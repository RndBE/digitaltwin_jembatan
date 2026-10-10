import { buatSimpanan } from '../lib/simpanan';
import { dossierFor } from './demoData';
import type { Bridge } from '../lib/types';

/**
 * Data administrasi laporan pemeriksaan.
 *
 * Bagian ke-1 Formulir Rutin dan Detail (Tabel A.12, A.16) membuka dengan
 * identitas jembatan: nomor, nama, lokasi, koordinat, kilometer dari kota
 * asal, tahun pembangunan, dan lalu lintas (Bab 6.4.1 hlm. 51, Bab 8.4.1
 * hlm. 81). Sebagian sudah ada di berkas aset; yang belum — **nomor jembatan
 * resmi dan posisi kilometer** — tidak dapat dikarang, jadi disediakan isian
 * yang disimpan di peramban dan dibiarkan kosong sampai pemilik data
 * mengisinya. Laporan menuliskan "belum diisi" untuk yang kosong, bukan
 * angka contoh.
 */

export interface Administrasi {
  /** Nomor jembatan menurut kodefikasi ruas (Bab 5.2). */
  nomorJembatan: string;
  /** Kota asal / kilometer nol ruas. */
  kotaAsal: string;
  /** Jarak dari kota asal, kilometer. */
  kilometer: string;
}

const KOSONG: Administrasi = { nomorJembatan: '', kotaAsal: '', kilometer: '' };

type Isi = Record<string, Administrasi>;

const simpanan = buatSimpanan<Isi>('jdt.administrasi', {});

export const langganAdministrasi = simpanan.langgan;
export const versiAdministrasi = simpanan.versi;

export function administrasiAset(bridgeId: string): Administrasi {
  return { ...KOSONG, ...(simpanan.baca()[bridgeId] ?? {}) };
}

export function simpanAdministrasi(bridgeId: string, isi: Administrasi): boolean {
  return simpanan.tulis({ ...simpanan.baca(), [bridgeId]: isi });
}

/** Seluruh identitas untuk kepala laporan: yang diisi pengguna dan yang dari berkas aset. */
export interface Identitas extends Administrasi {
  nama: string;
  lokasi: string;
  koordinat: string;
  tahunBangun: number;
  /** Lalu lintas harian rata-rata, bila berkas aset memilikinya. */
  lhr: number | null;
  sungai: string;
}

export function identitasLaporan(bridge: Bridge): Identitas {
  const dossier = dossierFor(bridge.id);
  return {
    ...administrasiAset(bridge.id),
    nama: bridge.name,
    lokasi: bridge.location,
    koordinat: dossier?.coordinates ?? '',
    tahunBangun: bridge.builtYear,
    lhr: dossier?.trafficPerDay ?? null,
    sungai: dossier?.river ?? '',
  };
}
