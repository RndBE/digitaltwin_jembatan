/**
 * Penilaian kondisi elemen struktur.
 *
 * Telemetri menjawab "sekarang bagaimana". Yang tidak dijawabnya adalah
 * pertanyaan yang sebenarnya dipakai mengambil keputusan anggaran: *elemen
 * mana* yang kondisinya paling buruk, dan atas dasar apa. Jawabannya tidak
 * bisa datang dari sensor saja — sensor punya cakupan sempit dan frekuensi
 * tinggi, inspeksi punya cakupan luas dan frekuensi rendah, uji diagnostik
 * punya akurasi tinggi tetapi jarang. Ketiganya melihat hal yang sama dari
 * sudut yang berbeda, dan skor kondisi adalah cara menggabungkannya.
 */

/**
 * Bobot tiap sumber.
 *
 * Angka ini **wajib dikalibrasi bersama ahli struktur**; ia bukan tetapan
 * universal. Yang dibawanya adalah perbandingan cakupan × frekuensi ×
 * kepercayaan:
 *
 *   sensor kontinu    1,0   cakupan sempit, frekuensi tinggi
 *   inspeksi visual   0,6   cakupan luas,   frekuensi rendah
 *   uji diagnostik    0,3   cakupan sempit, akurasi tinggi, jarang
 */
export const SOURCE_WEIGHTS = { sensor: 1.0, visual: 0.6, diagnostic: 0.3 } as const;

export type SourceKey = keyof typeof SOURCE_WEIGHTS;

export const SOURCE_LABELS: Record<SourceKey, string> = {
  sensor: 'Sensor kontinu',
  visual: 'Inspeksi visual',
  diagnostic: 'Uji diagnostik',
};

/**
 * Tiga nilai mentah 0..1; 1 berarti sempurna, `null` berarti sumbernya tidak
 * berkata apa-apa tentang elemen ini.
 */
export type RawCondition = Record<SourceKey, number | null>;

export const CONDITION_THRESHOLDS = { baik: 0.85, pantau: 0.7 } as const;

export type ConditionStatus = 'baik' | 'pantau' | 'tindak';

export const CONDITION_LABEL: Record<ConditionStatus, string> = {
  baik: 'BAIK',
  pantau: 'PANTAU',
  tindak: 'TINDAK',
};

export const CONDITION_CLASS: Record<ConditionStatus, string> = {
  baik: 'tag tag-normal',
  pantau: 'tag tag-waspada',
  tindak: 'tag tag-bahaya',
};

export const CONDITION_COLOR: Record<ConditionStatus, string> = {
  baik: 'var(--state-normal)',
  pantau: 'var(--state-waspada)',
  tindak: 'var(--state-bahaya)',
};

export function conditionStatus(score: number): ConditionStatus {
  if (score >= CONDITION_THRESHOLDS.baik) return 'baik';
  if (score >= CONDITION_THRESHOLDS.pantau) return 'pantau';
  return 'tindak';
}

/**
 * Skor satu elemen: rata-rata berbobot dari sumber yang **tersedia**.
 *
 * Sumber yang tidak ada ditulis `null`, bukan nol, dan bobotnya dikeluarkan
 * dari penyebut. Bedanya besar: nol berarti "elemennya hancur menurut sumber
 * ini", sedangkan tidak ada berarti "sumber ini tidak berkata apa-apa". Elemen
 * tanpa sensor — sandaran, kerb — akan dihukum berat oleh yang pertama padahal
 * yang benar adalah yang kedua.
 */
export function elementScore(raw: RawCondition): number {
  let num = 0;
  let den = 0;
  (Object.keys(SOURCE_WEIGHTS) as SourceKey[]).forEach((key) => {
    const value = raw[key];
    if (value === null) return;
    num += value * SOURCE_WEIGHTS[key];
    den += SOURCE_WEIGHTS[key];
  });
  return den > 0 ? num / den : 1;
}

export interface BreakdownPart {
  key: SourceKey;
  label: string;
  value: number | null;
  weight: number;
  contribution: number;
}

/**
 * Rincian skor, untuk ditampilkan apa adanya.
 *
 * Angka agregat yang tidak dapat dibongkar akan dianggap ajaib, dan yang ajaib
 * tidak dipakai orang untuk membelanjakan uang. Kalau ahli struktur tidak bisa
 * melihat kenapa skornya 0,61, ia tidak akan percaya sistemnya — dan ia benar.
 */
export function scoreBreakdown(raw: RawCondition) {
  const parts: BreakdownPart[] = (Object.keys(SOURCE_WEIGHTS) as SourceKey[]).map((key) => ({
    key,
    label: SOURCE_LABELS[key],
    value: raw[key],
    weight: SOURCE_WEIGHTS[key],
    contribution: raw[key] === null ? 0 : (raw[key] as number) * SOURCE_WEIGHTS[key],
  }));

  const dipakai = parts.filter((part) => part.value !== null);
  const denominator = dipakai.reduce((sum, part) => sum + part.weight, 0);
  const numerator = dipakai.reduce((sum, part) => sum + part.contribution, 0);
  return { parts, numerator, denominator, score: denominator > 0 ? numerator / denominator : 1 };
}

/**
 * Skor gabungan seluruh struktur — **sengaja bukan rata-rata**.
 *
 * Rata-rata menyembunyikan kegagalan setempat, dan kegagalan setempat itulah
 * yang dicari: satu tumpuan dengan skor 0,58 di antara tiga belas elemen sehat
 * akan hilang di dalam rata-rata, padahal justru tumpuan itu yang menentukan
 * apa yang harus dikerjakan bulan depan. Karena itu skornya ditarik ke arah
 * elemen terburuk sebesar `severity`.
 *
 *   severity = 0  → rata-rata murni
 *   severity = 1  → minimum murni
 */
export function rollUp(scores: number[], severity = 0.75): number {
  if (scores.length === 0) return 1;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  return mean * (1 - severity) + min * severity;
}

/**
 * Elemen yang menarik turun skor gabungan.
 *
 * Wajib ditampilkan di samping angkanya. Indeks tanpa penyebab hanya memberi
 * tahu bahwa ada yang salah, dan orang tidak dapat mengerjakan "ada yang
 * salah".
 */
export function driver<T extends { score: number }>(elements: T[]): T | null {
  if (elements.length === 0) return null;
  return elements.reduce((worst, item) => (item.score < worst.score ? item : worst), elements[0]);
}
