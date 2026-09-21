/**
 * Unduh dan cetak tabel.
 *
 * Situs telemetri lapangan selalu berakhir di dua tempat yang sama: berkas yang
 * dibuka di Excel dan lembar yang dicetak untuk dilampirkan ke laporan. Karena
 * itu keduanya disiapkan di sini, bukan di halaman yang menampilkan tabelnya —
 * halaman cukup menyusun barisnya, formatnya diurus satu modul.
 *
 * Pemisahnya titik koma dan desimalnya koma, bukan sebaliknya. Excel dengan
 * setelan wilayah Indonesia membaca `0,25` sebagai satu angka dan `0.25`
 * sebagai teks; berkas yang benar menurut RFC 4180 justru yang rusak di layar
 * orang yang membukanya. Tanda urutan bita di depan berkas dipasang dengan
 * alasan yang sama: tanpa itu Excel membaca berkas sebagai ANSI dan huruf
 * beraksen pada nama kanal berubah menjadi sampah.
 */

/** Satu baris tabel. Sel angka diformat di sini, bukan oleh pemanggilnya. */
export type BarisCsv = Array<string | number | null | undefined>;

const PEMISAH = ';';

/** Angka ditulis dengan koma desimal; teks dikutip bila memuat pemisah. */
function sel(nilai: string | number | null | undefined): string {
  if (nilai === null || nilai === undefined) return '';
  if (typeof nilai === 'number') {
    if (!Number.isFinite(nilai)) return '';
    return String(nilai).replace('.', ',');
  }
  const teks = String(nilai);
  return /["\n\r]|[;,\t]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks;
}

export function susunCsv(baris: BarisCsv[], pemisah: string = PEMISAH): string {
  return baris.map((r) => r.map(sel).join(pemisah)).join('\r\n');
}

/**
 * Waktu di dalam berkas: `2026-09-19 14:35:07`.
 *
 * Tahun di depan supaya kolomnya dapat diurut sebagai teks biasa, dan
 * milidetiknya dipisah titik — koma sudah menjadi tanda desimal di berkas ini,
 * dan sel waktu yang membawanya harus dikutip agar tidak terbelah.
 */
export function waktuBerkas(ms: number, milidetik = false): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  const jam = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  const sisa = milidetik ? `.${String(d.getMilliseconds()).padStart(3, '0')}` : '';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${jam}${sisa}`;
}

/** `2026-09-19_1435` — cukup untuk membedakan dua unduhan pada hari yang sama. */
export function stempelBerkas(waktu: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${waktu.getFullYear()}-${p(waktu.getMonth() + 1)}-${p(waktu.getDate())}` +
    `_${p(waktu.getHours())}${p(waktu.getMinutes())}`
  );
}

/**
 * Susun berkas CSV lalu serahkan ke peramban.
 *
 * Tautan sementara dibuang setelah kliknya, dan alamat objeknya dicabut pada
 * putaran berikutnya — dicabut seketika, sebagian peramban keburu membatalkan
 * unduhannya.
 */
export function unduhCsv(namaBerkas: string, baris: BarisCsv[]): void {
  const isi = `\uFEFF${susunCsv(baris)}`;
  const berkas = new Blob([isi], { type: 'text/csv;charset=utf-8;' });
  const alamat = URL.createObjectURL(berkas);
  const tautan = document.createElement('a');
  tautan.href = alamat;
  tautan.download = namaBerkas.endsWith('.csv') ? namaBerkas : `${namaBerkas}.csv`;
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();
  window.setTimeout(() => URL.revokeObjectURL(alamat), 1000);
}

/** Dialog cetak peramban. Yang ikut tercetak diatur blok `@media print`. */
export function cetakHalaman(): void {
  window.print();
}
