import type { Assessment } from '../lib/types';
import { PRIORITY_CLASS } from '../domain/risk';
import { Meter } from './Charts';

/**
 * Rekomendasi pemeliharaan.
 *
 * Isinya diturunkan dari skor risiko, dan rinciannya menyebut kanal mana yang
 * mendorong skor tersebut — supaya tindakan yang disarankan selalu dapat
 * ditelusuri ke pembacaan yang menyebabkannya.
 */
export function MaintenancePanel({ assessment }: { assessment: Assessment }) {
  const { maintenance, breakdown } = assessment;

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className={PRIORITY_CLASS[maintenance.priority]}>PRIORITAS {maintenance.priority}</span>
        <span className="text-muted" style={{ fontSize: 12 }}>
          {maintenance.timeline}
        </span>
      </div>

      <p style={{ fontSize: 15, fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
        {maintenance.recommendation}
      </p>

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {maintenance.items.map((item) => (
          <li key={item} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
            <span aria-hidden="true" style={{ color: 'var(--brand-400)' }}>
              —
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="hr" style={{ margin: 'var(--space-2) 0' }} />

      <div className="stack" style={{ gap: 'var(--space-2)' }}>
        <span className="card-kicker">Pendorong skor risiko</span>
        {breakdown.map((entry) => (
          <Meter
            key={entry.id}
            pct={entry.pct}
            label={`${entry.name} · ${entry.value} ${entry.unit}`}
            color={
              entry.status === 'KRITIS'
                ? 'var(--state-bahaya)'
                : entry.status === 'WASPADA'
                  ? 'var(--state-waspada)'
                  : 'var(--brand-400)'
            }
          />
        ))}
      </div>
    </div>
  );
}
