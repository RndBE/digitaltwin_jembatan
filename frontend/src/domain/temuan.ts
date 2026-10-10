import { petugas } from './alarms';
import type { Temuan } from './pedoman';

/**
 * Simpanan temuan pemeriksaan detail.
 *
 * Bentuknya sama dengan simpanan alarm: di peramban, per aset, dengan
 * `useSyncExternalStore` sebagai jalur berlangganan. Keterbatasannya pun sama
 * dan disadari — temuan yang dicatat di satu komputer tidak terlihat di
 * komputer lain dan hilang bila data peramban dibersihkan. Hari layanan
 * penyimpanan pindah ke server, modul inilah yang diganti; halaman hanya
 * memakai fungsi yang diekspor di sini.
 *
 * Yang disimpan hanya **masukan** pemeriksa. S, R, K, dan NK dihitung ulang
 * dari kriteria di `pedoman.ts` setiap kali dibaca, sehingga koreksi pada
 * kriteria langsung berlaku pada catatan lama dan tidak ada angka usang yang
 * tertinggal di penyimpanan.
 */

const KUNCI = 'jdt.temuan';

type Simpanan = Record<string, Temuan[]>;

let versi = 0;
const pendengar = new Set<() => void>();

function umumkan(): void {
  versi += 1;
  pendengar.forEach((f) => f());
}

export function langganTemuan(f: () => void): () => void {
  pendengar.add(f);
  return () => {
    pendengar.delete(f);
  };
}

export function versiTemuan(): number {
  return versi;
}

/**
 * Data contoh, supaya halaman tidak kosong pada pembukaan pertama.
 *
 * Diturunkan dari kalimat temuan di `demoData.ts` (korosi ringan pelat buhul
 * panel 4–6 sisi selatan; deformasi bantalan tumpuan timur 3 mm, dipantau)
 * dan ditandai `contoh` supaya tidak terbaca sebagai hasil lapangan. Angka
 * volumenya karangan; hanya kodenya yang nyata.
 */
const CONTOH: Record<string, Temuan[]> = {
  'jbt-progo': [
    {
      id: 'contoh-1',
      tanggal: '2026-06-18',
      pemeriksa: 'Tim Inspeksi Wilayah II',
      elemen: '4.455a',
      kerusakan: '302',
      bentang: 1,
      x: 5,
      y: 2,
      ukur: 0,
      volumeRusak: 0.6,
      volumeTotal: 4,
      f: 0,
      p: 0,
      catatan: 'Korosi ringan pada pelat buhul panel 4–6 sisi selatan.',
      contoh: true,
    },
    {
      id: 'contoh-2',
      tanggal: '2026-02-11',
      pemeriksa: 'PT Rekayasa Struktur Nusantara',
      elemen: '4.611b',
      kerusakan: '604',
      bentang: 1,
      posisi: 'A2',
      ukur: 0,
      volumeRusak: 1,
      volumeTotal: 2,
      f: 0,
      p: 0,
      catatan: 'Bantalan tumpuan timur (A2) berdeformasi 3 mm, dipantau.',
      contoh: true,
    },
  ],
};

function baca(): Simpanan | null {
  try {
    const mentah = localStorage.getItem(KUNCI);
    if (!mentah) return null;
    const isi = JSON.parse(mentah) as Simpanan;
    return isi && typeof isi === 'object' ? isi : null;
  } catch {
    return null;
  }
}

/** `false` bila peramban menolak menyimpan, biasanya karena kuota penuh oleh foto. */
function tulis(isi: Simpanan): boolean {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(isi));
    return true;
  } catch {
    return false;
  }
}

/** Foto per temuan dibatasi: tiap foto ratusan kilobita, dan kuota peramban sekitar lima megabita. */
export const MAKS_FOTO = 3;

/**
 * Salinan dalam ingatan, hanya terisi **setelah penulisan terakhir gagal**.
 *
 * Bila penyimpanan menolak (kuota penuh), isi di ingatan lebih baru daripada
 * yang ada di peramban; membaca dari peramban lalu membuat temuan yang baru
 * dicatat menghilang dari layar. Setelah penulisan berhasil, peramban kembali
 * menjadi sumber, supaya perubahan dari tab lain tidak tertimpa salinan usang.
 */
let cadangan: Simpanan | null = null;

function semua(): Simpanan {
  return cadangan ?? baca() ?? {};
}

/** Temuan sebuah aset; aset yang belum pernah disentuh menerima data contohnya. */
export function daftarTemuan(bridgeId: string): Temuan[] {
  const isi = semua();
  return isi[bridgeId] ?? CONTOH[bridgeId] ?? [];
}

function simpan(bridgeId: string, daftar: Temuan[]): boolean {
  const isi = { ...semua(), [bridgeId]: daftar };
  const tersimpan = tulis(isi);
  cadangan = tersimpan ? null : isi;
  umumkan();
  return tersimpan;
}

/**
 * Menambah temuan. Mengembalikan `false` bila temuannya hanya ada di ingatan
 * halaman karena penyimpanan peramban menolaknya — penelepon wajib
 * memberitahu pengguna, sebab temuan itu hilang saat halaman ditutup.
 */
export function tambahTemuan(bridgeId: string, temuan: Omit<Temuan, 'id'>): boolean {
  const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return simpan(bridgeId, [{ ...temuan, id }, ...daftarTemuan(bridgeId)]);
}

export function hapusTemuan(bridgeId: string, id: string): void {
  simpan(
    bridgeId,
    daftarTemuan(bridgeId).filter((t) => t.id !== id),
  );
}

/** Nama pemeriksa bawaan: pengguna yang sedang masuk. */
export const pemeriksaBawaan = petugas;
