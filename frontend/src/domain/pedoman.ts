/**
 * Pedoman Pemeriksaan Jembatan No. 01/P/BM/2022 (Ditjen Bina Marga).
 *
 * Modul ini memuat dua hal dari pedoman itu dan tidak lebih:
 *
 *   1. **Kode elemen** — hierarki Level 1 sampai 4 menurut Lampiran B, dibatasi
 *      pada bagian yang ada pada jembatan rangka baja di aplikasi ini
 *      (Bangunan Atas: Rangka, Sistem Lantai, Perletakan, Pengaman Pengguna
 *      Jalan). Bangunan Bawah, Aliran Sungai, dan Jalan Pendekat belum
 *      dimuat karena belum ada elemennya di model.
 *   2. **Penilaian kerusakan** — kode kerusakan Lampiran C, kriteria S/R/K
 *      Lampiran D, dan rumus Nilai Kondisi `NK = S + R + K + F + P` (Bab 5.7,
 *      Tabel F.1).
 *
 * Yang sengaja **tidak** ada: penggabungan dengan sensor. Pedoman tidak
 * mengatur itu (Bab 1 mengecualikan evaluasi yang menggabungkan pemeriksaan
 * visual, khusus, dan SHM), jadi Nilai Kondisi di sini murni hasil pemeriksa
 * dan tidak pernah bercampur dengan skor telemetri di `condition.ts`.
 *
 * Kriteria S dan R disalin dari tabel Lampiran D dan diperiksa terhadap
 * halaman aslinya; nomor halaman tercetak dicantumkan di `rujukan` supaya
 * pemeriksa dapat mencocokkannya. Kode yang tidak diperlukan jembatan rangka
 * baja (kayu, pasangan batu, kabel) tidak dimuat.
 */

export type Biner = 0 | 1;
export type Bahan = 'baja' | 'beton';

/* ------------------------------------------------------------ kode kerusakan */

/** Satu baris kolom "Pengukuran" Lampiran D; menentukan R. */
export interface PilihanUkur {
  label: string;
  r: Biner;
}

/** Satu baris kolom "Penyebab" Lampiran D; dipakai bila S bergantung penyebab. */
export interface PilihanSebab {
  label: string;
  s: Biner;
}

export interface KodeKerusakan {
  kode: string;
  nama: string;
  /** Pengelompokan di daftar pilihan. */
  kelompok: string;
  /** S bila tidak bergantung penyebab: 1 berbahaya, 0 tidak berbahaya. */
  s: Biner;
  sebab?: PilihanSebab[];
  ukur: PilihanUkur[];
  /** Cara menghitung K: apa yang diukur, dan terhadap apa dibandingkan. */
  volume: string;
  total: string;
  satuan: string;
  /** Tabel dan nomor halaman tercetak di pedoman. */
  rujukan: string;
}

const BAJA = 'Kerusakan bahan baja';
const BETON = 'Kerusakan bahan beton';

