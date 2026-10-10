import type { Reading } from '../lib/types';
import type { BridgeDossier } from './demoData';
import type { TemuanBernilai } from './pedoman';
import type { HasilSmks } from './smks';
import { SENSOR_BY_ID } from './sensors';

/**
 * Butir Bagian ke-2 Formulir Pemeriksaan Rutin: "Kondisi Jembatan".
 *
 * Disalin dari Tabel A.17 hlm. 105 (keamanan), A.18 hlm. 106 (keselamatan,
 * kenyamanan, pemeliharaan), dan A.19 hlm. 107 (rehabilitasi, kondisi sosial)
 * Pedoman Pemeriksaan Jembatan No. 01/P/BM/2022, diperiksa terhadap gambar
 * halamannya. Urutan dan kalimat uraiannya dibiarkan sama supaya isiannya
 * dapat disalin ke formulir tanpa menerjemahkan.
 *
 * Arah jawaban sama dengan formulir: **"Ya" berarti ada masalah** (atau, pada
 * bagian pemeliharaan, ada pekerjaan yang sedang berlangsung). Semua butir
 * dimuat, termasuk yang tidak berlaku pada jembatan rangka baja ini (elemen
 * penahan kabel, ikatan penahan gempa): pemeriksa yang menjawab "Tidak" tetap
 * memberi tanda bahwa butir itu sudah dipertimbangkan.
 */

export type BagianForm =
  | 'Keamanan jembatan'
  | 'Keselamatan jembatan'
  | 'Kenyamanan jembatan'
  | 'Pemeliharaan, rehabilitasi, penggantian, dan pembangunan'
  | 'Kondisi sosial kemasyarakatan';

export interface ButirForm {
  id: string;
  bagian: BagianForm;
  /** Kolom "Elemen Pemeriksaan", mis. "5. Bangunan Atas". */
  elemen: string;
  /** Huruf butir pada formulir, bila ada. */
  huruf?: string;
  uraian: string;
  rujukan: string;
}

const KAM = 'Keamanan jembatan' as const;
const SEL = 'Keselamatan jembatan' as const;
const KEN = 'Kenyamanan jembatan' as const;
const PEM = 'Pemeliharaan, rehabilitasi, penggantian, dan pembangunan' as const;
const SOS = 'Kondisi sosial kemasyarakatan' as const;

const A17 = 'Tabel A.17 hlm. 105';
const A18 = 'Tabel A.18 hlm. 106';
const A19 = 'Tabel A.19 hlm. 107';

const butir = (id: string, bagian: BagianForm, elemen: string, huruf: string | undefined, uraian: string, rujukan: string): ButirForm => ({
  id,
  bagian,
  elemen,
  huruf,
  uraian,
  rujukan,
});

