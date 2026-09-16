import type { Bridge, DataSource, Status } from '../lib/types';
import { StatusTag } from './Ui';
import { dossierFor, inspeksiTerakhir, jarakWaktu } from '../domain/demoData';

export type ScreenKey =
  | 'dash'
  | 'twin'
  | 'info'
  | 'inspection'
  | 'repair'
  | 'sensors'
  | 'analysis'
  | 'compare'
  | 'scenario';

interface NavItem {
  key: ScreenKey;
  label: string;
}

/**
 * Navigasi dikelompokkan menurut sifat halamannya, bukan menurut asal datanya.
 *
 *   Overview      — dua layar yang menampilkan keadaan sekarang apa adanya.
 *   Analysis      — layar yang mengolah keadaan itu: deret waktu, pembanding,
 *                   dan skenario yang mengubahnya dengan sengaja.
 *   Asset record  — berkas yang tidak berubah tiap menit: identitas, catatan
 *                   pemeriksaan, pekerjaan, dan alat terpasang.
 *
 * Digital Twin sebelumnya berada di kelompok aset, dan itu salah tempat: model
 * 3D adalah layar pemantauan langsung, bukan lembar arsip.
 */
export const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { key: 'dash', label: 'Dashboard' },
      { key: 'twin', label: 'Digital twin' },
    ],
  },
  {
    title: 'Analysis',
    items: [
      { key: 'analysis', label: 'Time series' },
      { key: 'compare', label: 'Comparison' },
      { key: 'scenario', label: 'Scenarios' },
    ],
  },
  {
    title: 'Asset record',
    items: [
      { key: 'info', label: 'Information' },
      { key: 'inspection', label: 'Inspections' },
      { key: 'repair', label: 'Maintenance' },
      { key: 'sensors', label: 'Sensors' },
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
}

/** Tanda platform: lengkungan di atas lantai, seperti rangka jembatan. */
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
}: SidebarProps) {
  // Satu aset tidak perlu pemilih — namanya saja sudah cukup. Pemilih muncul
  // sendiri begitu katalog berisi lebih dari satu jembatan.
  const multipleAssets = bridges.length > 1;

  // Tiga keterangan dari berkas aset yang berlaku sepanjang sesi: nilai kondisi
  // hasil inspeksi, kapan pemeriksaan terakhir, dan beban rencananya. Ketiganya
  // adalah acuan yang dipakai membaca angka di halaman mana pun, jadi tempatnya
  // di bilah samping — bukan hanya di halaman Informasi.
  const dossier = dossierFor(bridge.id);
  const inspection = dossier ? inspeksiTerakhir(dossier) : null;

  return (
    <nav className="sidebar glass glass--rail" aria-label="Main navigation">
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
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--mist-300)',
            }}
          >
            Structural Monitoring
          </div>
        </div>
      </div>

      <div className="sidebar-asset">
        {multipleAssets ? (
          <div className="field">
            <label htmlFor="pilih-jembatan">Monitored asset</label>
            <select
              id="pilih-jembatan"
              className="input"
              value={bridge.id}
              onChange={(event) => onBridge(event.target.value)}
            >
              {bridges.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="glass glass--inset sidebar-asset-card">
            <span className="stat-label">Monitored asset</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>
              {bridge.name}
            </span>
            <span className="text-muted" style={{ fontSize: 11 }}>
              {bridge.location}
            </span>
          </div>
        )}

        {dossier ? (
          <dl className="sidebar-reference">
            <dt>Condition rating</dt>
            <dd>
              <strong style={{ fontWeight: 700 }}>{dossier.conditionValue}</strong>
              <span className="text-muted">/5</span>
            </dd>
            <dt>Last inspection</dt>
            <dd>{jarakWaktu(inspection?.date ?? bridge.lastInspection)}</dd>
            <dt>Design load</dt>
            <dd>{dossier.designLoad.split(' ').slice(0, 2).join(' ')}</dd>
          </dl>
        ) : null}
      </div>

      <div className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.title || 'utama'} className="sidebar-nav-group">
            {group.title ? <div className="nav-section">{group.title}</div> : null}
            <div className="sidebar-nav-items">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={screen === item.key ? 'nav-item nav-item--active' : 'nav-item'}
                  aria-current={screen === item.key ? 'page' : undefined}
                  onClick={() => onScreen(item.key)}
                >
                  {item.label}
                </button>
              ))}
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
              Repair pending
            </button>
          ) : null}
        </div>

        <div className="text-muted" style={{ fontSize: 11 }}>
          {demo ? 'Demo mode · sample data' : 'Field data'} ·{' '}
          {source === 'api' ? 'API server' : 'local engine'}
        </div>
      </div>
    </nav>
  );
}
