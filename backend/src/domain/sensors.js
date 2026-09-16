/**
 * Definisi kanal sensor untuk sebuah jembatan rangka baja.
 *
 * `base`  — nilai tipikal pada kondisi layan normal
 * `warn`  — ambang waspada
 * `crit`  — ambang kritis
 * `weight`— bobot kanal dalam perhitungan skor risiko (lihat domain/risk.js)
 * `node`  — lokasi fisik titik ukur pada struktur
 * `spot`  — id titik pada model 3D tempat sensor dipasang
 */
const SENSORS = [
  { id: 'vib', name: 'Getaran', unit: 'm/s²', base: 0.12, warn: 0.25, crit: 0.4, dec: 3, weight: 0.22, node: 'Tengah bentang, rangka atas', spot: 'vib' },
  { id: 'strain', name: 'Regangan', unit: 'µε', base: 85, warn: 140, crit: 190, dec: 0, weight: 0.24, node: 'Batang bawah tengah', spot: 'strain' },
  { id: 'defl', name: 'Lendutan', unit: 'mm', base: 8, warn: 12, crit: 16, dec: 1, weight: 0.22, node: 'Tengah bentang, lantai', spot: 'defl' },
  { id: 'tilt', name: 'Kemiringan', unit: '°', base: 0.04, warn: 0.08, crit: 0.12, dec: 3, weight: 0.12, node: 'Tumpuan timur', spot: 'tilt' },
  { id: 'temp', name: 'Suhu', unit: '°C', base: 31, warn: 45, crit: 55, dec: 1, weight: 0.02, node: 'Batang atas, sisi selatan', spot: 'temp' },
  { id: 'wim', name: 'Beban kendaraan', unit: 't', base: 12, warn: 20, crit: 30, dec: 1, weight: 0.06, node: 'WIM pendekat barat', spot: 'wim' },
  { id: 'crack', name: 'Retak', unit: 'mm', base: 0.1, warn: 0.2, crit: 0.35, dec: 2, weight: 0.1, node: 'Sambungan gelagar G-6', spot: 'crack' },
  { id: 'wind', name: 'Angin', unit: 'km/j', base: 14, warn: 40, crit: 60, dec: 0, weight: 0.02, node: 'Anemometer pilar', spot: 'wind' },
];

const SENSOR_BY_ID = Object.fromEntries(SENSORS.map((s) => [s.id, s]));

/** Kanal yang ikut menentukan indeks kesehatan struktur. */
const STRUCTURAL_IDS = ['vib', 'strain', 'defl', 'tilt', 'crack'];

const statusOf = (sensor, value) =>
  value >= sensor.crit ? 'KRITIS' : value >= sensor.warn ? 'WASPADA' : 'AMAN';

/** Rasio pemanfaatan kanal terhadap ambang kritisnya, dibatasi 0..1,2. */
const utilisation = (sensor, value) => Math.min(1.2, value / sensor.crit);

/**
 * Kelebihan nilai di atas kondisi layan normal, dinormalkan terhadap sisa
 * jarak menuju ambang kritis: 0 saat kanal berada di nilai dasarnya, 1 saat
 * menyentuh ambang kritis.
 *
 * Ini yang dipakai untuk menilai kondisi, bukan rasio terhadap ambang kritis.
 * Pada kondisi layan normal lendutan sudah berada di setengah ambang kritisnya,
 * sehingga rasio mentah akan melaporkan struktur sehat sebagai setengah rusak.
 */
const excessRatio = (sensor, value) => {
  const span = sensor.crit - sensor.base;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (value - sensor.base) / span));
};

module.exports = { SENSORS, SENSOR_BY_ID, STRUCTURAL_IDS, statusOf, utilisation, excessRatio };