export const BUTIR_FORM: ButirForm[] = [
  // ------------------------------------------------------------- keamanan
  butir('kam-1a', KAM, '1. Tanah Timbunan', undefined, 'Keruntuhan, longsor atau amblas', A17),

  butir('kam-2a', KAM, '2. Aliran Sungai', 'a', 'Gerusan/degradasi dasar sungai', A17),
  butir('kam-2b', KAM, '2. Aliran Sungai', 'b', 'Endapan/agradasi', A17),
  butir('kam-2c', KAM, '2. Aliran Sungai', 'c', 'Benda hanyutan/debris di aliran sungai', A17),
  butir('kam-2d', KAM, '2. Aliran Sungai', 'd', 'Sisa struktur jembatan lama', A17),

  butir('kam-3a', KAM, '3. Fondasi', 'a', 'Penurunan atau deformasi', A17),
  butir('kam-3b', KAM, '3. Fondasi', 'b', 'Retak pada bagian fondasi', A17),
  butir('kam-3c', KAM, '3. Fondasi', 'c', 'Kerusakan berupa lepasnya bahan fondasi (gompal, delaminasi, karat, atau busuk)', A17),
  butir('kam-3d', KAM, '3. Fondasi', 'd', 'Lepas/rusaknya sistem perlindungan (cat, galvanis, proteksi katodik)', A17),

  butir('kam-4a', KAM, '4. Bangunan Bawah', 'a', 'Pergerakan atau amblasnya kepala jembatan/pilar', A17),
  butir('kam-4b', KAM, '4. Bangunan Bawah', 'b', 'Keretakan bagian tembok sayap, kepala jembatan dan pilar', A17),
  butir('kam-4c', KAM, '4. Bangunan Bawah', 'c', 'Kerusakan berupa pelepasan bahan (gompal, delaminasi, karat, atau busuk)', A17),
  butir('kam-4d', KAM, '4. Bangunan Bawah', 'd', 'Rembesan air', A17),
  butir('kam-4e', KAM, '4. Bangunan Bawah', 'e', 'Lepas/rusaknya sistem perlindungan (cat, galvanis, proteksi katodik)', A17),
  butir('kam-4f', KAM, '4. Bangunan Bawah', 'f', 'Tidak berfungsinya sistem perkuatan', A17),

  butir('kam-5a', KAM, '5. Bangunan Atas', 'a', 'Lendutan berlebihan sewaktu lalu lintas lewat di atas jembatan', A17),
  butir('kam-5b', KAM, '5. Bangunan Atas', 'b', 'Keretakan bahan bangunan atas', A17),
  butir('kam-5c', KAM, '5. Bangunan Atas', 'c', 'Kerusakan berupa pelepasan bahan (gompal, delaminasi, karat, atau busuk)', A17),
  butir('kam-5d', KAM, '5. Bangunan Atas', 'd', 'Lepas/longgar sistem sambungan', A17),
  butir('kam-5e', KAM, '5. Bangunan Atas', 'e', 'Rusaknya elemen penahan struktur kabel', A17),
  butir('kam-5f', KAM, '5. Bangunan Atas', 'f', 'Tidak berfungsinya sistem perkuatan', A17),
  butir('kam-5g', KAM, '5. Bangunan Atas', 'g', 'Pergeseran bangunan atas yang ekstrim', A17),
  butir('kam-5h', KAM, '5. Bangunan Atas', 'h', 'Lepasnya ikatan penahan gempa', A17),
  butir('kam-5i', KAM, '5. Bangunan Atas', 'i', 'Sampah pada elemen rangka baja', A17),
  butir('kam-5j', KAM, '5. Bangunan Atas', 'j', 'Rembesan air bangunan atas', A17),
  butir('kam-5k', KAM, '5. Bangunan Atas', 'k', 'Rembesan air bagian bawah lantai', A17),
  butir('kam-5l', KAM, '5. Bangunan Atas', 'l', 'Tidak berfungsi elemen-elemen drainase', A17),

  butir('kam-6a', KAM, '6. Siar Muai', 'a', 'Beda tinggi antara elevasi jalan pendekat dengan elevasi lantai jembatan', A17),
  butir('kam-6b', KAM, '6. Siar Muai', 'b', 'Hilang elemen sambungan siar-muai', A17),
  butir('kam-6c', KAM, '6. Siar Muai', 'c', 'Tidak berfungsinya sambungan siar-muai', A17),

  butir('kam-7a', KAM, '7. Perletakan', 'a', 'Tidak lengkapnya elemen perletakan', A17),
  butir('kam-7b', KAM, '7. Perletakan', 'b', 'Pergerakan/pergeseran landasan ekstrim', A17),
  butir('kam-7c', KAM, '7. Perletakan', 'c', 'Keutuhan sistem pendukung landasan: i) bantalan mortar; ii) batang pengikat, dll', A17),

  // ---------------------------------------------------------- keselamatan
  butir('sel-1a', SEL, '1. Sandaran', 'a', 'Ketidaklengkapan elemen', A18),
  butir('sel-1b', SEL, '1. Sandaran', 'b', 'Longgar/hilang sistem sambungan', A18),
  butir('sel-1c', SEL, '1. Sandaran', 'c', 'Kerusakan berupa pelepasan bahan (gompal, delaminasi, karat, atau busuk)', A18),
  butir('sel-2a', SEL, '2. Rambu dan tanda', 'a', 'Ketidaklengkapan elemen', A18),
  butir('sel-2b', SEL, '2. Rambu dan tanda', 'b', 'Longgar/hilang sistem sambungan', A18),
  butir('sel-3a', SEL, '3. Penangkal petir', 'a', 'Ketidaklengkapan elemen', A18),
  butir('sel-3b', SEL, '3. Penangkal petir', 'b', 'Tidak berfungsinya elemen', A18),
  butir('sel-3c', SEL, '3. Penangkal petir', 'c', 'Longgar/hilang sistem sambungan', A18),
  butir('sel-3d', SEL, '3. Penangkal petir', 'd', 'Kerusakan berupa pelepasan bahan (gompal, delaminasi, karat, atau busuk)', A18),
  butir('sel-4a', SEL, '4. SMKS', 'a', 'Ketidaklengkapan elemen', A18),
  butir('sel-4b', SEL, '4. SMKS', 'b', 'Tidak berfungsinya elemen', A18),

  // ----------------------------------------------------------- kenyamanan
  butir('ken-1a', KEN, '1. Sistem Lantai', 'a', 'Kerataan permukaan pada lapis permukaan (gaya kejut berlebihan atau arus lalu lintas terhambat)', A18),
  butir('ken-2b', KEN, '2. Bangunan Atas', 'b', 'Getaran yang mengganggu kenyamanan kendaraan dan pejalan kaki', A18),
  butir('ken-3c', KEN, '3. Jalan pendekat', 'c', 'Tidak berfungsinya drainase jalan pendekat', A18),

  // ----------------------------------------------------------- pemeliharaan
  butir('pem-1a', PEM, '1. Pemeliharaan Rutin', 'a', 'Pembuatan jalan akses', A18),
  butir('pem-1b', PEM, '1. Pemeliharaan Rutin', 'b', 'Pembersihan secara umum', A18),
  butir('pem-1c', PEM, '1. Pemeliharaan Rutin', 'c', 'Pengecatan sederhana', A18),
  butir('pem-1d', PEM, '1. Pemeliharaan Rutin', 'd', 'Penanganan kerusakan ringan', A18),
  butir('pem-2a', PEM, '2. Pemeliharaan Berkala', 'a', 'Pengecatan ulang', A18),
  butir('pem-2b', PEM, '2. Pemeliharaan Berkala', 'b', 'Penggantian lapisan permukaan', A18),
  butir('pem-2c', PEM, '2. Pemeliharaan Berkala', 'c', 'Penggantian lantai kayu', A18),
  butir('pem-2d', PEM, '2. Pemeliharaan Berkala', 'd', 'Penggantian kayu jalur roda kendaraan', A18),
  butir('pem-2e', PEM, '2. Pemeliharaan Berkala', 'e', 'Pembersihan keseluruhan jembatan', A18),
  butir('pem-2f', PEM, '2. Pemeliharaan Berkala', 'f', 'Pemeliharaan perletakan/landasan', A18),
  butir('pem-2g', PEM, '2. Pemeliharaan Berkala', 'g', 'Penggantian sambungan siar-muai', A18),
  butir('pem-2h', PEM, '2. Pemeliharaan Berkala', 'h', 'Perbaikan keretakan pasangan batu/bata', A18),
  butir('pem-2i', PEM, '2. Pemeliharaan Berkala', 'i', 'Penggantian elemen-elemen kecil', A18),
  butir('pem-2j', PEM, '2. Pemeliharaan Berkala', 'j', 'Perbaikan tiang dan sandaran', A18),
  butir('pem-2k', PEM, '2. Pemeliharaan Berkala', 'k', 'Perawatan bagian-bagian yang bergerak', A18),
  butir('pem-2l', PEM, '2. Pemeliharaan Berkala', 'l', 'Perkuatan skala elemen struktural jembatan', A18),
  butir('pem-2m', PEM, '2. Pemeliharaan Berkala', 'm', 'Perbaikan longsor dan erosi tebing', A18),
  butir('pem-2n', PEM, '2. Pemeliharaan Berkala', 'n', 'Perbaikan sederhana bangunan pengaman', A18),
  butir('pem-3a', PEM, '3. Rehabilitasi', 'a', 'Penggantian skala komponen jembatan', A19),
  butir('pem-3b', PEM, '3. Rehabilitasi', 'b', 'Modifikasi bangunan atas/bawah, fondasi', A19),
  butir('pem-3c', PEM, '3. Rehabilitasi', 'c', 'Perubahan sistem siar-muai dan perletakan', A19),
  butir('pem-4a', PEM, '4. Penggantian', 'a', 'Bangunan atas', A19),
  butir('pem-4b', PEM, '4. Penggantian', 'b', 'Bangunan bawah', A19),
  butir('pem-5', PEM, '5. Pelebaran/Duplikasi Jembatan', undefined, 'Pelebaran atau duplikasi jembatan', A19),

  // ------------------------------------------------------------- sosial
  butir('sos-1', SOS, '1.', undefined, 'Ketidakbersihan sekitar jembatan (sampah dan limbah)', A19),
  butir('sos-2', SOS, '2.', undefined, 'Ketidaksesuaian peruntukan jembatan', A19),
  butir('sos-3', SOS, '3.', undefined, 'Aktivitas yang mengganggu pelayanan jembatan (gangguan keamanan, vandalisme, perselisihan adat, perlintasan binatang liar)', A19),
];

