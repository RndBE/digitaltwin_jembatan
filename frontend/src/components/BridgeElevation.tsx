import { useId, useState } from 'react';
import type { ScoredElement } from '../domain/elements';
import { CONDITION_COLOR, CONDITION_LABEL, conditionStatus, rollUp } from '../domain/condition';

/**
 * Elevasi jembatan, diwarnai menurut kondisi elemennya.
 *
 * Model tiga dimensi sudah ada satu klik jauhnya, dan gambar ini tidak
 * bermaksud menggantikannya — yang tidak dapat dilakukan model itu adalah
 * muncul di dashboard tanpa memuat WebGL, tanpa memutar kamera, dan tanpa
 * meminta siapa pun mencari sudut pandang yang benar. Satu siluet dari
 * samping menjawab pertanyaan yang paling sering diajukan di depan dashboard
 * — *bagian mana yang merah* — dalam sekali lihat.
 *
 * Gambarnya mengikuti jembatan yang sebenarnya, bukan lambang jembatan:
 *
 *   - **Rangka menumpu pada pangkalnya.** Ujung batang tepi bawah berhenti
 *     tepat di atas landasan, dengan bantalan tergambar di antaranya. Rangka
 *     yang berhenti di udara di sebelah pangkal — seperti gambar ini
 *     sebelumnya — terbaca sebagai dua benda yang kebetulan bersebelahan.
 *   - **Tiang ujung tegak** menutup kedua ujung rangka, jadi tepi atas tidak
 *     lagi melayang dengan ujung terbuka.
 *   - **Lantai duduk pada tepi bawah**, satu bidang dengan ketebalan, lalu
 *     berlanjut sebagai oprit di atas timbunan yang melandai ke tebing —
 *     bukan garis tipis yang menembus gambar dari tepi ke tepi.
 *   - **Pangkal jembatan bertubuh gelap** dengan muka yang miring sedikit dan
 *     telapak di dasarnya, bukan kotak berwarna terang. Warna kondisinya
 *     dibawa garis tepi dan bantalannya, bukan seluruh badannya: pangkal yang
 *     menyala kuning sepenuhnya menarik mata ke benda yang paling tidak
 *     sering bergerak di seluruh gambar.
 *
 * Warnanya tetap bukan hiasan: tiap kelompok batang memakai warna status
 * kondisi kelompok itu, dihitung dengan aturan minimum berbobot yang sama
 * seperti batang-batang di bawahnya. Kalau tidak ada yang merah, memang tidak
 * ada yang merah.
 *
 * Tiga hal menjaganya tetap terbaca ketika seluruhnya sehat — keadaan yang
 * berlaku hampir sepanjang tahun:
 *
 *   1. Kelompok berkondisi **baik digambar lebih redup** daripada yang tidak.
 *      Warna penuh disimpan untuk yang perlu ditindak, jadi satu kelompok
 *      merah di antara lima yang sehat terlihat sebelum ada yang membaca
 *      apa pun.
 *   2. **Warna tidak pernah berdiri sendiri.** Kelompok terburuk membawa
 *      labelnya sendiri di dalam gambar, keterangan di bawah menyebut nama,
 *      skor, dan statusnya dengan huruf, dan tiap kelompok punya `<title>`
 *      untuk peramban maupun pembaca layar.
 *   3. **Nomor panel** ditulis di sepanjang tepi atas. "Ada yang merah" tidak
 *      dapat dikerjakan siapa pun; "pelat buhul panel 6" dapat.
 */

export interface BridgeElevationProps {
  elements: ScoredElement[];
  /** Banyak panel rangka; mengikuti model jembatannya. */
  panels?: number;
  /**
   * Muka air relatif terhadap tinggi bebas di bawah lantai, 0..1.
   *
   * Angka muka air pada ubin di atas gambar hanya menyebut meter; yang
   * membuat meter itu berarti adalah melihat air mendekati lantai.
   */
  waterRatio?: number;
  /** Muka air dalam meter, untuk keterangan di garis airnya. */
  waterMetres?: number;
  /** Dibuka saat tautannya ditekan; biasanya halaman Kondisi elemen. */
  onOpen?: () => void;
}

/** Kelompok batang pada gambar, sejajar dengan `group` pada katalog elemen. */
const GROUPS = ['lantai', 'bawah', 'atas', 'diagonal', 'vertikal', 'tumpuan'] as const;
type GroupKey = (typeof GROUPS)[number];

