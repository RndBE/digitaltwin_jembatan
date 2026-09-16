import type { Bridge, Reading, Telemetry } from '../lib/types';
import { SENSORS, SENSOR_BY_ID, statusOf } from './sensors';
import { ONSET_RATE, SCENARIOS } from './scenarios';
import { assess } from './risk';

/**
 * Mesin simulasi yang berjalan di peramban.
 *
 * Nilai tiap kanal dibentuk dari empat suku yang dapat dijelaskan terpisah:
 *
 *   1. nilai dasar kanal
 *   2. pengali skenario, didekati bertahap dengan laju yang ditentukan
 *      `onset` — struktur tidak berpindah kondisi seketika, dan beban truk
 *      datang jauh lebih cepat daripada retak lelah tumbuh
 *   3. riak deterministik — jumlah dua sinus dengan beda frekuensi
 *   4. penuaan struktur dan faktor lingkungan per jembatan
 *
 * Di atas itu ada **sisa kerusakan**: pengali yang tertinggal setelah skenario
 * keluarga `kerusakan` dihentikan. Lendutan akibat truk hilang bersama truknya,
 * tetapi retak tidak menutup sendiri — sisa itu hanya hilang lewat
 * `recordRepair()`, yang mewakili pekerjaan perbaikan yang benar-benar
 * dilakukan di lapangan.
 *
 * Yang keluar dari mesin ini bukan cuplikan sesaat, melainkan **rerata satu
 * menit**. Riak dan derau membuat nilai sesaat melompat beberapa persen dari
 * satu cuplikan ke cuplikan berikutnya, dan angka yang berloncatan tidak dapat
 * dibaca — juga tidak berarti apa-apa, karena yang menentukan kondisi struktur
 * adalah tingkat yang bertahan, bukan satu puncak. Alat ukur lapangan bekerja
 * dengan cara yang sama: yang dikirim adalah rerata satu selang, bukan bacaan
 * sesaat. `meanWindow` menyatakan berapa cuplikan mentah yang menyusun satu
 * nilai tampil, dan `resetMeanWindow()` mengosongkannya ketika keadaan
 * berpindah, supaya rerata tidak menahan angka lama setelah skenario berubah.
 */

export const HISTORY_LENGTH = 180;

/** Panjang jendela rerata dalam detik; satuan `t` pada mesin ini adalah detik. */
export const MEAN_WINDOW_SECONDS = 60;

/** Cuplikan yang dirata-ratakan untuk mengisi riwayat awal. */
const SEED_SAMPLES = 8;

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

export interface SimEvent {
  at: string;
  sensorId: string | null;
  level: 'AMAN' | 'WASPADA' | 'KRITIS';
  text: string;
}

function ripple(base: number, t: number, multiplier: number): number {
  const stressed = multiplier > 1.5 ? 2 : 1;
  return Math.sin(t * 0.9 + base) * 0.05 + Math.sin(t * 2.3 + base * 3) * 0.03 * stressed;
}

const noise = () => (Math.random() - 0.5) * 0.1;

export class LocalSimulation {
  readonly bridge: Bridge;

  private t = 0;
  private startedAt = 0;
  private degradation = 0;
  private environmental: number;

  scenario = 'idle';
  paused = false;
  packets = 0;

  private multiplier: Record<string, number> = {};
  /** Sisa kerusakan yang belum diperbaiki, dikunci ke kanal. */
  private residual: Record<string, number> = {};
  /** Elemen struktur yang masih ditandai rusak, walau skenarionya dihentikan. */
  private damagedParts: string[] = [];

  /** Riwayat nilai tampil — tiap butir sudah berupa rerata, bukan cuplikan. */
  series: Record<string, number[]> = {};
  baseline: Record<string, number[]> = {};
  /** Cuplikan mentah yang belum dirata-ratakan. */
  private window: Record<string, number[]> = {};
  private windowBaseline: Record<string, number[]> = {};
  /** Banyak cuplikan mentah yang menyusun satu nilai tampil. */
  meanWindow = 12;
  private lastStatus: Record<string, string> = {};
  private lastEventAt: Record<string, number> = {};

  constructor(bridge: Bridge) {
    this.bridge = bridge;
    this.environmental = bridge.environmentalBias ?? 0;

    SENSORS.forEach((s) => {
      this.multiplier[s.id] = 1;
      this.window[s.id] = [];
      this.windowBaseline[s.id] = [];
      this.series[s.id] = [];
      this.baseline[s.id] = [];
      for (let i = 0; i < HISTORY_LENGTH; i++) {
        this.series[s.id].push(this.seed(s.base, i * 0.2));
        this.baseline[s.id].push(this.seed(s.base, i * 0.2 + 7));
      }
      // Jendela diisi sejak awal, supaya nilai pertama yang tampil sudah berupa
      // rerata dan bukan satu cuplikan tunggal yang kebetulan tinggi. Isinya
      // tersebar sepanjang satu menit, sama seperti jendela yang berjalan.
      const spacing = MEAN_WINDOW_SECONDS / this.meanWindow;
      for (let i = 0; i < this.meanWindow; i++) {
        this.window[s.id].push(this.sample(s.base, 1, i * spacing));
        this.windowBaseline[s.id].push(this.sample(s.base, 1, i * spacing + 7));
      }
      this.lastStatus[s.id] = statusOf(s, this.series[s.id][HISTORY_LENGTH - 1]);
    });
  }

