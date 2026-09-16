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
  kind: 'Rutin' | 'Detail' | 'Khusus';
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
  status: 'Selesai' | 'Berjalan' | 'Direncanakan';
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
  coordinates: '7°50′14″ LS, 110°13′02″ BT',
  river: 'Kali Progo',
  roadClass: 'Jalan Nasional, kelas I',
  designLoad: 'BM 100 (RSNI T-02-2005)',
  owner: 'Balai Besar Pelaksanaan Jalan Nasional',
  conditionValue: 2,
  trafficPerDay: 18400,
  heavyShare: 0.21,
  inspections: [
    { date: '2026-06-18', kind: 'Rutin', inspector: 'Tim Inspeksi Wilayah II', conditionValue: 2, findings: 'Korosi ringan pada pelat buhul panel 4–6 sisi selatan. Bukaan retak gelagar G-6 terukur 0,12 mm, belum melewati batas layan.' },
    { date: '2026-02-11', kind: 'Detail', inspector: 'PT Rekayasa Struktur Nusantara', conditionValue: 2, findings: 'Uji ultrasonik pada 24 sambungan las; seluruhnya lolos. Bantalan tumpuan timur menunjukkan deformasi 3 mm, dipantau.' },
    { date: '2025-09-30', kind: 'Rutin', inspector: 'Tim Inspeksi Wilayah II', conditionValue: 1, findings: 'Sambungan siar muai sisi barat perlu pembersihan. Tidak ada temuan struktural.' },
    { date: '2025-04-22', kind: 'Khusus', inspector: 'Tim Tanggap Banjir', conditionValue: 3, findings: 'Pemeriksaan pascabanjir. Gerusan pada pilar sisi kanan sedalam 0,8 m, ditangani dengan bronjong.' },
  ],
  maintenance: [
    { date: '2026-07-02', work: 'Pengecatan ulang rangka atas', element: 'Rangka atas panel 1–10', cost: 385_000_000, status: 'Berjalan' },
    { date: '2026-03-14', work: 'Penggantian bantalan elastomer', element: 'Tumpuan timur', cost: 512_000_000, status: 'Selesai' },
    { date: '2025-11-08', work: 'Perbaikan siar muai', element: 'Sambungan lantai sisi barat', cost: 96_500_000, status: 'Selesai' },
    { date: '2026-10-01', work: 'Injeksi retak gelagar', element: 'Gelagar G-6', cost: 145_000_000, status: 'Direncanakan' },
  ],
  sensors: [
    { id: 'SNS-01', channel: 'Getaran', model: 'Accelerometer triaksial 3G', installed: '2024-05-12', battery: 86, signal: 94, location: 'Tengah bentang, rangka atas' },
    { id: 'SNS-02', channel: 'Regangan', model: 'Strain gauge foil 350 Ω', installed: '2024-05-12', battery: 91, signal: 97, location: 'Batang bawah tengah' },
    { id: 'SNS-03', channel: 'Lendutan', model: 'LVDT 100 mm', installed: '2024-05-13', battery: 78, signal: 88, location: 'Tengah bentang, lantai' },
    { id: 'SNS-04', channel: 'Kemiringan', model: 'Inklinometer dua sumbu', installed: '2024-05-13', battery: 72, signal: 91, location: 'Tumpuan timur' },
    { id: 'SNS-05', channel: 'Suhu', model: 'RTD PT100', installed: '2024-05-14', battery: 95, signal: 99, location: 'Batang atas, sisi selatan' },
    { id: 'SNS-06', channel: 'Beban kendaraan', model: 'WIM piezoelektrik', installed: '2024-06-02', battery: 100, signal: 96, location: 'WIM pendekat barat' },
    { id: 'SNS-07', channel: 'Retak', model: 'Crack meter 10 mm', installed: '2025-01-19', battery: 64, signal: 83, location: 'Sambungan gelagar G-6' },
    { id: 'SNS-08', channel: 'Angin', model: 'Anemometer ultrasonik', installed: '2024-06-02', battery: 88, signal: 92, location: 'Anemometer pilar' },
  ],
  contacts: [
    { role: 'Penanggung jawab aset', name: 'Ir. Bagus Prasetya', unit: 'Satker Pelaksanaan Jalan Nasional DIY' },
    { role: 'Koordinator pemantauan', name: 'Rina Kusumawati, S.T.', unit: 'Unit Digital Twin' },
    { role: 'Kontak darurat', name: 'Posko Jalan Nasional', unit: '24 jam · ext. 118' },
  ],
};

export const DOSSIERS: Record<string, BridgeDossier> = {
  'jbt-progo': progo,
};

export const dossierFor = (bridgeId: string): BridgeDossier | null => DOSSIERS[bridgeId] ?? null;

/** Keterangan nilai kondisi 0–5 yang lazim dipakai pada penilaian jembatan. */
export const CONDITION_LABELS: Record<number, string> = {
  0: 'Baik · tanpa kerusakan',
  1: 'Rusak ringan',
  2: 'Rusak sedang',
  3: 'Rusak berat',
  4: 'Kritis',
  5: 'Runtuh / tidak berfungsi',
};

export const rupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export const tanggal = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const tanggalPendek = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
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
      ? `${magnitude} hari`
      : magnitude < 365
        ? `${Math.round(magnitude / 30)} bulan`
        : `${Math.round((magnitude / 365) * 10) / 10} tahun`;
  if (magnitude === 0) return 'hari ini';
  return days < 0 ? `${amount} lalu` : `dalam ${amount}`;
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
  dossier.maintenance.find((item) => item.status === 'Berjalan') ?? null;

/** Pekerjaan terjadwal terdekat yang belum dimulai. */
export const pekerjaanBerikutnya = (dossier: BridgeDossier): MaintenanceRecord | null =>
  [...dossier.maintenance]
    .filter((item) => item.status === 'Direncanakan')
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
