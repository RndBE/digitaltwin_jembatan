import { ELEMEN_BY_KODE, type Temuan } from './pedoman';

/**
 * Padanan bagian model 3D dengan kode elemen dan lokasi menurut pedoman.
 *
 * Tiap batang di `three/proceduralBridge.ts` membawa tag (`bc3z0`, `d5z1`,
 * `joint-4-1-0`, `bearW0`, …). Pedoman menamai elemen dengan kode Lampiran B
 * dan menentukan letaknya dengan bentang, sumbu X (memanjang dari A1), Y
 * (melintang dari kiri ke kanan), dan Z (vertikal) — Bab 5.4 hlm. 38–40,
 * contohnya `B3.X5.Y2.Z2`. Modul ini menerjemahkan yang pertama ke yang kedua
 * sehingga pemeriksa cukup menunjuk bagian di model dan tidak perlu menghafal
 * kode atau menghitung nomor panel.
 *
 * Aturan penomorannya, supaya dapat dicek terhadap pedoman:
 *
 *   X    batang yang membentang pada satu panel (tepi atas/bawah, diagonal,
 *        gelagar memanjang, ikatan silang) memakai **nomor panel** 1…P.
 *        Yang berdiri di satu simpul (vertikal, gelagar melintang, pelat
 *        buhul, ikatan melintang) memakai **nomor simpul** 1…P+1.
 *   Y    1 untuk rangka sisi kiri dan 2 untuk sisi kanan, dilihat dari A1
 *        menuju A2. Gelagar memanjang lantai dinomori 1…4 dengan arah sama.
 *   Z    1 untuk tingkat batang tepi bawah, 2 untuk tingkat batang tepi atas.
 *        Dikosongkan untuk batang yang melintang di antara keduanya.
 *   A    tumpuan ditulis sebagai A1 atau A2, bukan bentang.
 *
 * **Asumsi yang harus dibenarkan pemilik data:** pedoman menomori dari kepala
 * jembatan di kilometer terkecil (A1). Aplikasi ini tidak menyimpan arah
 * kilometernya, jadi `A1_DI_BARAT` di bawah diasumsikan benar: A1 adalah ujung
 * barat (kiri pada gambar), sehingga sisi kiri bila menghadap timur adalah
 * utara. Bila arah kilometer sebenarnya sebaliknya, cukup ubah satu konstanta
 * itu; seluruh penomoran X, Y, dan A1/A2 ikut terbalik.
 */
export const A1_DI_BARAT = true;

export interface PadananBagian {
  /** Kode Level 4, mis. `4.453b`. */
  elemen: string;
  bentang: number;
  posisi?: 'A1' | 'A2';
  x?: number;
  y?: number;
  z?: number;
  /** Tag bagian di model, untuk ditampilkan: "diisi dari bagian bc3z0". */
  bagian: string;
}

/**
 * Bagian model → padanan pedoman, atau `null` bila bagian itu tidak punya
 * padanan (lantai jalan, tiang lampu, pagar, penanda sensor).
 */
export function padankanBagian(id: string, panels: number): PadananBagian | null {
  const P = panels;
  const balik = !A1_DI_BARAT;
  /** Nomor panel 0…P−1 dari barat → nomor dari A1. */
  const panel = (i: number) => (balik ? P - i : i + 1);
  /** Nomor simpul 0…P dari barat → nomor dari A1. */
  const simpul = (i: number) => (balik ? P + 1 - i : i + 1);
  /** Sisi rangka 0 (utara) atau 1 (selatan) → Y dari A1. */
  const sisi = (zi: number) => (balik ? 2 - zi : zi + 1);
  /** Gelagar memanjang 0…3 dari utara ke selatan → Y dari A1. */
  const jalur = (j: number) => (balik ? 4 - j : j + 1);

  const dasar = { bentang: 1, bagian: id };
  let m: RegExpMatchArray | null;

  if ((m = id.match(/^bc(\d+)z(\d)$/))) {
    return { ...dasar, elemen: '4.453b', x: panel(+m[1]), y: sisi(+m[2]), z: 1 };
  }
  if ((m = id.match(/^tc(\d+)z(\d)$/))) {
    return { ...dasar, elemen: '4.453a', x: panel(+m[1]), y: sisi(+m[2]), z: 2 };
  }
  if ((m = id.match(/^d(\d+)z(\d)$/))) {
    return { ...dasar, elemen: '4.453c', x: panel(+m[1]), y: sisi(+m[2]) };
  }
  if ((m = id.match(/^v(\d+)z(\d)$/))) {
    // `v{i}` berdiri di simpul i+1 (0-based): simpul ujung tidak punya vertikal.
    return { ...dasar, elemen: '4.453d', x: simpul(+m[1] + 1), y: sisi(+m[2]) };
  }
  if ((m = id.match(/^fb(\d+)$/))) {
    return { ...dasar, elemen: '4.453g', x: simpul(+m[1]), z: 1 };
  }
  if ((m = id.match(/^tb(\d+)$/))) {
    return { ...dasar, elemen: '4.454c', x: simpul(+m[1]), z: 2 };
  }
  if ((m = id.match(/^lb(\d+)[ab]$/))) {
    return { ...dasar, elemen: '4.454a', x: panel(+m[1]), z: 2 };
  }
  if ((m = id.match(/^ub(\d+)[ab]$/))) {
    return { ...dasar, elemen: '4.454b', x: panel(+m[1]), z: 1 };
  }
  if ((m = id.match(/^st(\d+)-(\d)$/))) {
    return { ...dasar, elemen: '4.512a', x: panel(+m[1]), y: jalur(+m[2]), z: 1 };
  }
  if ((m = id.match(/^joint-(\d+)-(\d)-(\d)$/))) {
    return { ...dasar, elemen: '4.455a', x: simpul(+m[1]), y: sisi(+m[2]), z: +m[3] + 1 };
  }
  if ((m = id.match(/^bear([WE])(\d)$/))) {
    const barat = m[1] === 'W';
    const posisi = barat === A1_DI_BARAT ? 'A1' : 'A2';
    return { bentang: 1, bagian: id, elemen: '4.611b', posisi, y: sisi(+m[2]) };
  }
  return null;
}

/** Ringkasan satu baris untuk ditampilkan di panel inspeksi. */
export function ringkasPadanan(p: PadananBagian): string {
  const nama = ELEMEN_BY_KODE[p.elemen]?.elemen.nama ?? p.elemen;
  return `${p.elemen} · ${nama}`;
}

/** Bentuk yang dipakai `lokasiLabel`; sumber tunggal supaya tidak berselisih. */
export function lokasiDari(p: PadananBagian): Pick<Temuan, 'bentang' | 'posisi' | 'x' | 'y' | 'z'> {
  return { bentang: p.bentang, posisi: p.posisi, x: p.x, y: p.y, z: p.z };
}

/* ------------------------------------------------------------------ titipan */

/**
 * Padanan yang ditunjuk di model 3D dan menunggu dibuka di form pemeriksaan.
 *
 * Perpindahan layar tidak membawa parameter, jadi isinya dititipkan di sini.
 * Pembacaannya **tidak menghapus**: komponen React di mode pengembangan
 * dirender dua kali, dan pembacaan yang menghabiskan titipan membuat render
 * kedua melihat kotak kosong. Form yang sudah memakainya memanggil
 * `kosongkanTitipan` dari efeknya.
 */
let titipan: PadananBagian | null = null;

export function titipkanPadanan(p: PadananBagian): void {
  titipan = p;
}

export function intipTitipan(): PadananBagian | null {
  return titipan;
}

export function kosongkanTitipan(): void {
  titipan = null;
}
