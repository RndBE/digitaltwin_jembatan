import type { Inspection } from './demoData';

/**
 * Jadwal dan kewajiban pemeriksaan.
 *
 * Aturan yang dipakai, dengan pasalnya:
 *
 *   Pemeriksaan Rutin   setiap tahun, di antara Pemeriksaan Detail (Bab 4.3.3,
 *                       3.19). Jatuh tempo = satu tahun sejak pemeriksaan
 *                       Rutin **atau** Detail yang terakhir: tahun ketika
 *                       Detail dikerjakan tidak perlu Rutin lagi.
 *   Pemeriksaan Detail  paling lama sekali dalam lima tahun (Bab 3.18, 4.3.2).
 *                       Bab 7.1.1 menambah dua kriteria yang **mewajibkan**
 *                       Detail dalam siklus lima tahun itu:
 *                         a) nilai kondisi ≥ 3 pada Detail yang paling lama
 *                            dua tahun lalu;
 *                         b) belum pernah Detail sejak empat tahun lalu.
 *
 * Yang dilakukan pedoman **bukan** memendekkan interval menjadi dua tahun
 * untuk jembatan bernilai ≥ 3: dua tahun adalah usia hasil Detail yang masih
 * dihitung sebagai alasan memasukkannya ke daftar Detail. Keduanya mudah
 * tertukar, jadi dicatat di sini.
 *
 * Bab 4.3.2 juga membolehkan interval lebih pendek "tergantung kondisi" tanpa
 * menyebut angkanya; itu keputusan inspektur dan tidak dihitung di sini.
 */

export type StatusJadwal = 'aman' | 'mendekati' | 'wajib' | 'terlambat';

export interface BarisJadwal {
  jenis: 'Rutin' | 'Detail';
  /** Pemeriksaan terakhir yang menjadi dasar hitungan; `null` bila belum pernah. */
  terakhir: Inspection | null;
  /** Tanggal jatuh tempo `YYYY-MM-DD`; `null` bila tidak ada dasar menghitungnya. */
  jatuhTempo: string | null;
  /** Hari menuju jatuh tempo; negatif berarti sudah lewat. */
  sisaHari: number | null;
  status: StatusJadwal;
  /** Kalimat alasan beserta pasalnya. */
  dasar: string;
}

/**
 * Berapa hari sebelum jatuh tempo Rutin sebuah jadwal ditandai "mendekati".
 *
 * Angka pengembang, bukan pedoman: pedoman hanya menyebut "setiap tahun".
 */
export const MENDEKATI_HARI = 60;

const HARI = 86_400_000;

function tambahTahun(iso: string, tahun: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + tahun);
  return d.toISOString().slice(0, 10);
}

function selisihHari(dari: string, ke: string): number {
  return Math.round((new Date(`${ke}T00:00:00Z`).getTime() - new Date(`${dari}T00:00:00Z`).getTime()) / HARI);
}

const urut = (daftar: Inspection[]) => [...daftar].sort((a, b) => b.date.localeCompare(a.date));

/**
 * Dua baris jadwal untuk sebuah aset.
 *
 * `hariIni` berbentuk `YYYY-MM-DD` dan dapat disuntikkan supaya hasilnya dapat
 * diuji tanpa bergantung jam mesin.
 */
export function susunJadwal(inspeksi: Inspection[], hariIni: string): BarisJadwal[] {
  const semua = urut(inspeksi);
  const rutinAtauDetail = semua.find((i) => i.kind === 'Rutin' || i.kind === 'Detail') ?? null;
  const detail = semua.find((i) => i.kind === 'Detail') ?? null;

  /* ---- Rutin ---- */
  let rutin: BarisJadwal;
  if (!rutinAtauDetail) {
    rutin = {
      jenis: 'Rutin',
      terakhir: null,
      jatuhTempo: null,
      sisaHari: null,
      status: 'wajib',
      dasar: 'Belum ada catatan Rutin maupun Detail; Pemeriksaan Rutin dilakukan setiap tahun (Bab 4.3.3).',
    };
  } else {
    const tempo = tambahTahun(rutinAtauDetail.date, 1);
    const sisa = selisihHari(hariIni, tempo);
    rutin = {
      jenis: 'Rutin',
      terakhir: rutinAtauDetail,
      jatuhTempo: tempo,
      sisaHari: sisa,
      status: sisa < 0 ? 'terlambat' : sisa <= MENDEKATI_HARI ? 'mendekati' : 'aman',
      dasar: `Setiap tahun sejak pemeriksaan ${rutinAtauDetail.kind} terakhir (Bab 4.3.3).`,
    };
  }

  /* ---- Detail ---- */
  let rincian: BarisJadwal;
  if (!detail) {
    rincian = {
      jenis: 'Detail',
      terakhir: null,
      jatuhTempo: null,
      sisaHari: null,
      status: 'wajib',
      dasar: 'Belum pernah Pemeriksaan Detail; masuk kriteria wajib Bab 7.1.1 butir b.',
    };
  } else {
    const batas = tambahTahun(detail.date, 5);
    const sisa = selisihHari(hariIni, batas);
    const umurTahun = selisihHari(detail.date, hariIni) / 365.25;
    const nilaiTinggi = detail.conditionValue >= 3 && umurTahun <= 2;
    const empatTahun = umurTahun > 4;

    let status: StatusJadwal = 'aman';
    let dasar = 'Paling lama lima tahun sejak Detail terakhir (Bab 3.18, 4.3.2).';
    if (sisa < 0) {
      status = 'terlambat';
      dasar = 'Batas lima tahun sejak Detail terakhir telah lewat (Bab 3.18).';
    } else if (nilaiTinggi) {
      status = 'wajib';
      dasar = `Nilai kondisi ${detail.conditionValue} pada Detail yang berusia ≤ 2 tahun; masuk kriteria wajib Bab 7.1.1 butir a.`;
    } else if (empatTahun) {
      status = 'wajib';
      dasar = 'Detail terakhir lebih dari empat tahun lalu; masuk kriteria wajib Bab 7.1.1 butir b.';
    }
    rincian = { jenis: 'Detail', terakhir: detail, jatuhTempo: batas, sisaHari: sisa, status, dasar };
  }

  return [rutin, rincian];
}

export const STATUS_JADWAL_LABEL: Record<StatusJadwal, string> = {
  aman: 'BELUM JATUH TEMPO',
  mendekati: 'MENDEKATI',
  wajib: 'WAJIB DIJADWALKAN',
  terlambat: 'TERLAMBAT',
};

export const STATUS_JADWAL_KELAS: Record<StatusJadwal, string> = {
  aman: 'tag tag-normal',
  mendekati: 'tag tag-waspada',
  wajib: 'tag tag-siaga',
  terlambat: 'tag tag-bahaya',
};
