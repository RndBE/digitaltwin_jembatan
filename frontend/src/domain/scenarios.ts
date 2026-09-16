import type { Scenario, ScenarioFamily } from '../lib/types';

/**
 * Skenario pembebanan.
 *
 * Tiga keluarga, disusun sebagai tangga: tiap keluarga punya anak tangga
 * waspada dan kritis, sehingga kenaikan kondisi dapat ditelusuri dan bukan
 * sekadar dilompati.
 *
 *   lalu-lintas  — beban kendaraan. Datang cepat, pulih penuh saat beban pergi.
 *   lingkungan   — angin, suhu. Datang sedang, pulih lebih lambat.
 *   kerusakan    — retak, tumpuan, gerusan. Tumbuh perlahan, DAN TIDAK PULIH.
 *
 * Bidang yang membedakan ketiganya:
 *
 *   `onset`    — seberapa cepat kanal bergerak menuju kondisi baru tiap langkah.
 *                Truk yang naik jembatan mengubah lendutan dalam hitungan detik;
 *                retak lelah tumbuh selama berbulan-bulan.
 *   `residual` — pengali yang tertinggal setelah skenario dihentikan. Lendutan
 *                akibat truk hilang bersama truknya; retak tidak menutup
 *                sendiri. Inilah yang membedakan waspada karena beban dari
 *                waspada karena kerusakan, dan tanpa itu semua skenario terlihat
 *                sama: naik lalu turun.
 */

export const FAMILY_LABELS: Record<ScenarioFamily, string> = {
  'lalu-lintas': 'Traffic load',
  lingkungan: 'Environmental load',
  kerusakan: 'Structural damage',
};

export const FAMILY_NOTES: Record<ScenarioFamily, string> = {
  'lalu-lintas':
    'Live load from passing vehicles. The structure works in its elastic range: every reading returns to its baseline as soon as the load leaves the span.',
  lingkungan:
    'Wind and temperature. They do not damage the structure, but they narrow the remaining margin to the thresholds — and recovery follows the weather, not the traffic.',
  kerusakan:
    'Damage to a structural element. It does not heal on its own: once the scenario is stopped, the affected channels stay above their baseline until a repair is recorded.',
};

/** Laju pendekatan menuju kondisi baru, per langkah simulasi. */
export const ONSET_RATE: Record<Scenario['onset'], number> = {
  cepat: 0.09,
  sedang: 0.045,
  bertahap: 0.018,
};

export const ONSET_LABEL: Record<Scenario['onset'], string> = {
  cepat: 'Fast · seconds',
  sedang: 'Moderate · minutes',
  bertahap: 'Gradual · develops slowly',
};

