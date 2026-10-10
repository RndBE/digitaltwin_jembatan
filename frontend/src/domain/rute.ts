import type { Reading, Status } from '../lib/types';
import { buatSimpanan } from '../lib/simpanan';
import { A1_DI_BARAT, padankanBagian, type PadananBagian } from './lokasiModel';
import { SENSOR_SPOTS, SENSORS } from './sensors';
import { type Temuan, type TemuanBernilai } from './pedoman';

/**
 * Rute pemeriksaan: urutan berjalan dari A1 ke A2.
 *
 * Bab 5.5 hlm. 41 menetapkan pemeriksaan jembatan non-kompleks dimulai dari
 * sebelah kiri kepala jembatan 1 (A1), di kilometer terkecil, lalu maju ke
 * kepala jembatan 2. Modul ini mengubah isi jembatan menjadi daftar *stasiun*
 * dalam urutan itu, supaya pemeriksa di lapangan memeriksa sambil berjalan dan
 * tidak melompat-lompat antara kode elemen.
 *
 * Stasiunnya mengikuti penomoran X pada Bab 5.4 (lihat `lokasiModel.ts`):
 *
 *   A1 → simpul 1 → panel 1 → simpul 2 → panel 2 → … → simpul P+1 → A2
 *
 * Tiap stasiun memuat bagian-bagian model yang ada di sana, dikelompokkan
 * menurut kode elemen Lampiran B.
 */

export type JenisStasiun = 'abutmen' | 'simpul' | 'panel' | 'umum';

export interface Stasiun {
  kunci: string;
  jenis: JenisStasiun;
  judul: string;
  /** Lokasi X dari A1 untuk simpul dan panel. */
  nomor?: number;
  padanan: PadananBagian[];
}

/** Elemen yang berdiri di satu simpul; selebihnya membentang pada satu panel. */
const KODE_SIMPUL = new Set(['4.453d', '4.453g', '4.454c', '4.455a', '4.455g', '4.455i']);

const urutanKunci = (jenis: JenisStasiun, nomor?: number) =>
  jenis === 'abutmen' ? `A${nomor}` : `${jenis === 'simpul' ? 'N' : 'P'}${nomor}`;

/** Seluruh tag bagian model yang punya padanan pedoman, untuk P panel. */
function semuaBagian(P: number): string[] {
  const id: string[] = [];
  for (const zi of [0, 1]) {
    for (let i = 0; i < P; i++) {
      id.push(`bc${i}z${zi}`, `d${i}z${zi}`);
      if (i > 0 && i < P - 1) id.push(`tc${i}z${zi}`);
      if (i < P - 1) id.push(`v${i}z${zi}`);
    }
  }
  for (let i = 0; i <= P; i++) {
    id.push(`fb${i}`);
    if (i > 0 && i < P) id.push(`tb${i}`);
    for (const side of [0, 1]) {
      id.push(`joint-${i}-${side}-0`);
      if (i > 0 && i < P) id.push(`joint-${i}-${side}-1`);
    }
  }
  for (let i = 0; i < P; i++) {
    if (i > 0 && i < P - 1) id.push(`lb${i}a`, `lb${i}b`);
    id.push(`ub${i}a`, `ub${i}b`);
    for (let j = 0; j < 4; j++) id.push(`st${i}-${j}`);
  }
  for (const w of ['W', 'E']) for (const zi of [0, 1]) id.push(`bear${w}${zi}`);
  return id;
}

/** Stasiun tempat sebuah padanan berada. */
export function kunciStasiun(p: Pick<PadananBagian, 'elemen' | 'posisi' | 'x'>): string {
  if (p.posisi) return p.posisi;
  if (p.x === undefined) return 'UMUM';
  return urutanKunci(KODE_SIMPUL.has(p.elemen) ? 'simpul' : 'panel', p.x);
}

/** Stasiun tempat sebuah temuan dicatat; temuan tanpa lokasi masuk stasiun umum. */
export function stasiunTemuan(t: Pick<Temuan, 'elemen' | 'posisi' | 'x'>): string {
  return kunciStasiun(t);
}

/** Daftar stasiun berurutan dari A1 ke A2, dibuka dengan stasiun "seluruh elemen". */
export function susunRute(panels: number): Stasiun[] {
  const peta = new Map<string, PadananBagian[]>();
  for (const id of semuaBagian(panels)) {
    const p = padankanBagian(id, panels);
    if (!p) continue;
    const k = kunciStasiun(p);
    peta.set(k, [...(peta.get(k) ?? []), p]);
  }

  const stasiun = (kunci: string, jenis: JenisStasiun, judul: string, nomor?: number): Stasiun => ({
    kunci,
    jenis,
    judul,
    nomor,
    padanan: peta.get(kunci) ?? [],
  });

  const rute: Stasiun[] = [
    { kunci: 'UMUM', jenis: 'umum', judul: 'Seluruh elemen · penilaian Level 4', padanan: [] },
    stasiun('A1', 'abutmen', `Kepala jembatan A1 (${A1_DI_BARAT ? 'barat' : 'timur'})`, 1),
  ];
  for (let k = 1; k <= panels + 1; k++) {
    rute.push(stasiun(`N${k}`, 'simpul', `Simpul ${k} · X${k}`, k));
    if (k <= panels) rute.push(stasiun(`P${k}`, 'panel', `Panel ${k} · X${k}`, k));
  }
  rute.push(stasiun('A2', 'abutmen', `Kepala jembatan A2 (${A1_DI_BARAT ? 'timur' : 'barat'})`, 2));
  return rute;
}

