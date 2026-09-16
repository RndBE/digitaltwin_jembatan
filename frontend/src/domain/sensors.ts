import type { Reading, SensorSpec, Status } from '../lib/types';

/**
 * Kanal sensor pada jembatan rangka baja. Nilai ambang mengikuti definisi yang
 * sama dengan API (`backend/src/domain/sensors.js`), sehingga antarmuka
 * menampilkan angka yang konsisten baik saat tersambung API maupun saat
 * mesin simulasi berjalan di peramban.
 */
export const SENSORS: SensorSpec[] = [
  { id: 'vib', name: 'Getaran', unit: 'm/s²', base: 0.12, warn: 0.25, crit: 0.4, dec: 3, weight: 0.22, node: 'Tengah bentang, rangka atas' },
  { id: 'strain', name: 'Regangan', unit: 'µε', base: 85, warn: 140, crit: 190, dec: 0, weight: 0.24, node: 'Batang bawah tengah' },
  { id: 'defl', name: 'Lendutan', unit: 'mm', base: 8, warn: 12, crit: 16, dec: 1, weight: 0.22, node: 'Tengah bentang, lantai' },
  { id: 'tilt', name: 'Kemiringan', unit: '°', base: 0.04, warn: 0.08, crit: 0.12, dec: 3, weight: 0.12, node: 'Tumpuan timur' },
  { id: 'temp', name: 'Suhu', unit: '°C', base: 31, warn: 45, crit: 55, dec: 1, weight: 0.02, node: 'Batang atas, sisi selatan' },
  { id: 'wim', name: 'Beban kendaraan', unit: 't', base: 12, warn: 20, crit: 30, dec: 1, weight: 0.06, node: 'WIM pendekat barat' },
  { id: 'crack', name: 'Retak', unit: 'mm', base: 0.1, warn: 0.2, crit: 0.35, dec: 2, weight: 0.1, node: 'Sambungan gelagar G-6' },
  { id: 'wind', name: 'Angin', unit: 'km/j', base: 14, warn: 40, crit: 60, dec: 0, weight: 0.02, node: 'Anemometer, tiang oprit timur' },
];

export const SENSOR_BY_ID: Record<string, SensorSpec> = Object.fromEntries(
  SENSORS.map((s) => [s.id, s]),
);

/** Kanal yang ikut menentukan indeks kesehatan struktur. */
export const STRUCTURAL_IDS = ['vib', 'strain', 'defl', 'tilt', 'crack'];

/**
 * Titik pemasangan tiap sensor pada model prosedural, dalam satuan adegan.
 *
 * Ujung runcing penanda jatuh persis di koordinat ini, jadi koordinatnya harus
 * berada di permukaan elemen yang disebut kolom `node`, bukan menggantung di
 * dekatnya. Acuan geometri model (lihat `three/proceduralBridge.ts`):
 *
 *   bentang    x −6 … 6, buhul tiap 1,2 satuan
 *   rangka     z ±2,2 · batang bawah y 0 (sisi atas 0,05) · batang atas y 1,7
 *              (sisi atas 1,75)
 *   lantai     permukaan aspal y 0,12 · kerb y 0,22 di z ±1,8 · lajur z ±0,85
 *   tumpuan    sisi atas y −0,15 di x ±6, z ±2,2
 *   oprit      permukaan y 0,12, menerus dari x ±5,94 sejauh 17 satuan
 *   tiang angin  puncak y 2,58 di x 9,4, z 2,5
 *
 * Penanda dijauhkan dari sumbu lajur supaya tidak terus-menerus ditimpa
 * kendaraan yang lewat.
 */
export const SENSOR_SPOTS: Record<string, [number, number, number]> = {
  vib: [0, 1.75, -2.2], // batang atas, tengah bentang
  temp: [1.2, 1.75, 2.2], // batang atas sisi selatan, satu buhul dari tengah
  defl: [0, 0.22, -1.8], // kerb tengah bentang — di lantai, di luar lajur
  strain: [0, 0.05, 2.2], // batang bawah, tengah bentang
  crack: [1.2, 0.05, 2.28], // buhul ke-6, pada pelat sambungan
  tilt: [6, -0.15, 2.2], // sisi atas bantalan tumpuan timur
  wim: [-7.2, 0.12, -1.45], // perkerasan oprit barat, tepi lajur arah masuk
  wind: [9.4, 2.62, 2.5], // puncak tiang kantong angin
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

export const worstStatus = (readings: Reading[]): Status =>
  readings.some((r) => r.status === 'KRITIS')
    ? 'KRITIS'
    : readings.some((r) => r.status === 'WASPADA')
      ? 'WASPADA'
      : 'AMAN';
