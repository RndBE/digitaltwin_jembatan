import type { SensorSpec } from '../lib/types';
import { SENSORS, SENSOR_BY_ID } from './sensors';

/**
 * Ambang batas yang dapat diubah operator.
 *
 * Nilai bawaannya ada di `sensors.ts` dan digandakan dari katalog sensor di
 * sisi API. Yang disimpan di sini hanya *selisihnya*: kanal yang tidak pernah
 * disentuh tidak ikut tertulis, sehingga ambang bawaan yang kelak diperbaiki
 * di katalog tetap sampai ke pengguna lama alih-alih tertimpa salinan usang
 * yang menumpang di peramban mereka.
 *
 * Perubahannya ditulis langsung ke objek `SensorSpec` yang sama — mesin
 * simulasi membaca `warn` dan `crit` pada tiap langkah, jadi ambang baru
 * berlaku pada cuplikan berikutnya tanpa memuat ulang halaman. Yang tidak ikut
 * berubah adalah ambang di sisi server: pada mode API status tiap pembacaan
 * dihitung di sana, dan setelan ini hanya mengubah apa yang dinilai peramban
 * ini. Halaman Tingkat siaga menyatakan batas itu apa adanya.
 */

export interface Ambang {
  warn: number;
  crit: number;
}

const KUNCI = 'jdt.ambang';

/** Ambang bawaan, disalin sebelum apa pun sempat mengubahnya. */
export const AMBANG_BAWAAN: Record<string, Ambang> = Object.fromEntries(
  SENSORS.map((s) => [s.id, { warn: s.warn, crit: s.crit }]),
);

let versi = 0;
const pendengar = new Set<() => void>();

function umumkan(): void {
  versi += 1;
  pendengar.forEach((f) => f());
}

/** Untuk `useSyncExternalStore`: berlangganan dan membaca nomor versinya. */
export function langganAmbang(f: () => void): () => void {
  pendengar.add(f);
  return () => {
    pendengar.delete(f);
  };
}

export function versiAmbang(): number {
  return versi;
}

function bacaSimpanan(): Record<string, Ambang> {
  try {
    const mentah = localStorage.getItem(KUNCI);
    if (!mentah) return {};
    const isi = JSON.parse(mentah) as Record<string, Partial<Ambang>>;
    const hasil: Record<string, Ambang> = {};
    Object.entries(isi ?? {}).forEach(([id, nilai]) => {
      if (!SENSOR_BY_ID[id]) return;
      const warn = Number(nilai?.warn);
      const crit = Number(nilai?.crit);
      if (sahih(warn, crit) === null) hasil[id] = { warn, crit };
    });
    return hasil;
  } catch {
    // Penyimpanan dapat dilarang, atau isinya rusak. Ambang bawaan tetap benar.
    return {};
  }
}

function tulisSimpanan(isi: Record<string, Ambang>): void {
  try {
    if (Object.keys(isi).length === 0) localStorage.removeItem(KUNCI);
    else localStorage.setItem(KUNCI, JSON.stringify(isi));
  } catch {
    /* diabaikan: setelan hanya bertahan selama halaman terbuka */
  }
}

/**
 * Alasan sepasang ambang ditolak, atau `null` bila sah.
 *
 * Batas waspada yang berada di atas batas kritis bukan sekadar aneh: kanal
 * seperti itu tidak akan pernah berstatus waspada, ia melompat dari aman ke
 * kritis. Karena itu ditolak, bukan diterima lalu diurutkan diam-diam.
 */
export function sahih(warn: number, crit: number): string | null {
  if (!Number.isFinite(warn) || !Number.isFinite(crit)) return 'Kedua ambang harus berupa angka.';
  if (warn <= 0 || crit <= 0) return 'Ambang harus lebih besar dari nol.';
  if (warn >= crit) return 'Ambang waspada harus lebih kecil daripada ambang kritis.';
  return null;
}

/** Ambang yang sedang berlaku untuk sebuah kanal. */
export function ambangKini(id: string): Ambang {
  const spec = SENSOR_BY_ID[id];
  return spec ? { warn: spec.warn, crit: spec.crit } : { warn: 0, crit: 0 };
}

export function diubah(id: string): boolean {
  const bawaan = AMBANG_BAWAAN[id];
  const kini = ambangKini(id);
  return !bawaan || bawaan.warn !== kini.warn || bawaan.crit !== kini.crit;
}

export function jumlahDiubah(): number {
  return SENSORS.filter((s) => diubah(s.id)).length;
}

function terapkan(spec: SensorSpec, ambang: Ambang): void {
  spec.warn = ambang.warn;
  spec.crit = ambang.crit;
}

/**
 * Pasang ambang baru untuk satu kanal.
 *
 * Mengembalikan alasan penolakan bila nilainya tidak masuk akal, `null` bila
 * berhasil — pemanggilnya menampilkan alasan itu di sebelah isian yang salah.
 */
export function setAmbang(id: string, ambang: Ambang): string | null {
  const spec = SENSOR_BY_ID[id];
  if (!spec) return 'Kanal tidak dikenal.';
  const alasan = sahih(ambang.warn, ambang.crit);
  if (alasan) return alasan;

  terapkan(spec, ambang);

  const simpanan = bacaSimpanan();
  const bawaan = AMBANG_BAWAAN[id];
  if (bawaan && bawaan.warn === ambang.warn && bawaan.crit === ambang.crit) delete simpanan[id];
  else simpanan[id] = ambang;
  tulisSimpanan(simpanan);

  umumkan();
  return null;
}

/** Kembalikan satu kanal — atau seluruhnya, bila `id` tidak disebut — ke bawaan. */
export function resetAmbang(id?: string): void {
  const daftar = id ? [id] : SENSORS.map((s) => s.id);
  const simpanan = bacaSimpanan();

  daftar.forEach((kanal) => {
    const spec = SENSOR_BY_ID[kanal];
    const bawaan = AMBANG_BAWAAN[kanal];
    if (!spec || !bawaan) return;
    terapkan(spec, bawaan);
    delete simpanan[kanal];
  });

  tulisSimpanan(simpanan);
  umumkan();
}

/**
 * Pasang kembali ambang yang tersimpan. Dipanggil sekali saat aplikasi dimuat,
 * sebelum mesin simulasi dibangun, supaya cuplikan pertama pun sudah dinilai
 * dengan ambang yang dipakai penggunanya.
 */
export function pulihkanAmbang(): void {
  const simpanan = bacaSimpanan();
  Object.entries(simpanan).forEach(([id, ambang]) => {
    const spec = SENSOR_BY_ID[id];
    if (spec) terapkan(spec, ambang);
  });
  if (Object.keys(simpanan).length) umumkan();
}
