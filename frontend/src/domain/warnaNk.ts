import { NK_URAIAN } from './pedoman';

/**
 * Warna Nilai Kondisi 0–5 pada model 3D dan legendanya.
 *
 * Satu daftar dipakai adegan three.js dan legenda di halaman, supaya batang
 * yang berwarna oranye selalu berarti angka yang sama dengan yang tertulis di
 * legenda. Dari hijau ke merah tua mengikuti uraian Lampiran F.2.
 */
export const NK_WARNA_HEX: readonly number[] = [0x34d399, 0xa3e635, 0xfbbf24, 0xfb923c, 0xf87171, 0xb91c1c];

export const NK_WARNA_CSS: readonly string[] = NK_WARNA_HEX.map((h) => `#${h.toString(16).padStart(6, '0')}`);

export const NK_LEGENDA = NK_WARNA_CSS.map((warna, nk) => ({ nk, warna, label: NK_URAIAN[nk].label }));

/** Cara model 3D diwarnai. */
export type WarnaModel = 'sensor' | 'nk';