const GROUP_NAMES: Record<GroupKey, string> = {
  lantai: 'Lantai jalan',
  bawah: 'Batang tepi bawah',
  atas: 'Batang tepi atas',
  diagonal: 'Batang diagonal',
  vertikal: 'Batang vertikal',
  tumpuan: 'Tumpuan',
};

/*
 * Geometri gambar. Angkanya piksel pada `viewBox`, bukan meter.
 *
 * Perbandingannya diambil dari jembatan rangka bentang tunggal yang
 * sesungguhnya: tinggi rangka sekitar sepertujuh bentangnya, panel sedikit
 * lebih lebar daripada tingginya dibagi dua, dan tinggi bebas di bawah lantai
 * kira-kira setengah tinggi rangka.
 */
const W = 640;
const H = 232;
/** Ujung bentang — tempat rangka menumpu. */
const XL = 104;
const XR = 536;
/**
 * Tepi atas, tepi bawah, dan dasar palung.
 *
 * Susunan tegaknya mengikuti urutan yang sebenarnya, dari atas ke bawah:
 * batang tepi bawah, lalu pelat lantai di bawahnya, lalu bantalan, baru
 * pangkal. Menumpuknya begitu — bukan menaruh semuanya pada satu garis —
 * adalah yang membuat gambar ini terbaca sebagai jembatan, karena itulah
 * urutan yang dilihat orang ketika berdiri di tepi sungai.
 */
const Y_ATAS = 52;
const Y_BAWAH = 126;
const Y_LANTAI = 129;
const TEBAL_LANTAI = 6;
const Y_LANDASAN = Y_LANTAI + TEBAL_LANTAI + 5;
const Y_DASAR = 196;
/** Pangkal jembatan: lebar badan di atas, dan lebar telapak di dasar. */
const PANGKAL = 44;
const TELAPAK = 12;

