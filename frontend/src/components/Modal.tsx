import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Jendela bertumpuk, dibangun di atas `<dialog>` bawaan peramban.
 *
 * Bukan `<div>` berlapis `position: fixed`. Elemen `<dialog>` yang dibuka
 * dengan `showModal()` sudah membawa empat hal yang kalau dikerjakan sendiri
 * hampir selalu setengah jadi:
 *
 *   - **Perangkap fokus.** Tab tidak dapat keluar ke halaman di belakangnya,
 *     jadi pengguna papan ketik tidak tersesat di formulir yang tidak
 *     terlihat.
 *   - **Tombol Esc** menutupnya tanpa satu baris pun penangan tombol.
 *   - **Lapisan atas** (`::backdrop`) di luar urutan susun halaman, jadi tidak
 *     ada perang `z-index` dengan rel, kepala, dan panggung tiga dimensi.
 *   - **Halaman di belakangnya menjadi inert** — tidak dapat diklik dan tidak
 *     dibacakan pembaca layar sebagai bagian dari isi yang aktif.
 *
 * Yang tetap harus dikerjakan sendiri hanya dua: memanggil `showModal()` pada
 * saat yang tepat, dan menangkap peristiwa `cancel` supaya Esc mengembalikan
 * keadaan React, bukan cuma menutup elemennya. Tanpa yang kedua, jendelanya
 * hilang dari layar sementara React masih mengira ia terbuka, dan tombol yang
 * membukanya berhenti bekerja.
 */

export interface ModalProps {
  open: boolean;
  title: string;
  /** Keterangan pendek di bawah judul; sering berisi acuan yang sedang diubah. */
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, subtitle, onClose, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  /*
   * Disamakan tiap render, bukan hanya ketika `open` berubah.
   *
   * Elemen `<dialog>` menyimpan keadaan bukanya sendiri di DOM, dan DOM dapat
   * berpindah tanpa sepengetahuan React — `close()` yang dipanggil kode lain,
   * alat uji, atau ekstensi. Bila penyamaannya hanya berjalan saat `open`
   * berubah, satu perpindahan diam-diam membuat keduanya berbeda selamanya:
   * React mengira jendelanya terbuka, tombolnya berhenti bekerja, dan tidak
   * ada yang dapat mengembalikannya.
   *
   * Tanpa senarai kebergantungan, tiap render mengembalikan DOM ke keadaan
   * yang dikehendaki React. Ongkosnya dua pembacaan `dialog.open` per render.
   */
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const batal = (event: Event) => {
      // Esc ditangani React, bukan peramban: kalau dibiarkan, elemennya
      // tertutup sementara `open` di React tetap `true`.
      event.preventDefault();
      onClose();
    };
    /*
     * `close` sengaja **tidak** didengar.
     *
     * Sempat dipasang sebagai jaring pengaman, dan justru ia yang merusak:
     * `close` dikirim juga ketika React sendiri yang menutup jendelanya, jadi
     * penanganannya memanggil `onClose` di tengah pembaruan yang sedang
     * berjalan dan menghasilkan lomba yang membuat jendela berikutnya gagal
     * terbuka sekali. Ketidaksamaan DOM diurus penyamaan tiap render di atas,
     * bukan oleh pendengar yang ikut mengubah keadaan.
     */
    dialog.addEventListener('cancel', batal);
    return () => dialog.removeEventListener('cancel', batal);
  }, [onClose]);

  return (
    <dialog ref={ref} className="modal" aria-labelledby="modal-judul">
      {/*
        * Klik di luar kartu menutup jendela. `<dialog>` sendiri memenuhi
        * seluruh layar ketika modal, jadi klik yang mendarat pada elemennya —
        * bukan pada kartunya — berarti klik di latar.
        */}
      <div
        className="modal-latar"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="modal-kartu glass" role="document">
          <div className="modal-kepala">
            <div style={{ minWidth: 0 }}>
              <h2 id="modal-judul" className="modal-judul">
                {title}
              </h2>
              {subtitle ? <p className="modal-subjudul">{subtitle}</p> : null}
            </div>
            <button type="button" className="modal-tutup" onClick={onClose} title="Tutup">
              <span aria-hidden="true">×</span>
              <span className="sr-only">Tutup</span>
            </button>
          </div>

          <div className="modal-isi">{children}</div>

          {footer ? <div className="modal-kaki">{footer}</div> : null}
        </div>
      </div>
    </dialog>
  );
}