const KERUSAKAN_LIST: KodeKerusakan[] = [
  {
    kode: '301',
    nama: 'Penurunan mutu proteksi korosi (cat/pelapis)',
    kelompok: BAJA,
    s: 1,
    sebab: [
      { label: 'Penuaan', s: 1 },
      { label: 'Retak', s: 0 },
      { label: 'Lembab (akibat korosi)', s: 1 },
      { label: 'Tindakan kekerasan', s: 0 },
      { label: 'Pemakaian / terkikis', s: 1 },
    ],
    ukur: [
      { label: 'Permukaan dasar baja belum terlihat', r: 0 },
      { label: 'Sebaliknya (baja dasar sudah terlihat)', r: 1 },
    ],
    volume: 'Luas kerusakan pada permukaan baja',
    total: 'Luas permukaan total elemen baja sesuai level pemeriksaan',
    satuan: 'm²',
    rujukan: 'D.3 hlm. 147',
  },
  {
    kode: '302',
    nama: 'Karat',
    kelompok: BAJA,
    s: 1,
    ukur: [
      { label: 'Belum ada titik karat, lapisan menipis, atau karat tipis ≤ 10% dimensi penampang', r: 0 },
      { label: 'Lapisan sudah rusak, karat di ujung/goresan/baut, atau > 10% dimensi penampang', r: 1 },
    ],
    volume: 'Luas permukaan baja yang berkarat',
    total: 'Luas permukaan total elemen baja sesuai level pemeriksaan',
    satuan: 'm²',
    rujukan: 'D.3 hlm. 147',
  },
  {
    kode: '303',
    nama: 'Perubahan bentuk pada komponen',
    kelompok: BAJA,
    s: 1,
    ukur: [
      { label: 'Elemen struktural, ≤ 20 mm (tegak lurus sumbu memanjang)', r: 0 },
      { label: 'Elemen struktural, > 20 mm', r: 1 },
      { label: 'Elemen non-struktural', r: 0 },
    ],
    volume: 'Tinggi/lebar permukaan baja yang berubah bentuk',
    total: 'Tinggi (dimensi) elemen sesuai level pemeriksaan',
    satuan: 'm',
    rujukan: 'D.3 hlm. 147',
  },
  {
    kode: '304',
    nama: 'Retak (elemen baja dan las)',
    kelompok: BAJA,
    s: 1,
    ukur: [{ label: 'Di mana saja', r: 1 }],
    volume: 'Panjang permukaan baja yang mengalami retak',
    total: 'Dimensi panjang total elemen sesuai level pemeriksaan',
    satuan: 'm',
    rujukan: 'D.3 hlm. 148',
  },
  {
    kode: '305',
    nama: 'Komponen rusak/hilang (sobek, abrasi)',
    kelompok: BAJA,
    s: 1,
    ukur: [
      { label: 'Elemen struktural', r: 1 },
      { label: 'Elemen non-struktural', r: 0 },
    ],
    volume: 'Jumlah komponen yang hilang',
    total: 'Jumlah total komponen sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.3 hlm. 148',
  },
  {
    kode: '306',
    nama: 'Elemen yang salah pemasangan',
    kelompok: BAJA,
    s: 1,
    ukur: [
      { label: 'Dimensi lebih kecil', r: 1 },
      { label: 'Sebaliknya', r: 0 },
    ],
    volume: 'Jumlah elemen yang salah pemasangannya',
    total: 'Jumlah total elemen sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.3 hlm. 148',
  },
  {
    kode: '308',
    nama: 'Sambungan yang longgar',
    kelompok: BAJA,
    s: 1,
    ukur: [{ label: 'Apa saja', r: 1 }],
    volume: 'Jumlah baut yang longgar dalam satu titik buhul',
    total: 'Jumlah total baut dalam satu titik buhul',
    satuan: 'buah',
    rujukan: 'D.3 hlm. 148',
  },

  {
    kode: '201',
    nama: 'Beton rontok/spalling, keropos, berongga, mutu rendah',
    kelompok: BETON,
    s: 1,
    ukur: [
      { label: 'Tulangan tidak terlihat', r: 0 },
      { label: 'Tulangan terlihat', r: 1 },
      { label: 'Terlihat adanya rembesan', r: 1 },
    ],
    volume: 'Luas permukaan / volume beton yang rontok, keropos, atau berongga',
    total: 'Luas permukaan / volume elemen beton sesuai level pemeriksaan',
    satuan: 'm²',
    rujukan: 'D.2 hlm. 143',
  },
  {
    kode: '202',
    nama: 'Retak (elemen beton)',
    kelompok: BETON,
    s: 1,
    sebab: [
      { label: 'Beban berlebih / kapasitas tidak mencukupi', s: 1 },
      { label: 'Gaya pratekan', s: 1 },
      { label: 'Retak di sambungan segmen/diafragma ke gelagar', s: 1 },
      { label: 'Karbonasi', s: 1 },
      { label: 'Benturan', s: 1 },
      { label: 'Kegagalan fondasi', s: 1 },
      { label: 'Susut', s: 0 },
      { label: 'Tumbuhan (retak bertambah lebar)', s: 1 },
    ],
    ukur: [
      { label: 'Lebar < 0,2 mm', r: 0 },
      { label: 'Lebar ≥ 0,2 mm', r: 1 },
      { label: 'Terlihat rembesan atau bocor', r: 1 },
      { label: 'Susut/tumbuhan: lebar < 0,4 mm', r: 0 },
      { label: 'Susut/tumbuhan: lebar ≥ 0,4 mm', r: 1 },
    ],
    volume: 'Panjang retak pada elemen beton (atau luas permukaan yang retak)',
    total: 'Ketinggian/lebar elemen (atau luas permukaan elemen)',
    satuan: 'm',
    rujukan: 'D.2 hlm. 144',
  },
  {
    kode: '203',
    nama: 'Karat baja tulangan',
    kelompok: BETON,
    s: 1,
    ukur: [
      { label: '≤ 10% dari diameter tulangan', r: 0 },
      { label: '> 10% dari diameter tulangan', r: 1 },
    ],
    volume: 'Panjang tulangan yang terkorosi',
    total: 'Panjang total tulangan sesuai level pemeriksaan',
    satuan: 'm',
    rujukan: 'D.2 hlm. 145',
  },
  {
    kode: '204',
    nama: 'Kotor, berlumut, penuaan/pelapukan beton, rembesan',
    kelompok: BETON,
    s: 1,
    ukur: [
      { label: '≤ selimut beton', r: 0 },
      { label: '> selimut beton', r: 1 },
    ],
    volume: 'Luas elemen yang mengalami kerusakan 204',
    total: 'Luas permukaan beton total elemen sesuai level pemeriksaan',
    satuan: 'm²',
    rujukan: 'D.2 hlm. 145',
  },
  {
    kode: '205',
    nama: 'Pecah atau hilangnya bahan (delaminasi, abrasi, aus)',
    kelompok: BETON,
    s: 1,
    ukur: [
      { label: 'Elemen struktural', r: 1 },
      { label: 'Elemen non-struktural', r: 0 },
    ],
    volume: 'Luas/volume elemen beton yang pecah atau hilang',
    total: 'Luas permukaan / volume beton total elemen',
    satuan: 'm²',
    rujukan: 'D.2 hlm. 145',
  },
  {
    kode: '206',
    nama: 'Lendutan (elemen beton)',
    kelompok: BETON,
    s: 1,
    ukur: [
      { label: 'Lantai: ≤ 1/600', r: 0 },
      { label: 'Lantai: > 1/600', r: 1 },
      { label: 'Elemen lain: ≤ 20 mm', r: 0 },
      { label: 'Elemen lain: > 20 mm', r: 1 },
    ],
    volume: 'Luas elemen yang mengalami lendutan',
    total: 'Luas lantai total sesuai level pemeriksaan',
    satuan: 'm²',
    rujukan: 'D.2 hlm. 146',
  },

  {
    kode: '601',
    nama: 'Tidak cukup tempat untuk bergerak',
    kelompok: 'Perletakan (3.610)',
    s: 1,
    ukur: [{ label: 'Apa saja', r: 1 }],
    volume: 'Jumlah landasan yang tertahan / tidak dapat bergerak',
    total: 'Jumlah total landasan sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.11 hlm. 157',
  },
  {
    kode: '602',
    nama: 'Kedudukan landasan tidak sempurna',
    kelompok: 'Perletakan (3.610)',
    s: 1,
    ukur: [
      { label: 'Gap ≤ 2 mm*', r: 0 },
      { label: 'Gap > 2 mm*', r: 1 },
      { label: 'Bagian yang tidak pada tempatnya ≤ 1/3', r: 0 },
      { label: 'Bagian yang tidak pada tempatnya > 1/3', r: 1 },
    ],
    volume: 'Jumlah landasan yang tidak tepat dudukannya',
    total: 'Jumlah total landasan sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.11 hlm. 157',
  },
  {
    kode: '603',
    nama: 'Mortar dasar retak atau rontok',
    kelompok: 'Perletakan (3.610)',
    s: 1,
    ukur: [
      { label: '≤ 15% bagian rusak', r: 0 },
      { label: '> 15% bagian rusak', r: 1 },
    ],
    volume: 'Jumlah mortar di bawah landasan yang rusak',
    total: 'Jumlah total landasan sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.11 hlm. 157',
  },
  {
    kode: '604',
    nama: 'Perpindahan / deformasi landasan berlebihan',
    kelompok: 'Perletakan (3.610)',
    s: 1,
    ukur: [
      { label: 'Perpindahan ≤ 30 mm*', r: 0 },
      { label: 'Perpindahan > 30 mm*', r: 1 },
      { label: 'Deformasi < 20% tebal landasan*', r: 0 },
      { label: 'Deformasi ≥ 20% tebal landasan*', r: 1 },
    ],
    volume: 'Jumlah landasan yang mengalami perpindahan dan deformasi berlebihan',
    total: 'Jumlah total landasan sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.11 hlm. 157',
  },
  {
    kode: '605',
    nama: 'Aus karena umur; landasan pecah, sobek, atau retak',
    kelompok: 'Perletakan (3.610)',
    // Satu-satunya kode perletakan yang tidak berbahaya menurut Lampiran D.
    s: 0,
    ukur: [
      { label: 'Aus ≤ 25%', r: 0 },
      { label: 'Aus > 25%', r: 1 },
      { label: 'Landasan pecah, sobek, atau retak', r: 1 },
    ],
    volume: 'Jumlah landasan yang aus, pecah, sobek, retak, atau hilang',
    total: 'Jumlah total landasan sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.11 hlm. 158',
  },
  {
    kode: '606',
    nama: 'Bagian rusak, hilang, atau tidak berfungsi',
    kelompok: 'Perletakan (3.610)',
    s: 1,
    ukur: [{ label: 'Apa saja', r: 1 }],
    volume: 'Jumlah landasan yang rusak, hilang, atau tidak berfungsi',
    total: 'Jumlah total landasan sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.11 hlm. 158',
  },
  {
    kode: '607',
    nama: 'Kurang pelumasan pada landasan logam',
    kelompok: 'Perletakan (3.610)',
    s: 1,
    ukur: [{ label: 'Apa saja', r: 1 }],
    volume: 'Jumlah landasan logam yang kering',
    total: 'Jumlah total landasan sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.11 hlm. 158',
  },
  {
    kode: '561',
    nama: 'Longgar, hilang, rusak, atau tidak berfungsi (pendukung landasan)',
    kelompok: 'Perletakan (3.610)',
    s: 1,
    ukur: [{ label: 'Apa saja', r: 1 }],
    volume: 'Jumlah sistem yang longgar / hilang / tidak ada',
    total: 'Jumlah sistem yang seharusnya terpasang sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.10 hlm. 156',
  },

  {
    kode: '702',
    nama: 'Lendutan lantai berlebihan',
    kelompok: 'Sistem lantai (3.500)',
    s: 1,
    ukur: [
      { label: '≤ bentang/200', r: 0 },
      { label: '> bentang/200', r: 1 },
    ],
    volume: 'Luas lantai yang mengalami lendutan',
    total: 'Luas lantai total sesuai level pemeriksaan',
    satuan: 'm²',
    rujukan: 'D.12 hlm. 159',
  },
  {
    kode: '731',
    nama: 'Permukaan trotoar licin',
    kelompok: 'Trotoar dan kerb (4.513)',
    s: 1,
    ukur: [
      { label: 'Tergelincir (skidding)', r: 1 },
      { label: 'Sebaliknya', r: 0 },
    ],
    volume: 'Luas trotoar yang licin dan/atau berlubang',
    total: 'Luas total trotoar sesuai level pemeriksaan',
    satuan: 'm²',
    rujukan: 'D.15 hlm. 162',
  },
  {
    kode: '732',
    nama: 'Lubang pada trotoar',
    kelompok: 'Trotoar dan kerb (4.513)',
    s: 1,
    ukur: [
      { label: 'Kedalaman ≤ 20 mm', r: 0 },
      { label: 'Kedalaman > 20 mm', r: 1 },
    ],
    volume: 'Luas trotoar yang licin dan/atau berlubang',
    total: 'Luas total trotoar sesuai level pemeriksaan',
    satuan: 'm²',
    rujukan: 'D.15 hlm. 162',
  },
  {
    kode: '733',
    nama: 'Bagian trotoar hilang / tidak ada',
    kelompok: 'Trotoar dan kerb (4.513)',
    s: 1,
    ukur: [{ label: 'Apa saja', r: 1 }],
    volume: 'Luas trotoar yang hilang',
    total: 'Luas total trotoar sesuai level pemeriksaan',
    satuan: 'm²',
    rujukan: 'D.15 hlm. 162',
  },
  {
    kode: '931',
    nama: 'Pengaman pengguna jalan tidak berfungsi / tidak sesuai penempatan',
    kelompok: 'Pengaman pengguna jalan (3.620)',
    // Tidak berbahaya menurut Lampiran D.20: R tetap parah, tetapi S nol.
    s: 0,
    ukur: [{ label: 'Apa saja', r: 1 }],
    volume: 'Jumlah median atau utilitas yang rusak / tidak sesuai penempatannya',
    total: 'Jumlah total yang seharusnya ada sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.20 hlm. 165',
  },
  {
    kode: '941',
    nama: 'Hilang / lepas',
    kelompok: 'SMKS (3.750)',
    s: 0,
    ukur: [
      { label: 'Membahayakan elemen struktural', r: 1 },
      { label: 'Sebaliknya', r: 0 },
    ],
    volume: 'Jumlah bagian yang hilang / lepas',
    total: 'Jumlah total elemen sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.21 hlm. 166',
  },
  {
    kode: '942',
    nama: 'Retak / rusak / tidak berfungsi',
    kelompok: 'SMKS (3.750)',
    s: 0,
    ukur: [
      { label: 'Membahayakan elemen struktural', r: 1 },
      { label: 'Sebaliknya', r: 0 },
    ],
    volume: 'Jumlah bagian yang retak / rusak / tidak berfungsi',
    total: 'Jumlah total elemen sesuai level pemeriksaan',
    satuan: 'buah',
    rujukan: 'D.21 hlm. 166',
  },
];

