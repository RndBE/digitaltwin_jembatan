/**
 * Katalog jembatan yang dipantau.
 *
 * `model` menentukan bagaimana kembaran digital digambar di peramban:
 *   - `procedural` — rangka baja yang dibangkitkan langsung oleh three.js
 *   - `glb`        — memuat berkas GLB beserta manifes bagian (parts.json)
 */
const BRIDGES = [
  {
    id: 'jbt-progo',
    name: 'Jembatan Kali Progo',
    location: 'Ruas Yogyakarta–Purworejo, DIY',
    type: 'Rangka baja tipe Warren',
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

const BRIDGE_BY_ID = Object.fromEntries(BRIDGES.map((b) => [b.id, b]));
const DEFAULT_BRIDGE_ID = BRIDGES[0].id;

module.exports = { BRIDGES, BRIDGE_BY_ID, DEFAULT_BRIDGE_ID };
