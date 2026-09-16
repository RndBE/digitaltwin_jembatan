/**
 * Data peraga.
 *
 * Seluruh isi berkas ini adalah data karangan untuk keperluan demonstrasi dan
 * presentasi — riwayat inspeksi, pekerjaan pemeliharaan, inventaris sensor, dan
 * kontak penanggung jawab. Tidak satu pun berasal dari catatan lapangan.
 *
 * Dipisahkan dari `bridges.ts` supaya jelas mana yang harus diganti ketika
 * aplikasi disambungkan ke data sungguhan: katalog jembatan dan telemetri
 * datang dari API, sedangkan berkas ini dibuang seluruhnya.
 */

export interface Inspection {
  date: string;
  kind: 'Routine' | 'Detailed' | 'Special';
  inspector: string;
  /** Nilai kondisi 0–5 mengikuti kebiasaan penilaian jembatan: 0 baik, 5 kritis. */
  conditionValue: number;
  findings: string;
}

export interface MaintenanceRecord {
  date: string;
  work: string;
  element: string;
  cost: number;
  status: 'Completed' | 'In progress' | 'Planned';
}

export interface SensorUnit {
  id: string;
  channel: string;
  model: string;
  installed: string;
  battery: number;
  signal: number;
  location: string;
}

export interface Contact {
  role: string;
  name: string;
  unit: string;
}

export interface BridgeDossier {
  /** Koordinat titik tengah bentang. */
  coordinates: string;
  river: string;
  roadClass: string;
  designLoad: string;
  owner: string;
  conditionValue: number;
  trafficPerDay: number;
  /** Bagian dari lalu lintas harian yang berupa kendaraan berat. */
  heavyShare: number;
  inspections: Inspection[];
  maintenance: MaintenanceRecord[];
  sensors: SensorUnit[];
  contacts: Contact[];
}

const progo: BridgeDossier = {
  coordinates: '7°50′14″ S, 110°13′02″ E',
  river: 'Progo River',
  roadClass: 'National road, class I',
  designLoad: 'BM 100 (RSNI T-02-2005)',
  owner: 'National Road Implementation Agency',
  conditionValue: 2,
  trafficPerDay: 18400,
  heavyShare: 0.21,
  inspections: [
    { date: '2026-06-18', kind: 'Routine', inspector: 'Region II Inspection Team', conditionValue: 2, findings: 'Light corrosion on the gusset plates of panels 4–6, south side. Crack opening at girder G-6 measured 0.12 mm, still within serviceability limits.' },
    { date: '2026-02-11', kind: 'Detailed', inspector: 'PT Rekayasa Struktur Nusantara', conditionValue: 2, findings: 'Ultrasonic testing on 24 welded joints; all passed. The east bearing shows 3 mm of deformation and is being monitored.' },
    { date: '2025-09-30', kind: 'Routine', inspector: 'Region II Inspection Team', conditionValue: 1, findings: 'The west expansion joint needs cleaning. No structural findings.' },
    { date: '2025-04-22', kind: 'Special', inspector: 'Flood Response Team', conditionValue: 3, findings: 'Post-flood inspection. Scour 0.8 m deep at the right-hand pier, treated with gabions.' },
  ],
  maintenance: [
    { date: '2026-07-02', work: 'Repainting the top chord', element: 'Top chord, panels 1–10', cost: 385_000_000, status: 'In progress' },
    { date: '2026-03-14', work: 'Elastomeric bearing replacement', element: 'East bearing', cost: 512_000_000, status: 'Completed' },
    { date: '2025-11-08', work: 'Expansion joint repair', element: 'West deck joint', cost: 96_500_000, status: 'Completed' },
    { date: '2026-10-01', work: 'Girder crack injection', element: 'Girder G-6', cost: 145_000_000, status: 'Planned' },
  ],
  sensors: [
    { id: 'SNS-01', channel: 'Vibration', model: 'Triaxial accelerometer 3G', installed: '2024-05-12', battery: 86, signal: 94, location: 'Mid-span, top chord' },
    { id: 'SNS-02', channel: 'Strain', model: 'Foil strain gauge 350 Ω', installed: '2024-05-12', battery: 91, signal: 97, location: 'Bottom chord, mid-span' },
    { id: 'SNS-03', channel: 'Deflection', model: 'LVDT 100 mm', installed: '2024-05-13', battery: 78, signal: 88, location: 'Mid-span, deck' },
    { id: 'SNS-04', channel: 'Tilt', model: 'Biaxial inclinometer', installed: '2024-05-13', battery: 72, signal: 91, location: 'East bearing' },
    { id: 'SNS-05', channel: 'Temperature', model: 'RTD PT100', installed: '2024-05-14', battery: 95, signal: 99, location: 'Top chord, south side' },
    { id: 'SNS-06', channel: 'Vehicle load', model: 'Piezoelectric WIM', installed: '2024-06-02', battery: 100, signal: 96, location: 'WIM, west approach' },
    { id: 'SNS-07', channel: 'Crack', model: 'Crack meter 10 mm', installed: '2025-01-19', battery: 64, signal: 83, location: 'Girder G-6 joint' },
    { id: 'SNS-08', channel: 'Wind', model: 'Ultrasonic anemometer', installed: '2024-06-02', battery: 88, signal: 92, location: 'Pier anemometer' },
  ],
  contacts: [
    { role: 'Asset owner', name: 'Ir. Bagus Prasetya', unit: 'DIY National Road Work Unit' },
    { role: 'Monitoring coordinator', name: 'Rina Kusumawati, S.T.', unit: 'Digital Twin Unit' },
    { role: 'Emergency contact', name: 'National Road Command Post', unit: '24 hours · ext. 118' },
  ],
};

