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

/**
 * Kamera pemantau.
 *
 * `view` menentukan gambar peraga mana yang digambar ubinnya — arah pandang
 * kamera, bukan hiasan: apa yang terlihat dari oprit berbeda dari apa yang
 * terlihat dari tengah bentang, dan operator mengenali kameranya justru dari
 * situ.
 */
export interface Camera {
  id: string;
  place: string;
  view: 'oprit' | 'bentang' | 'tumpuan';
  resolution: string;
  fps: number;
  ptz: boolean;
  status: 'daring' | 'gangguan' | 'luring';
  recording: boolean;
  /** Kanal sensor yang diawasi kamera ini, bila ada. */
  channel?: string;
  /** Keterangan tambahan; diisi saat statusnya bukan `daring`. */
  note?: string;
}

export interface Contact {
  role: string;
  name: string;
  unit: string;
}

/**
 * Simpul lapangan yang sedang tidak melapor.
 *
 * Jumlah node terpasang (`bridge.sensorCount`) menghitung seluruh titik ukur
 * di lapangan, sedangkan `sensors` di bawah hanya mendaftar satu unit acuan
 * per kanal. Yang membedakan "47 node terpasang" dari "46 node melapor"
 * karena itu tidak dapat disimpulkan dari daftar unit — ia harus ditulis, dan
 * inilah tempatnya.
 */
export interface OfflineNode {
  id: string;
  place: string;
  /** Sejak kapan simpulnya berhenti melapor. */
  since: string;
  reason: string;
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
  offlineNodes: OfflineNode[];
  cameras: Camera[];
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
  offlineNodes: [
    { id: 'SNS-23', place: 'Rangka atas panel 7, sisi utara', since: '2026-09-19T04:12:00+07:00', reason: 'Modul radio tidak menjawab sejak pemadaman listrik' },
  ],
  cameras: [
    { id: 'CAM-01', place: 'Oprit barat, menghadap timur', view: 'oprit', resolution: '1920 × 1080', fps: 25, ptz: true, status: 'daring', recording: true },
    { id: 'CAM-02', place: 'Oprit timur, menghadap barat', view: 'oprit', resolution: '1920 × 1080', fps: 25, ptz: true, status: 'daring', recording: true },
    { id: 'CAM-03', place: 'Tengah bentang, sisi hulu', view: 'bentang', resolution: '1280 × 720', fps: 25, ptz: false, status: 'gangguan', recording: true, note: 'Lebar pita turun; siaran diturunkan ke 720p' },
    { id: 'CAM-04', place: 'Tumpuan timur, bawah lantai', view: 'tumpuan', resolution: '1920 × 1080', fps: 25, ptz: false, status: 'daring', recording: true, channel: 'tilt' },
    { id: 'CAM-05', place: 'Pendekat barat, sejajar WIM', view: 'oprit', resolution: '1920 × 1080', fps: 25, ptz: false, status: 'daring', recording: true, channel: 'wim' },
    { id: 'CAM-06', place: 'Pilar tengah, sisi hilir', view: 'tumpuan', resolution: '1280 × 720', fps: 15, ptz: false, status: 'luring', recording: false, note: 'Kabel serat putus sejak 14 Sep 2026; perbaikan terjadwal' },
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

/**
 * Bentuk lalu lintas sepanjang hari.
 *
 * Berkas aset hanya menyimpan satu angka — lalu lintas harian rata-rata — dan
 * angka itu dibagi dua puluh empat akan menyebut jam tiga pagi sama ramainya
 * dengan jam lima sore. Bobot di bawah ini yang membentuknya kembali: dua
 * puncak, pagi dan sore, dengan lembah dini hari. Bobotnya relatif; yang
 * dipakai adalah bagiannya terhadap jumlah seluruhnya, jadi menambah atau
 * mengurangi satu angka tidak merusak yang lain.
 *
 * **Data peraga.** Di sistem sungguhan bentuk ini datang dari pencacah lalu
 * lintas yang sama yang memberi makan WIM.
 */
const PROFIL_JAM = [
  0.010, 0.008, 0.008, 0.010, 0.018, 0.032, 0.058, 0.075, 0.066, 0.055, 0.050, 0.050,
  0.052, 0.050, 0.050, 0.055, 0.068, 0.080, 0.070, 0.055, 0.042, 0.032, 0.024, 0.016,
];
const PROFIL_TOTAL = PROFIL_JAM.reduce((a, b) => a + b, 0);
const PROFIL_PUNCAK = Math.max(...PROFIL_JAM);

export interface TrafficRate {
  /** Perkiraan kendaraan per jam pada jam cuplikan. */
  perHour: number;
  /** Bagian kendaraan berat, mengikuti berkas aset. */
  heavyPerHour: number;
  /** Jamnya sedang menanjak dibanding jam sebelumnya. */
  rising: boolean;
  /** Jamnya termasuk jam puncak. */
  peak: boolean;
}

export function lalulintasPerJam(
  dossier: BridgeDossier | null,
  at: string | number,
): TrafficRate | null {
  if (!dossier) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  const h = date.getHours();
  const bagian = PROFIL_JAM[h] / PROFIL_TOTAL;
  const perHour = Math.round(dossier.trafficPerDay * bagian);
  return {
    perHour,
    heavyPerHour: Math.round(perHour * dossier.heavyShare),
    rising: PROFIL_JAM[h] > PROFIL_JAM[(h + 23) % 24],
    peak: PROFIL_JAM[h] >= PROFIL_PUNCAK * 0.85,
  };
}

/**
 * Batas baterai yang sudah pantas diganti.
 *
 * Bukan batas mati: simpul dengan baterai 72 % masih melapor sepanjang hari.
 * Ia batas **jadwal** — di bawah angka ini penggantian harus sudah masuk
 * rencana kunjungan berikutnya, karena satu kunjungan lapangan jauh lebih
 * mahal daripada satu baterai.
 */
export const BATERAI_RENDAH = 75;

export interface NodeInventory {
  /** Simpul terpasang seluruhnya. */
  total: number;
  /** Simpul yang melapor pada cuplikan terakhir. */
  online: number;
  offline: OfflineNode[];
  /** Unit yang baterainya sudah di bawah `BATERAI_RENDAH`. */
  lowBattery: SensorUnit[];
}

/**
 * Keadaan jaringan simpul: berapa yang melapor, berapa yang tidak, dan berapa
 * yang baterainya menipis.
 *
 * Angka ini menjawab pertanyaan yang tidak dijawab satu pun kanal: apakah
 * "seluruh kanal aman" itu berarti jembatannya aman, atau berarti alat yang
 * seharusnya melaporkan keadaan buruk sedang mati. Dashboard yang menampilkan
 * delapan kanal hijau di atas dua simpul yang padam sedang menampilkan
 * ketenangan yang tidak dimilikinya.
 */
export function inventarisNode(sensorCount: number, dossier: BridgeDossier | null): NodeInventory {
  const offline = dossier?.offlineNodes ?? [];
  const lowBattery = (dossier?.sensors ?? []).filter((unit) => unit.battery < BATERAI_RENDAH);
  return {
    total: sensorCount,
    online: Math.max(0, sensorCount - offline.length),
    offline,
    lowBattery,
  };
}

/** Pekerjaan terjadwal terdekat yang belum dimulai. */
export const pekerjaanBerikutnya = (dossier: BridgeDossier): MaintenanceRecord | null =>
  [...dossier.maintenance]
    .filter((item) => item.status === 'Direncanakan')
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
