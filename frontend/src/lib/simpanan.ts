/**
 * Simpanan kecil di peramban dengan jalur berlangganan.
 *
 * Bentuknya sama dengan simpanan alarm dan temuan: satu kunci
 * `localStorage`, nomor versi untuk `useSyncExternalStore`, dan salinan
 * dalam ingatan **hanya bila penulisan terakhir gagal** — supaya yang baru
 * dicatat tidak menghilang dari layar ketika kuota penuh, tetapi perubahan
 * dari tab lain tidak tertimpa salinan usang selama penyimpanan sehat.
 *
 * Keterbatasannya disadari: isinya hanya ada di peramban ini. Hari simpanan
 * pindah ke server, yang diganti adalah modul pemakainya; halaman hanya
 * memanggil fungsi yang mereka ekspor.
 */
export interface Simpanan<T> {
  /** Isi sekarang, atau `kosong` bila belum ada. */
  baca: () => T;
  /** Ganti seluruh isi. `false` bila peramban menolak menyimpan. */
  tulis: (isi: T) => boolean;
  langgan: (f: () => void) => () => void;
  versi: () => number;
}

export function buatSimpanan<T>(kunci: string, kosong: T): Simpanan<T> {
  let versi = 0;
  let cadangan: T | null = null;
  const pendengar = new Set<() => void>();

  const bacaPeramban = (): T | null => {
    try {
      const mentah = localStorage.getItem(kunci);
      if (!mentah) return null;
      const isi = JSON.parse(mentah) as T;
      return isi && typeof isi === 'object' ? isi : null;
    } catch {
      return null;
    }
  };

  return {
    baca: () => cadangan ?? bacaPeramban() ?? kosong,
    tulis: (isi) => {
      let tersimpan = true;
      try {
        localStorage.setItem(kunci, JSON.stringify(isi));
      } catch {
        tersimpan = false;
      }
      cadangan = tersimpan ? null : isi;
      versi += 1;
      pendengar.forEach((f) => f());
      return tersimpan;
    },
    langgan: (f) => {
      pendengar.add(f);
      return () => {
        pendengar.delete(f);
      };
    },
    versi: () => versi,
  };
}
