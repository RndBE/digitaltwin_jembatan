import type { RiskLevel, Status } from '../lib/types';
import { STATUS_TONE } from './Ui';
import { LEVEL_LABEL, STATUS_LABEL } from '../domain/sensors';

/**
 * Cincin indeks kesehatan.
 *
 * Lingkaran berjari-jari 64 px punya keliling ≈ 402,1 px; panjang goresan
 * diatur sebagai pecahan dari keliling itu, jadi tidak perlu menghitung sudut.
 */
export function HealthRing({ health, status }: { health: number; status: Status }) {
  const circumference = 402.1;
  // Cincin memakai warna keadaan yang sama dengan labelnya, supaya keduanya
  // tidak pernah saling bertentangan di layar yang sama.
  const stroke = STATUS_TONE[status];

  return (
    <div style={{ position: 'relative', width: 150, height: 150, flex: 'none' }}>
      <svg
        width="150"
        height="150"
        viewBox="0 0 150 150"
        role="img"
        aria-label={`Structural health index ${health} of 100, status ${STATUS_LABEL[status]}`}
      >
        <circle cx="75" cy="75" r="64" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="11" />
        <circle
          cx="75"
          cy="75"
          r="64"
          fill="none"
          stroke={stroke}
          strokeWidth="11"
          strokeLinecap="butt"
          strokeDasharray={`${((health / 100) * circumference).toFixed(1)} ${circumference}`}
          transform="rotate(-90 75 75)"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        <div
          className="tabular"
          style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 40 }}
        >
          {health}
        </div>
        <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
          Health index
        </div>
      </div>
    </div>
  );
}

/** Pengukur risiko mendatar, 0..100, dengan penanda tingkat. */
export function RiskMeter({ score, level }: { score: number; level: RiskLevel }) {
  const color =
    level === 'KRITIS' || level === 'TINGGI'
      ? 'var(--state-bahaya)'
      : level === 'SEDANG'
        ? 'var(--state-waspada)'
        : 'var(--state-normal)';

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13 }}>Risk score</span>
        <span className="tabular" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 20 }}>
          {score}
          <span className="text-muted" style={{ fontSize: 12, fontWeight: 400 }}>
            /100
          </span>
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Risk score ${score} of 100, level ${LEVEL_LABEL[level]}`}
        style={{ height: 8, background: 'rgb(255 255 255 / 0.12)', borderRadius: 4, overflow: 'hidden' }}
      >
        <div style={{ width: `${score}%`, height: '100%', background: color, transition: 'width 0.4s ease' }} />
      </div>
      <div className="text-muted" style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
        <span>Critical</span>
      </div>
    </div>
  );
}
