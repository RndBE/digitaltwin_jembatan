import type { Camera } from './demoData';
import { dossierFor } from './demoData';
import type { Reading, Status } from '../lib/types';

/**
 * Sambungan antara kanal sensor dan kamera yang mengawasi tempatnya.
 *
 * Sensor menjawab *berapa*, kamera menjawab *seperti apa*. Selama keduanya
 * berada di halaman yang berbeda, orang yang melihat kemiringan melewati
 * ambang harus membuka halaman lain, mencari kamera mana yang menghadap
 * tumpuan timur, lalu mencocokkan sendiri jamnya — tiga langkah yang seluruhnya
 * dikerjakan dari ingatan, dan tiga tempat kekeliruan masuk. Berkas ini yang
 * mengerjakan pencocokan itu sekali, di satu tempat.
 *
 * Urutan pemilihannya sengaja bertingkat:
 *
 *   1. Kamera yang **memang ditugaskan** ke kanal itu (`Camera.channel`).
 *      Itu keterangan pemasangan, bukan tebakan, jadi ia menang atas apa pun.
 *   2. Kamera **daring** yang menghadap bagian yang sama. Sensor lendutan ada
 *      di tengah bentang, dan kamera bentang mana pun memperlihatkan tempat
 *      itu.
 *   3. Kamera yang menghadap bagian yang sama **walau sedang terganggu atau
 *      luring**. Ubin yang menyatakan "kamera ini sedang mati" jauh lebih
 *      berguna daripada ruang kosong: yang pertama memberi tahu ada mata yang
 *      perlu diperbaiki, yang kedua tidak memberi tahu apa-apa.
 */

/** Bagian jembatan yang dilihat tiap kanal; sejajar dengan `Camera.view`. */
const VIEW_OF_SENSOR: Record<string, Camera['view']> = {
  vib: 'bentang',
  strain: 'bentang',
  defl: 'bentang',
  crack: 'bentang',
  temp: 'bentang',
  tilt: 'tumpuan',
  wim: 'oprit',
  wind: 'oprit',
};

export function cameraForSensor(bridgeId: string, sensorId: string): Camera | null {
  const cameras = dossierFor(bridgeId)?.cameras ?? [];
  const ditugaskan = cameras.find((c) => c.channel === sensorId);
  if (ditugaskan) return ditugaskan;

  const view = VIEW_OF_SENSOR[sensorId];
  if (!view) return null;
  return (
    cameras.find((c) => c.view === view && c.status === 'daring') ??
    cameras.find((c) => c.view === view) ??
    null
  );
}

/**
 * Kotak sorot pada bingkai kamera, dalam satuan `viewBox` 320 × 180 milik
 * ubin kamera.
 *
 * Tanpa kotak ini perbandingan dua bingkai menyisakan satu pertanyaan yang
 * tidak terjawab: *bagian mana yang harus dilihat*. Gambar kamera memuat
 * jalan, langit, tebing, dan kendaraan; sensor hanya mengukur satu petak
 * kecil di antaranya, dan petak itulah yang pantas diberi bingkai.
 */
export const SENSOR_FOCUS: Record<string, { x: number; y: number; w: number; h: number }> = {
  vib: { x: 108, y: 58, w: 104, h: 40 },
  strain: { x: 104, y: 112, w: 112, h: 34 },
  defl: { x: 88, y: 104, w: 144, h: 40 },
  crack: { x: 132, y: 104, w: 56, h: 40 },
  temp: { x: 116, y: 52, w: 88, h: 30 },
  tilt: { x: 104, y: 62, w: 112, h: 58 },
  wim: { x: 116, y: 128, w: 92, h: 40 },
  wind: { x: 196, y: 44, w: 60, h: 48 },
};

/**
 * Isyarat kerusakan yang digambar pada bingkai "sekarang".
 *
 * Dua bingkai yang digambar dari kode yang sama tidak akan berbeda sedikit
 * pun, dan perbandingan yang keduanya sama persis lebih buruk daripada tidak
 * ada perbandingan: ia membuat orang menyimpulkan tidak ada yang berubah,
 * padahal yang terjadi hanyalah gambarnya tidak tahu apa-apa. Jadi ketika
 * kanalnya keluar rentang, bingkai kanan menggambar bentuk kerusakan yang
 * memang dilaporkan kanal itu — retak yang menganga, tumpukan yang miring,
 * lantai yang melendut, dasar yang tergerus.
 *
 * Pada sistem sungguhan isyarat ini tidak digambar: bingkai kanan adalah
 * cuplikan siaran, dan bingkai kirinya cuplikan tersimpan dari saat kanal itu
 * terakhir berstatus AMAN.
 */
export type DamageCue = 'retak' | 'miring' | 'lendut' | 'gerusan' | 'beban';

export function cueForSensor(sensorId: string, status: Status, flood: number): DamageCue | null {
  if (flood > 0.4 && (sensorId === 'tilt' || sensorId === 'defl')) return 'gerusan';
  if (status === 'AMAN') return null;
  if (sensorId === 'crack') return 'retak';
  if (sensorId === 'tilt') return 'miring';
  if (sensorId === 'defl' || sensorId === 'strain') return 'lendut';
  if (sensorId === 'wim') return 'beban';
  return null;
}

/**
 * Nilai acuan sebuah kanal: rerata deret pembanding yang direkam saat
 * skenario acuan berjalan.
 *
 * Bukan nilai dasar katalog. Nilai dasar adalah angka rancangan; yang dipakai
 * membandingkan haruslah angka yang benar-benar terukur pada jembatan ini
 * ketika seluruh kanalnya aman — itulah yang direkam halaman Perbandingan,
 * dan itu pula yang pantas berdiri di sebelah angka hari ini.
 */
export function referenceValue(baseline: number[] | undefined, fallback: number): number {
  if (!baseline || baseline.length === 0) return fallback;
  const ekor = baseline.slice(-20);
  return ekor.reduce((sum, v) => sum + v, 0) / ekor.length;
}

/** Selisih terhadap acuan, dalam persen; `null` bila acuannya nol. */
export function deltaPercent(now: number, reference: number): number | null {
  if (reference === 0) return null;
  return ((now - reference) / reference) * 100;
}

/** Ringkasan satu kanal untuk panel perbandingan. */
export interface SensorComparison {
  reading: Reading;
  reference: number;
  delta: number | null;
  cue: DamageCue | null;
  camera: Camera | null;
}
