import type { ReactNode } from 'react';
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

export function PageHeader({
  kicker,
  title,
  lede,
  actions,
}: {
  kicker?: string;
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      {kicker ? <div className="page-kicker">{kicker}</div> : null}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <h1 className="page-title">{title}</h1>
        {actions ? <div className="row">{actions}</div> : null}
      </div>
      {lede ? <p className="page-lede">{lede}</p> : null}
    </header>
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