export const KERUSAKAN: Record<string, KodeKerusakan> = Object.fromEntries(
  KERUSAKAN_LIST.map((item) => [item.kode, item]),
);

/** Kode kerusakan bahan yang berlaku untuk tiap bahan elemen. */
const KODE_BAHAN: Record<Bahan, string[]> = {
  baja: ['301', '302', '303', '304', '305', '306', '308'],
  beton: ['201', '202', '203', '204', '205', '206'],
};

/* ------------------------------------------------------------ kode elemen */

export interface ElemenLevel4 {
  /** Kode lengkap dengan huruf, mis. `4.453b`. */
  kode: string;
  nama: string;
  /**
   * Struktural menurut definisi Bab 3 (menerima beban yang bekerja di atas
   * jembatan). Pedoman tidak mendaftar per elemen; yang di sini adalah
   * penilaian pengembang dan dapat dikoreksi pemeriksa. Dampaknya dua: ambang
   * K (30% struktural, 50% non-struktural) dan apakah elemen ikut menentukan
   * Nilai Kondisi jembatan.
   */
  struktural: boolean;
  bahan: Bahan[];
  /** Kode kerusakan elemen (Lampiran C.2) di luar kode bahan. */
  kerusakanLain?: string[];
}

export interface Klaster {
  kode: string;
  nama: string;
  elemen: ElemenLevel4[];
}

