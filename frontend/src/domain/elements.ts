import type { Reading } from '../lib/types';
import { SENSOR_BY_ID, excessRatio } from './sensors';
import {
  conditionStatus,
  driver,
  elementScore,
  rollUp,
  scoreBreakdown,
  type ConditionStatus,
  type RawCondition,
} from './condition';

/**
 * Katalog elemen struktur.
 *
 * Daftarnya tidak dikarang: tiap elemen menunjuk **kelompok bagian yang sudah
 * ada di model 3D** (`PART_GROUPS` di `three/proceduralBridge.ts`) dan **kanal
 * sensor yang mengukurnya**. Itulah tautan yang mengubah "grafik regangan"
 * menjadi "kondisi batang tepi bawah" — tanpa tautan itu, yang ada hanya
 * dasbor sensor dengan gambar tiga dimensi di sebelahnya, dua hal yang tidak
 * saling tahu.
 *
 * Perinciannya mengikuti cara elemen jembatan dinilai di lapangan, bukan cara
 * model membaginya: pemeriksa menilai "batang tepi bawah sisi utara", bukan
 * "batang bc3z0".
 */

export interface ElementSpec {
  id: string;
  name: string;
  /** Kelompok bagian pada model 3D; dipakai menyorotnya dari halaman ini. */
  group: string;
  /** Bagian struktur, untuk pengelompokan di layar. */
  system: 'Lantai' | 'Rangka utama' | 'Sambungan & ikatan' | 'Tumpuan' | 'Perlengkapan';
  /** Kanal sensor yang mengukur elemen ini; kosong berarti tidak tersensor. */
  channel?: string;
  /** Letaknya, untuk dicocokkan dengan catatan lapangan. */
  location: string;
}

/**
 * Nilai inspeksi visual dan uji diagnostik per elemen.
 *
 * **Data contoh**, tetapi bukan angka acak: seluruhnya diturunkan dari catatan
 * inspeksi yang sudah ada di `demoData.ts`, supaya skor yang muncul dapat
 * ditelusuri ke kalimat temuannya —
 *
 *   "Korosi ringan pada pelat buhul panel 4–6 sisi selatan"        → BUH
 *   "Bukaan retak gelagar G-6 terukur 0,12 mm, belum melewati …"   → BUH, IKT
 *   "Bantalan tumpuan timur menunjukkan deformasi 3 mm, dipantau"  → TMP-T
 *   "Gerusan pada pilar sisi kanan sedalam 0,8 m, ditangani …"     → TMP-B
 *
 * Besarnya pun tidak dikira-kira: rata-rata seluruh nilai `visual` di bawah
 * jatuh di sekitar 0,64, yang dibalik dan dikalikan lima menghasilkan nilai
 * kondisi **2 dari 5** — persis nilai kondisi jembatan ini pada berkas asetnya.
 * Dua bagian data contoh yang saling bertentangan lebih buruk daripada satu
 * pun tidak ada.
 *
 * Di sistem sungguhan keduanya datang dari tempat lain: `visual` dari nilai
 * kondisi BMS 0–5 tiap temuan inspeksi, dibalik dan dinormalkan ke 0..1;
 * `diagnostic` dari hasil uji tak-merusak terakhir. Selama form inspeksi belum
 * mencatat temuan **per elemen**, keduanya tetap data contoh — dan halaman
 * yang menampilkannya menyatakan itu apa adanya.
 */
const SURVEYED: Record<string, { visual: number; diagnostic: number }> = {
  'LNT-1': { visual: 0.68, diagnostic: 0.72 },
  'LNT-2': { visual: 0.64, diagnostic: 0.7 },
  'LNT-3': { visual: 0.62, diagnostic: 0.7 },
  'LNT-4': { visual: 0.67, diagnostic: 0.72 },
  'RB-U': { visual: 0.7, diagnostic: 0.76 },
  'RB-S': { visual: 0.6, diagnostic: 0.74 },
  'RA-U': { visual: 0.74, diagnostic: 0.78 },
  'RA-S': { visual: 0.68, diagnostic: 0.76 },
  DIA: { visual: 0.66, diagnostic: 0.74 },
  VER: { visual: 0.72, diagnostic: 0.77 },
  IKT: { visual: 0.55, diagnostic: 0.68 },
  BUH: { visual: 0.45, diagnostic: 0.66 },
  'TMP-B': { visual: 0.63, diagnostic: 0.58 },
  'TMP-T': { visual: 0.52, diagnostic: 0.56 },
  SDR: { visual: 0.75, diagnostic: 0.8 },
};

