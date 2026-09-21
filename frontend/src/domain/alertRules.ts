import type { Reading, Status } from '../lib/types';
import { SENSOR_BY_ID, statusOf } from './sensors';

/**
 * Aturan yang menaikkan tingkat siaga, ditulis sebagai data.
 *
 * Statusnya sendiri sudah dihitung `worstStatus` di `risk.ts` — tiga baris
 * kode yang benar dan tidak perlu diubah. Yang tidak dijawab tiga baris itu
 * adalah pertanyaan yang justru diajukan orang yang harus menandatangani:
 * *kenapa* sekarang KRITIS, aturan mana yang dilanggar, kanal mana yang
 * melanggarnya, dan sejak kapan.
 *
 * Selama kriterianya hanya hidup di dalam kode, jawaban itu tidak dapat
 * ditampilkan; status di layar lalu dianggap ajaib, dan yang ajaib tidak
 * dipercaya. Karena itu tiap tingkat membawa kalimat kriterianya sendiri dan
 * fungsi yang menunjuk kanal pelanggarnya.
 *
 * Aturan di sini wajib setara dengan `worstStatus`, bukan tafsiran baru
 * atasnya. Begitu keduanya berbeda, halaman akan menyebut satu alasan
 * sementara sistem bertindak atas alasan lain — lebih buruk daripada tidak
 * menyebut alasan sama sekali.
 */

export interface AlertRule {
  /** Kode pendek supaya aturannya dapat dirujuk di berita acara. */
  code: string;
  level: Status;
  /** Kriteria, dalam kalimat yang dapat dibaca operator apa adanya. */
  criteria: string;
  /** Yang dituntut tingkat ini begitu aturannya berlaku. */
  action: string;
  /** Kanal yang memenuhi kriterianya; kosong berarti aturan tidak berlaku. */
  match: (readings: Reading[]) => Reading[];
}

/** Status sebuah pembacaan menurut ambang yang sedang berlaku di peramban ini. */
const levelOf = (reading: Reading): Status => {
  const spec = SENSOR_BY_ID[reading.id];
  return spec ? statusOf(spec, reading.value) : 'AMAN';
};

/**
 * Urutannya menentukan: yang pertama cocok itulah yang berlaku. Karena itu
 * aturan paling berat ditulis lebih dulu, persis seperti `worstStatus` yang
 * memeriksa KRITIS sebelum WASPADA.
 */
export const ALERT_RULES: AlertRule[] = [
  {
    code: 'R-03',
    level: 'KRITIS',
    criteria: 'Satu kanal atau lebih menyentuh ambang kritisnya.',
    action:
      'Pembatasan beban segera, inspeksi darurat, dan pelaporan ke pihak berwenang dalam 24 jam.',
    match: (readings) => readings.filter((reading) => levelOf(reading) === 'KRITIS'),
  },
  {
    code: 'R-02',
    level: 'WASPADA',
    criteria:
      'Satu kanal atau lebih menyentuh ambang waspada, dan belum ada satu pun yang menyentuh ambang kritis.',
    action: 'Inspeksi struktur dijadwalkan dalam 7 hari dan pemantauan dinaikkan menjadi harian.',
    match: (readings) => readings.filter((reading) => levelOf(reading) === 'WASPADA'),
  },
  {
    code: 'R-01',
    level: 'AMAN',
    criteria: 'Seluruh kanal berada di bawah ambang waspadanya.',
    action: 'Pemantauan rutin dilanjutkan; inspeksi terjadwal berikutnya 30 hari.',
    // Aturan penutup: ia berlaku justru ketika tidak ada kanal yang melanggar,
    // jadi tidak ada kanal yang dapat ditunjuk sebagai penyebabnya.
    match: () => [],
  },
];

export interface ActiveRule {
  rule: AlertRule;
  /** Kanal yang membuat aturannya berlaku; kosong pada tingkat aman. */
  triggered: Reading[];
}

/** Aturan yang sedang menentukan tingkat siaga, beserta kanal pelanggarnya. */
export function activeRule(readings: Reading[]): ActiveRule {
  for (const rule of ALERT_RULES) {
    const triggered = rule.match(readings);
    if (triggered.length > 0) return { rule, triggered };
  }
  return { rule: ALERT_RULES[ALERT_RULES.length - 1], triggered: [] };
}

/**
 * Lama sebuah keadaan bertahan, dihitung dari saat status terakhir berpindah.
 *
 * "Sejak kapan" sama pentingnya dengan "sekarang apa": kanal yang melewati
 * ambang sejak dua menit lalu dan kanal yang melewatinya sejak kemarin sore
 * menuntut tindakan yang berbeda, walau keduanya berstatus sama.
 */
export function lamaSejak(iso: string, now: Date = new Date()): string {
  const detik = Math.max(0, (now.getTime() - Date.parse(iso)) / 1000);
  if (!Number.isFinite(detik)) return '—';
  // Ditulis pendek, bukan panjang: kalimat ini duduk di kepala aplikasi yang
  // satu baris, dan 'kurang dari semenit' sendirian memakan tujuh puluh piksel
  // untuk mengatakan apa yang '< 1 menit' katakan sama jelasnya.
  if (detik < 60) return '< 1 menit';
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam < 24) return sisa ? `${jam} jam ${sisa} menit` : `${jam} jam`;
  const hari = Math.floor(jam / 24);
  return `${hari} hari ${jam % 24} jam`;
}

/** Jam saja, gaya Indonesia: `09:41:07`. */
export function jamSejak(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
