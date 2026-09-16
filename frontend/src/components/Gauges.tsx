import type { RiskLevel, Status } from '../lib/types';
import { STATUS_TONE } from './Ui';

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
        aria-label={`Indeks kesehatan struktur ${health} dari 100, status ${status}`}
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
          Indeks kesehatan
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
        <span style={{ fontSize: 13 }}>Skor risiko</span>
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
        aria-label={`Skor risiko ${score} dari 100, tingkat ${level}`}
        style={{ height: 8, background: 'rgb(255 255 255 / 0.12)', borderRadius: 4, overflow: 'hidden' }}
      >
        <div style={{ width: `${score}%`, height: '100%', background: color, transition: 'width 0.4s ease' }} />
      </div>
      <div className="text-muted" style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
        <span>Rendah</span>
        <span>Sedang</span>
        <span>Tinggi</span>
        <span>Kritis</span>
      </div>
    </div>
  );
}
