import type { Bridge } from '../lib/types';

/**
 * Katalog jembatan.
 *
 * Dipakai saat API tidak tersedia; bila API menyala, daftar ini digantikan oleh
 * `GET /api/bridges`. Isinya sengaja dibuat sama dengan `backend/src/data/bridges.js`.
 *
 * Satu aset sudah cukup untuk seluruh antarmuka. Menambah entri di sini
 * langsung memunculkan pemilih aset di bilah samping, dan sebuah entri dengan
 * `model.kind: 'glb'` akan memakai penampil model kendali bersumber alih-alih
 * rangka prosedural — keduanya tetap didukung, hanya tidak dipakai sekarang.
 */
export const BRIDGES: Bridge[] = [
  {
    id: 'jbt-progo',
    name: 'Kali Progo Bridge',
    location: 'Yogyakarta–Purworejo route, DIY',
    type: 'Warren-type steel truss',
    spanMeters: 120,
    widthMeters: 9,
    lanes: 2,
    builtYear: 1998,
    lastInspection: '2026-06-18',
    sensorCount: 47,
    environmentalBias: 0.04,
    model: { kind: 'procedural', panels: 10, spanUnits: 12 },
  },
];

export const BRIDGE_BY_ID: Record<string, Bridge> = Object.fromEntries(
  BRIDGES.map((b) => [b.id, b]),
);

export const DEFAULT_BRIDGE_ID = BRIDGES[0].id;