  private sample(base: number, multiplier: number, t: number): number {
    const aging = this.degradation * 0.00004 + this.environmental * 0.01;
    return base * multiplier * (1 + ripple(base, t, multiplier) + noise() + aging);
  }

  /**
   * Riwayat awal dibangkitkan dengan perataan yang sama seperti data berjalan:
   * cuplikannya tersebar sepanjang satu menit, bukan berdempetan di satu titik,
   * sehingga riak ikut terataakan persis seperti pada data yang berjalan.
   */
  private seed(base: number, t: number): number {
    const values = [];
    const spacing = MEAN_WINDOW_SECONDS / SEED_SAMPLES;
    for (let i = 0; i < SEED_SAMPLES; i++) values.push(this.sample(base, 1, t + i * spacing));
    return average(values);
  }

  /**
   * Kosongkan jendela rerata.
   *
   * Dipanggil saat keadaan berpindah: rerata satu menit yang masih memuat
   * cuplikan dari keadaan sebelumnya akan menahan angka lama, dan struktur
   * yang baru saja dibebani akan terbaca seolah belum berubah.
   */
  resetMeanWindow(): void {
    SENSORS.forEach((s) => {
      this.window[s.id] = [];
      this.windowBaseline[s.id] = [];
    });
  }

  setScenario(key: string): void {
    const scenario = SCENARIOS[key];
    if (!scenario) return;
    this.scenario = key;
    this.paused = false;
    this.startedAt = this.t;
    this.resetMeanWindow();

    // Kerusakan yang dijalankan menitipkan sisanya sekarang, bukan saat
    // dihentikan: begitu skenario berjalan, kerusakan itu sudah terjadi.
    if (scenario.residual) {
      Object.entries(scenario.residual).forEach(([id, value]) => {
        this.residual[id] = Math.max(this.residual[id] ?? 1, value);
      });
    }
    if (scenario.damaged) {
      const merged = new Set([...this.damagedParts, ...scenario.damaged]);
      // Elemen yang ditandai skenario yang dapat pulih tidak ikut disimpan —
      // hanya kerusakan yang meninggalkan bekas.
      this.damagedParts = scenario.reversible ? scenario.damaged : [...merged];
    } else if (this.scenario === 'idle') {
      this.damagedParts = this.hasResidual() ? this.damagedParts : [];
    }
  }

  /** Catat bahwa perbaikan telah dilakukan: seluruh sisa kerusakan dibersihkan. */
  recordRepair(): void {
    this.residual = {};
    this.damagedParts = [];
    this.resetMeanWindow();
  }

  hasResidual(): boolean {
    return Object.keys(this.residual).length > 0;
  }

  /**
   * Apakah seluruh kanal sudah sampai di sasarannya.
   *
   * Dipakai untuk memilih laju pengambilan sampel: pemantauan pada kondisi
   * tenang tidak perlu lima cuplikan per detik, tetapi struktur yang sedang
   * bergerak menuju kondisi baru — termasuk yang sedang pulih setelah sebuah
   * skenario dihentikan — harus tetap diikuti rapat.
   */
  isSettled(): boolean {
    const scenario = SCENARIOS[this.scenario];
    return SENSORS.every((s) => {
      const target = Math.max(scenario.mult[s.id] ?? 1, this.residual[s.id] ?? 1);
      return Math.abs(this.multiplier[s.id] - target) < 0.01;
    });
  }

  residualChannels(): Record<string, number> {
    return { ...this.residual };
  }

  setPaused(paused?: boolean): boolean {
    this.paused = typeof paused === 'boolean' ? paused : !this.paused;
    return this.paused;
  }