export const ELEMENTS: ElementSpec[] = [
  { id: 'LNT-1', name: 'Lantai seperempat barat', group: 'lantai', system: 'Lantai', channel: 'defl', location: 'x −60 … −30 m dari tengah bentang' },
  { id: 'LNT-2', name: 'Lantai tengah barat', group: 'lantai', system: 'Lantai', channel: 'defl', location: 'x −30 … 0 m' },
  { id: 'LNT-3', name: 'Lantai tengah timur', group: 'lantai', system: 'Lantai', channel: 'defl', location: 'x 0 … +30 m' },
  { id: 'LNT-4', name: 'Lantai seperempat timur', group: 'lantai', system: 'Lantai', channel: 'defl', location: 'x +30 … +60 m' },

  { id: 'RB-U', name: 'Batang tepi bawah utara', group: 'bawah', system: 'Rangka utama', channel: 'strain', location: 'Rangka sisi utara, seluruh bentang' },
  { id: 'RB-S', name: 'Batang tepi bawah selatan', group: 'bawah', system: 'Rangka utama', channel: 'strain', location: 'Rangka sisi selatan, seluruh bentang' },
  { id: 'RA-U', name: 'Batang tepi atas utara', group: 'atas', system: 'Rangka utama', channel: 'vib', location: 'Rangka sisi utara, seluruh bentang' },
  { id: 'RA-S', name: 'Batang tepi atas selatan', group: 'atas', system: 'Rangka utama', channel: 'vib', location: 'Rangka sisi selatan, seluruh bentang' },
  { id: 'DIA', name: 'Batang diagonal', group: 'diagonal', system: 'Rangka utama', channel: 'strain', location: 'Sepuluh panel, kedua rangka' },
  { id: 'VER', name: 'Batang vertikal', group: 'vertikal', system: 'Rangka utama', channel: 'strain', location: 'Buhul 0–10, kedua rangka' },

  { id: 'IKT', name: 'Gelagar melintang & ikatan angin', group: 'bracing', system: 'Sambungan & ikatan', channel: 'vib', location: 'Bidang lantai; ikatan angin atas tidak digambar pada model' },
  { id: 'BUH', name: 'Pelat buhul & sambungan', group: 'bawah', system: 'Sambungan & ikatan', channel: 'crack', location: 'Empat puluh empat buhul, kedua rangka' },

  { id: 'TMP-B', name: 'Tumpuan barat', group: 'tumpuan', system: 'Tumpuan', channel: 'tilt', location: 'Abutmen barat, dua bantalan' },
  { id: 'TMP-T', name: 'Tumpuan timur', group: 'tumpuan', system: 'Tumpuan', channel: 'tilt', location: 'Abutmen timur, dua bantalan' },

  { id: 'SDR', name: 'Sandaran, kerb & perlengkapan', group: 'lantai', system: 'Perlengkapan', location: 'Kedua sisi, seluruh bentang' },
];

export interface ScoredElement extends ElementSpec {
  raw: RawCondition;
  score: number;
  status: ConditionStatus;
  breakdown: ReturnType<typeof scoreBreakdown>;
  /** Nilai kanal yang dipakai suku sensornya, bila elemennya tersensor. */
  reading?: Reading;
}

/**
 * Suku sensor sebuah elemen, 0..1, atau `null` bila elemennya tidak tersensor.
 *
 * `excessRatio` menyatakan seberapa jauh kanal naik di atas kondisi layan
 * normalnya menuju ambang kritis; dibalik, ia menjadi "seberapa baik kanal itu
 * pada cuplikan terakhir".
 *
 * Yang tidak tersensor mengembalikan `null`, bukan angka pengganti. Angka
 * pengganti apa pun akan ikut ditimbang dengan bobot 1,0 — bobot terbesar —
 * dan elemen yang kebetulan tidak dipasangi alat jadi dinilai terutama oleh
 * tebakan. `null` membuat bobotnya keluar dari penyebut: elemen itu dinilai
 * oleh inspeksi dan uji diagnostik saja, apa adanya.
 */
function sensorTerm(spec: ElementSpec, readings: Reading[]): number | null {
  if (!spec.channel) return null;
  const sensor = SENSOR_BY_ID[spec.channel];
  const reading = readings.find((r) => r.id === spec.channel);
  if (!sensor || !reading) return null;
  return Math.max(0, Math.min(1, 1 - excessRatio(sensor, reading.value)));
}

/** Seluruh elemen beserta skornya pada cuplikan telemetri tertentu. */
export function scoreElements(readings: Reading[]): ScoredElement[] {
  return ELEMENTS.map((spec) => {
    const survey = SURVEYED[spec.id] ?? { visual: 0.85, diagnostic: 0.85 };
    const raw: RawCondition = {
      sensor: sensorTerm(spec, readings),
      visual: survey.visual,
      diagnostic: survey.diagnostic,
    };
    const score = elementScore(raw);
    return {
      ...spec,
      raw,
      score,
      status: conditionStatus(score),
      breakdown: scoreBreakdown(raw),
      reading: spec.channel ? readings.find((r) => r.id === spec.channel) : undefined,
    };
  });
}

export interface BridgeCondition {
  elements: ScoredElement[];
  /** Elemen yang ikut menentukan indeks — yang memikul beban saja. */
  structural: ScoredElement[];
  /** Indeks kondisi jembatan 0..1, minimum berbobot — bukan rata-rata. */
  index: number;
  /** Rata-rata polos, ditampilkan sebagai pembanding supaya selisihnya terlihat. */
  mean: number;
  /** Elemen yang menarik turun indeksnya. */
  driver: ScoredElement | null;
}

/**
 * Perlengkapan tidak ikut menentukan indeks kondisi **struktur**.
 *
 * Sandaran dan kerb tidak memikul beban: sandaran yang penyok tetap harus
 * diperbaiki, tetapi ia tidak menentukan apakah jembatannya boleh dilewati.
 * Ia juga satu-satunya elemen tanpa sensor, jadi skornya disusun dari dua
 * sumber sementara yang lain dari tiga — dibandingkan langsung, keduanya tidak
 * berbicara tentang hal yang sama. Elemennya tetap ada di daftar beserta
 * skornya; yang tidak dilakukan hanyalah membiarkannya menarik turun indeks
 * struktur.
 */
const NON_STRUCTURAL: Array<ElementSpec['system']> = ['Perlengkapan'];

export function bridgeCondition(readings: Reading[]): BridgeCondition {
  const elements = scoreElements(readings);
  const structural = elements.filter((e) => !NON_STRUCTURAL.includes(e.system));
  const scores = structural.map((e) => e.score);
  return {
    elements,
    structural,
    index: rollUp(scores),
    mean: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1,
    driver: driver(structural),
  };
}