export const BAGIAN_FORM: BagianForm[] = [KAM, SEL, KEN, PEM, SOS];

/* ------------------------------------------------------------------ petunjuk */

/**
 * Bahan yang dipakai membuat petunjuk dari data monitoring.
 *
 * Petunjuk adalah **bantuan, bukan jawaban**: pemeriksa yang berdiri di
 * jembatan yang memutuskan. Ia memuat teks alasan, dan `saran` hanya bila data
 * memang menunjuk ke "Ya" — satu klik memakainya, tetapi tidak pernah terisi
 * sendiri.
 */
export interface KonteksPetunjuk {
  readings: Reading[] | null;
  smks: HasilSmks | null;
  temuan: TemuanBernilai[];
  dossier: BridgeDossier | null;
  /** Muka air sungai, meter; `null` bila tidak diketahui. */
  mukaAir: number | null;
}

export interface Petunjuk {
  teks: string;
  /** Jawaban yang disarankan data; kosong bila hanya informasi. */
  saran?: boolean;
}

const bacaan = (k: KonteksPetunjuk, id: string) => {
  const r = k.readings?.find((x) => x.id === id);
  const spec = SENSOR_BY_ID[id];
  if (!r || !spec) return null;
  return { r, spec, teks: `${spec.name} ${r.value.toFixed(spec.dec)} ${spec.unit} · ${r.status}` };
};

