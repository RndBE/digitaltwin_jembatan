/**
 * Keadaan lingkungan di sekitar jembatan: muka air sungai dan curah hujan.
 *
 * Keduanya **data peraga**, sama seperti isi `demoData.ts`. Keduanya juga
 * sengaja tidak dijadikan kanal sensor di `sensors.ts`: kanal di sana ikut
 * menimbang indeks kesehatan struktur, dan hujan yang turun deras tidak
 * membuat rangka bajanya lebih buruk — ia hanya membuat keadaan di sekitarnya
 * berubah. Yang diukur struktur dan yang diukur lingkungan dipisahkan supaya
 * angka kesehatan tetap berbicara tentang jembatannya saja.
 *
 * Nilainya ditentukan oleh **jam pengambilan**, bukan oleh pencacah yang
 * berjalan. Dua pemanggilan dengan cuplikan yang sama selalu menghasilkan
 * angka yang sama, dan itulah yang membuat "naik 0,4 m sejak subuh" dapat
 * dihitung apa adanya: nilainya enam jam lalu tinggal dihitung ulang dengan
 * jam enam jam lalu, bukan disimpan di suatu tempat.
 */

const JAM = 3_600_000;

/** Muka air pada keadaan biasa, meter di atas dasar palung. */
const AIR_DASAR = 2.3;
/** Muka air saat banjir penuh — dipakai sebagai ujung atas skenario banjir. */
const AIR_BANJIR = 6.1;

/** Bilangan semu 0..1, tetap sama untuk masukan yang sama. */
function acak(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Derau yang **berpindah mulus**, bukan melompat tiap langkah.
 *
 * Muka air yang melonjak dua puluh sentimeter antara satu cuplikan dan
 * cuplikan berikutnya akan terbaca sebagai alat yang rusak, bukan sebagai
 * sungai. Nilai acak karena itu hanya dipasang pada titik bulat, dan yang di
 * antaranya diambil dengan pelembut kubik.
 */
function derau(t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const halus = f * f * (3 - 2 * f);
  return acak(i) * (1 - halus) + acak(i + 1) * halus;
}

export interface EnvironmentState {
  /** Muka air sungai, meter di atas dasar palung. */
  water: number;
  /** Selisih muka air terhadap enam jam lalu, meter. */
  waterDelta: number;
  /** Curah hujan sesaat, mm/jam. */
  rain: number;
  /** Hujan terkumpul tiga jam terakhir, mm. */
  rain3h: number;
  /** Bagian banjir 0..1 yang sedang dipaksakan skenario, 0 bila tidak ada. */
  flood: number;
}

function airPada(ms: number, flood: number): number {
  // Satu gelombang lambat berperiode belasan jam: sungai naik-turun mengikuti
  // hujan di hulu, bukan mengikuti jam dinding.
  const gelombang = (derau(ms / JAM / 6) - 0.5) * 0.9;
  return AIR_DASAR + gelombang + flood * (AIR_BANJIR - AIR_DASAR);
}

function hujanPada(ms: number, flood: number): number {
  /*
   * Hujan sebagian besar waktu tidak turun.
   *
   * Derau yang dipakai apa adanya menghasilkan gerimis abadi — angka yang
   * selalu bergerak di sekitar 7 mm/jam dan karena itu tidak pernah berarti
   * apa-apa. Ambang di bawah ini yang membuat sebagian besar jam kering dan
   * sisanya benar-benar hujan.
   */
  const dasar = Math.max(0, derau(ms / JAM / 2 + 40) * 26 - 12);
  return dasar + flood * 34;
}

export function environmentAt(at: string | number, flood = 0): EnvironmentState {
  const ms = typeof at === 'number' ? at : Date.parse(at) || Date.now();
  const water = airPada(ms, flood);
  const rain = hujanPada(ms, flood);
  // Hujan tiga jam diambil dari tiga cuplikan berjarak satu jam, bukan dari
  // satu nilai dikali tiga: yang menarik dari angka ini justru hujan yang
  // sudah berhenti setengah jam lalu tetapi airnya masih di sungai.
  const rain3h = [0, 1, 2].reduce((sum, mundur) => sum + hujanPada(ms - mundur * JAM, flood), 0);

  return {
    water: Math.round(water * 100) / 100,
    waterDelta: Math.round((water - airPada(ms - 6 * JAM, 0)) * 100) / 100,
    rain: Math.round(rain * 10) / 10,
    rain3h: Math.round(rain3h),
    flood,
  };
}

/** Keterangan pendek muka air, dipakai di bawah angkanya. */
export function keteranganAir(env: EnvironmentState): string {
  if (env.flood > 0) return `banjir skenario · ${(env.flood * 100).toFixed(0)} % tinggi rencana`;
  const arah = env.waterDelta >= 0 ? 'naik' : 'turun';
  return `${arah} ${Math.abs(env.waterDelta).toFixed(2)} m sejak 6 jam lalu`;
}
