import type { LayarTujuan } from '../components/Sidebar';
import { BUTIR_FORM } from './formRutin';
import { ELEMEN_BY_KODE, KERUSAKAN } from './pedoman';

/**
 * Peta kesesuaian dengan Pedoman Pemeriksaan Jembatan No. 01/P/BM/2022.
 *
 * Satu butir per bagian pedoman, dengan status bertingkat — hampir tidak ada
 * bagian yang sepenuhnya ada atau sepenuhnya tidak ada:
 *
 *   sesuai     mengikuti pedoman dan dapat dicocokkan ke halamannya
 *   sebagian   ada, cakupannya lebih sempit
 *   belum      belum ada
 *   luar       bukan bagian pedoman; fitur monitoring milik aplikasi ini
 *
 * Nomor halaman adalah nomor tercetak di pedoman, bukan halaman berkas PDF.
 */

export type StatusKesesuaian = 'sesuai' | 'sebagian' | 'belum' | 'luar';

export const STATUS_LABEL: Record<StatusKesesuaian, string> = {
  sesuai: 'SESUAI',
  sebagian: 'SEBAGIAN',
  belum: 'BELUM ADA',
  luar: 'DI LUAR PEDOMAN',
};

export const STATUS_KELAS: Record<StatusKesesuaian, string> = {
  sesuai: 'tag tag-normal',
  sebagian: 'tag tag-waspada',
  belum: 'tag tag-siaga',
  luar: 'tag tag-outline',
};

export interface ButirKesesuaian {
  id: string;
  kelompok: string;
  /** Bab atau lampiran beserta halaman tercetaknya. */
  rujukan: string;
  judul: string;
  status: StatusKesesuaian;
  /** Yang sudah ada di aplikasi. */
  ada: string;
  /** Yang belum, bila status bukan sesuai. */
  kurang?: string;
  layar?: LayarTujuan;
}

const jumlahElemen = Object.keys(ELEMEN_BY_KODE).length;
const jumlahKode = Object.keys(KERUSAKAN).length;

export const KELOMPOK = [
  'Penilaian kondisi',
  'Sistem referensi',
  'Jenis pemeriksaan',
  'Formulir dan laporan',
  'Perlengkapan dan dokumentasi',
  'Di luar pedoman',
] as const;

