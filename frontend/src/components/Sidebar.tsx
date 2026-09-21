import type { Bridge, DataSource, Status } from '../lib/types';
import { Icon, type IconName } from './Icon';
import { Select } from './Select';
import { StatusTag } from './Ui';

export type ScreenKey =
  | 'dash'
  | 'twin'
  | 'data'
  | 'kamera'
  | 'info'
  | 'inspection'
  | 'kondisi'
  | 'repair'
  | 'sensors'
  | 'ambang'
  | 'analysis'
  | 'compare'
  | 'scenario';

interface NavItem {
  key: ScreenKey;
  label: string;
  icon: IconName;
}

/**
 * Navigasi dikelompokkan menurut sifat halamannya, bukan menurut asal datanya.
 *
 *   Pemantauan  — dua layar yang menampilkan keadaan sekarang apa adanya.
 *   Kajian      — layar yang mengolah keadaan itu: deret waktu, pembanding, dan
 *                 skenario yang mengubahnya dengan sengaja.
 *   Berkas aset — berkas yang tidak berubah tiap menit: identitas, catatan
 *                 pemeriksaan, pekerjaan, dan alat terpasang.
 *
 * Digital Twin sebelumnya berada di kelompok aset, dan itu salah tempat: model
 * 3D adalah layar pemantauan langsung, bukan lembar arsip.
 */
/**
 * Nama tiap layar untuk judul tab peramban.
 *
 * Terpisah dari `NAV_GROUPS` karena harus lengkap: Pemeliharaan sedang
 * disembunyikan dari navigasi tetapi halamannya tetap dapat dibuka, dan tab
 * tanpa nama pada riwayat peramban sama tidak berartinya dengan tab yang
 * seluruhnya bernama sama.
 */
export const SCREEN_TITLES: Record<ScreenKey, string> = {
  dash: 'Dashboard',
  twin: 'Digital Twin',
  data: 'Data',
  kamera: 'Kamera',
  analysis: 'Deret waktu',
  compare: 'Perbandingan',
  scenario: 'Skenario',
  info: 'Informasi',
  inspection: 'Inspeksi',
  kondisi: 'Kondisi elemen',
  repair: 'Pemeliharaan',
  sensors: 'Sensor',
  ambang: 'Tingkat siaga',
};

export const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Pemantauan',
    items: [
      { key: 'dash', label: 'Dashboard', icon: 'home' },
      { key: 'twin', label: 'Digital Twin', icon: 'cube' },
      { key: 'data', label: 'Data', icon: 'table' },
      { key: 'kamera', label: 'Kamera', icon: 'camera' },
    ],
  },
  {
    title: 'Kajian',
    items: [
      { key: 'analysis', label: 'Deret waktu', icon: 'pulse' },
      { key: 'compare', label: 'Perbandingan', icon: 'bars' },
      { key: 'scenario', label: 'Skenario', icon: 'play' },
    ],
  },
  {
    title: 'Berkas aset',
    items: [
      { key: 'info', label: 'Informasi', icon: 'doc' },
      { key: 'inspection', label: 'Inspeksi', icon: 'clipboard' },
      { key: 'kondisi', label: 'Kondisi elemen', icon: 'layers' },
      // Butir Pemeliharaan disembunyikan dari navigasi untuk sementara.
      // Halamannya tetap ada dan tetap dapat dibuka lewat kartu "Perbaikan"
      // di halaman Informasi; hapus komentar ini untuk memunculkannya lagi.
      // { key: 'repair', label: 'Pemeliharaan', icon: 'wrench' },
      { key: 'sensors', label: 'Sensor', icon: 'radio' },
      { key: 'ambang', label: 'Tingkat siaga', icon: 'alert' },
    ],
  },
];

export const SCREENS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export interface SidebarProps {
  screen: ScreenKey;
  onScreen: (key: ScreenKey) => void;
  bridges: Bridge[];
  bridge: Bridge;
  onBridge: (id: string) => void;
  status: Status;
  source: DataSource;
  demo: boolean;
  /** Ada sisa kerusakan yang menunggu dicatat perbaikannya. */
  repairNeeded: boolean;
  /**
   * Titik penanda per layar, beserta warnanya dan alasannya.
   *
   * Butir menu yang perlu dilihat harus mengatakannya sendiri. Tanpa ini,
   * satu-satunya cara tahu ada kejadian baru atau kanal yang melewati ambang
   * adalah membuka halamannya satu per satu — dan orang tidak membuka halaman
   * yang tidak mereka curigai.
   */
  dots?: Partial<Record<ScreenKey, { color: string; title: string }>>;
}

