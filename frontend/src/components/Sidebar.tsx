import type { AuthUser, Bridge, Status } from '../lib/types';
import { Icon, type IconName } from './Icon';
import { Select } from './Select';
import { StatusTag } from './Ui';

export type ScreenKey =
  | 'dash'
  | 'twin'
  | 'data'
  | 'kamera'
  | 'ambang'
  | 'analisa'
  | 'periksa'
  | 'inventarisasi'
  | 'pemeriksaan'
  | 'rutin'
  | 'khusus'
  | 'info'
  | 'kondisi'
  | 'laporan'
  | 'repair'
  | 'kesesuaian';

/**
 * Tujuan yang dapat dibuka dari mana saja, termasuk yang sudah bukan layar
 * sendiri. Deret waktu, Perbandingan, dan Skenario sekarang tab di Analisa,
 * dan Rute pemeriksaan tab di Pemeriksaan detail; sebutan lamanya tetap
 * dikenali supaya tautan dan tombol yang menunjuknya tidak patah.
 */
export type LayarTujuan = ScreenKey | 'analysis' | 'compare' | 'scenario' | 'rute';

interface NavItem {
  key: ScreenKey;
  label: string;
  icon: IconName;
  /** Keterangan kecil di ujung kanan, mis. halaman yang belum lengkap. */
  badge?: string;
}

/**
 * Navigasi dikelompokkan menurut sifat pekerjaannya.
 *
 *   Pemantauan  — keadaan sekarang apa adanya, ditambah Analisa (deret waktu,
 *                 pembanding, skenario) yang mengolah keadaan itu.
 *   Pemeriksaan — pekerjaan pemeriksa menurut Pedoman Bina Marga; lihat di bawah.
 *   Berkas aset — berkas yang tidak berubah tiap menit: identitas, kondisi per
 *                 elemen, dan laporan.
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
  ambang: 'Tingkat siaga',
  analisa: 'Analisa',
  periksa: 'Ringkasan pemeriksaan',
  inventarisasi: 'Pemeriksaan inventarisasi',
  pemeriksaan: 'Pemeriksaan detail',
  rutin: 'Pemeriksaan rutin',
  khusus: 'Pemeriksaan khusus',
  info: 'Informasi',
  kondisi: 'Kondisi elemen',
  laporan: 'Laporan pemeriksaan',
  repair: 'Pemeliharaan',
  kesesuaian: 'Kesesuaian pedoman',
};

/*
 * Tiga kelompok, dan yang kedua mengikuti susunan pedoman, bukan susunan alat.
 *
 * Pedoman membagi pekerjaan menurut **jenis pemeriksaan** — Inventarisasi,
 * Detail, Rutin, Khusus (Bab 4.3) — jadi menunya begitu pula. Rute pemeriksaan
 * menjadi tab di dalam Detail, karena ia urutan kerja pemeriksa Detail
 * (Bab 5.5), bukan jenis pemeriksaan sendiri. Peta kesesuaian adalah alat
 * pengembang dan tinggal di kaki rel, bukan di antara alat kerja.
 */
export const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Pemantauan',
    items: [
      { key: 'dash', label: 'Dashboard', icon: 'home' },
      { key: 'twin', label: 'Digital Twin', icon: 'cube' },
      { key: 'data', label: 'Data', icon: 'table' },
      { key: 'kamera', label: 'Kamera', icon: 'camera' },
      { key: 'ambang', label: 'Tingkat siaga', icon: 'alert' },
      { key: 'analisa', label: 'Analisa', icon: 'pulse' },
    ],
  },
  {
    title: 'Pemeriksaan',
    items: [
      { key: 'periksa', label: 'Ringkasan', icon: 'clipboard' },
      { key: 'inventarisasi', label: 'Inventarisasi', icon: 'layers', badge: 'Segera' },
      { key: 'pemeriksaan', label: 'Detail', icon: 'doc' },
      { key: 'rutin', label: 'Rutin', icon: 'bars' },
      { key: 'khusus', label: 'Khusus', icon: 'wrench' },
    ],
  },
  {
    title: 'Berkas aset',
    items: [
      { key: 'info', label: 'Informasi', icon: 'doc' },
      { key: 'kondisi', label: 'Kondisi elemen', icon: 'layers' },
      { key: 'laporan', label: 'Laporan', icon: 'table' },
      // Butir Pemeliharaan disembunyikan dari navigasi untuk sementara.
      // Halamannya tetap ada dan tetap dapat dibuka lewat tombol "Perbaikan"
      // di halaman Informasi; hapus komentar ini untuk memunculkannya lagi.
      // { key: 'repair', label: 'Pemeliharaan', icon: 'wrench' },
    ],
  },
];

export const SCREENS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export interface SidebarProps {
  screen: ScreenKey;
  onScreen: (key: LayarTujuan) => void;
  bridges: Bridge[];
  bridge: Bridge;
  onBridge: (id: string) => void;
  status: Status;
  /** Ada sisa kerusakan yang menunggu dicatat perbaikannya. */
  repairNeeded: boolean;
  /** Pengguna yang sedang masuk; namanya dipakai saat alarm diakui. */
  user: AuthUser;
  onLogout: () => void;
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

export function Sidebar({
  screen,
  onScreen,
  bridges,
  bridge,
  onBridge,
  status,
  repairNeeded,
  user,
  onLogout,
  dots = {},
}: SidebarProps) {
  // Satu aset tidak perlu pemilih — namanya saja sudah cukup. Pemilih muncul
  // sendiri begitu katalog berisi lebih dari satu jembatan.
  const multipleAssets = bridges.length > 1;

  return (
    <nav className="sidebar glass glass--rail" aria-label="Navigasi utama">
      <div className="sidebar-brand">
        <img src="/logo_beacon.png" alt="Beacon Engineering" className="sidebar-logo" />
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
                    {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
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
        <button
          type="button"
          className={screen === 'kesesuaian' ? 'sidebar-tautan sidebar-tautan--aktif' : 'sidebar-tautan'}
          aria-current={screen === 'kesesuaian' ? 'page' : undefined}
          onClick={() => onScreen('kesesuaian')}
        >
          Kesesuaian pedoman
        </button>
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

        {/* Siapa yang sedang membukanya, dan jalan keluarnya. */}
        <div className="sidebar-akun">
          <div className="stack" style={{ gap: 1, minWidth: 0 }}>
            <span className="sidebar-akun-nama">{user.name}</span>
            <span className="text-muted sidebar-akun-peran">{user.role}</span>
          </div>
          <button type="button" className="btn btn-sm" onClick={onLogout}>
            Keluar
          </button>
        </div>
      </div>
    </nav>
  );
}
