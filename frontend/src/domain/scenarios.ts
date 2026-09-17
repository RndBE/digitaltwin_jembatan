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
  'lalu-lintas': 'Beban lalu lintas',
  lingkungan: 'Beban lingkungan',
  kerusakan: 'Kerusakan struktur',
};

export const FAMILY_NOTES: Record<ScenarioFamily, string> = {
  'lalu-lintas':
    'Beban kendaraan yang melintas. Struktur bekerja di rentang elastis: seluruh pembacaan kembali ke nilai dasarnya begitu beban meninggalkan bentang.',
  lingkungan:
    'Angin dan suhu. Tidak merusak struktur, tetapi mempersempit sisa jarak menuju ambang — dan pemulihannya mengikuti cuaca, bukan lalu lintas.',
  kerusakan:
    'Kerusakan pada elemen struktur. Tidak pulih sendiri: setelah skenario dihentikan, kanal yang terdampak tetap berada di atas nilai dasarnya sampai perbaikan dicatat.',
};

/** Laju pendekatan menuju kondisi baru, per langkah simulasi. */
export const ONSET_RATE: Record<Scenario['onset'], number> = {
  cepat: 0.09,
  sedang: 0.045,
  bertahap: 0.018,
};

export const ONSET_LABEL: Record<Scenario['onset'], string> = {
  cepat: 'Cepat · hitungan detik',
  sedang: 'Sedang · hitungan menit',
  bertahap: 'Bertahap · berkembang perlahan',
};

export const SCENARIOS: Record<string, Scenario> = {
  idle: {
    key: 'idle',
    family: 'lalu-lintas',
    name: 'Pemantauan langsung',
    desc: 'Tidak ada skenario yang dipaksakan. Nilai sensor mengikuti kondisi layan normal, ditambah sisa kerusakan yang belum diperbaiki bila ada.',
    traffic: '—',
    impact: 'Tidak ada',
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
    name: 'Arus lalu lintas normal',
    desc: 'Arus campuran mobil dan truk ringan pada kecepatan rencana. Inilah acuan perilaku struktur sehari-hari, dan deret inilah yang direkam sebagai pembanding di halaman Perbandingan.',
    traffic: '6 mobil, 2 truk · 60 km/j',
    impact: 'Tidak ada · seluruh kanal di rentang aman',
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
    name: 'Jam sibuk / kemacetan',
    desc: 'Kedua lajur terisi penuh kendaraan yang hampir berhenti sepanjang bentang. Beban menjadi statis: getaran justru turun, tetapi lendutan dan regangan naik dan bertahan selama kemacetan berlangsung.',
    traffic: '16 kendaraan · 3 km/j',
    impact: 'Lendutan statis, regangan merata',
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
    name: 'Truk melebihi batas gandar',
    desc: 'Iring-iringan truk bermuatan di atas batas gandar melintas beriringan di satu lajur. Regangan dan lendutan tengah bentang melewati ambang kritis bersamaan.',
    traffic: '4 truk berat · 30 km/j',
    impact: 'Regangan & lendutan tengah bentang',
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
    name: 'Angin kencang',
    desc: 'Angin lateral 45 km/jam dengan hembusan. Lalu lintas tetap berjalan dengan pembatasan kecepatan. Getaran lateral dan kemiringan naik bersama, sementara regangan hampir tidak berubah.',
    traffic: '4 mobil · 40 km/j',
    impact: 'Getaran lateral & kemiringan',
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
    name: 'Suhu ekstrem siang hari',
    desc: 'Suhu permukaan baja mencapai 48 °C. Pemuaian tertahan di tumpuan sehingga muncul regangan termal — regangan naik tanpa ada tambahan beban kendaraan sama sekali.',
    traffic: '3 mobil, 1 truk · 60 km/j',
    impact: 'Regangan termal, sambungan siar muai',
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
    name: 'Retak lelah pada girder',
    desc: 'Retak lelah pada batang bawah panel ke-6, tumbuh perlahan seiring beban lalu lintas berulang. Bukaan retak melewati ambang waspada dan tidak menutup kembali setelah beban hilang.',
    traffic: '6 mobil, 2 truk · 60 km/j',
    impact: 'Bukaan retak, regangan lokal',
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
    name: 'Kegagalan bantalan tumpuan',
    desc: 'Bantalan tumpuan timur terdeformasi sehingga lantai miring dan beban terdistribusi tidak merata. Kemiringan melewati ambang kritis dan bertahan walau lalu lintas dihentikan.',
    traffic: '5 mobil, 1 truk · 60 km/j',
    impact: 'Kemiringan tumpuan, lendutan asimetris',
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
    name: 'Gerusan pilar pascabanjir',
    desc: 'Aliran banjir menggerus dasar di sekitar tumpuan barat sehingga pondasi turun. Lendutan dan kemiringan melewati ambang kritis bersamaan, dan lalu lintas berat sudah dialihkan.',
    traffic: '3 mobil, 1 truk · 30 km/j',
    impact: 'Penurunan tumpuan, lendutan & kemiringan',
    expected: 'KRITIS',
    onset: 'bertahap',
    reversible: false,
    /*
     * Regangan ditahan di bawah ambang waspada (85 × 1,3 ≈ 111 µm/m), lebih
     * rendah daripada kegagalan bantalan yang lalu lintasnya justru lebih
     * berat. Regangan batang bawah terutama dibentuk beban hidup, dan pada
     * skenario ini lalu lintas berat sudah dialihkan — yang tersisa hanya
     * pembagian ulang gaya akibat tumpuan yang turun. Menaikkannya sampai
     * waspada membuat panel sensor bertentangan dengan ceritanya sendiri:
     * vonis KRITIS di sini datang dari lendutan dan kemiringan, bukan regangan.
     *
     * Sisanya 1,15: penurunan tumpuan tidak naik kembali setelah lalu lintas
     * dihentikan, jadi sebagian besar kenaikan itu menetap sampai diperbaiki.
     */
    mult: { defl: 2.2, tilt: 3.1, strain: 1.3, crack: 1.6 },
    residual: { defl: 1.75, tilt: 2.3, strain: 1.15 },
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

/**
 * Skenario yang berjalan saat aplikasi dibuka.
 *
 * Bukan `idle`: bentang yang kosong tidak mengatakan apa-apa tentang jembatan
 * yang dipantau, dan angka yang pertama dibaca pengunjung sebaiknya angka
 * kondisi layan sehari-hari — jembatan yang sedang bekerja menahan lalu lintas
 * rencananya. `normal` juga termasuk `REFERENCE_SCENARIOS`, jadi rekaman acuan
 * halaman Perbandingan tetap terisi sejak detik pertama.
 */
export const DEFAULT_SCENARIO = 'normal';

/** Skenario yang dipakai sebagai acuan "kondisi normal" di halaman Perbandingan. */
export const REFERENCE_SCENARIOS = ['idle', 'normal'];

export const SPEED_LABEL: Record<string, string> = {
  '1': '60 km/j',
  '0.7': '40 km/j',
  '0.45': '30 km/j',
  '0.06': '3 km/j',
  '0': '—',
};