/**
 * Tanda platform: lengkungan di atas lantai, seperti rangka jembatan.
 *
 * Tempatnya di puncak rel, bukan di kepala lajur isi. Rel berdiri utuh dari
 * atas ke bawah, dan benda yang menamai seluruh aplikasi wajib berada di
 * puncak benda yang utuh itu — bukan di atas salah satu lajurnya saja.
 */
function BrandMark() {
  return (
    <svg
      width="38"
      height="38"
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ flex: 'none', borderRadius: 12, boxShadow: '0 12px 26px -14px rgb(2 8 20 / 0.9)' }}
    >
      <rect width="40" height="40" rx="12" fill="url(#brand-grad)" />
      <path
        d="M7 27c4.2-9 8.4-13.5 13-13.5S29.8 18 34 27"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path d="M7 27h27" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
      <path
        d="M13 27v-5.4M20 27v-9.6M27 27v-5.4"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.5"
      />
      <defs>
        <linearGradient id="brand-grad" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="#47a6ff" />
          <stop offset="1" stopColor="#1268c9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Sidebar({
  screen,
  onScreen,
  bridges,
  bridge,
  onBridge,
  status,
  source,
  demo,
  repairNeeded,
  dots = {},
}: SidebarProps) {
  // Satu aset tidak perlu pemilih — namanya saja sudah cukup. Pemilih muncul
  // sendiri begitu katalog berisi lebih dari satu jembatan.
  const multipleAssets = bridges.length > 1;

  return (
    <nav className="sidebar glass glass--rail" aria-label="Navigasi utama">
      <div className="sidebar-brand">
        <BrandMark />
        <div style={{ lineHeight: 1.2, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              color: '#fff',
            }}
          >
            Bridge Digital Twin
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--mist-300)',
            }}
          >
            Pemantauan Struktur
          </div>
        </div>
      </div>

      {/*
        * Aset yang dipantau: keterangan yang berlaku sepanjang sesi, jadi
        * tempatnya menetap di rel — bukan di kepala yang isinya berganti tiap
        * berpindah halaman.
        */}
      <div className="sidebar-asset">
        {multipleAssets ? (
          <div className="field">
            <label htmlFor="pilih-jembatan" id="label-pilih-jembatan">
              Aset yang dipantau
            </label>
            <Select
              id="pilih-jembatan"
              aria-labelledby="label-pilih-jembatan"
              value={bridge.id}
              onChange={onBridge}
              groups={[{ options: bridges.map((item) => ({ value: item.id, label: item.name })) }]}
            />
          </div>
        ) : (
          <div className="glass glass--inset sidebar-asset-card">
            <span className="stat-label">Aset yang dipantau</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>
              {bridge.name}
            </span>
            <span className="text-muted" style={{ fontSize: 11 }}>
              {bridge.location}
            </span>
          </div>
        )}
      </div>

      <div className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.title || 'utama'} className="sidebar-nav-group">
            {group.title ? <div className="nav-section">{group.title}</div> : null}
            <div className="sidebar-nav-items">
              {group.items.map((item) => {
                const dot = dots[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={screen === item.key ? 'nav-item nav-item--active' : 'nav-item'}
                    aria-current={screen === item.key ? 'page' : undefined}
                    onClick={() => onScreen(item.key)}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                    {/* Titiknya bukan satu-satunya pembawa pesan: alasannya
                        ikut ditulis sebagai teks tersembunyi, supaya pembaca
                        layar dan pembaca yang tidak membedakan warna tetap
                        mendapat keterangan yang sama. */}
                    {dot ? (
                      <>
                        <span
                          className="nav-dot"
                          style={{ background: dot.color }}
                          aria-hidden="true"
                        />
                        <span className="sr-only"> — {dot.title}</span>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="row" style={{ gap: 8 }}>
          <StatusTag status={status} />
          {repairNeeded ? (
            <button
              type="button"
              className="tag tag-waspada"
              style={{ border: 0, cursor: 'pointer' }}
              onClick={() => onScreen('scenario')}
            >
              <span className="tag-dot" aria-hidden="true" />
              Perlu perbaikan
            </button>
          ) : null}
        </div>

        <div className="text-muted" style={{ fontSize: 11 }}>
          {demo ? 'Mode demo · data dummy' : 'Data lapangan'} ·{' '}
          {source === 'api' ? 'API server' : 'mesin lokal'}
        </div>
      </div>
    </nav>
  );
}
