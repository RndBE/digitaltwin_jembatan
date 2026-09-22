/**
 * Ikon navigasi.
 *
 * Digambar sebaris, bukan dimuat dari pustaka ikon: yang dipakai sepuluh
 * bentuk saja, dan sepuluh bentuk tidak sepadan dengan satu paket tambahan
 * beserta pohon berkasnya. Semuanya garis dengan tebal yang sama dan warna
 * `currentColor`, sehingga butir menu yang aktif membawa ikonnya ikut menyala
 * tanpa aturan warna tersendiri.
 *
 * Ikon di sini **tidak menggantikan label**, hanya mendampinginya. Sepuluh
 * butir teks polos menuntut pembacanya membaca ulang tiap kali; sepuluh butir
 * bergambar tanpa teks menuntutnya menghafal sandi. Yang bekerja adalah
 * keduanya sekaligus — bentuknya untuk mata yang sudah hafal, hurufnya untuk
 * yang belum.
 */

export type IconName =
  | 'home'
  | 'cube'
  | 'table'
  | 'pulse'
  | 'bars'
  | 'play'
  | 'doc'
  | 'clipboard'
  | 'radio'
  | 'alert'
  | 'camera'
  | 'layers'
  | 'wrench';

/** Tiap ikon satu atau beberapa jalur pada kotak 24 × 24. */
const PATHS: Record<IconName, string[]> = {
  home: ['M3.4 10.4 12 3.2l8.6 7.2', 'M5.6 9.3V20.2h12.8V9.3'],
  cube: ['M12 2.9 20.4 7.5v9L12 21.1 3.6 16.5v-9z', 'M3.6 7.5 12 12.1l8.4-4.6', 'M12 12.1v9'],
  table: ['M3.6 5.4h16.8v13.2H3.6z', 'M3.6 10h16.8', 'M9.6 10v8.6', 'M15.2 10v8.6'],
  pulse: ['M3.4 12.6h3.6L9.5 6l3.6 12 2.4-5.4h5.1'],
  bars: ['M3.8 3.8v16.4h16.4', 'M7.4 16.8h8.4', 'M7.4 12.2h12.2', 'M7.4 7.6h5.6'],
  play: ['M8.4 5.4 18.6 12 8.4 18.6z'],
  doc: ['M6.4 3.4h7.4l4.2 4.2v13H6.4z', 'M13.6 3.4v4.4h4.4'],
  clipboard: [
    'M9.4 3.6h5.2v3H9.4z',
    'M9.4 5.1H6.4v15.3h11.2V5.1h-3',
    'M9.6 13.2l2 2 3.6-4.2',
  ],
  radio: [
    'M13.4 12a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 0 1 2.8 0z',
    'M8.8 8.8a4.5 4.5 0 0 0 0 6.4',
    'M15.2 15.2a4.5 4.5 0 0 0 0-6.4',
    'M6.2 6.2a8 8 0 0 0 0 11.6',
    'M17.8 17.8a8 8 0 0 0 0-11.6',
  ],
  alert: ['M12 4.2 20.8 19.6H3.2z', 'M12 10.2v4.2', 'M12 16.9h.01'],
  camera: [
    'M3.6 7.8h11.2v8.4H3.6z',
    'M14.8 11.2l5.6-2.8v7.2l-5.6-2.8z',
    'M6.4 7.8l1.4-2.2h2.8l1.4 2.2',
  ],
  layers: ['M12 3.4 20.6 8 12 12.6 3.4 8z', 'M3.4 12.4 12 17l8.6-4.6', 'M3.4 16.6 12 21.2l8.6-4.6'],
  wrench: ['M14.8 6.4a4.2 4.2 0 1 0 5 5L9.6 21.6a2.2 2.2 0 0 1-3.1-3.1z'],
};

/**
 * Geseran agar tinta tiap ikon benar-benar duduk di tengah kotak 24 × 24.
 *
 * Jalurnya digambar tangan, dan beberapa berakhir condong ke satu sisi —
 * kamera 1,1 satuan terlalu tinggi, kunci pas 2,3 terlalu rendah. Selisih
 * sekecil itu tidak terlihat pada satu ikon, tetapi pada rel berisi dua belas
 * butir bertumpuk ia terbaca sebagai baris yang tidak lurus. Angkanya diukur
 * dari `getBBox()` tiap jalur; ubah jalurnya, ukur lagi.
 */
const NUDGE: Partial<Record<IconName, [number, number]>> = {
  home: [0, 0.3],
  play: [-1.5, 0],
  camera: [0, 1.1],
  layers: [0, -0.3],
  wrench: [-0.9, -2.3],
};

export interface IconProps {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none', opacity: 0.9 }}
    >
      <g transform={geser(name)}>
        {PATHS[name].map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

function geser(name: IconName): string | undefined {
  const n = NUDGE[name];
  return n ? `translate(${n[0]} ${n[1]})` : undefined;
}
