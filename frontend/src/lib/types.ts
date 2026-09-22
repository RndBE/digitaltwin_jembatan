export type Status = 'AMAN' | 'WASPADA' | 'KRITIS';
export type RiskLevel = 'RENDAH' | 'SEDANG' | 'TINGGI' | 'KRITIS';
export type Priority = 'RENDAH' | 'SEDANG' | 'KRITIS';

export interface SensorSpec {
  id: string;
  name: string;
  unit: string;
  base: number;
  warn: number;
  crit: number;
  /** Jumlah angka di belakang koma saat nilai ditampilkan. */
  dec: number;
  /** Bobot kanal dalam perhitungan skor risiko. */
  weight: number;
  /** Lokasi fisik titik ukur pada struktur. */
  node: string;
}

export interface Reading {
  id: string;
  name: string;
  unit: string;
  node: string;
  value: number;
  baseline: number;
  warn: number;
  crit: number;
  status: Status;
  deltaPct: number;
}

/** Asal beban yang dimodelkan sebuah skenario. */
export type ScenarioFamily = 'lalu-lintas' | 'lingkungan' | 'kerusakan';

export interface Scenario {
  key: string;
  family: ScenarioFamily;
  name: string;
  desc: string;
  traffic: string;
  impact: string;
  expected: Status;
  /** Seberapa cepat kanal bergerak menuju kondisi baru. */
  onset: 'cepat' | 'sedang' | 'bertahap';
  /** Apakah pembacaan kembali ke nilai dasar setelah skenario dihentikan. */
  reversible: boolean;
  mult: Record<string, number>;
  /**
   * Pengali yang tertinggal setelah skenario dihentikan — hanya pada keluarga
   * kerusakan. Dibersihkan lewat pencatatan perbaikan, bukan dengan menunggu.
   */
  residual?: Record<string, number>;
  cars: number;
  trucks: number;
  /**
   * Truk tronton — kendaraan bersumbu banyak yang bobotnya jauh di atas truk
   * biasa. Dipisahkan dari `trucks` karena yang membedakannya bukan jumlah
   * melainkan bentuk dan bobotnya, dan keduanya harus terlihat di model:
   * skenario yang berjudul "melebihi batas gandar" tetapi menggambar truk
   * boks biasa tidak memperlihatkan apa pun yang melebihi batas gandar.
   */
  tronton?: number;
  speed: number;
  damaged?: string[];
  /**
   * Keadaan lingkungan yang tidak terbaca sensor mana pun, tetapi terlihat di
   * model: muka air sungai. Angin tidak perlu ditulis di sini karena sudah ada
   * anemometernya — kantong angin pada model membaca kanal itu langsung.
   */
  environment?: {
    /** Muka air banjir, 0 (normal) sampai 1 (banjir penuh). */
    flood?: number;
  };
}

export interface AlertEvent {
  at: string;
  sensorId: string | null;
  level: Status;
  text: string;
}

export interface Maintenance {
  priority: Priority;
  recommendation: string;
  timeline: string;
  dueDays: number;
  items: string[];
}

export interface Assessment {
  health: number;
  risk: { score: number; level: RiskLevel };
  status: Status;
  maintenance: Maintenance;
  breakdown: Array<{ id: string; name: string; value: number; unit: string; pct: number; status: Status }>;
  sensorCount: number;
}

export interface BridgeModelSpec {
  kind: 'procedural' | 'glb';
  /** procedural: jumlah panel rangka dan panjang bentang dalam satuan adegan */
  panels?: number;
  spanUnits?: number;
  /** glb: berkas dan manifes bagian */
  url?: string;
  proxyUrl?: string;
  metadataUrl?: string;
  configUrl?: string;
  credit?: string;
}

export interface Bridge {
  id: string;
  name: string;
  location: string;
  type: string;
  spanMeters: number;
  widthMeters: number;
  lanes: number;
  builtYear: number;
  lastInspection: string;
  sensorCount: number;
  environmentalBias?: number;
  reference?: boolean;
  model: BridgeModelSpec;
}

export interface Telemetry {
  bridgeId: string;
  /** Kanal yang masih membawa sisa kerusakan, beserta pengalinya. */
  residual?: Record<string, number>;
  at: string;
  scenario: string;
  scenarioName: string;
  paused: boolean;
  runtimeSeconds: number;
  packets: number;
  readings: Reading[];
  traffic: { cars: number; trucks: number; speedFactor: number };
  damagedParts: string[];
  assessment: Assessment;
}

export interface SeriesFrame {
  sensorId: string;
  values: number[];
  baseline: number[];
}

/** Sumber data yang sedang dipakai antarmuka. */
export type DataSource = 'api' | 'lokal';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
}