export interface ElemenUtama {
  kode: string;
  nama: string;
  /** Komponen (Level 2) tempat elemen utama ini berada. */
  komponen: { kode: string; nama: string };
  klaster: Klaster[];
}

export const LEVEL1 = { kode: '1.000', nama: 'Jembatan' } as const;
const BANGUNAN_ATAS = { kode: '2.400', nama: 'Bangunan Atas' } as const;
const PERLENGKAPAN = { kode: '2.700', nama: 'Perlengkapan' } as const;

const baja = (kode: string, nama: string, struktural = true, kerusakanLain?: string[]): ElemenLevel4 => ({
  kode,
  nama,
  struktural,
  bahan: ['baja'],
  kerusakanLain,
});

/** Elemen SMKS: perlengkapan, bukan struktural; kerusakannya dicatat dengan 941/942 (D.21). */
const smks = (kode: string, nama: string): ElemenLevel4 => ({
  kode,
  nama,
  struktural: false,
  bahan: [],
  kerusakanLain: ['941', '942'],
});

/**
 * Hierarki jembatan rangka baja, Lampiran B hlm. 118–127.
 *
 * Elemen yang tidak ada pada rangka Warren (batang tengah CH, kupingan pelat
 * pracetak, paku keling, dan sejenisnya) tidak dimuat.
 */
