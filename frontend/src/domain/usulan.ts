import type { Reading } from '../lib/types';
import { ELEMEN_BY_KODE, NK_URAIAN, lokasiLabel, type TemuanBernilai } from './pedoman';
import { SENSOR_BY_ID } from './sensors';

/**
 * Usulan tindakan darurat dan pemeriksaan khusus.
 *
 * Formulir Pemeriksaan Detail (Tabel A.12) dan Rutin (Tabel A.16) sama-sama
 * menanyakan "Apakah tindakan darurat disarankan?" dan, pada Detail, "Elemen
 * yang memerlukan Pemeriksaan Khusus", masing-masing dengan kolom Kode, Elemen,
 * Lokasi, dan Alasan. Modul ini menyiapkan baris-baris itu dari dua sumber:
 * kanal sensor yang melewati ambang, dan temuan yang bernilai kondisi tinggi.
 *
 * **Ini usulan sistem, bukan keputusan.** Pedoman menyerahkan penetapannya
 * kepada inspektur. Aturan di bawah adalah penafsiran pengembang atas
 * pedoman dan ditulis terbuka supaya dapat dikoreksi:
 *
 *   - Pemeriksaan khusus (Bab 4.3.4) diadakan bila perlu memastikan tingkat
 *     keparahan dan kuantitas kerusakan yang dapat mengubah nilai kondisi
 *     elemen struktural secara signifikan. Dua pemicunya di sini: kanal
 *     struktural melewati ambang **waspada**, atau temuan elemen struktural
 *     bernilai kondisi ≥ 3 ("rusak berat", Lampiran F.2).
 *   - Tindakan darurat (Bab 8.4.1) untuk keadaan kritis atau lalu lintas yang
 *     tidak dapat lewat dengan aman. Dua pemicunya: kanal struktural
 *     melewati ambang **kritis**, atau temuan bernilai kondisi ≥ 4 ("kritis,
 *     perhatian segera").
 *
 * Sensor hanya menunjukkan *indikasi*. Satu bacaan tinggi belum membuktikan
 * kerusakan, jadi setiap alasan menyebut itu dan meminta konfirmasi lapangan.
 *
 * Kanal beban (kendaraan, angin) dan suhu sengaja tidak memicu apa pun: ia
 * mengukur pembebanan atau lingkungan, bukan keadaan struktur. Sebuah truk
 * berat yang lewat bukan kerusakan.
 */

export type JenisUsulan = 'khusus' | 'darurat';

export interface Usulan {
  jenis: JenisUsulan;
  /** Kode elemen pedoman, mis. `4.453b`. */
  kode: string;
  elemen: string;
  lokasi: string;
  alasan: string;
  /** Dari mana usulannya berasal. */
  sumber: 'sensor' | 'temuan';
  /** Pengujian yang cocok, untuk usulan pemeriksaan khusus. */
  pengujian?: string;
}

/** Tindakan darurat di atas jembatan, Bab 8.4.1 b.i dan Lampiran A. */
export const TINDAKAN_DARURAT = [
  'Pembatasan beban',
  'Penyokongan / sangga (shoring)',
  'Penutupan parsial / sebagian',
  'Penutupan penuh',
  'Jalan memutar (detour)',
  'Jembatan sementara',
] as const;

interface AturanKanal {
  /** Elemen Level 4 yang paling mungkin terdampak bacaan kanal ini. */
  kode: string;
  /** Alasan pada formulir bila kanalnya kritis, dikutip dari Bab 8.4.1. */
  alasanDarurat: string;
  pengujian: string;
}

/**
 * Kanal struktural → elemen dan pengujian yang disarankan.
 *
 * Pengujian dikutip dari Tabel 9 (baja) dan Tabel 10 (struktur) Bab 9, serta
 * "Pengujian Geometri" untuk deformasi. Pemetaan kanal ke elemen mengikuti
 * letak sensornya pada `SENSORS` dan padanan di `KODE_PEDOMAN`.
 */
