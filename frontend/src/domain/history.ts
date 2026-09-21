import type { SensorSpec } from '../lib/types';
import type { DataSource } from '../lib/types';
import { SENSORS, SENSOR_BY_ID } from './sensors';
import { api } from '../lib/api';

/**
 * Riwayat panjang: lebih lama daripada yang muat di layar.
 *
 * Penyangga pemantauan langsung hanya memuat beberapa menit terakhir dan
 * hilang saat halaman disegarkan. Yang dijawab berkas ini adalah pertanyaan
 * yang justru dipakai mengambil keputusan — apakah lendutan bulan ini lebih
 * dalam daripada bulan lalu, berapa kali regangan menyentuh ambang sepanjang
 * musim hujan, apakah suhu dek naik bersama umur perkerasan.
 *
 * Dua sumber, satu bentuk keluaran:
 *
 *   mode API    dibaca dari `GET /bridges/:id/history?from&to`, yaitu cuplikan
 *               yang benar-benar tersimpan di disk server
 *   mode peraga dibangkitkan di peramban dari jam yang diminta
 *
 * Yang kedua **bukan data acak**. Ia model harian-mingguan yang ditentukan
 * sepenuhnya oleh jamnya: dua puncak lalu lintas tiap hari kerja, akhir pekan
 * lebih sepi, suhu dek mengikuti matahari, retak melebar perlahan sepanjang
 * bulan, dan sesekali ada kejadian beban berlebih. Memanggilnya dua kali untuk
 * rentang yang sama selalu menghasilkan angka yang sama, jadi grafik tidak
 * berubah tiap kali halaman dibuka — dan itu syarat supaya sebuah riwayat
 * dapat dipercaya, meskipun isinya data peraga.
 */

export interface HistoryPoint {
  /** Awal keranjang, epoch milidetik. */
  t: number;
  min: number;
  avg: number;
  max: number;
}

export interface HistorySeries {
  sensorId: string;
  name: string;
  unit: string;
  warn: number;
  crit: number;
  points: HistoryPoint[];
}

export interface HistoryResult {
  from: number;
  to: number;
  bucketMs: number;
  series: HistorySeries[];
  /** Dari mana angkanya datang; ditulis apa adanya di layar. */
  source: 'api' | 'peraga';
}

/** Pilihan rentang yang disediakan layar, beserta keranjangnya. */
export interface RangeOption {
  key: string;
  label: string;
  /** Panjang rentang dalam milidetik. */
  spanMs: number;
  /** Lebar keranjang; menentukan berapa titik yang digambar. */
  bucketMs: number;
  note: string;
}

const MENIT = 60_000;
const JAM = 3_600_000;
const HARI = 86_400_000;

export const RANGES: RangeOption[] = [
  { key: '24j', label: '24 jam', spanMs: 24 * JAM, bucketMs: 10 * MENIT, note: 'keranjang 10 menit' },
  { key: '7h', label: '7 hari', spanMs: 7 * HARI, bucketMs: JAM, note: 'keranjang 1 jam' },
  { key: '30h', label: '30 hari', spanMs: 30 * HARI, bucketMs: 6 * JAM, note: 'keranjang 6 jam' },
  { key: '90h', label: '90 hari', spanMs: 90 * HARI, bucketMs: 12 * JAM, note: 'keranjang 12 jam' },
];

// ----------------------------------------------------------- model peraga

