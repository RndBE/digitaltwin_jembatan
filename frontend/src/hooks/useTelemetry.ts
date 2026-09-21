import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AlertEvent, Bridge, DataSource, Status, Telemetry } from '../lib/types';
import { activeRule } from '../domain/alertRules';
import { langganAmbang, versiAmbang } from '../domain/thresholds';
import { LocalSimulation, HISTORY_LENGTH } from '../domain/simulationEngine';
import { SENSORS } from '../domain/sensors';
import { DEFAULT_SCENARIO, REFERENCE_SCENARIOS, SCENARIOS } from '../domain/scenarios';
import { api } from '../lib/api';

/**
 * Sumber tunggal data telemetri untuk seluruh halaman.
 *
 * Dua mode:
 *   - `api`   — menarik cuplikan dari server Express setiap `POLL_MS`
 *   - `lokal` — menjalankan mesin simulasi di peramban setiap `TICK_MS`
 *
 * Deret waktu untuk bagan selalu dirawat di sisi klien: nilai baru ditambahkan
 * ke penyangga bergulir, sehingga bagan tetap mulus di kedua mode dan tidak
 * perlu menarik seluruh riwayat berulang kali.
 *
 * Ada dua penyangga, bukan satu. `series` selalu berisi kondisi terkini.
 * `reference` hanya menerima nilai selama jembatan berada pada kondisi
 * normal — begitu sebuah skenario dijalankan, penyangga itu berhenti terisi
 * dan menjadi rekaman "sebelum", yang dipakai halaman Perbandingan untuk
 * menjajarkan dua grafik dari struktur yang sama.
 */

/**
 * Laju pengambilan sampel.
 *
 * Pemantauan pada kondisi tenang tidak perlu lima cuplikan per detik — sebuah
 * jembatan yang sedang diam berubah dalam hitungan jam, dan menarik data secepat
 * itu hanya membakar jaringan tanpa menambah satu pun informasi. Begitu sebuah
 * skenario berjalan, atau struktur sedang bergerak menuju kondisi baru (termasuk
 * saat pulih setelah skenario dihentikan), laju naik ke pemantauan langsung.
 *
 * Yang berubah hanya *kapan* nilai baru muncul. Isi nilainya selalu sama
 * artinya: rerata satu menit. Pada pemantauan rutin satu menit itu diambil
 * sekaligus — dua belas cuplikan berjarak lima detik, sekali tiap menit. Pada
 * pemantauan langsung cuplikan datang tiap 200 ms dan reratanya bergulir di
 * atas tiga ratus cuplikan terakhir, yang juga tepat satu menit.
 */
const LIVE_TICK_MS = 200;
const IDLE_TICK_MS = 60_000;
const LIVE_POLL_MS = 500;
const IDLE_POLL_MS = 60_000;
const MAX_ALERTS = 40;

/** Satu menit rerata, dinyatakan dalam banyak cuplikan mentah. */
const MEAN_WINDOW_MS = 60_000;
const IDLE_SAMPLES = 12;
const LIVE_SAMPLES = Math.round(MEAN_WINDOW_MS / LIVE_TICK_MS);
/** Jarak antar cuplikan dalam detik, mengikuti laju masing-masing mode. */
const LIVE_STEP = LIVE_TICK_MS / 1000;
const IDLE_STEP = MEAN_WINDOW_MS / 1000 / IDLE_SAMPLES;

export interface Series {
  values: number[];
  baseline: number[];
  /**
   * Waktu tiap cuplikan dalam milidetik epoch, sejajar indeks dengan `values`.
   *
   * Bagan tidak memerlukannya — sumbu datarnya hanya urutan. Tabel data
   * memerlukannya: sebuah angka tanpa jam pengambilannya tidak dapat dicocokkan
   * dengan kejadian di lapangan, dan itulah satu-satunya alasan orang mengunduh
   * tabelnya.
   */
  times: number[];
}

export interface TelemetryController {
  telemetry: Telemetry | null;
  alerts: AlertEvent[];
  /** Deret kondisi terkini per kanal. */
  series: Record<string, Series>;
  /** Rekaman kondisi normal terakhir per kanal, dibekukan saat skenario berjalan. */
  reference: Record<string, number[]>;
  /** Apakah rekaman acuan sedang dibekukan (ada skenario berjalan). */
  referenceFrozen: boolean;
  source: DataSource;
  /** Jarak antar cuplikan yang sedang dipakai, dalam milidetik. */
  intervalMs: number;
  /** Kanal yang masih membawa sisa kerusakan. */
  residual: Record<string, number>;
  /** Pesan galat terakhir dari perintah kendali (mis. perlu masuk). */
  controlError: string | null;
  /**
   * Sejak kapan tingkat siaga yang sekarang berlaku, dalam waktu cuplikan.
   *
   * "Sejak kapan" sama pentingnya dengan "sekarang apa": kanal yang melewati
   * ambang dua menit lalu dan kanal yang melewatinya sejak kemarin sore
   * menuntut tindakan yang berbeda walau statusnya sama.
   */
  alertSince: string;
  setScenario: (key: string) => void;
  stopScenario: () => void;
  togglePause: () => void;
  /** Catat bahwa perbaikan sudah dilakukan; membersihkan sisa kerusakan. */
  recordRepair: () => void;
}