/* ------------------------------------------------------------------ sensor */

export interface SensorDiStasiun {
  kanal: string;
  nama: string;
}

/**
 * Stasiun tempat tiap kanal sensor dipasang, dari koordinat adegannya.
 *
 * Kanal di luar bentang (WIM dan anemometer di oprit) tidak punya stasiun dan
 * dikembalikan terpisah. Kemiringan dipasang pada bantalan, jadi dimasukkan
 * ke kepala jembatan terdekat, bukan ke simpul.
 */
export function sensorPerStasiun(
  panels: number,
  spanUnits: number,
): { peta: Map<string, SensorDiStasiun[]>; diLuar: SensorDiStasiun[] } {
  const peta = new Map<string, SensorDiStasiun[]>();
  const diLuar: SensorDiStasiun[] = [];
  const panjangPanel = spanUnits / panels;

  for (const s of SENSORS) {
    const spot = SENSOR_SPOTS[s.id];
    if (!spot) continue;
    const entri = { kanal: s.id, nama: s.name };
    const x = spot[0];
    if (Math.abs(x) > spanUnits / 2 + 0.05) {
      diLuar.push(entri);
      continue;
    }
    let kunci: string;
    if (s.id === 'tilt') {
      const timur = x > 0;
      kunci = timur === A1_DI_BARAT ? 'A2' : 'A1';
    } else {
      const idx = Math.round((x + spanUnits / 2) / panjangPanel); // 0…P dari barat
      const nomor = A1_DI_BARAT ? idx + 1 : panels + 1 - idx;
      kunci = `N${nomor}`;
    }
    peta.set(kunci, [...(peta.get(kunci) ?? []), entri]);
  }
  return { peta, diLuar };
}

/* ------------------------------------------------------------------ ringkasan */

export interface RingkasStasiun {
  stasiun: Stasiun;
  temuan: TemuanBernilai[];
  /** Nilai Kondisi tertinggi di stasiun ini; 0 bila tidak ada temuan. */
  nk: number;
  sensor: Array<SensorDiStasiun & { status: Status | null; teks: string }>;
  /** Untuk mengurutkan menurut prioritas; makin tinggi makin perlu dilihat dulu. */
  prioritas: number;
}

const BOBOT_STATUS: Record<Status, number> = { AMAN: 0, WASPADA: 2, KRITIS: 3 };

export function ringkasRute(
  rute: Stasiun[],
  temuan: TemuanBernilai[],
  sensor: Map<string, SensorDiStasiun[]>,
  readings: Reading[] | null,
): RingkasStasiun[] {
  return rute.map((stasiun) => {
    const milik = temuan.filter((t) => stasiunTemuan(t) === stasiun.kunci);
    const nk = milik.reduce((maks, t) => Math.max(maks, t.skor.nk), 0);
    const sens = (sensor.get(stasiun.kunci) ?? []).map((s) => {
      const r = readings?.find((x) => x.id === s.kanal);
      return {
        ...s,
        status: r?.status ?? null,
        teks: r ? `${r.value.toFixed(SENSORS.find((x) => x.id === s.kanal)?.dec ?? 1)} ${r.unit}` : '—',
      };
    });
    const bobotSensor = sens.reduce((maks, s) => Math.max(maks, s.status ? BOBOT_STATUS[s.status] : 0), 0);
    const bobotNk = nk >= 3 ? 2 : nk >= 1 ? 1 : 0;
    return { stasiun, temuan: milik, nk, sensor: sens, prioritas: bobotSensor * 10 + bobotNk * 3 + Math.min(milik.length, 2) };
  });
}

/* ----------------------------------------------------------------- tanda */

/**
 * Tanda "sudah diperiksa" per stasiun.
 *
 * Berlaku **satu hari**: rute dijalani sekali per kunjungan, dan tanda dari
 * kunjungan bulan lalu yang masih menempel membuat stasiun terbaca sudah
 * diperiksa padahal belum. Tanda dengan tanggal lain dianggap kosong.
 */
interface IsiTanda {
  tanggal: string;
  tanda: Record<string, boolean>;
}

const simpanan = buatSimpanan<Record<string, IsiTanda>>('jdt.rute', {});
export const langganRute = simpanan.langgan;
export const versiRute = simpanan.versi;

const hariIni = () => new Date().toISOString().slice(0, 10);

export function tandaRute(bridgeId: string): Record<string, boolean> {
  const isi = simpanan.baca()[bridgeId];
  return isi && isi.tanggal === hariIni() ? isi.tanda : {};
}

export function setTandaRute(bridgeId: string, kunci: string, nilai: boolean): boolean {
  const sekarang = tandaRute(bridgeId);
  return simpanan.tulis({
    ...simpanan.baca(),
    [bridgeId]: { tanggal: hariIni(), tanda: { ...sekarang, [kunci]: nilai } },
  });
}

export function kosongkanRute(bridgeId: string): boolean {
  return simpanan.tulis({ ...simpanan.baca(), [bridgeId]: { tanggal: hariIni(), tanda: {} } });
}