/** Bilangan semu 0..1, tetap sama untuk masukan yang sama. */
function acak(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Derau yang berpindah mulus, bukan melompat tiap langkah. */
function derau(t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const halus = f * f * (3 - 2 * f);
  return acak(i) * (1 - halus) + acak(i + 1) * halus;
}

/**
 * Bentuk lalu lintas sepanjang hari, 0..1.
 *
 * Dua puncak — berangkat dan pulang kerja — dengan lembah dini hari, dan akhir
 * pekan yang lebih rendah serta lebih rata. Inilah yang menggerakkan hampir
 * seluruh kanal: regangan, lendutan, getaran, dan beban gandar semuanya
 * mengikuti berapa banyak kendaraan yang sedang di atas bentang.
 */
function bebanLaluLintas(ms: number): number {
  const d = new Date(ms);
  const jam = d.getHours() + d.getMinutes() / 60;
  const pagi = Math.exp(-((jam - 7) ** 2) / 3.2);
  const sore = Math.exp(-((jam - 17) ** 2) / 4.5);
  const dasar = 0.18 + 0.62 * Math.max(pagi, sore) + 0.2 * Math.exp(-((jam - 12) ** 2) / 18);
  const akhirPekan = d.getDay() === 0 || d.getDay() === 6 ? 0.62 : 1;
  const harian = 0.92 + 0.16 * derau(ms / HARI + 11);
  return Math.max(0.05, Math.min(1, dasar * akhirPekan * harian));
}

/** Suhu udara: puncak pukul dua siang, dengan perbedaan musim yang tipis. */
function suhuUdara(ms: number): number {
  const d = new Date(ms);
  const jam = d.getHours() + d.getMinutes() / 60;
  const harian = -Math.cos(((jam - 2) / 24) * Math.PI * 2) * 4.6;
  const musim = derau(ms / (30 * HARI) + 3) * 2.4;
  return 25.5 + harian + musim;
}

/**
 * Kejadian beban berlebih.
 *
 * Beberapa kali sebulan sebuah kendaraan melewati batas gandar, dan itulah
 * yang dicari orang ketika membuka riwayat sebulan. Kejadiannya ditentukan
 * oleh harinya, jadi tetap berada di tanggal yang sama tiap kali grafiknya
 * dibuka — riwayat yang kejadiannya berpindah-pindah tidak dapat dirujuk
 * dalam rapat.
 */
function bebanBerlebih(ms: number): number {
  const hari = Math.floor(ms / HARI);
  if (acak(hari * 7.3) > 0.12) return 0;
  const jamKejadian = 2 + Math.floor(acak(hari * 3.1) * 20);
  const d = new Date(ms);
  const jarak = Math.abs(d.getHours() + d.getMinutes() / 60 - jamKejadian);
  if (jarak > 1.5) return 0;
  return (1 - jarak / 1.5) * (0.55 + 0.45 * acak(hari * 5.9));
}

/** Nilai satu kanal pada satu saat — model, bukan bilangan acak. */
function nilaiPeraga(spec: SensorSpec, ms: number): number {
  const beban = bebanLaluLintas(ms);
  const lebih = bebanBerlebih(ms);
  const suhu = suhuUdara(ms);
  const halus = derau(ms / (2 * JAM) + spec.id.length * 17);

  switch (spec.id) {
    case 'temp':
      // Dek baja berwarna gelap: beberapa derajat di atas suhu udara saat
      // matahari tinggi, dan turun mengikuti udara selepas senja.
      return suhu + Math.max(0, (suhu - 26) * 1.15) + halus * 1.2;
    case 'wind': {
      const d = new Date(ms);
      const jam = d.getHours() + d.getMinutes() / 60;
      const angin = 9 + 9 * Math.max(0, Math.sin(((jam - 9) / 24) * Math.PI * 2));
      return angin * (0.7 + 0.8 * derau(ms / (3 * JAM) + 5));
    }
    case 'crack':
      /*
       * Retak tidak pulang.
       *
       * Ia satu-satunya kanal yang tidak kembali ke nilai kemarin: bukaannya
       * melebar perlahan sepanjang bulan dan hanya turun setelah ada
       * perbaikan. Digambar naik sekitar satu setengah persen sebulan, dengan
       * gerak harian yang sangat kecil — dan justru garis yang hampir datar
       * tetapi tidak pernah turun itulah yang harus terbaca pada tampilan
       * sembilan puluh hari.
       */
      return spec.base * (1 + ((ms - Date.now()) / (30 * HARI)) * 0.015 + 0.04 * halus) + lebih * 0.02;
    case 'vib':
      return spec.base * (0.55 + 0.85 * beban + 0.25 * halus) + lebih * spec.base * 0.9;
    case 'strain':
      // Regangan membawa dua hal sekaligus: beban lalu lintas dan pemuaian
      // panas. Tanpa suku suhunya, grafik siang hari tampak seolah lalu
      // lintasnya yang naik.
      return spec.base * (0.82 + 0.3 * beban + 0.08 * halus) + (suhu - 26) * 1.6 + lebih * 48;
    case 'defl':
      return spec.base * (0.78 + 0.34 * beban + 0.07 * halus) + lebih * 4.2;
    case 'tilt':
      return spec.base * (0.9 + 0.18 * beban + 0.12 * halus) + lebih * 0.012;
    case 'wim':
      return spec.base * (0.55 + 0.75 * beban + 0.2 * halus) + lebih * 14;
    default:
      return spec.base * (0.9 + 0.2 * halus);
  }
}

/**
 * Riwayat peraga satu rentang.
 *
 * Tiap keranjang diisi dari beberapa cuplikan di dalamnya, bukan dari satu
 * nilai di tengahnya — karena yang dicari pada tampilan sebulan justru nilai
 * **tertinggi** tiap keranjang, dan nilai tertinggi tidak dapat disimpulkan
 * dari rata-rata.
 */
function riwayatPeraga(
  from: number,
  to: number,
  bucketMs: number,
  specs: SensorSpec[],
): HistorySeries[] {
  const awal = Math.floor(from / bucketMs) * bucketMs;
  const cuplikanPerKeranjang = Math.min(12, Math.max(4, Math.round(bucketMs / (10 * MENIT))));

  return specs.map((spec) => {
    const points: HistoryPoint[] = [];
    for (let t = awal; t <= to; t += bucketMs) {
      let min = Infinity;
      let max = -Infinity;
      let jumlah = 0;
      for (let i = 0; i < cuplikanPerKeranjang; i++) {
        const saat = t + (bucketMs * (i + 0.5)) / cuplikanPerKeranjang;
        const nilai = Math.max(0, nilaiPeraga(spec, saat));
        min = Math.min(min, nilai);
        max = Math.max(max, nilai);
        jumlah += nilai;
      }
      const bulat = (n: number) => Number(n.toFixed(spec.dec + 2));
      points.push({
        t,
        min: bulat(min),
        avg: bulat(jumlah / cuplikanPerKeranjang),
        max: bulat(max),
      });
    }
    return {
      sensorId: spec.id,
      name: spec.name,
      unit: spec.unit,
      warn: spec.warn,
      crit: spec.crit,
      points,
    };
  });
}

// --------------------------------------------------------------- pemuatan

export interface LoadOptions {
  bridgeId: string;
  from: number;
  to: number;
  bucketMs: number;
  source: DataSource;
  sensorIds?: string[];
}

/**
 * Muat riwayat, dari server bila ada, dari model peraga bila tidak.
 *
 * Server yang baru dinyalakan belum menyimpan apa-apa, dan grafik kosong
 * sepanjang tiga puluh hari tidak memberi tahu apa pun tentang jembatannya —
 * ia hanya memberi tahu bahwa servernya masih muda. Karena itu jawaban yang
 * kosong pun dijatuhkan ke model peraga, dan layar menyebutkan yang mana yang
 * sedang ditampilkan.
 */
export async function muatRiwayat(opts: LoadOptions): Promise<HistoryResult> {
  const specs = (opts.sensorIds ? opts.sensorIds.map((id) => SENSOR_BY_ID[id]) : SENSORS).filter(
    Boolean,
  ) as SensorSpec[];

  if (opts.source === 'api') {
    try {
      const data = await api.getHistoryRange(opts.bridgeId, {
        from: opts.from,
        to: opts.to,
        bucket: opts.bucketMs,
        sensors: opts.sensorIds,
      });
      const terisi = data.series.some((s) => s.points.length > 1);
      if (terisi) {
        return {
          from: data.from,
          to: data.to,
          bucketMs: data.bucketMs,
          series: data.series,
          source: 'api',
        };
      }
    } catch {
      /* server tidak menjawab; model peraga di bawah yang menjawab */
    }
  }

  return {
    from: opts.from,
    to: opts.to,
    bucketMs: opts.bucketMs,
    series: riwayatPeraga(opts.from, opts.to, opts.bucketMs, specs),
    source: 'peraga',
  };
}

/** Ringkasan satu deret: terendah, rata-rata, tertinggi, dan pelanggaran ambang. */
export function ringkas(series: HistorySeries) {
  if (series.points.length === 0) {
    return { min: 0, avg: 0, max: 0, lewatWaspada: 0, lewatKritis: 0 };
  }
  const min = Math.min(...series.points.map((p) => p.min));
  const max = Math.max(...series.points.map((p) => p.max));
  const avg = series.points.reduce((s, p) => s + p.avg, 0) / series.points.length;
  return {
    min,
    avg,
    max,
    lewatWaspada: series.points.filter((p) => p.max >= series.warn && p.max < series.crit).length,
    lewatKritis: series.points.filter((p) => p.max >= series.crit).length,
  };
}