export const ELEMEN_UTAMA: ElemenUtama[] = [
  {
    kode: '3.450',
    nama: 'Rangka',
    komponen: BANGUNAN_ATAS,
    klaster: [
      {
        kode: '4.453',
        nama: 'Struktur Rangka',
        elemen: [
          baja('4.453a', 'Batang tepi atas'),
          baja('4.453b', 'Batang tepi bawah'),
          baja('4.453c', 'Batang diagonal'),
          baja('4.453d', 'Batang vertikal'),
          baja('4.453g', 'Gelagar melintang'),
        ],
      },
      {
        kode: '4.454',
        nama: 'Pengaku Rangka',
        elemen: [
          baja('4.454a', 'Ikatan angin atas'),
          baja('4.454b', 'Ikatan angin bawah'),
          baja('4.454c', 'Ikatan angin melintang'),
          baja('4.454d', 'Pengaku diagonal'),
          baja('4.454e', 'Pengaku vertikal'),
          baja('4.454f', 'Portal ujung'),
        ],
      },
      {
        kode: '4.455',
        nama: 'Sambungan Rangka Baja',
        elemen: [
          baja('4.455a', 'Pelat buhul'),
          baja('4.455b', 'Pelat pengisi'),
          baja('4.455g', 'Sambungan baut'),
          baja('4.455i', 'Sambungan las'),
        ],
      },
    ],
  },
  {
    kode: '3.500',
    nama: 'Sistem Lantai',
    komponen: BANGUNAN_ATAS,
    klaster: [
      {
        kode: '4.511',
        nama: 'Struktur Lantai',
        elemen: [
          {
            kode: '4.511a',
            nama: 'Pelat lantai (kayu / beton bertulang / baja)',
            struktural: true,
            bahan: ['beton', 'baja'],
            kerusakanLain: ['702'],
          },
        ],
      },
      {
        kode: '4.512',
        nama: 'Penyangga Sistem Lantai',
        elemen: [baja('4.512a', 'Gelagar memanjang lantai'), baja('4.512b', 'Balok tepi')],
      },
      {
        kode: '4.513',
        nama: 'Trotoar dan Kerb',
        elemen: [
          { kode: '4.513a', nama: 'Trotoar', struktural: false, bahan: ['beton'], kerusakanLain: ['731', '732', '733'] },
          { kode: '4.513b', nama: 'Kerb', struktural: false, bahan: ['beton'], kerusakanLain: ['731', '732', '733'] },
        ],
      },
    ],
  },
  {
    kode: '3.610',
    nama: 'Perletakan',
    komponen: BANGUNAN_ATAS,
    klaster: [
      {
        kode: '4.611',
        nama: 'Landasan',
        elemen: [
          { kode: '4.611a', nama: 'Landasan baja', struktural: true, bahan: [], kerusakanLain: ['601', '602', '603', '604', '605', '606', '607'] },
          { kode: '4.611b', nama: 'Landasan karet perletakan elastomer', struktural: true, bahan: [], kerusakanLain: ['601', '602', '603', '604', '605', '606', '607'] },
          { kode: '4.611c', nama: 'Landasan karet lembaran', struktural: true, bahan: [], kerusakanLain: ['601', '602', '603', '604', '605', '606', '607'] },
          { kode: '4.611d', nama: 'Landasan pot', struktural: true, bahan: [], kerusakanLain: ['601', '602', '603', '604', '605', '606', '607'] },
        ],
      },
      {
        kode: '4.614',
        nama: 'Pendukung Landasan',
        elemen: [
          { kode: '4.614a', nama: 'Bantalan mortar / pelat dasar', struktural: true, bahan: ['beton'], kerusakanLain: ['561'] },
          baja('4.614b', 'Baut pengikat (angkur gempa)', true, ['561']),
          baja('4.614d', 'Pelat landasan', true, ['561']),
          baja('4.614e', 'Angkur pengikat', true, ['561']),
        ],
      },
    ],
  },
  {
    kode: '3.620',
    nama: 'Pengaman Pengguna Jalan',
    komponen: BANGUNAN_ATAS,
    klaster: [
      {
        kode: '4.621',
        nama: 'Struktur Sandaran Railing',
        elemen: [
          baja('4.621a', 'Tiang railing', false, ['931']),
          baja('4.621b', 'Sandaran', false, ['931']),
          baja('4.621d', 'Baut pengikat tiang railing', false, ['931']),
          baja('4.621e', 'Pelat dasar tiang railing', false, ['931']),
        ],
      },
    ],
  },
  {
    kode: '3.750',
    nama: 'SMKS (Sistem Monitoring Kesehatan Jembatan)',
    komponen: PERLENGKAPAN,
    klaster: [
      {
        kode: '4.751',
        nama: 'Sensor Struktur',
        elemen: [
          smks('4.751a', 'Strain gauge'),
          smks('4.751e', 'Displacement transducer'),
          smks('4.751g', 'Accelerometer beban kendaraan'),
          smks('4.751i', 'Tiltmeter'),
          smks('4.751v', 'Temperatur struktur'),
        ],
      },
      {
        kode: '4.752',
        nama: 'Perangkat Pengukur Beban Kendaraan',
        elemen: [smks('4.752a', 'WIM di perkerasan jalan')],
      },
      {
        kode: '4.753',
        nama: 'Sensor Pengukur Beban Lingkungan',
        elemen: [smks('4.753a', 'Anemometer')],
      },
      {
        kode: '4.754',
        nama: 'Pendukung Lainnya',
        elemen: [smks('4.754b', 'CCTV')],
      },
    ],
  },
];

