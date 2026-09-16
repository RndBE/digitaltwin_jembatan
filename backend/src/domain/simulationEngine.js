/**
 * Mesin simulasi telemetri jembatan.
 *
 * Nilai tiap kanal dibentuk dari empat suku yang dapat dijelaskan secara terpisah:
 *
 *   1. nilai dasar kanal (`sensor.base`)
 *   2. pengali skenario, didekati secara bertahap agar transisi tidak melompat
 *   3. riak deterministik — jumlah dua sinus dengan beda frekuensi, memberi
 *      bentuk gelombang yang berulang namun tidak periodik secara kasat mata
 *   4. penuaan struktur (`degradation`) dan faktor lingkungan per jembatan,
 *      yang menaikkan garis dasar secara sangat perlahan
 *
 * Suku 1–3 mengikuti pendekatan model peraga kembaran digital jembatan; suku 4
 * mengikuti pendekatan trend + degradation pada Smart-Bridge-Digital-Twin-Dashboard.
 *
 * Yang dikeluarkan bukan cuplikan sesaat melainkan rerata satu menit, sama
 * seperti alat ukur lapangan: riak dan derau membuat nilai sesaat melompat
 * beberapa persen antar cuplikan, dan yang menentukan kondisi struktur adalah
 * tingkat yang bertahan, bukan satu puncak.
 */
const { SENSORS, SENSOR_BY_ID, statusOf } = require('./sensors');
const { SCENARIOS, ONSET_RATE } = require('./scenarios');

const HISTORY = 180;

/** Satu menit pada laju cuplikan 200 ms. */
const MEAN_WINDOW = 300;

/** Cuplikan yang dirata-ratakan untuk mengisi riwayat awal. */
const SEED_SAMPLES = 8;

const average = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

/** Riak deterministik, amplitudonya membesar saat kanal sedang dibebani skenario. */
function ripple(sensor, t, multiplier) {
  const phase = sensor.base;
  const stressed = multiplier > 1.5 ? 2 : 1;
  return Math.sin(t * 0.9 + phase) * 0.05 + Math.sin(t * 2.3 + phase * 3) * 0.03 * stressed;
}

/** Derau pengukuran kecil, dibatasi ±5 %. */
function noise() {
  return (Math.random() - 0.5) * 0.1;
}

class BridgeSimulation {
  constructor(bridge) {
    this.bridge = bridge;
    this.t = 0;
    this.scenario = 'idle';
    this.paused = false;
    this.packets = 0;
    this.startedAt = 0;

    // Penuaan struktur kumulatif dan karakter lingkungan tiap jembatan.
    this.degradation = 0;
    this.environmental = (bridge.environmentalBias ?? 0);

    /** @type {Record<string, number>} pengali skenario aktual (didekati bertahap) */
    this.multiplier = {};
    /**
     * Sisa kerusakan yang belum diperbaiki, dikunci ke kanal.
     *
     * Lendutan akibat truk hilang bersama truknya; retak tidak menutup sendiri.
     * Sisa ini hanya dibersihkan lewat `recordRepair()`, yang mewakili pekerjaan
     * perbaikan yang benar-benar dilakukan di lapangan.
     */
    this.residual = {};
    /** @type {string[]} elemen yang masih ditandai rusak walau skenarionya berhenti */
    this.damagedParts = [];
    /** @type {Record<string, number[]>} riwayat nilai tampil; tiap butir sudah berupa rerata */
    this.series = {};
    /** @type {Record<string, number[]>} riwayat garis dasar (acuan pembanding) */
    this.baseline = {};
    /** @type {Record<string, number[]>} cuplikan mentah yang belum dirata-ratakan */
    this.window = {};
    this.windowBaseline = {};
    /** @type {Record<string, string>} status terakhir, untuk mendeteksi perpindahan status */
    this.lastStatus = {};
    this.lastEventAt = {};

    SENSORS.forEach((s) => {
      this.multiplier[s.id] = 1;
      this.series[s.id] = [];
      this.baseline[s.id] = [];
      this.window[s.id] = [];
      this.windowBaseline[s.id] = [];
      for (let i = 0; i < HISTORY; i++) {
        this.series[s.id].push(this.seed(s, i * 0.2));
        this.baseline[s.id].push(this.seed(s, i * 0.2 + 7));
      }
      // Jendela diisi sejak awal, supaya nilai pertama yang keluar sudah berupa
      // rerata dan bukan satu cuplikan tunggal yang kebetulan tinggi.
      for (let i = 0; i < MEAN_WINDOW; i++) {
        this.window[s.id].push(this.sample(s, 1, i * 0.2));
        this.windowBaseline[s.id].push(this.sample(s, 1, i * 0.2 + 7));
      }
      this.lastStatus[s.id] = statusOf(s, this.series[s.id][HISTORY - 1]);
    });
  }

  sample(sensor, multiplier, t) {
    const aging = this.degradation * 0.00004 + this.environmental * 0.01;
    return sensor.base * multiplier * (1 + ripple(sensor, t, multiplier) + noise() + aging);
  }

  /**
   * Riwayat awal dibangkitkan dengan perataan yang sama seperti data berjalan:
   * cuplikannya tersebar sepanjang satu menit, bukan berdempetan di satu titik,
   * sehingga riak ikut terataakan persis seperti pada data yang berjalan.
   */
  seed(sensor, t) {
    const values = [];
    const spacing = (MEAN_WINDOW * 0.2) / SEED_SAMPLES;
    for (let i = 0; i < SEED_SAMPLES; i++) values.push(this.sample(sensor, 1, t + i * spacing));
    return average(values);
  }

