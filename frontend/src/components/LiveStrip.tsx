import type { DataSource, Telemetry } from '../lib/types';
import { clockOf } from './EventLog';

/**
 * Bilah status aliran data.
 *
 * Titik yang berkedip hanya menandakan bahwa paket masih masuk; angka pencacah
 * dan waktu perbaruan terakhir di sebelahnya yang benar-benar membuktikannya,
 * jadi keduanya selalu ditampilkan bersama.
 */
/** Jarak antar cuplikan, ditulis dalam satuan yang enak dibaca. */
function intervalLabel(ms: number): string {
  if (ms >= 60_000) return `${Math.round(ms / 60_000)} min`;
  if (ms >= 1_000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} s`;
  return `${ms} ms`;
}

export function LiveStrip({
  telemetry,
  source,
  sensorCount,
  intervalMs,
}: {
  telemetry: Telemetry | null;
  source: DataSource;
  sensorCount: number;
  intervalMs: number;
}) {
  const paused = telemetry?.paused ?? false;
  // Pada laju satu menit, jembatan sedang tenang — titik yang berkedip cepat
  // di sebelahnya akan menjanjikan sesuatu yang tidak sedang terjadi.
  const quiet = intervalMs >= 60_000;

  const item = (label: string, value: string | number) => (
    <span className="text-muted">
      {label} <span className="tabular" style={{ color: 'var(--color-text)' }}>{value}</span>
    </span>
  );

  return (
    <div
      className="glass glass--chip card"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--space-2) var(--space-6)',
        padding: 'var(--space-2) var(--space-4)',
        fontSize: 13,
        marginBottom: 'var(--space-4)',
      }}
    >
      <span className="row" style={{ gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: paused ? 'var(--mist-400)' : quiet ? 'var(--state-normal)' : 'var(--brand-400)',
            animation: paused || quiet ? 'none' : 'blink 1.2s infinite',
          }}
        />
        <strong style={{ fontWeight: 700 }}>
          {paused ? 'Data stream paused' : quiet ? 'Routine monitoring' : 'Live monitoring'}
        </strong>
      </span>

      {item('Updated', telemetry ? clockOf(telemetry.at) : '—')}
      {item('Sampled', intervalLabel(intervalMs))}
      {/*
        * Laju cuplikan dan jendela rerata adalah dua hal berbeda, jadi
        * keduanya ditulis terpisah: yang pertama menyatakan seberapa sering
        * angkanya diperbarui, yang kedua menyatakan angka itu mewakili apa.
        */}
      {item('Averaged', '1 min')}
      {item('Packets', telemetry?.packets ?? 0)}
      {item('Sensors', `${sensorCount} online`)}

      <span className="text-muted" style={{ marginLeft: 'auto' }}>
        {source === 'api' ? 'Source: digital twin API' : 'Source: in-browser simulation engine'}
      </span>
    </div>
  );
}