export interface IndeksElemen {
  elemen: ElemenLevel4;
  klaster: Klaster;
  utama: ElemenUtama;
}

export const ELEMEN_BY_KODE: Record<string, IndeksElemen> = Object.fromEntries(
  ELEMEN_UTAMA.flatMap((utama) =>
    utama.klaster.flatMap((klaster) =>
      klaster.elemen.map((elemen) => [elemen.kode, { elemen, klaster, utama }] as const),
    ),
  ),
);

/** Kode kerusakan yang boleh dipilih untuk sebuah elemen, berurutan menurut kode. */
export function kerusakanUntuk(elemen: ElemenLevel4): KodeKerusakan[] {
  const kode = new Set<string>([
    ...elemen.bahan.flatMap((b) => KODE_BAHAN[b]),
    ...(elemen.kerusakanLain ?? []),
  ]);
  return [...kode].sort().map((k) => KERUSAKAN[k]);
}

/** `4.453b · Batang tepi bawah`, untuk label yang ringkas. */
export function labelElemen(kode: string): string {
  const item = ELEMEN_BY_KODE[kode];
  return item ? `${kode} · ${item.elemen.nama}` : kode;
}

/* ------------------------------------------------------------ penilaian */

/** Ambang K: 30% untuk elemen struktural, 50% untuk non-struktural (Bab 5.7, Tabel F.1). */
export function ambangKuantitas(struktural: boolean): number {
  return struktural ? 0.3 : 0.5;
}

export interface Isian {
  /** Indeks penyebab pada `KodeKerusakan.sebab`, bila kode itu punya. */
  sebab?: number;
  /** Indeks pengukuran pada `KodeKerusakan.ukur`. */
  ukur: number;
  volumeRusak: number;
  volumeTotal: number;
  /** F: 1 bila elemen tidak lagi berfungsi akibat kerusakan ini. */
  f: Biner;
  /** P: 1 bila kerusakan memengaruhi elemen lain atau pengguna jembatan. */
  p: Biner;
}

