import type { Reading } from '../lib/types';
import { SENSOR_BY_ID } from '../domain/sensors';
import { Sparkline } from './Charts';
import { StatusTag } from './Ui';

export interface SensorCardProps {
  reading: Reading;
  values: number[];
  onSelect?: (sensorId: string) => void;
  selected?: boolean;
}

/**
 * Kartu satu kanal sensor: nilai terkini, status, grafik ringkas, dan jarak
 * terhadap ambang. Kartu ini muncul di dashboard maupun di panel model 3D.
 */
export function SensorCard({ reading, values, onSelect, selected = false }: SensorCardProps) {
  const spec = SENSOR_BY_ID[reading.id];
  const headroom = Math.max(0, ((reading.crit - reading.value) / reading.crit) * 100);

  const body = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 13 }}>{reading.name}</span>
        <StatusTag status={reading.status} />
      </div>

      <div
        className="tabular"
        style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 30, lineHeight: 1 }}
      >
        {reading.value.toFixed(spec?.dec ?? 1)}
        <span className="text-muted" style={{ fontSize: 13, fontWeight: 400, marginLeft: 4 }}>
          {reading.unit}
        </span>
      </div>

      <Sparkline values={values.slice(-60)} status={reading.status} height={38} />

      <div className="text-muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span>ambang {reading.warn}</span>
        <span className="tabular">sisa {headroom.toFixed(0)}%</span>
      </div>
    </>
  );

  if (!onSelect) {
    return (
      <div className="glass card" style={{ gap: 'var(--space-1)' }}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(reading.id)}
      aria-pressed={selected}
      className="glass card card-interactive"
      style={{ gap: 'var(--space-1)' }}
    >
      {body}
    </button>
  );
}
