import { useState } from 'react';
import type { ScreenKey } from '../components/Sidebar';
import { PageHeader, Stat } from '../components/Ui';
import {
  BUTIR,
  KELOMPOK,
  STATUS_KELAS,
  STATUS_LABEL,
  TAFSIRAN,
  ringkasKesesuaian,
  type StatusKesesuaian,
} from '../domain/kesesuaian';

/**
 * Kesesuaian dengan Pedoman Pemeriksaan Jembatan No. 01/P/BM/2022, bagian
 * demi bagian dengan rujukan halamannya. Isinya di `domain/kesesuaian.ts`.
 */

const PILIHAN: Array<{ key: StatusKesesuaian | 'semua'; label: string }> = [
  { key: 'semua', label: 'Semua' },
  { key: 'sesuai', label: 'Sesuai' },
  { key: 'sebagian', label: 'Sebagian' },
  { key: 'belum', label: 'Belum ada' },
  { key: 'luar', label: 'Di luar pedoman' },
];

export interface KesesuaianPageProps {
  onOpen: (screen: ScreenKey) => void;
}

export function KesesuaianPage({ onOpen }: KesesuaianPageProps) {
  const [saring, setSaring] = useState<StatusKesesuaian | 'semua'>('semua');
  const ringkas = ringkasKesesuaian();
  const tampil = BUTIR.filter((b) => saring === 'semua' || b.status === saring);

  return (
    <div className="screen">
      <PageHeader
        kicker="Pedoman Bina Marga"
        title="Kesesuaian pedoman"
        lede="Seberapa jauh aplikasi ini mengikuti Pedoman Pemeriksaan Jembatan Bina Marga No. 01/P/BM/2022."
      />

      <section
        className="glass glass--chip stat-row"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 'var(--space-3)' }}
      >
        <Stat label="Sesuai" value={ringkas.per.sesuai} tone="accent" />
        <Stat label="Sebagian" value={ringkas.per.sebagian} tone="warn" />
        <Stat label="Belum ada" value={ringkas.per.belum} tone="critical" />
        <Stat label="Di luar pedoman" value={ringkas.per.luar} />
      </section>

      <div className="seg" role="group" aria-label="Saring menurut status" style={{ flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
        {PILIHAN.map((p) => (
          <button key={p.key} type="button" className="seg-opt" aria-pressed={saring === p.key} onClick={() => setSaring(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {KELOMPOK.map((kelompok) => {
        const butir = tampil.filter((b) => b.kelompok === kelompok);
        if (butir.length === 0) return null;
        return (
          <div key={kelompok} className="glass card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
            <div className="card-head">
              <span className="card-kicker">{kelompok}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <tbody>
                  {butir.map((b) => (
                    <tr key={b.id}>
                      <td style={{ minWidth: 220, lineHeight: 1.5 }}>
                        <strong style={{ fontWeight: 600 }}>{b.judul}</strong>
                        <div className="text-muted" style={{ fontSize: 11.5 }}>{b.rujukan}</div>
                      </td>
                      <td>
                        <span className={STATUS_KELAS[b.status]}>{STATUS_LABEL[b.status]}</span>
                      </td>
                      <td style={{ minWidth: 300, lineHeight: 1.5 }}>
                        {b.ada}
                        {b.kurang ? <div className="text-muted" style={{ fontSize: 11.5 }}>{b.status === 'sesuai' ? 'Catatan' : 'Belum'}: {b.kurang}</div> : null}
                      </td>
                      <td>
                        {b.layar ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(b.layar as ScreenKey)}>
                            Buka
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <details className="glass card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Penafsiran pengembang</summary>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'grid', gap: 4, fontSize: 13, lineHeight: 1.5 }}>
          {TAFSIRAN.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