export function useTelemetry(bridge: Bridge, apiAvailable: boolean): TelemetryController {
  const [source, setSource] = useState<DataSource>(apiAvailable ? 'api' : 'lokal');
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  // Satu baris pembuka, supaya log tidak kosong sebelum ada kanal yang
  // berpindah status — pada mode API baris ini datang dari penyimpanan server.
  const [alerts, setAlerts] = useState<AlertEvent[]>(() => [
    {
      at: new Date().toISOString(),
      sensorId: null,
      level: 'AMAN',
      text: `Sistem pemantauan aktif · ${bridge.sensorCount} sensor daring, sinkron dengan model`,
    },
  ]);
  const [controlError, setControlError] = useState<string | null>(null);
  const [intervalMs, setIntervalMs] = useState(IDLE_TICK_MS);
  // Dinaikkan setiap kali ada perintah, supaya gelung sampel tidak perlu
  // menunggu sisa jeda satu menit sebelum menanggapi.
  const [wake, setWake] = useState(0);
  // Penanda perubahan penyangga deret; isi penyangga sendiri disimpan di ref
  // agar penambahan nilai tiap 200 ms tidak menyalin ulang seluruh riwayat.
  const [seriesTick, setSeriesTick] = useState(0);

  const simRef = useRef<LocalSimulation | null>(null);
  const seriesRef = useRef<Record<string, Series>>({});
  const referenceRef = useRef<Record<string, number[]>>({});

  // Satu simulasi per jembatan. Dipakai sebagai mesin utama pada mode lokal,
  // dan sebagai sumber nilai awal bagan pada mode API.
  if (!simRef.current || simRef.current.bridge.id !== bridge.id) {
    const sim = new LocalSimulation(bridge);
    simRef.current = sim;
    // Riwayat awal dibangkitkan sekaligus, tanpa jam pengambilan. Karena tiap
    // nilainya mewakili rerata satu menit, jamnya diisi mundur satu menit per
    // cuplikan — bukan tebakan, melainkan arti deret itu sendiri.
    const mulai = Date.now();
    seriesRef.current = Object.fromEntries(
      SENSORS.map((s) => {
        const values = [...sim.series[s.id]];
        return [
          s.id,
          {
            values,
            baseline: [...sim.baseline[s.id]],
            times: values.map((_, i) => mulai - (values.length - 1 - i) * MEAN_WINDOW_MS),
          },
        ];
      }),
    );
    referenceRef.current = Object.fromEntries(SENSORS.map((s) => [s.id, [...sim.series[s.id]]]));
  }

  useEffect(() => {
    setSource(apiAvailable ? 'api' : 'lokal');
  }, [apiAvailable, bridge.id]);

  // Model acuan tidak punya telemetri di server; menanyakannya hanya menghasilkan
  // 409. Paksa mesin lokal pada render yang sama, tanpa menunggu efek di atas.
  const effectiveSource: DataSource = bridge.reference ? 'lokal' : source;

  const pushSeries = useCallback((snapshot: Telemetry) => {
    const normal = REFERENCE_SCENARIOS.includes(snapshot.scenario);
    // Satu jam untuk seluruh kanal: cuplikannya memang satu paket, dan jam yang
    // dihitung ulang per kanal akan menggeser baris tabel yang sama beberapa
    // milidetik satu sama lain tanpa alasan.
    const waktu = Date.parse(snapshot.at) || Date.now();
    snapshot.readings.forEach((reading) => {
      const entry = seriesRef.current[reading.id];
      if (entry) {
        entry.values.push(reading.value);
        entry.baseline.push(reading.baseline);
        entry.times.push(waktu);
        if (entry.values.length > HISTORY_LENGTH) entry.values.shift();
        if (entry.baseline.length > HISTORY_LENGTH) entry.baseline.shift();
        if (entry.times.length > HISTORY_LENGTH) entry.times.shift();
      }
      // Rekaman acuan hanya tumbuh selama jembatan berada di kondisi normal.
      if (normal) {
        const window = referenceRef.current[reading.id];
        if (window) {
          window.push(reading.value);
          if (window.length > HISTORY_LENGTH) window.shift();
        }
      }
    });
    setSeriesTick((n) => n + 1);
  }, []);

  // --- mesin lokal ---------------------------------------------------------
  useEffect(() => {
    // Model acuan tidak punya sensor terpasang. Membangkitkan pembacaan untuknya
    // akan menghasilkan angka kesehatan yang tidak berarti apa-apa, jadi tidak
    // ada telemetri sama sekali — dan halaman yang membacanya menyatakan itu.
    if (bridge.reference) {
      setTelemetry(null);
      return;
    }
    if (effectiveSource !== 'lokal') return;
    const sim = simRef.current;
    if (!sim) return;

    setTelemetry(sim.snapshot());

    let stopped = false;
    let timer = 0;

    // Jeda berikutnya dipilih setelah tiap langkah, bukan sekali di awal,
    // sehingga laju mengikuti keadaan struktur tanpa memasang ulang efek.
    //
    // Banyak cuplikan mengikuti jeda yang baru saja berlalu, bukan jeda
    // berikutnya: satu menit yang lewat harus diwakili oleh cuplikan senilai
    // satu menit, berapa pun laju sesudahnya.
    let delay = LIVE_TICK_MS;

    const step = () => {
      if (stopped) return;
      const routine = delay >= IDLE_TICK_MS;
      sim.meanWindow = routine ? IDLE_SAMPLES : LIVE_SAMPLES;
      const events = sim.tick(routine ? IDLE_SAMPLES : 1, routine ? IDLE_STEP : LIVE_STEP);
      if (events.length) setAlerts((prev) => [...events, ...prev].slice(0, MAX_ALERTS));
      const snapshot = sim.snapshot();
      setTelemetry(snapshot);
      pushSeries(snapshot);

      /*
       * Laju rutin hanya berlaku pada struktur yang benar-benar tenang, dan
       * "tenang" tidak sama dengan "berhenti berubah".
       *
       * Sisa kerusakan membuat kanal mengendap di atas ambangnya: nilainya
       * tidak bergerak lagi, `isSettled()` berkata ya, dan sebelum ini laju
       * langsung turun ke satu cuplikan per menit — padahal tangga siaga masih
       * membaca WASPADA. Yang terjadi kemudian adalah kebalikan dari cara
       * pemantauan bekerja: struktur yang sudah melewati ambangnya justru
       * diawasi paling jarang, dan menit pertama setelah keadaannya memburuk
       * lagi akan hilang seluruhnya dari rekaman.
       *
       * Karena itu status ikut menentukan: selama vonisnya bukan AMAN,
       * cuplikan tetap datang tiap `LIVE_TICK_MS`, berapa pun tenangnya angka
       * itu terlihat.
       */
      const quiet =
        sim.scenario === 'idle' && sim.isSettled() && snapshot.assessment.status === 'AMAN';
      // Cuplikan rutin pertama diambil segera setelah struktur tenang, bukan
      // satu menit sesudahnya: nilai terakhir dari pemantauan langsung masih
      // memuat menit pemulihannya, dan menahannya selama itu membuat angka
      // pemulihan tertinggal di layar padahal strukturnya sudah kembali tenang.
      const entering = quiet && delay < IDLE_TICK_MS;
      delay = quiet ? IDLE_TICK_MS : LIVE_TICK_MS;
      setIntervalMs(delay);
      timer = window.setTimeout(step, entering ? LIVE_TICK_MS : delay);
    };

    timer = window.setTimeout(step, LIVE_TICK_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [effectiveSource, bridge.id, bridge.reference, wake, pushSeries]);

  // --- mode API ------------------------------------------------------------
  useEffect(() => {
    if (effectiveSource !== 'api') return;
    let cancelled = false;
    let failures = 0;

    let timer = 0;

    const poll = async () => {
      let delay = LIVE_POLL_MS;
      try {
        const snapshot = await api.getTelemetry(bridge.id);
        if (cancelled) return;
        failures = 0;
        setTelemetry(snapshot);
        pushSeries(snapshot);
        // Sama seperti mesin lokal: laju penuh hanya saat ada yang bergerak.
        delay = snapshot.scenario === 'idle' ? IDLE_POLL_MS : LIVE_POLL_MS;
        setIntervalMs(delay);
        const list = await api.getAlerts(bridge.id, MAX_ALERTS);
        if (!cancelled) setAlerts(list);
      } catch {
        failures += 1;
        // Tiga kegagalan berturut-turut: server dianggap tidak dapat dihubungi,
        // antarmuka berpindah ke mesin lokal daripada membeku.
        if (failures >= 3 && !cancelled) {
          setControlError('Server tidak dapat dihubungi · beralih ke mesin simulasi lokal');
          setSource('lokal');
          return;
        }
      }
      if (!cancelled) timer = window.setTimeout(poll, delay);
    };

    poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [effectiveSource, bridge.id, wake, pushSeries]);

  // --- kendali -------------------------------------------------------------
  const applyLocalScenario = useCallback((key: string) => {
    const sim = simRef.current;
    if (!sim) return;
    sim.setScenario(key);
    setAlerts((prev) =>
      [
        {
          at: new Date().toISOString(),
          sensorId: null,
          level: key === 'idle' ? ('AMAN' as const) : (SCENARIOS[key].expected as 'WASPADA' | 'KRITIS'),
          text:
            key === 'idle'
              ? 'Skenario dihentikan · kembali ke pemantauan langsung'
              : `Skenario "${SCENARIOS[key].name}" dijalankan`,
        },
        ...prev,
      ].slice(0, MAX_ALERTS),
    );
    setTelemetry(sim.snapshot());
    setWake((n) => n + 1);
  }, []);

  const setScenario = useCallback(
    (key: string) => {
      if (!SCENARIOS[key]) return;
      setControlError(null);
      if (effectiveSource === 'lokal') {
        applyLocalScenario(key);
        return;
      }
      setWake((n) => n + 1);
      api.setScenario(bridge.id, key).catch((err: Error) => {
        // Endpoint kendali memerlukan token. Jalankan skenario di mesin lokal
        // supaya pengguna tetap dapat melihat hasilnya, dan katakan alasannya.
        setControlError(`${err.message} · skenario dijalankan di mesin lokal`);
        setSource('lokal');
        applyLocalScenario(key);
      });
    },
    [effectiveSource, bridge.id, applyLocalScenario],
  );

  const stopScenario = useCallback(() => setScenario('idle'), [setScenario]);

  const togglePause = useCallback(() => {
    const sim = simRef.current;
    if (effectiveSource === 'lokal') {
      if (!sim) return;
      sim.setPaused();
      setTelemetry(sim.snapshot());
      return;
    }
    const next = !(telemetry?.paused ?? false);
    api.setPaused(bridge.id, next).catch((err: Error) => {
      setControlError(`${err.message} · kendali dipindahkan ke mesin lokal`);
      setSource('lokal');
      sim?.setPaused(next);
    });
  }, [effectiveSource, bridge.id, telemetry?.paused]);

  const recordRepair = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.recordRepair();
    sim.setScenario('idle');
    setAlerts((prev) =>
      [
        {
          at: new Date().toISOString(),
          sensorId: null,
          level: 'AMAN' as const,
          text: 'Perbaikan dicatat · sisa kerusakan dibersihkan, struktur kembali ke kondisi layan',
        },
        ...prev,
      ].slice(0, MAX_ALERTS),
    );
    setTelemetry(sim.snapshot());
    setWake((n) => n + 1);
  }, []);

  /*
   * Kapan tingkat siaga terakhir berpindah.
   *
   * Tingkatnya dihitung ulang dari pembacaan lewat aturan yang sama yang
   * ditampilkan halaman Tingkat siaga, bukan dibaca dari `assessment.status`:
   * ambang dapat diubah operator di peramban ini, dan jam perpindahan harus
   * mengikuti tingkat yang benar-benar sedang ditampilkan. Karena itu versi
   * ambang ikut menjadi pemicu — mengubah ambang memang memindahkan tingkat,
   * dan jam perpindahannya adalah saat itu juga.
   */
  const ambangVersi = useSyncExternalStore(langganAmbang, versiAmbang);
  const [alertSince, setAlertSince] = useState(() => new Date().toISOString());
  const alertLevelRef = useRef<Status>('AMAN');

  useEffect(() => {
    if (!telemetry) return;
    const level = activeRule(telemetry.readings).rule.level;
    if (level === alertLevelRef.current) return;
    alertLevelRef.current = level;
    setAlertSince(telemetry.at);
  }, [telemetry, ambangVersi]);

  const series = useMemo(() => ({ ...seriesRef.current }), [seriesTick]);
  const reference = useMemo(() => ({ ...referenceRef.current }), [seriesTick]);

  const scenario = telemetry?.scenario ?? DEFAULT_SCENARIO;

  return {
    telemetry,
    alerts,
    series,
    reference,
    referenceFrozen: !REFERENCE_SCENARIOS.includes(scenario),
    source: effectiveSource,
    intervalMs,
    residual: telemetry?.residual ?? {},
    controlError,
    alertSince,
    setScenario,
    stopScenario,
    togglePause,
    recordRepair,
  };
}