const temuanDi = (k: KonteksPetunjuk, kode: string[], awalan: string[]) =>
  k.temuan.filter((t) => kode.includes(t.kerusakan) && awalan.some((a) => t.elemen.startsWith(a)));

const ringkasTemuan = (daftar: TemuanBernilai[]) =>
  daftar.map((t) => `${t.kerusakan} pada ${t.elemen}`).join(', ');

const dariSensor = (id: string, namaButir?: string) => (k: KonteksPetunjuk): Petunjuk | null => {
  const b = bacaan(k, id);
  if (!b) return null;
  return {
    teks: `${b.teks}${namaButir ? ` (${namaButir})` : ''}.`,
    saran: b.r.status !== 'AMAN' ? true : undefined,
  };
};

const dariTemuan = (kode: string[], awalan: string[]) => (k: KonteksPetunjuk): Petunjuk | null => {
  const cocok = temuanDi(k, kode, awalan);
  return cocok.length ? { teks: `Temuan tercatat: ${ringkasTemuan(cocok)}.`, saran: true } : null;
};

const gabung = (...fn: Array<(k: KonteksPetunjuk) => Petunjuk | null>) => (k: KonteksPetunjuk): Petunjuk | null => {
  const hasil = fn.map((f) => f(k)).filter((h): h is Petunjuk => h !== null);
  if (!hasil.length) return null;
  const saran = hasil.some((h) => h.saran) ? true : undefined;
  return { teks: hasil.map((h) => h.teks).join(' '), saran };
};