export interface Skor {
  s: Biner;
  r: Biner;
  k: Biner;
  f: Biner;
  p: Biner;
  /** Nilai Kondisi 0–5. */
  nk: number;
  rasio: number;
  ambang: number;
}

/**
 * NK = S + R + K + F + P.
 *
 * S dari penyebab (atau tetap per kode), R dari baris pengukuran yang dipilih,
 * K dari perbandingan volume kerusakan terhadap volume total elemen. F dan P
 * adalah penilaian pemeriksa — pedoman tidak memberinya rumus. Rasio tepat di
 * ambang dihitung kena (`>=`): Bab 5.7 menyebut "lebih atau sama dengan".
 */
export function hitungSkor(elemen: ElemenLevel4, kerusakan: KodeKerusakan, isian: Isian): Skor {
  const s =
    kerusakan.sebab && isian.sebab !== undefined
      ? (kerusakan.sebab[isian.sebab]?.s ?? kerusakan.s)
      : kerusakan.s;
  const r = kerusakan.ukur[isian.ukur]?.r ?? 0;
  const ambang = ambangKuantitas(elemen.struktural);
  const rasio = isian.volumeTotal > 0 ? isian.volumeRusak / isian.volumeTotal : 0;
  const k: Biner = rasio >= ambang ? 1 : 0;
  return { s, r, k, f: isian.f, p: isian.p, nk: s + r + k + isian.f + isian.p, rasio, ambang };
}

/** Uraian tiap Nilai Kondisi, dari Lampiran F.2. */
export const NK_URAIAN: Record<number, { label: string; arti: string }> = {
  0: { label: 'Baik', arti: 'Tidak ada kerusakan berarti.' },
  1: { label: 'Rusak ringan', arti: 'Dapat diperbaiki lewat pemeliharaan rutin; tidak berdampak pada keamanan atau fungsi.' },
  2: { label: 'Rusak sedang', arti: 'Perlu pemantauan atau pemeliharaan pada masa yang akan datang.' },
  3: { label: 'Rusak berat', arti: 'Perlu perhatian; kerusakan mungkin menjadi serius dalam 12 bulan.' },
  4: { label: 'Kritis', arti: 'Kerusakan serius; perlu perhatian segera.' },
  5: { label: 'Runtuh', arti: 'Jembatan runtuh dan tidak berfungsi.' },
};

export const NK_KELAS: Record<number, string> = {
  0: 'tag tag-normal',
  1: 'tag tag-normal',
  2: 'tag tag-waspada',
  3: 'tag tag-siaga',
  4: 'tag tag-bahaya',
  5: 'tag tag-bahaya',
};

/* ------------------------------------------------------------ temuan */

/**
 * Foto yang dilampirkan pada temuan (Lampiran G).
 *
 * `peraga` selalu benar selama bingkainya berasal dari ubin kamera peraga;
 * lihat `lib/tangkap.ts`. Bidang ini ada supaya foto lapangan sungguhan kelak
 * dapat dibedakan dari tangkapan peraga tanpa menebak dari isinya.
 */
export interface FotoTemuan {
  kamera: string;
  tempat: string;
  /** Saat ditangkap, ISO. */
  at: string;
  /** `data:image/jpeg;base64,…` */
  data: string;
  lebar: number;
  tinggi: number;
  peraga: boolean;
}

/** Satu kerusakan yang dicatat pemeriksa; hanya masukan, nilainya dihitung ulang. */
export interface Temuan extends Isian {
  id: string;
  /** Tanggal pemeriksaan, `YYYY-MM-DD`. */
  tanggal: string;
  pemeriksa: string;
  /** Kode Level 4, mis. `4.453b`. */
  elemen: string;
  /** Kode kerusakan Lampiran C. */
  kerusakan: string;
  /**
   * Lokasi Level 5 menurut Bab 5.4: bentang, lalu sumbu X (memanjang dari A1),
   * Y (melintang dari kiri), Z (vertikal). Semuanya kosong berarti penilaian
   * pada Level 4, untuk seluruh elemen.
   */
  bentang: number;
  /** Tumpuan pada abutmen (A1 atau A2); bila terisi, ia menggantikan bentang pada label lokasi. */
  posisi?: 'A1' | 'A2';
  x?: number;
  y?: number;
  z?: number;
  catatan: string;
  /** Foto kerusakan; pedoman meminta foto atau sketsa pada tiap isian. */
  foto?: FotoTemuan[];
  /** Data contoh, bukan hasil lapangan. */
  contoh?: boolean;
}

