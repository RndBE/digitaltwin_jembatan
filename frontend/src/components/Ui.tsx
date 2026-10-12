import { type ReactNode } from 'react';
import type { Status } from '../lib/types';

/**
 * Pemetaan status struktur ke palet keadaan.
 *
 * Palet keadaan terpisah dari palet antarmuka: hijau, kuning, dan merah di
 * sini hanya menyatakan keadaan, tidak pernah dipakai sebagai hiasan. Setiap
 * label juga membawa titik, jadi keadaannya tetap terbaca oleh pembaca yang
 * tidak membedakan hijau dari merah.
 */
const STATUS_TAG: Record<Status, string> = {
  AMAN: 'tag tag-normal',
  WASPADA: 'tag tag-waspada',
  KRITIS: 'tag tag-bahaya',
};

export function StatusTag({ status, children }: { status: Status; children?: ReactNode }) {
  return (
    <span className={STATUS_TAG[status]}>
      <span className="tag-dot" aria-hidden="true" />
      {children ?? status}
    </span>
  );
}

/** Warna keadaan sebagai nilai CSS, untuk bagan dan cincin. */
export const STATUS_TONE: Record<Status, string> = {
  AMAN: 'var(--state-normal)',
  WASPADA: 'var(--state-waspada)',
  KRITIS: 'var(--state-bahaya)',
};

/**
 * Kepala halaman — tombolnya, dan pengantar yang hanya dibaca mesin.
 *
 * Sejak nama halaman pindah ke kepala lajur isi (`AppHeader`), tajuk besar di
 * sini mengulang salah satu dari dua hal yang sudah tertulis di kerangka yang
 * tidak ikut tergulir: nama halamannya, atau nama jembatannya yang menetap di
 * rel. Kalimat pengantarnya dibuang karena alasan yang berbeda: ia dibaca
 * sekali, oleh orang yang pertama kali membuka layar itu, lalu dilewati
 * ribuan kali oleh orang yang sudah hafal — sementara tiga barisnya menekan
 * isi halaman ke bawah pada tiap kunjungan.
 *
 * Pengantarnya tidak dapat dibuka lagi: tombol `?` yang dulu melipatnya ikut
 * dibuang, karena satu benda yang ditekan sekali seumur pemakaian tetap
 * menyita tempat di baris yang dipakai berulang. Teksnya tidak dihapus — ia
 * tetap ada di dokumen lewat `.sr-only`, jadi pembaca layar dan pencarian
 * dalam halaman masih menemukannya, sementara layar tidak pernah
 * menampilkannya. `<h1>`-nya juga: halaman tanpa tajuk memaksa pembaca layar
 * menebak batas dokumennya, dan tautan "Lompat ke isi" mendarat di wilayah
 * yang tidak dapat diumumkan namanya.
 */
export function PageHeader({
  kicker,
  title,
  lede,
  actions,
  leading,
  rujukan,
}: {
  kicker?: string;
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
  /**
   * Bab dan halaman pedoman yang menjadi dasar halaman ini, mis.
   * `Bab 8 · hlm. 75`. Ditulis sebagai lencana kecil di baris tombol, supaya
   * pemeriksa dapat mencocokkan layar dengan kertasnya tanpa membuka peta
   * kesesuaian.
   */
  rujukan?: string;
  /**
   * Kendali milik halaman yang duduk di ujung kiri baris yang sama dengan
   * lencana status. Tanpa ini baris itu hanya berisi satu benda kecil di ujung
   * kanan, dan satu pita kosong selebar layar terbuang di atas isi halaman;
   * dengan ini baris tersebut memuat tombol yang memang dipakai berulang,
   * sehingga tidak ada tinggi yang dibayar percuma.
   */
  leading?: ReactNode;
}) {
  return (
    <header className="page-header">
      <h1 className="sr-only">{kicker ? `${kicker} · ${title}` : title}</h1>

      {actions || leading || rujukan ? (
        <div className="page-header-aksi">
          {leading ? <div className="row page-header-utama">{leading}</div> : null}
          {rujukan ? (
            <span
              className="tag tag-outline rujukan-pedoman"
              title="Pedoman Pemeriksaan Jembatan No. 01/P/BM/2022 (Bina Marga)"
              style={leading ? undefined : { marginRight: 'auto' }}
            >
              Pedoman 01/P/BM/2022 · {rujukan}
            </span>
          ) : null}
          {actions}
        </div>
      ) : null}

      {lede ? <p className="sr-only">{lede}</p> : null}
    </header>
  );
}

/**
 * Penanda bahwa isi halaman adalah data contoh.
 *
 * Aplikasi ini menampilkan data karangan di beberapa halaman (riwayat
 * inspeksi, pekerjaan, inventaris sensor). Penonton demo dan pemeriksa yang
 * baru membukanya tidak seharusnya menebak mana yang hasil lapangan, jadi
 * halamannya mengatakannya di muka — bukan hanya di README.
 */
export function LencanaContoh({ children }: { children?: ReactNode }) {
  return (
    <div
      role="note"
      className="row"
      style={{
        gap: 8,
        marginBottom: 'var(--space-3)',
        padding: '6px 12px',
        borderRadius: 12,
        background: 'rgb(251 191 36 / 0.1)',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <span className="tag tag-waspada">DATA CONTOH</span>
      <span>{children ?? 'Data karangan, bukan hasil lapangan.'}</span>
    </div>
  );
}

export function SectionTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
      }}
    >
      <h2 style={{ fontSize: 18 }}>{children}</h2>
      {note ? (
        <span className="text-muted" style={{ fontSize: 11.5 }}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  note,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  tone?: 'default' | 'accent' | 'warn' | 'critical';
}) {
  const color =
    tone === 'critical'
      ? 'var(--state-bahaya)'
      : tone === 'warn'
        ? 'var(--state-waspada)'
        : tone === 'accent'
          ? 'var(--brand-300)'
          : '#fff';

  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color }}>
        {value}
        {unit ? <span className="stat-unit">{unit}</span> : null}
      </span>
      {note ? <span className="stat-note">{note}</span> : null}
    </div>
  );
}

/** Panggung 3D: bidang gelap dengan cincin tepi dan bayangan dalam. */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="stage">
      {children}
      <div className="stage-overlay" aria-hidden="true" />
    </div>
  );
}

/** Latar senja tetap di belakang seluruh antarmuka. */
export function Backdrop() {
  return <div className="backdrop" aria-hidden="true" />;
}


/**
 * Deret tab untuk halaman yang memuat beberapa tampilan.
 *
 * Satu kendali tersegmentasi, bukan sub-menu: tab yang berpindah isi di tempat
 * yang sama menjaga rel navigasi tetap pendek.
 */
export function TabBar<K extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ key: K; label: string }>;
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div className="tabbar" role="group" aria-label={label}>
      <div className="seg">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="seg-opt"
            aria-pressed={value === tab.key}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