  /**
   * Kosongkan jendela rerata.
   *
   * Dipanggil saat keadaan berpindah: rerata satu menit yang masih memuat
   * cuplikan dari keadaan sebelumnya akan menahan angka lama, dan struktur yang
   * baru saja dibebani akan terbaca seolah belum berubah.
   */
  resetMeanWindow() {
    SENSORS.forEach((s) => {
      this.window[s.id] = [];
      this.windowBaseline[s.id] = [];
    });
  }

  setScenario(key) {
    const scenario = SCENARIOS[key];
    if (!scenario) return false;
    this.scenario = key;
    this.paused = false;
    this.startedAt = this.t;
    this.resetMeanWindow();

    // Kerusakan menitipkan sisanya sekarang, bukan saat dihentikan: begitu
    // skenario berjalan, kerusakan itu sudah terjadi.
    if (scenario.residual) {
      Object.entries(scenario.residual).forEach(([id, value]) => {
        this.residual[id] = Math.max(this.residual[id] ?? 1, value);
      });
    }
    if (scenario.damaged) {
      this.damagedParts = scenario.reversible
        ? scenario.damaged
        : [...new Set([...this.damagedParts, ...scenario.damaged])];
    }
    return true;
  }

  /** Catat bahwa perbaikan telah dilakukan: seluruh sisa kerusakan dibersihkan. */
  recordRepair() {
    this.residual = {};
    this.damagedParts = [];
    this.resetMeanWindow();
    return true;
  }

  setPaused(paused) {
    this.paused = typeof paused === 'boolean' ? paused : !this.paused;
    return this.paused;
  }

  /**
   * Memajukan simulasi satu cuplikan, lalu menerbitkan rerata satu menit
   * terakhir sebagai nilai tampil. Mengembalikan daftar peristiwa baru.
   */
  tick() {
    if (this.paused) return [];
    this.t += 0.2;
    this.packets += 1;
    this.degradation += 0.05;

    const scenario = SCENARIOS[this.scenario];
    const rate = ONSET_RATE[scenario.onset];
    const events = [];

    SENSORS.forEach((s) => {
      // Sisa kerusakan menjadi lantai: skenario lain boleh menaikkan kanal di
      // atasnya, tetapi tidak boleh menurunkannya di bawah kerusakan yang ada.
      const target = Math.max(scenario.mult[s.id] ?? 1, this.residual[s.id] ?? 1);
      // Pendekatan eksponensial dengan laju sesuai `onset`: beban truk datang
      // dalam hitungan detik, retak lelah tumbuh jauh lebih lambat.
      this.multiplier[s.id] += (target - this.multiplier[s.id]) * rate;

      const raw = this.window[s.id];
      raw.push(this.sample(s, this.multiplier[s.id], this.t));
      if (raw.length > MEAN_WINDOW) raw.splice(0, raw.length - MEAN_WINDOW);

      // Garis dasar berjalan seiring: nilai yang akan terbaca kanal ini
      // seandainya struktur tetap pada kondisi layan normal.
      const rawBaseline = this.windowBaseline[s.id];
      rawBaseline.push(this.sample(s, 1, this.t + 7));
      if (rawBaseline.length > MEAN_WINDOW) {
        rawBaseline.splice(0, rawBaseline.length - MEAN_WINDOW);
      }

      const value = average(raw);
      const series = this.series[s.id];
      series.push(value);
      if (series.length > HISTORY) series.shift();

      const baselineSeries = this.baseline[s.id];
      baselineSeries.push(average(rawBaseline));
      if (baselineSeries.length > HISTORY) baselineSeries.shift();

      const status = statusOf(s, value);
      const previous = this.lastStatus[s.id];
      // Jeda 4 satuan waktu agar nilai yang berosilasi di sekitar ambang
      // tidak membanjiri log dengan peristiwa yang sama.
      if (previous && previous !== status && this.t - (this.lastEventAt[s.id] ?? -9) > 4) {
        this.lastEventAt[s.id] = this.t;
        events.push({
          at: new Date().toISOString(),
          sensorId: s.id,
          level: status,
          text:
            status === 'AMAN'
              ? `${s.name} kembali ke rentang aman (${value.toFixed(s.dec)} ${s.unit})`
              : `${s.name} melewati ambang ${status.toLowerCase()} · ${value.toFixed(s.dec)} ${s.unit} di ${s.node}`,
        });
      }
      this.lastStatus[s.id] = status;
    });

    return events;
  }

  /** Cuplikan terkini seluruh kanal. */
  snapshot() {
    const scenario = SCENARIOS[this.scenario];
    const readings = SENSORS.map((s) => {
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

    return {
      bridgeId: this.bridge.id,
      residual: { ...this.residual },
      at: new Date().toISOString(),
      scenario: scenario.key,
      scenarioName: scenario.name,
      paused: this.paused,
      runtimeSeconds: Number((this.t - this.startedAt).toFixed(1)),
      packets: this.packets,
      readings,
      traffic: {
        cars: scenario.cars,
        trucks: scenario.trucks,
        speedFactor: scenario.speed,
      },
      damagedParts: scenario.damaged ?? this.damagedParts,
    };
  }

  /** Deret waktu penuh satu kanal, beserta garis dasarnya. */
  history(sensorId) {
    const sensor = SENSOR_BY_ID[sensorId];
    if (!sensor) return null;
    return {
      sensorId,
      name: sensor.name,
      unit: sensor.unit,
      warn: sensor.warn,
      crit: sensor.crit,
      values: this.series[sensorId].map((v) => Number(v.toFixed(sensor.dec + 2))),
      baseline: this.baseline[sensorId].map((v) => Number(v.toFixed(sensor.dec + 2))),
    };
  }
}

module.exports = { BridgeSimulation, HISTORY };