const dariSmks = (jenis: 'lengkap' | 'fungsi') => (k: KonteksPetunjuk): Petunjuk | null => {
  if (!k.smks) return null;
  const bermasalah = k.smks.baris.filter((b) => (jenis === 'lengkap' ? b.tidakLengkap : b.tidakBerfungsi === true));
  return bermasalah.length
    ? { teks: `Halaman Pemeriksaan rutin menandai ${bermasalah.map((b) => b.kode).join(', ')}.`, saran: true }
    : { teks: 'Seluruh elemen SMKS terdaftar tampak ' + (jenis === 'lengkap' ? 'lengkap.' : 'berfungsi.') };
};

const pekerjaan = (kata: string) => (k: KonteksPetunjuk): Petunjuk | null => {
  const ada = k.dossier?.maintenance.filter((m) => m.work.toLowerCase().includes(kata) && m.status === 'Berjalan');
  return ada?.length ? { teks: `Berkas aset: "${ada[0].work}" sedang berjalan.`, saran: true } : null;
};

const kemiringan = (kritis: boolean) => (k: KonteksPetunjuk): Petunjuk | null => {
  const b = bacaan(k, 'tilt');
  if (!b) return null;
  return {
    teks: `${b.teks}. Gerak tumpuan dapat menandakan pergerakan di bawahnya.`,
    saran: kritis && b.r.status === 'KRITIS' ? true : undefined,
  };
};

/** Petunjuk per butir; butir tanpa data pendukung tidak punya entri. */
export const PETUNJUK: Record<string, (k: KonteksPetunjuk) => Petunjuk | null> = {
  'kam-2a': (k) => (k.mukaAir === null ? null : { teks: `Muka air sungai ${k.mukaAir.toFixed(2)} m. Periksa dasar sungai di sekitar pilar bila air baru surut.` }),
  'kam-3a': kemiringan(true),
  'kam-4a': kemiringan(true),
  'kam-5a': dariSensor('defl'),
  'kam-5b': gabung(dariSensor('crack'), dariTemuan(['304', '202'], ['4.45', '4.51'])),
  'kam-5c': dariTemuan(['301', '302', '201', '205', '204'], ['4.45', '4.51']),
  'kam-5d': gabung(dariTemuan(['308'], ['4.45']), dariSensor('crack', 'sambungan')),
  'kam-5g': kemiringan(true),
  'kam-7a': dariTemuan(['605', '606'], ['4.61']),
  'kam-7b': gabung(kemiringan(true), dariTemuan(['602', '604'], ['4.61'])),
  'kam-7c': dariTemuan(['561', '603'], ['4.61']),
  'sel-1a': dariTemuan(['931'], ['4.621']),
  'sel-1b': dariTemuan(['308'], ['4.621']),
  'sel-1c': dariTemuan(['301', '302'], ['4.621']),
  'sel-4a': dariSmks('lengkap'),
  'sel-4b': dariSmks('fungsi'),
  'ken-2b': dariSensor('vib'),
  'pem-2a': pekerjaan('pengecatan'),
  'pem-2f': pekerjaan('bantalan'),
  'pem-2g': pekerjaan('siar'),
};

export function petunjukUntuk(id: string, konteks: KonteksPetunjuk): Petunjuk | null {
  return PETUNJUK[id]?.(konteks) ?? null;
}