export const DOSSIERS: Record<string, BridgeDossier> = {
  'jbt-progo': progo,
};

export const dossierFor = (bridgeId: string): BridgeDossier | null => DOSSIERS[bridgeId] ?? null;

/** Keterangan nilai kondisi 0–5 yang lazim dipakai pada penilaian jembatan. */
export const CONDITION_LABELS: Record<number, string> = {
  0: 'Good · no damage',
  1: 'Light damage',
  2: 'Moderate damage',
  3: 'Severe damage',
  4: 'Critical',
  5: 'Collapsed / out of service',
};

export const rupiah = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export const tanggal = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const tanggalPendek = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Jarak sebuah tanggal dari hari ini, ditulis sebagai kalimat pendek.
 *
 * Dipakai di tempat-tempat yang hanya punya ruang satu baris: "3 bulan lalu"
 * langsung memberi tahu apakah sebuah catatan masih segar, sedangkan tanggal
 * mentah menuntut pembacanya menghitung sendiri.
 */
export const jarakWaktu = (iso: string, now: Date = new Date()) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const days = Math.round((date.getTime() - now.getTime()) / 86_400_000);
  const magnitude = Math.abs(days);
  const amount =
    magnitude < 30
      ? `${magnitude} day${magnitude === 1 ? '' : 's'}`
      : magnitude < 365
        ? `${Math.round(magnitude / 30)} month${Math.round(magnitude / 30) === 1 ? '' : 's'}`
        : `${Math.round((magnitude / 365) * 10) / 10} years`;
  if (magnitude === 0) return 'today';
  return days < 0 ? `${amount} ago` : `in ${amount}`;
};

/**
 * Berkas aset sebagai acuan bagi halaman lain.
 *
 * Telemetri hanya tahu keadaan sekarang. Yang membuat sebuah angka dapat
 * ditafsirkan justru datang dari berkas: beban rencananya berapa, kapan
 * terakhir diperiksa, apa yang ditemukan waktu itu, dan alat apa yang sedang
 * mengukur. Fungsi-fungsi di bawah ini yang menyalurkannya ke dashboard,
 * analisa, dan bilah samping — supaya halaman Data aset bukan lemari arsip
 * yang hanya dibuka kalau sedang dicari.
 */

/** Unit sensor yang mengukur sebuah kanal; dicocokkan lewat nama kanal. */
export const sensorUnitFor = (bridgeId: string, channel: string): SensorUnit | null =>
  DOSSIERS[bridgeId]?.sensors.find((unit) => unit.channel === channel) ?? null;

/** Catatan inspeksi terbaru. */
export const inspeksiTerakhir = (dossier: BridgeDossier): Inspection | null =>
  [...dossier.inspections].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

/** Pekerjaan yang sedang dikerjakan di lapangan. */
export const pekerjaanBerjalan = (dossier: BridgeDossier): MaintenanceRecord | null =>
  dossier.maintenance.find((item) => item.status === 'In progress') ?? null;

/** Pekerjaan terjadwal terdekat yang belum dimulai. */
export const pekerjaanBerikutnya = (dossier: BridgeDossier): MaintenanceRecord | null =>
  [...dossier.maintenance]
    .filter((item) => item.status === 'Planned')
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
