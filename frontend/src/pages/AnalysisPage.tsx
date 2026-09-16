import { useState } from 'react';
import type { Bridge, Telemetry } from '../lib/types';
import type { Series } from '../hooks/useTelemetry';
import { SENSORS, SENSOR_BY_ID } from '../domain/sensors';
import { ThresholdChart } from '../components/Charts';
import { PageHeader, StatusTag } from '../components/Ui';
import {
  dossierFor,
  inspeksiTerakhir,
  jarakWaktu,
  sensorUnitFor,
  tanggalPendek,
} from '../domain/demoData';

/** Ringkasan statistik satu deret: terendah, rata-rata, tertinggi. */
function summarise(values: number[]) {
  if (values.length === 0) return { min: 0, avg: 0, max: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { min, avg, max };
}

export interface AnalysisPageProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
  series: Record<string, Series>;
}

/**
 * Analisa: deret waktu tiap kanal terhadap ambangnya.
 *
 * Sumbu tegak tiap bagan selalu memuat ambang kritis, sehingga tinggi garis
 * dapat dibandingkan antar kanal tanpa harus membaca angkanya satu per satu.
 *
 * Tiap kanal juga menyebut alat yang mengukurnya — nomor unit, model, dan sisa
 * baterainya diambil dari inventaris sensor pada berkas aset. Sebuah garis yang
 * bergerak aneh bisa berarti strukturnya berubah, bisa juga berarti alatnya yang
 * mulai habis daya, dan pembaca tidak dapat memisahkan keduanya kalau
 * keterangan alatnya disimpan di halaman lain.
 */
export function AnalysisPage({ bridge, telemetry, series }: AnalysisPageProps) {
  const [showBaseline, setShowBaseline] = useState(true);
  const dossier = dossierFor(bridge.id);
  const inspection = dossier ? inspeksiTerakhir(dossier) : null;

  if (!telemetry) return <p className="text-muted">Preparing the data…</p>;

  return (
    <div className="screen">
      <PageHeader
        kicker="Analysis"
        title="Time-series analysis"
        lede="Every channel is drawn against its two thresholds: the yellow line is the warning limit, the red line the critical limit. The grey dashed line is the baseline — the same channel under normal service conditions, as a reference. Each point on a chart is a one-minute mean, not an instantaneous sample."
        actions={
          <label className="row" style={{ gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={showBaseline}
              onChange={(event) => setShowBaseline(event.target.checked)}
            />
            Show the baseline
          </label>
        }
      />

      {dossier && inspection ? (
        <div
          className="glass glass--chip card"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            gap: 6,
            fontSize: 12.5,
            lineHeight: 1.55,
          }}
        >
          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span className="card-kicker">Asset record reference</span>
            <span className="text-muted">
              design load {dossier.designLoad} · condition rating {dossier.conditionValue}/5 ·
              inspected {tanggalPendek(inspection.date)} ({jarakWaktu(inspection.date)})
            </span>
          </div>
          <p className="text-muted" style={{ maxWidth: '96ch' }}>
            <strong style={{ fontWeight: 600, color: 'var(--mist-100)' }}>Latest finding</strong> ·{' '}
            {inspection.findings}
          </p>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {SENSORS.map((spec) => {
          const reading = telemetry.readings.find((r) => r.id === spec.id);
          const entry = series[spec.id];
          if (!reading || !entry) return null;
          const stats = summarise(entry.values);
          const unit = sensorUnitFor(bridge.id, spec.name);

          return (
            <div
              key={spec.id}
              className="glass card"
              style={{ padding: 'var(--space-4)' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <div>
                  <div className="card-title" style={{ fontSize: 16 }}>
                    {spec.name}
                  </div>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    {spec.node}
                  </div>
                  {unit ? (
                    <div style={{ fontSize: 11, marginTop: 2 }}>
                      <span className="tag tag-outline" style={{ marginRight: 6 }}>
                        {unit.id}
                      </span>
                      <span className="text-muted">{unit.model} · </span>
                      <span
                        className="tabular"
                        style={{
                          color: unit.battery < 70 ? 'var(--state-waspada)' : 'var(--mist-300)',
                        }}
                      >
                        battery {unit.battery} %
                      </span>
                    </div>
                  ) : null}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    className="tabular"
                    style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 22 }}
                  >
                    {reading.value.toFixed(spec.dec)}{' '}
                    <span className="text-muted" style={{ fontSize: 12, fontWeight: 400 }}>
                      {spec.unit}
                    </span>
                  </div>
                  <StatusTag status={reading.status} />
                </div>
              </div>

              <ThresholdChart
                sensor={spec}
                values={entry.values}
                baseline={entry.baseline}
                status={reading.status}
                showBaseline={showBaseline}
              />

              <div
                className="text-muted tabular"
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6 }}
              >
                <span>min {stats.min.toFixed(spec.dec)}</span>
                <span>mean {stats.avg.toFixed(spec.dec)}</span>
                <span>max {stats.max.toFixed(spec.dec)}</span>
                <span>
                  thresholds {spec.warn} / {spec.crit} {spec.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-6)', maxWidth: '70ch' }}>
        The history window keeps the last {series[SENSORS[0].id]?.values.length ?? 0} values per channel,
        each one a one-minute mean. The values come from the simulation engine, not from field
        measurements; the thresholds are the ones in the sensor catalogue
        ({SENSOR_BY_ID.strain.warn} µε warning, {SENSOR_BY_ID.strain.crit} µε critical for strain).
      </p>
    </div>
  );
}