export const BUTIR: ButirKesesuaian[] = [
  {
    id: 'nk',
    kelompok: 'Penilaian kondisi',
    rujukan: 'Bab 4.3.2, 5.7 · Lampiran F hlm. 189–190',
    judul: 'Nilai Kondisi = S + R + K + F + P',
    status: 'sesuai',
    ada: 'Rumus, ambang 30%/50%, dan nilai jembatan sebagai maksimum elemen struktural.',
    kurang: 'Klasifikasi elemen struktural adalah penilaian pengembang.',
    layar: 'pemeriksaan',
  },
  {
    id: 'kriteria',
    kelompok: 'Penilaian kondisi',
    rujukan: 'Lampiran C hlm. 138 · Lampiran D hlm. 142–166',
    judul: 'Kode kerusakan dan kriteria S/R/K',
    status: 'sebagian',
    ada: `${jumlahKode} kode: baja, beton, perletakan, lantai, trotoar, pengaman jalan, SMKS.`,
    kurang: 'Kayu, pasangan batu, kabel, fondasi, bangunan bawah, sungai, drainase, siar muai.',
    layar: 'pemeriksaan',
  },
  {
    id: 'hierarki',
    kelompok: 'Sistem referensi',
    rujukan: 'Bab 5.6 · Lampiran B hlm. 118–133',
    judul: 'Hierarki dan kode elemen',
    status: 'sebagian',
    ada: `${jumlahElemen} elemen Level 4 jembatan rangka baja, sudah dicocokkan ke Lampiran B.`,
    kurang: 'Bangunan bawah, aliran sungai, jalan pendekat, siar muai, drainase.',
    layar: 'pemeriksaan',
  },
  {
    id: 'lokasi',
    kelompok: 'Sistem referensi',
    rujukan: 'Bab 5.4–5.5 hlm. 38–41',
    judul: 'Penomoran lokasi dan alur A1 → A2',
    status: 'sebagian',
    ada: 'Lokasi B/X/Y/Z terisi otomatis dari model 3D; rute stasiun A1 → A2.',
    kurang: 'Arah A1 = barat adalah asumsi. Belum dipakai di inventaris sensor.',
    layar: 'rute',
  },
  {
    id: 'nomor',
    kelompok: 'Sistem referensi',
    rujukan: 'Bab 5.2–5.3 hlm. 26–37',
    judul: 'Nomor jembatan dan kilometer',
    status: 'sebagian',
    ada: 'Isian ada di Formulir Rutin dan Laporan.',
    kurang: 'Belum diisi (tidak dikarang); kodefikasi belum divalidasi.',
    layar: 'rutin',
  },
  {
    id: 'inventarisasi',
    kelompok: 'Jenis pemeriksaan',
    rujukan: 'Bab 6 hlm. 44–65',
    judul: 'Pemeriksaan Inventarisasi',
    status: 'belum',
    ada: 'Halaman cakupan: empat bagian Bab 6.4 dan apa yang sudah terbaca dari data aset.',
    kurang: 'Formulir isian dan foto inventarisasi belum ada.',
    layar: 'inventarisasi',
  },
  {
    id: 'detail',
    kelompok: 'Jenis pemeriksaan',
    rujukan: 'Bab 7 hlm. 66–75',
    judul: 'Pemeriksaan Detail',
    status: 'sebagian',
    ada: 'Catat kerusakan, hitung NK, roll-up ke jembatan, foto per temuan.',
    kurang: 'Penilaian tiap komponen dan laporan formulir lengkap.',
    layar: 'pemeriksaan',
  },
  {
    id: 'rutin',
    kelompok: 'Jenis pemeriksaan',
    rujukan: 'Bab 8 hlm. 75–87 · Tabel A.16–A.19 hlm. 104–107',
    judul: 'Pemeriksaan Rutin',
    status: 'sebagian',
    ada: `Formulir lengkap: ${BUTIR_FORM.length} butir, jawaban Ya/Tidak dan lokasi, disimpan per tahun, dapat dikunci selesai.`,
    kurang: 'Foto per butir; disimpan di peramban, bukan server.',
    layar: 'rutin',
  },
  {
    id: 'khusus',
    kelompok: 'Jenis pemeriksaan',
    rujukan: 'Bab 4.3.4, 9 hlm. 9, 88–92',
    judul: 'Pemeriksaan Khusus',
    status: 'sebagian',
    ada: 'Halaman Khusus: usulan elemen, alasan, pengujian dari Tabel 9–10, dan alat Bab 9.3.',
    kurang: 'Pencatatan hasil pengujian.',
    layar: 'khusus',
  },
  {
    id: 'jadwal',
    kelompok: 'Jenis pemeriksaan',
    rujukan: 'Bab 4.3, 7.1.1 hlm. 6–9, 66',
    judul: 'Jadwal Rutin dan Detail',
    status: 'sesuai',
    ada: 'Jatuh tempo dari riwayat inspeksi dengan kriteria Bab 7.1.1; menu bertitik bila terlambat.',
    kurang: 'Rutin dihitung dari Rutin atau Detail terakhir (tafsiran).',
    layar: 'rutin',
  },
  {
    id: 'laporan',
    kelompok: 'Formulir dan laporan',
    rujukan: 'Lampiran A hlm. 97 dst. · Bab 4.4.4 hlm. 18',
    judul: 'Formulir dan laporan',
    status: 'sebagian',
    ada: 'Laporan Detail dan Rutin siap cetak atau PDF, mengikuti susunan Lampiran A; CSV temuan.',
    kurang: 'Bukan formulir bernomor resmi; tanpa penyimpanan server dan riwayat perubahan.',
    layar: 'laporan',
  },
  {
    id: 'personel',
    kelompok: 'Formulir dan laporan',
    rujukan: 'Bab 4.4.5–4.4.6 hlm. 20–25',
    judul: 'Peran dan kualifikasi pemeriksa',
    status: 'belum',
    ada: 'Satu akun masuk.',
  },
  {
    id: 'smks',
    kelompok: 'Perlengkapan dan dokumentasi',
    rujukan: 'Lampiran B hlm. 132 · Tabel A.18 hlm. 106',
    judul: 'SMKS: kelengkapan dan fungsi',
    status: 'sebagian',
    ada: 'Delapan elemen SMKS dipadankan ke kode; jawaban awal dari inventaris dan telemetri.',
    kurang: 'Kanal Retak tidak punya kode di pedoman.',
    layar: 'rutin',
  },
  {
    id: 'foto',
    kelompok: 'Perlengkapan dan dokumentasi',
    rujukan: 'Bab 4.4.3 hlm. 18 · Lampiran G hlm. 195',
    judul: 'Foto kerusakan',
    status: 'sebagian',
    ada: 'Tangkapan kamera 960 × 540 dilampirkan ke temuan.',
    kurang: 'Masih tangkapan peraga, bukan foto lapangan.',
    layar: 'pemeriksaan',
  },
  {
    id: 'darurat',
    kelompok: 'Perlengkapan dan dokumentasi',
    rujukan: 'Bab 8.4.1 hlm. 81 · Tabel A.12, A.16',
    judul: 'Usulan tindakan darurat',
    status: 'sebagian',
    ada: 'Usulan terisi dari kanal kritis dan temuan NK ≥ 4; enam pilihan tindakan.',
    kurang: 'Hanya usulan; aturan pemicunya tafsiran pengembang.',
    layar: 'rutin',
  },
  {
    id: 'penanganan',
    kelompok: 'Perlengkapan dan dokumentasi',
    rujukan: 'Lampiran J hlm. 275',
    judul: 'Preservasi dan penanganan indikatif',
    status: 'belum',
    ada: 'Pekerjaan tercatat sebagai data contoh.',
    layar: 'repair',
  },
  {
    id: 'shm',
    kelompok: 'Di luar pedoman',
    rujukan: 'Bab 1 hlm. 1',
    judul: 'Monitoring sensor dan evaluasi gabungan',
    status: 'luar',
    ada: 'Telemetri, ambang siaga, skor kondisi gabungan, skenario, kamera, model 3D. Pedoman mengecualikannya.',
    layar: 'dash',
  },
];

export interface RingkasanKesesuaian {
  total: number;
  per: Record<StatusKesesuaian, number>;
}

export function ringkasKesesuaian(): RingkasanKesesuaian {
  const per: Record<StatusKesesuaian, number> = { sesuai: 0, sebagian: 0, belum: 0, luar: 0 };
  BUTIR.forEach((b) => {
    per[b.status] += 1;
  });
  return { total: BUTIR.length, per };
}

/** Penafsiran pengembang yang tidak tertulis eksplisit di pedoman. */
export const TAFSIRAN: string[] = [
  'Elemen mana yang struktural (Bab 3 hanya memberi definisi).',
  'Nilai jembatan = maksimum elemen struktural; Bab 5.7 dan Lampiran F.1 bertentangan soal Level 3.',
  'Rutin jatuh tempo setahun sejak Rutin atau Detail terakhir.',
  'Pemicu usulan darurat dan pemeriksaan khusus dari sensor dan temuan.',
  'Padanan kanal sensor ke kode SMKS, mis. Getaran → 4.751g.',
  'A1 = ujung barat, sehingga Y1 = utara.',
];
