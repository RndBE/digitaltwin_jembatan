import type { Reading } from '../lib/types';
import { dossierFor, type BridgeDossier } from './demoData';
import { ELEMEN_BY_KODE } from './pedoman';
import { SENSOR_BY_ID, SENSORS } from './sensors';

/**
 * Pemeriksaan SMKS pada Pemeriksaan Rutin.
 *
 * Pedoman mencatat sistem pemantauan kesehatan struktur sebagai elemen utama
 * 3.750 (Lampiran B hlm. 132–134) dan meminta pemeriksa menjawab dua hal
 * tentangnya pada Formulir Rutin Tabel A.18, bagian "Keselamatan Jembatan":
 *
 *   a. Ketidaklengkapan elemen      Ya / Tidak
 *   b. Tidak berfungsinya elemen    Ya / Tidak
 *
 * Perhatikan arahnya: "Ya" berarti **ada masalah**. Modul ini mengikuti arah
 * itu supaya isiannya dapat disalin ke formulir tanpa dibalik di kepala.
 *
 * Jawabannya diturunkan dari data sistem (inventaris unit dan cuplikan
 * telemetri terakhir), bukan dari pengamatan lapangan. Itu bukan pengganti
 * pemeriksa — ia menyiapkan jawaban awal dan menyebut alasannya, supaya
 * pemeriksa tahu ke mana harus melihat lebih dulu.
 */

/**
 * Kanal sensor aplikasi ke kode elemen SMKS Lampiran B.
 *
 * `vib` dipadankan ke 4.751g (accelerometer beban kendaraan) karena pemasangannya
 * mengukur getaran akibat lalu lintas; bila alat itu sebenarnya dipasang untuk
 * gempa, kodenya 4.751h. `crack` tidak punya padanan: daftar SMKS pedoman tidak
 * memuat crack meter (alat itu hanya muncul sebagai alat uji di Lampiran H).
 */
export const SMKS_KANAL: Record<string, string | null> = {
  vib: '4.751g',
  strain: '4.751a',
  defl: '4.751e',
  tilt: '4.751i',
  temp: '4.751v',
  wim: '4.752a',
  wind: '4.753a',
  crack: null,
};

/** CCTV bukan kanal sensor; kodenya ditetapkan sendiri. */
const KODE_CCTV = '4.754b';

export interface BarisSmks {
  kode: string;
  nama: string;
  /** Lokasi apa adanya dari inventaris; pedoman meminta A/P/B X Y Z yang belum ada. */
  lokasi: string;
  /** Jawaban "ketidaklengkapan elemen": Ya bila tidak ada unit terpasang. */
  tidakLengkap: boolean;
  /** Jawaban "tidak berfungsinya elemen"; `null` bila belum ada data untuk menjawab. */
  tidakBerfungsi: boolean | null;
  /** Alasan jawaban "Ya", supaya pemeriksa tahu apa yang harus dicek. */
  alasan: string[];
}

export interface HasilSmks {
  baris: BarisSmks[];
  /** Kanal terpasang yang tidak punya kode elemen di pedoman. */
  tanpaKode: string[];
  /** Ada satu saja jawaban "Ya" di antara baris. */
  adaMasalah: boolean;
}

const tanggalPendek = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

function barisSensor(
  kode: string,
  kanal: string,
  dossier: BridgeDossier,
  readings: Reading[] | null,
): BarisSmks {
  const spec = SENSOR_BY_ID[kanal];
  const unit = dossier.sensors.find((u) => u.channel === spec.name);
  const alasan: string[] = [];

  if (!unit) alasan.push(`Tidak ada unit ${spec.name} pada inventaris sensor.`);

  let tidakBerfungsi: boolean | null = null;
  if (readings) {
    tidakBerfungsi = false;
    if (!readings.some((r) => r.id === kanal)) {
      tidakBerfungsi = true;
      alasan.push(`Tidak ada pembacaan ${spec.name} pada cuplikan terakhir.`);
    }
    dossier.offlineNodes
      .filter((node) => node.channel === kanal)
      .forEach((node) => {
        tidakBerfungsi = true;
        alasan.push(
          `${node.id} (${node.place}) tidak melapor sejak ${tanggalPendek(node.since)}: ${node.reason}.`,
        );
      });
  }

  return {
    kode,
    nama: ELEMEN_BY_KODE[kode]?.elemen.nama ?? kode,
    lokasi: unit?.location ?? spec.node,
    tidakLengkap: !unit,
    tidakBerfungsi,
    alasan,
  };
}

function barisCctv(dossier: BridgeDossier): BarisSmks {
  const kamera = dossier.cameras;
  const bermasalah = kamera.filter((c) => c.status !== 'daring');
  return {
    kode: KODE_CCTV,
    nama: ELEMEN_BY_KODE[KODE_CCTV]?.elemen.nama ?? 'CCTV',
    lokasi: kamera.length ? `${kamera.length} kamera` : '—',
    tidakLengkap: kamera.length === 0,
    tidakBerfungsi: bermasalah.length > 0,
    alasan: [
      ...(kamera.length === 0 ? ['Tidak ada kamera pada inventaris.'] : []),
      ...bermasalah.map(
        (c) => `${c.id} (${c.place}) ${c.status}${c.note ? `: ${c.note}` : ''}.`,
      ),
    ],
  };
}

/**
 * Jawaban awal Tabel A.18 butir SMKS untuk sebuah aset.
 *
 * `readings` kosong (`null`) berarti telemetri belum sampai; jawaban "tidak
 * berfungsi" dibiarkan `null` alih-alih ditebak tidak.
 */
export function periksaSmks(bridgeId: string, readings: Reading[] | null): HasilSmks | null {
  const dossier = dossierFor(bridgeId);
  if (!dossier) return null;

  const baris = Object.entries(SMKS_KANAL)
    .filter(([, kode]) => kode !== null)
    .map(([kanal, kode]) => barisSensor(kode as string, kanal, dossier, readings))
    .sort((a, b) => a.kode.localeCompare(b.kode));
  baris.push(barisCctv(dossier));

  const terpasangTanpaKode = SENSORS.filter((s) => SMKS_KANAL[s.id] === null)
    .filter((s) => dossier.sensors.some((u) => u.channel === s.name))
    .map((s) => s.name);

  return {
    baris,
    tanpaKode: terpasangTanpaKode,
    adaMasalah: baris.some((b) => b.tidakLengkap || b.tidakBerfungsi),
  };
}
