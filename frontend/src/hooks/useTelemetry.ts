import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AlertEvent, Bridge, DataSource, Telemetry } from '../lib/types';
import { LocalSimulation, HISTORY_LENGTH } from '../domain/simulationEngine';
import { SENSORS } from '../domain/sensors';
import { REFERENCE_SCENARIOS, SCENARIOS } from '../domain/scenarios';
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
      text: `Monitoring system active · ${bridge.sensorCount} sensors online, in sync with the model`,
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
    seriesRef.current = Object.fromEntries(
      SENSORS.map((s) => [s.id, { values: [...sim.series[s.id]], baseline: [...sim.baseline[s.id]] }]),
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
    snapshot.readings.forEach((reading) => {
      const entry = seriesRef.current[reading.id];
      if (entry) {
        entry.values.push(reading.value);
        entry.baseline.push(reading.baseline);
        if (entry.values.length > HISTORY_LENGTH) entry.values.shift();
        if (entry.baseline.length > HISTORY_LENGTH) entry.baseline.shift();
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

      const quiet = sim.scenario === 'idle' && sim.isSettled();
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
          setControlError('Server unreachable · switching to the local simulation engine');
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
              ? 'Scenario stopped · back to live monitoring'
              : `Scenario "${SCENARIOS[key].name}" started`,
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
        setControlError(`${err.message} · scenario run on the local engine`);
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
      setControlError(`${err.message} · control handed to the local engine`);
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
          text: 'Repair recorded · residual damage cleared, structure back to service condition',
        },
        ...prev,
      ].slice(0, MAX_ALERTS),
    );
    setTelemetry(sim.snapshot());
    setWake((n) => n + 1);
  }, []);

  const series = useMemo(() => ({ ...seriesRef.current }), [seriesTick]);
  const reference = useMemo(() => ({ ...referenceRef.current }), [seriesTick]);

  const scenario = telemetry?.scenario ?? 'idle';

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
    setScenario,
    stopScenario,
    togglePause,
    recordRepair,
  };
}
