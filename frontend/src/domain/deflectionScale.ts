import type { Status } from '../lib/types';
import { SENSOR_BY_ID, statusOf } from './sensors';

/**
 * Skala gambar lendutan — bertingkat menurut ambang, bukan satu pengali.
 *
 * Lendutan tengah bentang bergerak dalam milimeter sementara bentangnya
 * seratus meter lebih; pada skala sebenarnya ia nol piksel, jadi gambarnya
 * wajib dibesarkan. Yang tidak wajib adalah membesarkannya **sama rata**.
 *
 * Satu pengali tetap memaksa satu kompromi yang tidak enak di kedua ujungnya:
 * cukup besar supaya keadaan kritis terbaca berarti keadaan normal pun sudah
 * tampak melengkung — dan lantai yang selalu melengkung membuat orang berhenti
 * memperhatikan lengkungannya. Cukup kecil supaya keadaan normal tampak lurus
 * berarti keadaan kritis hanya beberapa piksel lebih dalam, dan tidak ada yang
 * melihatnya datang.
 *
 * Karena itu pengalinya naik per pita ambang: tipis selama di bawah ambang
 * waspada, lebih tegas di antara waspada dan kritis, dan paling dalam setelah
 * ambang kritis terlampaui. Gambarnya jadi bergerak bukan hanya ketika
 * angkanya berubah, tetapi juga **lebih keras per milimeter** ketika angkanya
 * masuk wilayah yang berbahaya.
 */

/**
 * Pengali tiap pita, dipakai pada milimeter **di dalam** pita itu saja.
 *
 * Pita aman sengaja jauh lebih dangkal daripada dua pita di atasnya. Bukan
 * karena keadaan normal kurang penting, melainkan karena bentuk yang paling
 * cepat dikenali mata adalah **garis lurus**: selama lantainya lurus, tidak
 * ada yang perlu dibaca. Pada pengali yang lebih besar keadaan normal pun
 * sudah tampak melengkung, dan lengkungan yang selalu ada berhenti menjadi
 * kabar — orang menyetel matanya pada lengkungan itu, lalu tidak melihat
 * lengkungan berikutnya datang.
 *
 * Selisih antar pita yang melebar adalah maksudnya: satu milimeter di atas
 * ambang waspada tergambar empat kali lebih dalam daripada satu milimeter di
 * bawahnya, dan satu milimeter di atas ambang kritis delapan kali. Yang
 * berpindah pita karena itu terlihat berpindah, bukan sekadar bertambah.
 */
export const SAG_GAIN: Record<Status, number> = {
  AMAN: 110,
  WASPADA: 450,
  KRITIS: 900,
};

/**
 * Peredaman pegas tiap pita.
 *
 * Bukan sekadar hiasan. Rasio redaman struktur adalah besaran yang benar-benar
 * dipantau di lapangan, dan turunnya rasio redaman adalah salah satu penanda
 * kerusakan yang paling dikenal: struktur yang retak atau sambungannya longgar
 * menyerap energi lebih sedikit dan bergoyang lebih lama. Jadi lantai yang
 * turun dengan tenang saat aman lalu mengayun dan lama tenangnya saat kritis
 * bukan efek yang dikarang — itu yang memang terjadi.
 *
 *   omega  laju tanggapan, rad/detik
 *   zeta   rasio redaman; 1 berarti berhenti tanpa terlewat sama sekali
 */
export const SAG_DYNAMICS: Record<Status, { omega: number; zeta: number }> = {
  AMAN: { omega: 5.5, zeta: 0.92 },
  WASPADA: { omega: 5.0, zeta: 0.6 },
  KRITIS: { omega: 4.2, zeta: 0.34 },
};

export interface SagBand {
  /** Pita tempat nilainya jatuh. */
  status: Status;
  /** Pengali yang berlaku pada milimeter berikutnya, bukan pada seluruh nilai. */
  gain: number;
  /** Lendutan yang digambar, dalam milimeter skala sebenarnya. */
  drawnMm: number;
  /** Sama, dalam meter — inilah yang dibaca adegan tiga dimensi. */
  drawnMetres: number;
  /**
   * Pengali rata-rata yang sedang berlaku, `drawnMm / value`.
   *
   * Angka inilah yang ditulis di layar, karena `gain` hanya berlaku pada
   * milimeter terakhir dan menuliskannya akan menyesatkan.
   */
  effective: number;
  omega: number;
  zeta: number;
}

/**
 * Lendutan yang digambar, milimeter skala sebenarnya.
 *
 * Bertingkat tetapi **menerus dan selalu naik**: tiap pita hanya mengalikan
 * milimeter yang jatuh di dalam pita itu, jadi tidak ada lompatan di batas
 * pita dan nilai yang lebih besar tidak pernah tergambar lebih dangkal. Dua
 * sifat itu tidak boleh hilang — kalau hilang, gambarnya berhenti bisa
 * dibandingkan dengan dirinya sendiri sedetik yang lalu.
 */
export function drawnMillimetres(value: number): number {
  const sensor = SENSOR_BY_ID.defl;
  if (!sensor || value <= 0) return 0;
  const { warn, crit } = sensor;
  const aman = Math.min(value, warn);
  const waspada = Math.max(0, Math.min(value, crit) - warn);
  const kritis = Math.max(0, value - crit);
  return aman * SAG_GAIN.AMAN + waspada * SAG_GAIN.WASPADA + kritis * SAG_GAIN.KRITIS;
}

/** Seluruh keterangan skala untuk satu nilai lendutan. */
export function sagBand(value: number): SagBand {
  const sensor = SENSOR_BY_ID.defl;
  const status: Status = sensor ? statusOf(sensor, value) : 'AMAN';
  const drawnMm = drawnMillimetres(value);
  return {
    status,
    gain: SAG_GAIN[status],
    drawnMm,
    drawnMetres: drawnMm / 1000,
    effective: value > 0 ? drawnMm / value : SAG_GAIN.AMAN,
    ...SAG_DYNAMICS[status],
  };
}