export const SCENARIOS: Record<string, Scenario> = {
  idle: {
    key: 'idle',
    family: 'lalu-lintas',
    name: 'Live monitoring',
    desc: 'No scenario is being forced. Readings follow normal service conditions, plus any residual damage that has not been repaired yet.',
    traffic: '—',
    impact: 'None',
    expected: 'AMAN',
    onset: 'cepat',
    reversible: true,
    mult: {},
    cars: 0,
    trucks: 0,
    speed: 0,
  },

  /* --- beban lalu lintas -------------------------------------------------- */

  normal: {
    key: 'normal',
    family: 'lalu-lintas',
    name: 'Normal traffic flow',
    desc: 'Mixed cars and light trucks at design speed. This is the reference for everyday structural behaviour, and this is the series recorded as the "before" trace on the Comparison page.',
    traffic: '6 cars, 2 trucks · 60 km/h',
    impact: 'None · every channel inside its safe range',
    expected: 'AMAN',
    onset: 'cepat',
    reversible: true,
    mult: { vib: 1.05, strain: 1.1, defl: 1.05, wim: 1.1 },
    cars: 6,
    trucks: 2,
    speed: 1,
  },
  padat: {
    key: 'padat',
    family: 'lalu-lintas',
    name: 'Rush hour / congestion',
    desc: 'Both lanes packed with near-stationary vehicles along the whole span. The load turns static: vibration actually drops, but deflection and strain rise and stay up for as long as the jam lasts.',
    traffic: '16 vehicles · 3 km/h',
    impact: 'Static deflection, even strain',
    expected: 'WASPADA',
    onset: 'cepat',
    reversible: true,
    mult: { vib: 0.6, strain: 1.75, defl: 1.7, wim: 1.75 },
    cars: 11,
    trucks: 5,
    speed: 0.06,
  },
  overload: {
    key: 'overload',
    family: 'lalu-lintas',
    name: 'Overloaded trucks',
    desc: 'A convoy of trucks loaded beyond the axle limit crosses nose to tail in one lane. Mid-span strain and deflection cross their critical thresholds together.',
    traffic: '4 heavy trucks · 30 km/h',
    impact: 'Mid-span strain & deflection',
    expected: 'KRITIS',
    onset: 'cepat',
    reversible: true,
    mult: { vib: 1.6, strain: 2.4, defl: 2.1, wim: 3.1, crack: 1.4 },
    cars: 1,
    trucks: 4,
    speed: 0.45,
  },

  /* --- beban lingkungan --------------------------------------------------- */

  angin: {
    key: 'angin',
    family: 'lingkungan',
    name: 'High wind',
    desc: 'Lateral wind of 45 km/h with gusts. Traffic keeps running under a speed restriction. Lateral vibration and tilt rise together, while strain barely moves.',
    traffic: '4 cars · 40 km/h',
    impact: 'Lateral vibration & tilt',
    expected: 'WASPADA',
    onset: 'sedang',
    reversible: true,
    mult: { vib: 2.2, tilt: 2.2, wind: 3.2, strain: 1.15 },
    cars: 4,
    trucks: 0,
    speed: 0.7,
  },
  panas: {
    key: 'panas',
    family: 'lingkungan',
    name: 'Extreme midday heat',
    desc: 'Steel surface temperature reaches 48 °C. Expansion is restrained at the bearings, so thermal strain appears — strain rises without a single extra vehicle on the bridge.',
    traffic: '3 cars, 1 truck · 60 km/h',
    impact: 'Thermal strain, expansion joints',
    expected: 'WASPADA',
    onset: 'sedang',
    reversible: true,
    mult: { temp: 1.55, strain: 1.72, defl: 1.3, tilt: 1.4 },
    cars: 3,
    trucks: 1,
    speed: 1,
  },

  /* --- kerusakan struktur ------------------------------------------------- */

  retak: {
    key: 'retak',
    family: 'kerusakan',
    name: 'Fatigue crack in girder',
    desc: 'A fatigue crack in the bottom chord of panel 6, growing slowly under repeated traffic loading. The crack opening passes the warning threshold and does not close again once the load is gone.',
    traffic: '6 cars, 2 trucks · 60 km/h',
    impact: 'Crack opening, local strain',
    expected: 'WASPADA',
    onset: 'bertahap',
    reversible: false,
    mult: { crack: 2.4, strain: 1.35, vib: 1.2 },
    residual: { crack: 2.3, strain: 1.12 },
    cars: 6,
    trucks: 2,
    speed: 1,
    damaged: ['bc5z0', 'bc5z1', 'd5z0', 'd5z1'],
  },
  bearing: {
    key: 'bearing',
    family: 'kerusakan',
    name: 'Bearing failure',
    desc: 'The east bearing has deformed, so the deck tilts and the load is no longer distributed evenly. Tilt passes its critical threshold and stays there even with traffic stopped.',
    traffic: '5 cars, 1 truck · 60 km/h',
    impact: 'Bearing tilt, asymmetric deflection',
    expected: 'KRITIS',
    onset: 'bertahap',
    reversible: false,
    mult: { tilt: 3.6, defl: 1.6, strain: 1.4, vib: 1.25 },
    residual: { tilt: 2.9, defl: 1.35 },
    cars: 5,
    trucks: 1,
    speed: 1,
    damaged: ['bearE0', 'bearE1'],
  },
  gerusan: {
    key: 'gerusan',
    family: 'kerusakan',
    name: 'Post-flood pier scour',
    desc: 'Flood flow has scoured the bed around the west support and the foundation has settled. Deflection and tilt cross their critical thresholds together, and heavy traffic has already been diverted.',
    traffic: '3 cars, 1 truck · 30 km/h',
    impact: 'Support settlement, deflection & tilt',
    expected: 'KRITIS',
    onset: 'bertahap',
    reversible: false,
    mult: { defl: 2.2, tilt: 3.1, strain: 1.8, crack: 1.6 },
    residual: { defl: 1.75, tilt: 2.3, strain: 1.25 },
    cars: 3,
    trucks: 1,
    speed: 0.45,
    environment: { flood: 1 },
    damaged: ['bearW0', 'bearW1', 'bc0z0', 'bc0z1', 'v-1z0', 'v-1z1'],
  },
};

/** Urutan tampil: menaik di dalam tiap keluarga. */
export const SCENARIO_ORDER = [
  'normal',
  'padat',
  'overload',
  'angin',
  'panas',
  'retak',
  'bearing',
  'gerusan',
];

export const FAMILY_ORDER: ScenarioFamily[] = ['lalu-lintas', 'lingkungan', 'kerusakan'];

export const scenariosOf = (family: ScenarioFamily) =>
  SCENARIO_ORDER.map((key) => SCENARIOS[key]).filter((item) => item.family === family);

/** Skenario yang dipakai sebagai acuan "kondisi normal" di halaman Perbandingan. */
export const REFERENCE_SCENARIOS = ['idle', 'normal'];

export const SPEED_LABEL: Record<string, string> = {
  '1': '60 km/h',
  '0.7': '40 km/h',
  '0.45': '30 km/h',
  '0.06': '3 km/h',
  '0': '—',
};
