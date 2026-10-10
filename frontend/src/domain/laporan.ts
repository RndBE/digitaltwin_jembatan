import type { BarisCsv } from '../lib/export';
import { lokasiLabel, NK_URAIAN, type SimpulKondisi, type TemuanBernilai } from './pedoman';

/**
 * Bahan laporan pemeriksaan: baris CSV dan ringkasan hierarki.
 *
 * Laporan di layar dan berkas CSV disusun dari bahan yang sama di sini, supaya
 * angka di cetakan dan di Excel tidak dapat berselisih.
 */

/** Baris CSV daftar kerusakan, kolomnya mengikuti Tabel A.13 ditambah rincian S/R/K/F/P. */
export function barisCsvTemuan(temuan: TemuanBernilai[]): BarisCsv[] {
  const judul: BarisCsv = [
    'Tanggal',
    'Kode elemen',
    'Elemen',
    'Lokasi',
    'Kode kerusakan',
    'Kerusakan',
    'Penyebab',
    'Pengukuran',
    'Volume rusak',
    'Volume total',
    'Satuan',
    'Rasio (%)',
    'S',
    'R',
    'K',
    'F',
    'P',
    'Nilai Kondisi',
    'Uraian NK',
    'Pemeriksa',
    'Catatan',
    'Jumlah foto',
    'Data contoh',
  ];
  const isi = temuan.map<BarisCsv>((t) => [
    t.tanggal,
    t.elemen,
    t.elemenSpec.nama,
    lokasiLabel(t),
    t.kerusakan,
    t.kerusakanSpec.nama,
    t.sebab !== undefined ? (t.kerusakanSpec.sebab?.[t.sebab]?.label ?? '') : '',
    t.kerusakanSpec.ukur[t.ukur]?.label ?? '',
    t.volumeRusak,
    t.volumeTotal,
    t.kerusakanSpec.satuan,
    Math.round(t.skor.rasio * 1000) / 10,
    t.skor.s,
    t.skor.r,
    t.skor.k,
    t.skor.f,
    t.skor.p,
    t.skor.nk,
    NK_URAIAN[t.skor.nk].label,
    t.pemeriksa,
    t.catatan,
    t.foto?.length ?? 0,
    t.contoh ? 'ya' : '',
  ]);
  return [judul, ...isi];
}

export interface BarisHierarki {
  simpul: SimpulKondisi;
  kedalaman: number;
}

/**
 * Hierarki yang dicetak: seluruh Level 1–3, dan klaster Level 4 yang punya
 * temuan. Elemen individual tanpa temuan bernilai 0 dan akan menenggelamkan
 * isi yang berarti, jadi tidak dicetak; pedoman sendiri hanya meminta elemen
 * yang rusak dicatat (Bab 5.7).
 */
export function hierarkiCetak(akar: SimpulKondisi): BarisHierarki[] {
  const hasil: BarisHierarki[] = [];
  const jalan = (s: SimpulKondisi, kedalaman: number) => {
    hasil.push({ simpul: s, kedalaman });
    s.anak.forEach((a) => {
      if (a.level <= 3 || a.temuan > 0) jalan(a, kedalaman + 1);
    });
  };
  jalan(akar, 0);
  return hasil;
}