export function BridgeElevation({
  elements,
  panels = 10,
  waterRatio = 0,
  waterMetres,
  onOpen,
}: BridgeElevationProps) {
  const [sorot, setSorot] = useState<GroupKey | null>(null);
  const uid = useId().replace(/:/g, '');

  /*
   * Skor tiap kelompok batang.
   *
   * Sebuah kelompok pada gambar dapat memuat beberapa elemen katalog — "tepi
   * bawah" mencakup sisi utara dan sisi selatan — dan yang diambil bukan
   * rata-ratanya melainkan minimum berbobotnya, sama seperti indeks jembatan.
   * Sisi selatan yang berkarat tidak boleh hilang di balik sisi utara yang
   * masih baik hanya karena keduanya digambar sebagai satu garis.
   */
  const skor = new Map<GroupKey, number>();
  GROUPS.forEach((key) => {
    const anggota = elements.filter((e) => e.group === key);
    if (anggota.length) skor.set(key, rollUp(anggota.map((e) => e.score)));
  });

  const status = (key: GroupKey) => {
    const nilai = skor.get(key);
    return nilai === undefined ? null : conditionStatus(nilai);
  };

  const warna = (key: GroupKey): string => {
    const s = status(key);
    return s === null ? 'var(--mist-400)' : CONDITION_COLOR[s];
  };

  /*
   * Kelompok yang sehat mundur satu langkah.
   *
   * Yang disorot gambar ini bukan "keadaan tiap kelompok" melainkan "kelompok
   * mana yang menuntut perhatian". Karena itu yang berkondisi baik digambar
   * setengah tembus pandang: ia tetap ada, tetap berwarna statusnya, tetapi
   * tidak bersaing dengan yang merah. Kelompok yang sedang ditunjuk tetikus
   * naik ke depan supaya jelas yang mana yang sedang dibaca keterangannya.
   */
  const kepekatan = (key: GroupKey): number => {
    if (sorot === key) return 1;
    return status(key) === 'baik' ? 0.55 : 0.95;
  };

  const judul = (key: GroupKey): string => {
    const nilai = skor.get(key);
    if (nilai === undefined) return GROUP_NAMES[key];
    return `${GROUP_NAMES[key]} · ${nilai.toFixed(2)} · ${CONDITION_LABEL[conditionStatus(nilai)]}`;
  };

  /** Sifat bersama tiap kelompok: sorotan, penunjuk, dan keterangannya. */
  const kelompok = (key: GroupKey) => ({
    opacity: kepekatan(key),
    onMouseEnter: () => setSorot(key),
    onMouseLeave: () => setSorot((nilai) => (nilai === key ? null : nilai)),
    style: { transition: 'opacity 140ms ease' },
  });

  const lebarPanel = (XR - XL) / panels;
  const simpul = Array.from({ length: panels + 1 }, (_, i) => XL + i * lebarPanel);

  // Muka air: 0 menyentuh dasar palung, 1 menyentuh bawah lantai.
  const yAir = Y_DASAR - Math.max(0, Math.min(1, waterRatio)) * (Y_DASAR - Y_LANDASAN);

  // Kelompok terburuk: yang dinamai di dalam gambar dan di keterangannya.
  const terburuk = GROUPS.filter((key) => skor.has(key)).sort(
    (a, b) => (skor.get(a) as number) - (skor.get(b) as number),
  )[0];

  const dibaca = sorot ?? terburuk;
  const nilaiDibaca = dibaca ? skor.get(dibaca) : undefined;
  const statusDibaca = dibaca ? status(dibaca) : null;

  /*
   * Label di dalam gambar hanya untuk kelompok terburuk, dan hanya ketika
   * kondisinya memang menuntut sesuatu. Memberi label pada keenamnya membuat
   * gambar sepanjang 640 piksel ini penuh teks, dan yang penuh teks tidak lagi
   * terbaca dalam sekali lihat — padahal itu satu-satunya alasan gambar ini
   * ada di dashboard.
   */
  const labelDi: Record<GroupKey, { x: number; y: number }> = {
    atas: { x: (XL + XR) / 2 - 40, y: Y_ATAS - 16 },
    bawah: { x: (XL + XR) / 2 - 40, y: Y_BAWAH - 16 },
    diagonal: { x: XL + (XR - XL) * 0.26, y: (Y_ATAS + Y_BAWAH) / 2 },
    vertikal: { x: XL + (XR - XL) * 0.62, y: (Y_ATAS + Y_BAWAH) / 2 },
    // Dua yang terakhir turun ke bawah lantai: di tempat asalnya keduanya
    // menimpa rangka, dan label yang menutupi benda yang ditunjuknya
    // membatalkan dirinya sendiri.
    lantai: { x: XL + 20, y: Y_LANTAI + 30 },
    tumpuan: { x: XL - PANGKAL - 6, y: Y_DASAR + 16 },
  };
  const sematan = terburuk && status(terburuk) !== 'baik' ? terburuk : null;

  /** Badan pangkal: muka dalam tegak, muka luar sedikit melandai. */
  const pangkal = (dalam: number, arah: 1 | -1) =>
    `M${dalam} ${Y_LANDASAN}` +
    `L${dalam - arah * PANGKAL} ${Y_LANDASAN}` +
    `L${dalam - arah * (PANGKAL + 7)} ${Y_DASAR}` +
    `L${dalam} ${Y_DASAR} Z`;

  /** Timbunan oprit: melandai dari punggung pangkal ke tepi gambar. */
  const timbunan = (dalam: number, arah: 1 | -1, tepi: number) =>
    `M${dalam - arah * PANGKAL} ${Y_LANDASAN}` +
    `L${tepi} ${Y_LANDASAN}` +
    `L${tepi} ${Y_DASAR}` +
    `L${dalam - arah * (PANGKAL + 30)} ${Y_DASAR} Z`;

  return (
    // Sorotan dilepas di tepi gambar, bukan hanya di tepi tiap kelompok:
    // penunjuk yang keluar cepat kadang melewatkan `mouseleave` kelompoknya,
    // dan keterangan yang tertinggal pada kelompok yang tidak lagi ditunjuk
    // berbohong tentang apa yang sedang dibaca.
    <div className="elevasi" onMouseLeave={() => setSorot(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={
          dibaca
            ? `Elevasi jembatan rangka bentang tunggal ${panels} panel. Kondisi terburuk ${GROUP_NAMES[dibaca]}, skor ${(nilaiDibaca ?? 0).toFixed(2)}, ${CONDITION_LABEL[statusDibaca ?? 'baik']}.`
            : `Elevasi jembatan rangka bentang tunggal ${panels} panel.`
        }
        style={{ display: 'block' }}
      >
        <defs>
          {/* Air: terang di permukaan, gelap ke dasar — palungnya punya
              kedalaman tanpa menambah satu garis pun. */}
          <linearGradient id={`air-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(124 196 255)" stopOpacity="0.3" />
            <stop offset="1" stopColor="rgb(18 104 201)" stopOpacity="0.08" />
          </linearGradient>
          {/* Tanah: lebih terang di permukaan, meredup ke bawah. */}
          <linearGradient id={`tanah-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(148 163 184)" stopOpacity="0.16" />
            <stop offset="1" stopColor="rgb(148 163 184)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* --- tanah, timbunan, dan air: seluruhnya latar --------------- */}
        <path d={timbunan(XL, 1, -2)} fill={`url(#tanah-${uid})`} />
        <path d={timbunan(XR, -1, W + 2)} fill={`url(#tanah-${uid})`} />

        <rect x="0" y={yAir} width={W} height={H - yAir} fill={`url(#air-${uid})`} />
        <line x1="0" y1={yAir} x2={W} y2={yAir} stroke="rgb(124 196 255 / 0.5)" strokeWidth="1" />
        {/* Riak: tiga goresan mendatar, cukup untuk menyatakan permukaan. */}
        <g stroke="rgb(124 196 255 / 0.3)" strokeWidth="1" strokeLinecap="round">
          <line x1={XL + 30} y1={yAir + 9} x2={XL + 92} y2={yAir + 9} />
          <line x1={XL + 150} y1={yAir + 16} x2={XL + 232} y2={yAir + 16} />
          <line x1={XR - 120} y1={yAir + 7} x2={XR - 52} y2={yAir + 7} />
        </g>
        {waterMetres !== undefined ? (
          <text
            className="elevasi-nomor"
            x={(XL + XR) / 2}
            y={yAir - 6}
            textAnchor="middle"
            fontSize="9.5"
            fill="var(--mist-400)"
            letterSpacing="0.06em"
          >
            MUKA AIR {waterMetres.toFixed(2)} m
          </text>
        ) : null}

        {/* --- pangkal jembatan ----------------------------------------- */}
        <g {...kelompok('tumpuan')}>
          <title>{judul('tumpuan')}</title>
          <g fill="rgb(9 18 30 / 0.92)" stroke={warna('tumpuan')} strokeWidth="1.4">
            <path d={pangkal(XL, 1)} />
            <path d={pangkal(XR, -1)} />
          </g>
          {/* Telapak pondasi, tertanam di dasar palung. */}
          <g fill={warna('tumpuan')} fillOpacity="0.18" stroke={warna('tumpuan')} strokeWidth="1">
            <rect x={XL - PANGKAL - 13} y={Y_DASAR - TELAPAK} width={PANGKAL + 26} height={TELAPAK} rx="1.5" />
            <rect x={XR - PANGKAL - 13} y={Y_DASAR - TELAPAK} width={PANGKAL + 26} height={TELAPAK} rx="1.5" />
          </g>
          {/* Bantalan: benda kecil tempat bentang benar-benar duduk, di
              antara sisi bawah lantai dan kepala pangkal. */}
          <g fill={warna('tumpuan')} fillOpacity="0.85">
            <rect x={XL - 12} y={Y_LANTAI + TEBAL_LANTAI} width="24" height="5" rx="1.5" />
            <rect x={XR - 12} y={Y_LANTAI + TEBAL_LANTAI} width="24" height="5" rx="1.5" />
          </g>
        </g>

        {/* --- lantai dan oprit ----------------------------------------- */}
        <g {...kelompok('lantai')}>
          <title>{judul('lantai')}</title>
          {/* Oprit di atas timbunan: perkerasan yang sama, tetapi di luar
              bentang, jadi lebih redup. */}
          <g fill={warna('lantai')} fillOpacity="0.22">
            <rect x="0" y={Y_LANTAI} width={XL - PANGKAL} height={TEBAL_LANTAI - 1} />
            <rect
              x={XR + PANGKAL}
              y={Y_LANTAI}
              width={W - XR - PANGKAL}
              height={TEBAL_LANTAI - 1}
            />
          </g>
          {/* Lantai jembatan: pelat menerus di bawah batang tepi bawah. */}
          <rect
            x={XL - PANGKAL}
            y={Y_LANTAI}
            width={XR - XL + 2 * PANGKAL}
            height={TEBAL_LANTAI}
            fill={warna('lantai')}
            fillOpacity="0.32"
          />
          <line
            x1={0}
            y1={Y_LANTAI}
            x2={W}
            y2={Y_LANTAI}
            stroke={warna('lantai')}
            strokeWidth="1.3"
            strokeOpacity="0.75"
          />
          <line
            x1={XL - PANGKAL}
            y1={Y_LANTAI + TEBAL_LANTAI}
            x2={XR + PANGKAL}
            y2={Y_LANTAI + TEBAL_LANTAI}
            stroke={warna('lantai')}
            strokeWidth="1"
            strokeOpacity="0.5"
          />
          {/* Sandaran oprit: tiang pendek dan satu rel, hanya di luar bentang
              — di dalam bentang rangkanya sendiri yang menjadi sandaran. */}
          <g stroke="var(--mist-400)" strokeOpacity="0.45" strokeWidth="1.1" strokeLinecap="round">
            <line x1={6} y1={Y_LANTAI - 7} x2={XL - PANGKAL} y2={Y_LANTAI - 7} />
            <line x1={XR + PANGKAL} y1={Y_LANTAI - 7} x2={W - 6} y2={Y_LANTAI - 7} />
            {[10, 28, 46].map((d) => (
              <line key={`rb${d}`} x1={d} y1={Y_LANTAI - 7} x2={d} y2={Y_LANTAI} />
            ))}
            {[10, 28, 46].map((d) => (
              <line key={`rt${d}`} x1={W - d} y1={Y_LANTAI - 7} x2={W - d} y2={Y_LANTAI} />
            ))}
          </g>
        </g>

        {/*
         * Rangka seberang, samar.
         *
         * Elevasi yang tegak lurus sebenarnya hanya memperlihatkan satu
         * rangka, tetapi jembatan rangka yang dilihat orang selalu
         * memperlihatkan dua: yang dekat, dan yang jauh terlihat menembus
         * bentang. Bayangan ini digambar bergeser sedikit ke kanan atas,
         * netral, dan sangat redup — ia menambah kedalaman tanpa ikut
         * membawa warna kondisi, jadi tidak ada yang keliru membacanya
         * sebagai elemen kedua yang punya skor sendiri.
         */}
        <g
          transform="translate(9 -6)"
          stroke="var(--mist-400)"
          strokeOpacity="0.16"
          strokeWidth="1.6"
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <line x1={XL} y1={Y_ATAS} x2={XR} y2={Y_ATAS} />
          <line x1={XL} y1={Y_BAWAH} x2={XR} y2={Y_BAWAH} />
          {simpul.map((x, i) => (
            <line key={`gv${i}`} x1={x} y1={Y_ATAS} x2={x} y2={Y_BAWAH} />
          ))}
          {simpul.slice(0, -1).map((x, i) => {
            const naik = i % 2 === 0;
            return (
              <line
                key={`gd${i}`}
                x1={x}
                y1={naik ? Y_BAWAH : Y_ATAS}
                x2={simpul[i + 1]}
                y2={naik ? Y_ATAS : Y_BAWAH}
              />
            );
          })}
        </g>

        {/* --- rangka ---------------------------------------------------- */}
        <g
          {...kelompok('diagonal')}
          stroke={warna('diagonal')}
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <title>{judul('diagonal')}</title>
          {simpul.slice(0, -1).map((x, i) => {
            // Warren: arah diagonal berganti tiap panel, membentuk zigzag.
            const naik = i % 2 === 0;
            return (
              <line
                key={`d${i}`}
                x1={x}
                y1={naik ? Y_BAWAH : Y_ATAS}
                x2={simpul[i + 1]}
                y2={naik ? Y_ATAS : Y_BAWAH}
              />
            );
          })}
        </g>

        <g
          {...kelompok('vertikal')}
          stroke={warna('vertikal')}
          strokeLinecap="round"
        >
          <title>{judul('vertikal')}</title>
          {/* Batang vertikal dalam bentang. */}
          {simpul.slice(1, -1).map((x, i) => (
            <line key={`v${i}`} x1={x} y1={Y_ATAS} x2={x} y2={Y_BAWAH} strokeWidth="2.1" />
          ))}
          {/* Tiang ujung: lebih tebal, karena memang memikul seluruh ujung
              rangka — sekaligus menutup bentang supaya tepi atas tidak
              tergambar menggantung. */}
          <line x1={XL} y1={Y_ATAS} x2={XL} y2={Y_BAWAH} strokeWidth="4" />
          <line x1={XR} y1={Y_ATAS} x2={XR} y2={Y_BAWAH} strokeWidth="4" />
        </g>

        <g {...kelompok('atas')} stroke={warna('atas')} strokeLinecap="round">
          <title>{judul('atas')}</title>
          <line x1={XL} y1={Y_ATAS} x2={XR} y2={Y_ATAS} strokeWidth="4.5" />
          {/* Ikatan angin portal di kedua ujung: sudut kecil di bawah tepi
              atas, tanda bahwa kedua rangka terikat satu sama lain. */}
          <g strokeWidth="1.6" opacity="0.75">
            <line x1={XL} y1={Y_ATAS + 13} x2={XL + 15} y2={Y_ATAS} />
            <line x1={XR} y1={Y_ATAS + 13} x2={XR - 15} y2={Y_ATAS} />
          </g>
        </g>

        <g {...kelompok('bawah')} stroke={warna('bawah')} strokeLinecap="round">
          <title>{judul('bawah')}</title>
          <line x1={XL} y1={Y_BAWAH} x2={XR} y2={Y_BAWAH} strokeWidth="4.5" />
        </g>

        {/* Buhul: titik tempat batang bertemu — juga tempat pelat sambungan
            diperiksa, jadi ia pantas terlihat. */}
        <g fill="var(--ink-900)" stroke={warna('vertikal')} strokeWidth="1.2" opacity="0.85">
          {simpul.map((x, i) => (
            <circle key={`na${i}`} cx={x} cy={Y_ATAS} r="2.2" />
          ))}
          {simpul.map((x, i) => (
            <circle key={`nb${i}`} cx={x} cy={Y_BAWAH} r="2.2" />
          ))}
        </g>

        {/*
         * Nomor panel, di atas rangka.
         *
         * Ditulis berselang supaya angkanya tidak berdempetan, tetapi nomor
         * pertama dan terakhir selalu ada — dua angka itu yang memberi tahu ke
         * arah mana panel dihitung. Arah mata angin ditulis di ujung oprit,
         * sejajar lantai, karena di situlah orang membaca arah.
         */}
        <g className="elevasi-nomor" fontSize="8.5" fill="var(--mist-400)" textAnchor="middle">
          {Array.from({ length: panels }, (_, i) => i).map((i) =>
            i % 2 === 0 || i === panels - 1 ? (
              <text key={`p${i}`} x={XL + (i + 0.5) * lebarPanel} y={Y_ATAS - 7}>
                {i + 1}
              </text>
            ) : null,
          )}
          <text x={10} y={Y_LANTAI + 20} textAnchor="start" letterSpacing="0.08em">
            BARAT
          </text>
          <text x={W - 10} y={Y_LANTAI + 20} textAnchor="end" letterSpacing="0.08em">
            TIMUR
          </text>
        </g>

        {/* Nama kelompok terburuk, langsung di sebelah bagian yang dimaksud. */}
        {sematan ? (
          <g className="elevasi-semat" style={{ pointerEvents: 'none' }}>
            <circle cx={labelDi[sematan].x} cy={labelDi[sematan].y + 4} r="3" fill={warna(sematan)} />
            <text
              x={labelDi[sematan].x + 8}
              y={labelDi[sematan].y + 7}
              fontSize="10"
              fontWeight="650"
              fill="var(--mist-200)"
            >
              {GROUP_NAMES[sematan]} {(skor.get(sematan) as number).toFixed(2)}
            </text>
          </g>
        ) : null}
      </svg>

      {/*
       * Keterangan: nama, skor, dan status dengan huruf.
       *
       * Warna saja tidak cukup — pembaca yang tidak membedakan merah dari
       * hijau melihat enam garis abu-abu, dan gambar tanpa baris ini tidak
       * mengatakan apa-apa kepadanya. Isinya mengikuti tetikus: menunjuk satu
       * kelompok menggantikan ringkasan terburuk dengan kelompok itu.
       */}
      <div className="elevasi-kaki">
        {dibaca && statusDibaca ? (
          <span className="elevasi-baca">
            <span
              className="elevasi-titik"
              style={{ background: CONDITION_COLOR[statusDibaca] }}
              aria-hidden="true"
            />
            <span className="elevasi-nama">{GROUP_NAMES[dibaca]}</span>
            <span className="tabular elevasi-skor">{(nilaiDibaca ?? 0).toFixed(2)}</span>
            <span className="text-muted">{CONDITION_LABEL[statusDibaca]}</span>
            <span className="text-muted elevasi-sumber">
              {sorot ? 'kelompok yang ditunjuk' : 'kelompok terburuk'}
            </span>
          </span>
        ) : (
          <span className="text-muted">Belum ada skor kondisi</span>
        )}

        {onOpen ? (
          <button type="button" className="elevasi-tautan" onClick={onOpen}>
            Rincian per elemen
          </button>
        ) : null}
      </div>
    </div>
  );
}