const ATURAN: Record<string, AturanKanal> = {
  strain: {
    kode: '4.453b',
    alasanDarurat:
      'Indikasi kerusakan batang rangka yang berpotensi pada keruntuhan jembatan (Bab 8.4.1 b.iv.c).',
    pengujian:
      'Pengujian statis dan dinamis (Tabel 10); kunci torsi dan ultrasonic flaw detector pada sambungan (Tabel 9).',
  },
  vib: {
    kode: '4.453a',
    alasanDarurat:
      'Indikasi perubahan perilaku dinamis rangka yang berpotensi pada keruntuhan jembatan (Bab 8.4.1 b.iv.c).',
    pengujian: 'Pengujian dinamis untuk kekakuan dan karakteristik getaran (Tabel 10).',
  },
  defl: {
    kode: '4.511a',
    alasanDarurat:
      'Indikasi lendutan lantai yang berlebihan sehingga jembatan mungkin tidak aman dilalui (Bab 8.4.1 b.iv.d).',
    pengujian: 'Pengujian statis (Tabel 10); pengukuran geometri/deformasi dengan total station atau digital level.',
  },
  tilt: {
    kode: '4.611b',
    alasanDarurat:
      'Indikasi gerakan pada tumpuan yang mungkin merupakan tanda potensi runtuh (Bab 8.4.1 b.iv.e).',
    pengujian: 'Pengukuran geometri/deformasi (total station, digital level); tiltmeter dan busur derajat pada bantalan.',
  },
  crack: {
    kode: '4.455a',
    alasanDarurat:
      'Indikasi retak pada sambungan yang berpotensi pada keruntuhan jembatan (Bab 8.4.1 b.iv.c).',
    pengujian: 'Dye penetration test dan ultrasonic flaw detector untuk retak baja dan las (Tabel 9).',
  },
};

const STATUS_LABEL = { WASPADA: 'ambang waspada', KRITIS: 'ambang kritis' } as const;

function dariSensor(readings: Reading[]): Usulan[] {
  return readings.flatMap((r) => {
    const aturan = ATURAN[r.id];
    if (!aturan || r.status === 'AMAN') return [];
    const spec = SENSOR_BY_ID[r.id];
    const item = ELEMEN_BY_KODE[aturan.kode];
    if (!spec || !item) return [];

    const bacaan = `${spec.name} ${r.value.toFixed(spec.dec)} ${spec.unit} melewati ${STATUS_LABEL[r.status]} (${spec.warn} / ${spec.crit})`;
    const dasar = {
      kode: aturan.kode,
      elemen: item.elemen.nama,
      lokasi: spec.node,
      sumber: 'sensor' as const,
    };

    const hasil: Usulan[] = [
      {
        ...dasar,
        jenis: 'khusus',
        alasan: `${bacaan}.`,
        pengujian: aturan.pengujian,
      },
    ];
    if (r.status === 'KRITIS') {
      hasil.push({ ...dasar, jenis: 'darurat', alasan: `${bacaan}. ${aturan.alasanDarurat}` });
    }
    return hasil;
  });
}

function dariTemuan(temuan: TemuanBernilai[]): Usulan[] {
  // Satu baris per elemen, dari temuannya yang paling tinggi nilainya.
  const terburuk = new Map<string, TemuanBernilai>();
  temuan
    .filter((t) => t.elemenSpec.struktural && t.skor.nk >= 3)
    .forEach((t) => {
      const lama = terburuk.get(t.elemen);
      if (!lama || t.skor.nk > lama.skor.nk) terburuk.set(t.elemen, t);
    });

  return [...terburuk.values()].flatMap((t) => {
    const dasar = {
      kode: t.elemen,
      elemen: t.elemenSpec.nama,
      lokasi: lokasiLabel(t),
      sumber: 'temuan' as const,
    };
    const nilai = `Kerusakan ${t.kerusakan} (${t.kerusakanSpec.nama}) bernilai kondisi ${t.skor.nk} · ${NK_URAIAN[t.skor.nk].label}`;
    const hasil: Usulan[] = [
      {
        ...dasar,
        jenis: 'khusus',
        alasan: `${nilai}. ${NK_URAIAN[t.skor.nk].arti}`,
        pengujian: 'Ditetapkan inspektur menurut jenis kerusakan (Tabel 8–10).',
      },
    ];
    if (t.skor.nk >= 4) {
      hasil.push({ ...dasar, jenis: 'darurat', alasan: `${nilai}. Kerusakan yang berpotensi pada keruntuhan jembatan.` });
    }
    return hasil;
  });
}

export interface HasilUsulan {
  khusus: Usulan[];
  darurat: Usulan[];
  /** Jawaban "Apakah tindakan darurat disarankan?". */
  daruratDisarankan: boolean;
}

export function susunUsulan(readings: Reading[] | null, temuan: TemuanBernilai[]): HasilUsulan {
  const semua = [...dariSensor(readings ?? []), ...dariTemuan(temuan)];
  const darurat = semua.filter((u) => u.jenis === 'darurat');
  return {
    khusus: semua.filter((u) => u.jenis === 'khusus'),
    darurat,
    daruratDisarankan: darurat.length > 0,
  };
}
