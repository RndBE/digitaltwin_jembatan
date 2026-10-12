import { useEffect, useState } from 'react';

/**
 * Bilah posisi pada formulir bertahap: "Bagian 1 dari 2".
 *
 * Lembar isian pedoman dibagi dua bagian (Lampiran A): Bagian ke-1 data
 * administrasi, usulan, dan catatan; Bagian ke-2 penilaian kondisi. Bilah ini
 * menempel di dasar layar selama formulir berada di layar, menyebut bagian
 * mana yang sedang dibaca, dan satu klik membawa ke bagian lainnya. Bagian yang
 * sedang dibaca ditentukan dari yang tampak di layar, bukan dari klik terakhir.
 */

export interface BagianFormulir {
  /** `id` elemen DOM tempat bagian itu dimulai. */
  id: string;
  judul: string;
  /** Rujukan pedoman, mis. `Bab 8.4.1 · hlm. 81`. */
  rujukan: string;
}

export function BilahBagian({ bagian }: { bagian: BagianFormulir[] }) {
  const [aktif, setAktif] = useState(0);

  useEffect(() => {
    const tampak = new Set<string>();
    const pengamat = new IntersectionObserver(
      (entri) => {
        entri.forEach((e) => (e.isIntersecting ? tampak.add(e.target.id) : tampak.delete(e.target.id)));
        const pertama = bagian.findIndex((b) => tampak.has(b.id));
        if (pertama >= 0) setAktif(pertama);
      },
      { rootMargin: '-15% 0px -50% 0px' },
    );
    bagian.forEach((b) => {
      const elemen = document.getElementById(b.id);
      if (elemen) pengamat.observe(elemen);
    });
    return () => pengamat.disconnect();
  }, [bagian]);

  const pergi = (indeks: number) => {
    setAktif(indeks);
    document.getElementById(bagian[indeks].id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="glass bilah-bagian" aria-label="Bagian formulir">
      <span className="bilah-bagian-posisi tabular">
        Bagian {aktif + 1} dari {bagian.length}
      </span>
      <ol className="bilah-bagian-daftar">
        {bagian.map((b, i) => (
          <li key={b.id}>
            <button
              type="button"
              className="bilah-bagian-butir"
              aria-current={i === aktif ? 'step' : undefined}
              onClick={() => pergi(i)}
            >
              <span className="bilah-bagian-no" aria-hidden="true">{i + 1}</span>
              <span className="bilah-bagian-judul">{b.judul}</span>
              <span className="bilah-bagian-rujukan text-muted">{b.rujukan}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
