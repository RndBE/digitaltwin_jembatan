import { buatSimpanan } from '../lib/simpanan';
import { BUTIR_FORM } from './formRutin';
import { petugas } from './alarms';

/**
 * Lembar Pemeriksaan Rutin: satu per aset per tahun.
 *
 * Pemeriksaan Rutin dilakukan setiap tahun (Bab 4.3.3), jadi tahun menjadi
 * kunci lembarnya. Isinya sama dengan Formulir Rutin Tabel A.16–A.19:
 * keputusan tindakan darurat, jawaban "kesesuaian dengan pemeriksaan terakhir",
 * dan jawaban Ya/Tidak per butir kondisi beserta lokasinya.
 *
 * `ya: null` berarti butir belum dijawab. Pembedaan itu penting: formulir
 * yang separuh kosong dan formulir yang seluruhnya dijawab "Tidak" tidak boleh
 * terbaca sama, dan hanya yang kedua boleh ditandai selesai.
 */

export interface Jawaban {
  ya: boolean | null;
  lokasi: string;
  catatan: string;
}

export interface Lembar {
  tahun: number;
  /** Tanggal pemeriksaan, `YYYY-MM-DD`. */
  tanggal: string;
  pemeriksa: string;
  nip: string;
  /** "Apakah tindakan darurat disarankan?" — keputusan pemeriksa, bukan usulan sistem. */
  darurat: boolean | null;
  /** Indeks tindakan darurat terpilih pada `TINDAKAN_DARURAT`. */
  tindakan: number[];
  /** Catatan: kondisi sesuai dengan Pemeriksaan Inventarisasi terakhir? */
  sesuaiInventarisasi: boolean | null;
  /** Catatan: kondisi sesuai dengan Pemeriksaan Detail terakhir? */
  sesuaiDetail: boolean | null;
  jawaban: Record<string, Jawaban>;
  /** "Hanya untuk keperluan kantor": kapan dan oleh siapa data dimasukkan. */
  selesai?: { tanggal: string; oleh: string };
}

type Isi = Record<string, Record<string, Lembar>>;

const simpanan = buatSimpanan<Isi>('jdt.lembarRutin', {});

export const langganLembar = simpanan.langgan;
export const versiLembar = simpanan.versi;

const hariIni = () => new Date().toISOString().slice(0, 10);

export function lembarBaru(tahun: number): Lembar {
  return {
    tahun,
    tanggal: hariIni(),
    pemeriksa: '',
    nip: '',
    darurat: null,
    tindakan: [],
    sesuaiInventarisasi: null,
    sesuaiDetail: null,
    jawaban: {},
  };
}

export function lembarTahun(bridgeId: string, tahun: number): Lembar {
  const tersimpan = simpanan.baca()[bridgeId]?.[String(tahun)];
  return tersimpan ? { ...lembarBaru(tahun), ...tersimpan } : lembarBaru(tahun);
}

export function simpanLembar(bridgeId: string, lembar: Lembar): boolean {
  const semua = simpanan.baca();
  return simpanan.tulis({
    ...semua,
    [bridgeId]: { ...(semua[bridgeId] ?? {}), [String(lembar.tahun)]: lembar },
  });
}

/** Tahun-tahun yang sudah punya lembar, terbaru dulu. */
export function tahunTersimpan(bridgeId: string): number[] {
  return Object.keys(simpanan.baca()[bridgeId] ?? {})
    .map(Number)
    .sort((a, b) => b - a);
}

export interface KemajuanLembar {
  total: number;
  terjawab: number;
  ya: number;
  /** Alasan lembar belum boleh ditandai selesai; kosong bila sudah boleh. */
  kurang: string[];
}

/** Berapa butir sudah dijawab, dan apa yang masih kurang sebelum selesai. */
export function kemajuan(lembar: Lembar): KemajuanLembar {
  const jawaban = BUTIR_FORM.map((b) => lembar.jawaban[b.id]?.ya ?? null);
  const terjawab = jawaban.filter((j) => j !== null).length;
  const ya = jawaban.filter((j) => j === true).length;

  const kurang: string[] = [];
  if (!lembar.pemeriksa.trim()) kurang.push('nama pemeriksa');
  if (lembar.darurat === null) kurang.push('keputusan tindakan darurat');
  if (lembar.darurat && lembar.tindakan.length === 0) kurang.push('tindakan darurat yang dipilih');
  if (lembar.sesuaiInventarisasi === null || lembar.sesuaiDetail === null) kurang.push('catatan kesesuaian');
  if (terjawab < BUTIR_FORM.length) kurang.push(`${BUTIR_FORM.length - terjawab} butir kondisi belum dijawab`);
  // Jawaban "Ya" tanpa lokasi tidak dapat ditindaklanjuti siapa pun.
  const tanpaLokasi = BUTIR_FORM.filter((b) => lembar.jawaban[b.id]?.ya === true && !lembar.jawaban[b.id]?.lokasi.trim());
  if (tanpaLokasi.length) kurang.push(`${tanpaLokasi.length} jawaban "Ya" belum berlokasi`);

  return { total: BUTIR_FORM.length, terjawab, ya, kurang };
}

/** Menandai lembar selesai; ditolak bila masih ada yang kurang. */
export function selesaikanLembar(bridgeId: string, lembar: Lembar): boolean {
  if (kemajuan(lembar).kurang.length > 0) return false;
  return simpanLembar(bridgeId, { ...lembar, selesai: { tanggal: hariIni(), oleh: petugas() } });
}

/** Membuka kembali lembar yang sudah ditandai selesai, untuk dikoreksi. */
export function bukaLembar(bridgeId: string, lembar: Lembar): boolean {
  const { selesai: _selesai, ...sisa } = lembar;
  void _selesai;
  return simpanLembar(bridgeId, sisa);
}