/** `B1.X5.Y2.Z1`, atau penjelasan bahwa penilaiannya di Level 4. */
export function lokasiLabel(t: Pick<Temuan, 'bentang' | 'posisi' | 'x' | 'y' | 'z'>): string {
  if (t.x === undefined && t.y === undefined && t.z === undefined && !t.posisi) {
    return 'Level 4 · seluruh elemen';
  }
  return [
    t.posisi ?? `B${t.bentang}`,
    t.x !== undefined && `X${t.x}`,
    t.y !== undefined && `Y${t.y}`,
    t.z !== undefined && `Z${t.z}`,
  ]
    .filter(Boolean)
    .join('.');
}

export interface TemuanBernilai extends Temuan {
  skor: Skor;
  elemenSpec: ElemenLevel4;
  kerusakanSpec: KodeKerusakan;
}

/** Temuan beserta skornya; yang kodenya tidak dikenal dibuang, bukan ditebak. */
export function nilaiTemuan(daftar: Temuan[]): TemuanBernilai[] {
  return daftar.flatMap((t) => {
    const elemenSpec = ELEMEN_BY_KODE[t.elemen]?.elemen;
    const kerusakanSpec = KERUSAKAN[t.kerusakan];
    if (!elemenSpec || !kerusakanSpec) return [];
    return [{ ...t, elemenSpec, kerusakanSpec, skor: hitungSkor(elemenSpec, kerusakanSpec, t) }];
  });
}

/* ------------------------------------------------------------ roll-up */

export interface SimpulKondisi {
  kode: string;
  nama: string;
  /** Level hierarki pedoman: 1, 2, 3, atau 4 (klaster maupun elemen). */
  level: 1 | 2 | 3 | 4;
  struktural: boolean;
  /** Nilai Kondisi 0–5; 0 bila tidak ada kerusakan tercatat. */
  nk: number;
  /** Jumlah temuan di simpul ini dan di bawahnya. */
  temuan: number;
  anak: SimpulKondisi[];
}

/**
 * Nilai Kondisi naik jenjang sebagai **maksimum elemen struktural** di bawahnya
 * (Bab 4.3.2: nilai jembatan adalah nilai kondisi maksimum elemen struktural
 * pada level di bawahnya). Simpul yang seluruh anaknya non-struktural tetap
 * diberi nilainya, tetapi ditandai non-struktural dan tidak ikut naik.
 *
 * Pedoman juga mengizinkan pemeriksa menilai kelompok elemen sebagai satu
 * kesatuan (Lampiran F.4). Aplikasi ini melakukannya dengan mencatat temuan
 * tanpa lokasi Level 5 pada elemen Level 4; hasilnya ikut dimaksimumkan.
 */
export function ringkasKondisi(temuan: TemuanBernilai[]): SimpulKondisi {
  const naik = (anak: SimpulKondisi[]) => {
    const struktural = anak.filter((a) => a.struktural);
    const sumber = struktural.length ? struktural : anak;
    return {
      struktural: struktural.length > 0,
      nk: sumber.reduce((maks, a) => Math.max(maks, a.nk), 0),
      temuan: anak.reduce((jumlah, a) => jumlah + a.temuan, 0),
    };
  };

  const utama = ELEMEN_UTAMA.map((eu): { komponen: ElemenUtama['komponen']; simpul: SimpulKondisi } => {
    const klaster = eu.klaster.map((kl): SimpulKondisi => {
      const elemen = kl.elemen.map((el): SimpulKondisi => {
        const milik = temuan.filter((t) => t.elemen === el.kode);
        return {
          kode: el.kode,
          nama: el.nama,
          level: 4,
          struktural: el.struktural,
          nk: milik.reduce((maks, t) => Math.max(maks, t.skor.nk), 0),
          temuan: milik.length,
          anak: [],
        };
      });
      return { kode: kl.kode, nama: kl.nama, level: 4, ...naik(elemen), anak: elemen };
    });
    return {
      komponen: eu.komponen,
      simpul: { kode: eu.kode, nama: eu.nama, level: 3, ...naik(klaster), anak: klaster },
    };
  });

  // Elemen utama dikelompokkan menurut komponennya (Level 2), urutan kemunculan dijaga.
  const level2 = [...new Map(utama.map((u) => [u.komponen.kode, u.komponen])).values()].map(
    (komponen): SimpulKondisi => {
      const anak = utama.filter((u) => u.komponen.kode === komponen.kode).map((u) => u.simpul);
      return { kode: komponen.kode, nama: komponen.nama, level: 2, ...naik(anak), anak };
    },
  );
  return { kode: LEVEL1.kode, nama: LEVEL1.nama, level: 1, ...naik(level2), anak: level2 };
}
