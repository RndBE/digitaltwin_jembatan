import type { Reading, SensorSpec, Status } from '../lib/types';

/**
 * Kanal sensor pada jembatan rangka baja. Nilai ambang mengikuti definisi yang
 * sama dengan API (`backend/src/domain/sensors.js`), sehingga antarmuka
 * menampilkan angka yang konsisten baik saat tersambung API maupun saat
 * mesin simulasi berjalan di peramban.
 */
export const SENSORS: SensorSpec[] = [
  { id: 'vib', name: 'Vibration', unit: 'm/s²', base: 0.12, warn: 0.25, crit: 0.4, dec: 3, weight: 0.22, node: 'Mid-span, top chord' },
  { id: 'strain', name: 'Strain', unit: 'µε', base: 85, warn: 140, crit: 190, dec: 0, weight: 0.24, node: 'Bottom chord, mid-span' },
  { id: 'defl', name: 'Deflection', unit: 'mm', base: 8, warn: 12, crit: 16, dec: 1, weight: 0.22, node: 'Mid-span, deck' },
  { id: 'tilt', name: 'Tilt', unit: '°', base: 0.04, warn: 0.08, crit: 0.12, dec: 3, weight: 0.12, node: 'East bearing' },
  { id: 'temp', name: 'Temperature', unit: '°C', base: 31, warn: 45, crit: 55, dec: 1, weight: 0.02, node: 'Top chord, south side' },
  { id: 'wim', name: 'Vehicle load', unit: 't', base: 12, warn: 20, crit: 30, dec: 1, weight: 0.06, node: 'WIM, west approach' },
  { id: 'crack', name: 'Crack', unit: 'mm', base: 0.1, warn: 0.2, crit: 0.35, dec: 2, weight: 0.1, node: 'Girder G-6 joint' },
  { id: 'wind', name: 'Wind', unit: 'km/h', base: 14, warn: 40, crit: 60, dec: 0, weight: 0.02, node: 'Pier anemometer' },
];

export const SENSOR_BY_ID: Record<string, SensorSpec> = Object.fromEntries(
  SENSORS.map((s) => [s.id, s]),
);

/** Kanal yang ikut menentukan indeks kesehatan struktur. */
export const STRUCTURAL_IDS = ['vib', 'strain', 'defl', 'tilt', 'crack'];

/** Titik pemasangan tiap sensor pada model prosedural, dalam satuan adegan. */
export const SENSOR_SPOTS: Record<string, [number, number, number]> = {
  vib: [0, 1.84, -2.2],
  temp: [0, 1.84, 2.2],
  defl: [0, -0.24, 0],
  strain: [-2.4, -0.2, 2.2],
  crack: [1.2, -0.2, 2.32],
  tilt: [5.75, -0.5, 2.2],
  wim: [-5.5, 0.2, -0.85],
  wind: [3.6, 2.15, 2.2],
};

export const statusOf = (sensor: SensorSpec, value: number): Status =>
  value >= sensor.crit ? 'KRITIS' : value >= sensor.warn ? 'WASPADA' : 'AMAN';

/** Rasio pemanfaatan kanal terhadap ambang kritisnya, dibatasi 0..1,2. */
export const utilisation = (sensor: SensorSpec, value: number) =>
  Math.min(1.2, value / sensor.crit);

/**
 * Kelebihan nilai di atas kondisi layan normal, dinormalkan terhadap sisa
 * jarak menuju ambang kritis: 0 saat kanal berada di nilai dasarnya, 1 saat
 * menyentuh ambang kritis.
 *
 * Ini yang dipakai untuk menilai kondisi, bukan rasio terhadap ambang kritis.
 * Pada kondisi layan normal lendutan sudah berada di setengah ambang kritisnya,
 * sehingga rasio mentah akan melaporkan struktur sehat sebagai setengah rusak.
 */
export const excessRatio = (sensor: SensorSpec, value: number) => {
  const span = sensor.crit - sensor.base;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (value - sensor.base) / span));
};

export const formatValue = (sensor: SensorSpec, value: number) => value.toFixed(sensor.dec);

/** Kelas label yang dipakai tiap status. */
export const TAG_CLASS: Record<Status, string> = {
  AMAN: 'tag tag-normal',
  WASPADA: 'tag tag-waspada',
  KRITIS: 'tag tag-bahaya',
};

/** Warna garis bagan per status, diambil dari palet keadaan. */
export const STATUS_COLOR: Record<Status, string> = {
  AMAN: 'var(--state-normal)',
  WASPADA: 'var(--state-waspada)',
  KRITIS: 'var(--state-bahaya)',
};

/*
 * Nilai status tetap dalam bahasa Indonesia karena ia nilai domain yang dipakai
 * mesin simulasi, penilaian risiko, dan API — bukan teks tampilan. Yang dibaca
 * pengguna diterjemahkan lewat peta di bawah ini, jadi bahasa antarmuka dapat
 * berganti tanpa menyentuh satu pun cabang logika.
 */
export const STATUS_LABEL: Record<Status, string> = {
  AMAN: 'SAFE',
  WASPADA: 'WARNING',
  KRITIS: 'CRITICAL',
};

/** Tingkat risiko dan prioritas pemeliharaan memakai skala yang sama. */
export const LEVEL_LABEL: Record<string, string> = {
  RENDAH: 'LOW',
  SEDANG: 'MEDIUM',
  TINGGI: 'HIGH',
  KRITIS: 'CRITICAL',
};

export const worstStatus = (readings: Reading[]): Status =>
  readings.some((r) => r.status === 'KRITIS')
    ? 'KRITIS'
    : readings.some((r) => r.status === 'WASPADA')
      ? 'WASPADA'
      : 'AMAN';