  /**
   * Memajukan simulasi satu nilai tampil.
   *
   * `samples` adalah banyak cuplikan mentah yang diambil untuk nilai itu. Pada
   * pemantauan langsung cuplikan datang satu per satu dan reratanya bergulir
   * di atas satu menit terakhir; pada pemantauan rutin seluruh cuplikan satu
   * menit diambil sekaligus, sekali tiap menit.
   *
   * `step` adalah jarak waktu antar cuplikan dalam detik, dan harus mengikuti
   * jarak sungguhannya: satu menit yang diwakili dua belas cuplikan berarti
   * tiap cuplikan berjarak lima detik. Kalau jarak ini diabaikan, riak yang
   * berperiode tujuh detik hanya terpotong sebagian di tiap rerata dan sisanya
   * muncul kembali sebagai gelombang lambat pada angka yang tampil.
   *
   * Mengembalikan peristiwa perpindahan status.
   */
  tick(samples = 1, step = 0.2): SimEvent[] {
    if (this.paused) return [];

    const scenario = SCENARIOS[this.scenario];
    const rate = ONSET_RATE[scenario.onset];
    const events: SimEvent[] = [];

    for (let i = 0; i < samples; i++) {
      this.t += step;
      this.packets += 1;
      this.degradation += 0.05;

      SENSORS.forEach((s) => {
        // Sisa kerusakan menjadi lantai: skenario lain boleh menaikkan kanal di
        // atasnya, tetapi tidak boleh menurunkannya di bawah kerusakan yang ada.
        const target = Math.max(scenario.mult[s.id] ?? 1, this.residual[s.id] ?? 1);
        this.multiplier[s.id] += (target - this.multiplier[s.id]) * rate;

        const raw = this.window[s.id];
        raw.push(this.sample(s.base, this.multiplier[s.id], this.t));
        if (raw.length > this.meanWindow) raw.splice(0, raw.length - this.meanWindow);

        // Garis dasar berjalan seiring: nilai yang akan terbaca kanal ini
        // seandainya struktur tetap pada kondisi layan normal.
        const rawBaseline = this.windowBaseline[s.id];
        rawBaseline.push(this.sample(s.base, 1, this.t + 7));
        if (rawBaseline.length > this.meanWindow) {
          rawBaseline.splice(0, rawBaseline.length - this.meanWindow);
        }
      });
    }

    SENSORS.forEach((s) => {
      const value = average(this.window[s.id]);
      const series = this.series[s.id];
      series.push(value);
      if (series.length > HISTORY_LENGTH) series.shift();

      const baselineSeries = this.baseline[s.id];
      baselineSeries.push(average(this.windowBaseline[s.id]));
      if (baselineSeries.length > HISTORY_LENGTH) baselineSeries.shift();

      const status = statusOf(s, value);
      const previous = this.lastStatus[s.id];
      // Jeda 4 satuan waktu supaya nilai yang berosilasi tepat di ambang tidak
      // membanjiri log dengan peristiwa yang sama berulang kali.
      if (previous && previous !== status && this.t - (this.lastEventAt[s.id] ?? -9) > 4) {
        this.lastEventAt[s.id] = this.t;
        events.push({
          at: new Date().toISOString(),
          sensorId: s.id,
          level: status,
          text:
            status === 'AMAN'
              ? `${s.name} back inside its safe range (${value.toFixed(s.dec)} ${s.unit})`
              : `${s.name} crossed its ${status === 'KRITIS' ? 'critical' : 'warning'} threshold · ${value.toFixed(s.dec)} ${s.unit} at ${s.node}`,
        });
      }
      this.lastStatus[s.id] = status;
    });

    return events;
  }

  readings(): Reading[] {
    return SENSORS.map((s) => {
      const series = this.series[s.id];
      const value = series[series.length - 1];
      const baselineSeries = this.baseline[s.id];
      const baseline = baselineSeries[baselineSeries.length - 1];
      return {
        id: s.id,
        name: s.name,
        unit: s.unit,
        node: s.node,
        value: Number(value.toFixed(s.dec)),
        baseline: Number(baseline.toFixed(s.dec)),
        warn: s.warn,
        crit: s.crit,
        status: statusOf(s, value),
        deltaPct: Number((((value - baseline) / baseline) * 100).toFixed(1)),
      };
    });
  }

  snapshot(): Telemetry {
    const scenario = SCENARIOS[this.scenario];
    const readings = this.readings();
    return {
      bridgeId: this.bridge.id,
      residual: this.residualChannels(),
      at: new Date().toISOString(),
      scenario: scenario.key,
      scenarioName: scenario.name,
      paused: this.paused,
      runtimeSeconds: Number((this.t - this.startedAt).toFixed(1)),
      packets: this.packets,
      readings,
      traffic: { cars: scenario.cars, trucks: scenario.trucks, speedFactor: scenario.speed },
      damagedParts: scenario.damaged ?? this.damagedParts,
      assessment: assess(readings),
    };
  }

  history(sensorId: string) {
    const sensor = SENSOR_BY_ID[sensorId];
    if (!sensor) return null;
    return {
      sensorId,
      name: sensor.name,
      unit: sensor.unit,
      warn: sensor.warn,
      crit: sensor.crit,
      values: [...this.series[sensorId]],
      baseline: [...this.baseline[sensorId]],
    };
  }
}
