/**
 * Kontrak metadata model kendali bersumber.
 *
 * Bentuk berkas `parts.json` mengikuti kontrak proyek manhattan-bridge-3d
 * (CC BY 4.0): setiap bagian membawa tingkat kepercayaan geometrinya dan
 * daftar kontrol dimensi yang dipakainya, sehingga penampil dapat menyatakan
 * seberapa kuat dasar sebuah bentuk — bukan sekadar menampilkannya.
 */

export type Confidence = 'A' | 'B' | 'C' | 'D';

export type GeometryProvenance = 'MEASURED' | 'DOCUMENTED' | 'INFERRED' | 'ASSUMED';

export interface PartMetadata {
  part_id: string;
  system: string;
  subsystem: string | null;
  confidence: Confidence;
  notes: string;
  control_refs: string[];
  open_questions: string[];
  geometry_provenance: GeometryProvenance;
  material: string;
  material_confidence: Confidence;
  bbox_prototype_m: { min: number[]; max: number[]; size: number[] };
}

export interface ControlEntry {
  control_id: string;
  key: string;
  value: number;
  unit: string;
  value_m: number;
  confidence: Confidence;
  is_placeholder: boolean;
  notes: string;
}

export interface PartsDocument {
  schema_version: string;
  model: string;
  milestone: number;
  generated_at: string;
  ho_scale_denominator: number;
  confidence_colors: Record<Confidence, string>;
  controls: ControlEntry[];
  measures: Record<string, unknown>;
  parts: PartMetadata[];
}

export interface ModelConfig {
  title: string;
  subtitle: string;
  modelUrl: string;
  proxyUrl?: string;
  metadataUrl: string;
  scaleLabel: string;
  background: string;
  camera: { position: [number, number, number]; target: [number, number, number]; near: number; far: number; fov: number };
  framePadding?: number;
  credit: string;
  creditUrl?: string;
  license: string;
}

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  A: 'A · official dimensions or archive drawings',
  B: 'B · consistent photography plus control geometry',
  C: 'C · mesh alignment or photogrammetry',
  D: 'D · inferred, decorative, or provisional',
};

/** Keterangan asal-usul geometri. Solid untuk yang diketahui, putus-putus untuk yang dinalar. */
export const PROVENANCE_LABELS: Record<GeometryProvenance, string> = {
  MEASURED: 'measured · instrument readings on the real structure',
  DOCUMENTED: 'documented · position or dimension stated in a source',
  INFERRED: 'inferred · existence documented, position reasoned',
  ASSUMED: 'assumed · placed on engineering judgement, no source',
};

export const PROVENANCE_COLOR: Record<GeometryProvenance, string> = {
  MEASURED: '#2e9e4f',
  DOCUMENTED: '#3b7dd8',
  INFERRED: '#d89a3b',
  ASSUMED: '#c4453c',
};

export const SYSTEM_LABELS: Record<string, string> = {
  reference: 'Reference geometry',
  towers: 'Towers',
  anchorages: 'Anchorages',
  cables: 'Main cables',
  suspenders: 'Suspender cables',
  deck_system: 'Deck system',
  approaches: 'Approaches',
};

export const systemLabel = (key: string) => SYSTEM_LABELS[key] ?? key.replace(/_/g, ' ');

export const partLabel = (part: PartMetadata) => part.part_id.replace(/_/g, ' ');

/** Pandangan baku. `iso` memakai kamera perspektif, sisanya ortogonal. */
export type GlbViewMode = 'iso' | 'elevasi' | 'rencana' | 'potongan' | 'bawah';

export interface GlbViewPreset {
  label: string;
  description: string;
  orthographic: boolean;
  /** Vektor satuan dari titik pandang menuju kamera, dalam ruang render (Y ke atas). */
  direction: [number, number, number];
  up: [number, number, number];
}

export const GLB_VIEW_PRESETS: Record<GlbViewMode, GlbViewPreset> = {
  iso: {
    label: 'Isometric',
    description: 'Free perspective. The only mode with foreshortening, so lengths must not be measured off the screen.',
    orthographic: false,
    direction: [0.86, 0.32, 0.4],
    up: [0, 1, 0],
  },
  elevasi: {
    label: 'Elevation',
    description: 'Looking at the side of the bridge. Cable sag, tower height, and the approach profile read true.',
    orthographic: true,
    direction: [0, 0, 1],
    up: [0, 1, 0],
  },
  rencana: {
    label: 'Plan',
    description: 'Looking straight down. Deck width and the anchorage footprint read true.',
    orthographic: true,
    direction: [0, 1, 0],
    up: [0, 0, -1],
  },
  potongan: {
    label: 'Section',
    description: 'Looking along the bridge axis. The transverse arrangement of deck and truss.',
    orthographic: true,
    direction: [1, 0, 0],
    up: [0, 1, 0],
  },
  bawah: {
    label: 'Underside',
    description: 'Looking straight up from underneath — the view someone standing below actually gets.',
    orthographic: true,
    direction: [0, -1, 0],
    up: [0, 0, 1],
  },
};

export const GLB_VIEW_ORDER: GlbViewMode[] = ['iso', 'elevasi', 'rencana', 'potongan', 'bawah'];

/**
 * Panjang batang ukur yang bulat dan enak dibaca untuk skala layar tertentu.
 * Melangkah pada 1, 2, 5 × 10ⁿ: batang 100 m lebih mudah dinalar daripada 137 m.
 */
export function niceScaleLength(metresPerPixel: number, targetPx = 130): number {
  const raw = metresPerPixel * targetPx;
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const exponent = Math.floor(Math.log10(raw));
  const decade = Math.pow(10, exponent);
  const mantissa = raw / decade;
  const step = mantissa >= 5 ? 5 : mantissa >= 2 ? 2 : 1;
  return step * decade;
}
