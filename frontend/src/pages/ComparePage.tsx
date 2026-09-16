import { useState } from 'react';
import type { Status, Telemetry } from '../lib/types';
import type { Series } from '../hooks/useTelemetry';
import { SENSORS, SENSOR_BY_ID, statusOf } from '../domain/sensors';
import { SCENARIOS } from '../domain/scenarios';
import { ThresholdChart, sharedDomain } from '../components/Charts';
import { PageHeader, SectionTitle, StatusTag } from '../components/Ui';

export interface ComparePageProps {
  telemetry: Telemetry | null;
  series: Record<string, Series>;
  reference: Record<string, number[]>;
  referenceFrozen: boolean;
  onOpenScenario: () => void;
}

/** Nilai wakil satu deret: rata-rata sepertiga terakhir, supaya tidak terseret satu lonjakan. */
function tailMean(values: number[]): number {
  if (values.length === 0) return 0;
  const tail = values.slice(-Math.max(8, Math.floor(values.length / 3)));
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

/**
 * Perbandingan dua kondisi struktur yang sama.
 *
 * Kiri: rekaman saat jembatan berada pada kondisi normal. Kanan: kondisi
 * sekarang. Keduanya digambar pada rentang sumbu yang sama — tanpa itu, garis
 * yang lebih tinggi belum tentu berarti nilai yang lebih besar, dan
 * perbandingannya jadi menyesatkan.
 *
 * Rekaman kiri berhenti terisi begitu sebuah skenario dijalankan, jadi yang
 * dibandingkan benar-benar "sebelum" dan "sesudah", bukan dua potongan waktu
 * yang sama-sama sedang terbebani.
 */
export function ComparePage({
  telemetry,
  series,
  reference,
  referenceFrozen,
  onOpenScenario,
}: ComparePageProps) {
  const [focus, setFocus] = useState('strain');

  if (!telemetry) return <p className="text-muted">Menyiapkan data…</p>;

  const scenario = SCENARIOS[telemetry.scenario];
  const focusSpec = SENSOR_BY_ID[focus] ?? SENSORS[0];
  const focusNow = series[focusSpec.id]?.values ?? [];
  const focusNormal = reference[focusSpec.id] ?? [];
  const focusDomain = sharedDomain(focusSpec, focusNow, focusNormal);

  const rows = SENSORS.map((spec) => {
    const now = series[spec.id]?.values ?? [];
    const normal = reference[spec.id] ?? [];
    const nowMean = tailMean(now);
    const normalMean = tailMean(normal);
    const deltaPct = normalMean === 0 ? 0 : ((nowMean - normalMean) / normalMean) * 100;
    return {
      spec,
      now,
      normal,
      nowMean,
      normalMean,
      deltaPct,
      status: statusOf(spec, nowMean) as Status,
      domain: sharedDomain(spec, now, normal),
    };
  });

  const moved = rows.filter((row) => Math.abs(row.deltaPct) > 10);

  return (
    <div className="screen">
      <PageHeader
        kicker="Comparison"
        title="Normal condition against current condition"
        lede={
          referenceFrozen ? (
            <>
              The left chart is the recording of the bridge in its normal condition, frozen when the{' '}
              <strong style={{ fontWeight: 700, color: 'var(--mist-100)' }}>{scenario.name}</strong>{' '}
              scenario was started. The right chart is the current condition. Both use the same axis
              range, so the height of the traces can be compared directly.
            </>
          ) : (
            <>
              The bridge is currently in its normal condition, so both charts show the same thing.
              Run a scenario to freeze the left-hand recording and watch what changes.
            </>
          )
        }
        actions={
          referenceFrozen ? (
            <StatusTag status={telemetry.assessment.status} />
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={onOpenScenario}>
              Choose a scenario
            </button>
          )
        }
      />

      <section
        className="glass glass--chip stat-row"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div className="stat">
          <span className="stat-label">Reference condition</span>
          <span className="stat-value" style={{ fontSize: 18 }}>
            Normal
          </span>
          <span className="stat-note">
            {referenceFrozen ? 'recording frozen' : 'recording now'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Current condition</span>
          <span className="stat-value" style={{ fontSize: 18 }}>
            {scenario.name}
          </span>
          <span className="stat-note">{scenario.impact}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Channels shifted</span>
          <span className="stat-value">
            {moved.length}
            <span className="stat-unit">/{rows.length}</span>
          </span>
          <span className="stat-note">more than 10 % apart</span>
        </div>
        <div className="stat">
          <span className="stat-label">Self-recovering</span>
          <span
            className="stat-value"
            style={{ fontSize: 18, color: scenario.reversible ? 'var(--state-normal)' : 'var(--state-bahaya)' }}
          >
            {scenario.reversible ? 'Yes' : 'No'}
          </span>
          <span className="stat-note">
            {scenario.reversible
              ? 'returns to baseline once the load is gone'
              : 'needs a recorded repair'}
          </span>
        </div>
      </section>

      <SectionTitle note={`${focusSpec.unit} · ${focusSpec.node}`}>
        One channel in detail
      </SectionTitle>

      <div className="row" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="seg" style={{ flexWrap: 'wrap' }}>
          {SENSORS.map((spec) => (
            <button
              key={spec.id}
              type="button"
              className="seg-opt"
              aria-pressed={focus === spec.id}
              onClick={() => setFocus(spec.id)}
            >
              {spec.name}
            </button>
          ))}
        </div>
      </div>

      <section
        className="split"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-8)',
        }}
      >
        <ComparePanel
          title="Normal condition"
          note={referenceFrozen ? 'recorded before the scenario' : 'recording now'}
          spec={focusSpec}
          values={focusNormal}
          domain={focusDomain}
          status="AMAN"
          mean={tailMean(focusNormal)}
        />
        <ComparePanel
          title="Current condition"
          note={scenario.name}
          spec={focusSpec}
          values={focusNow}
          domain={focusDomain}
          status={statusOf(focusSpec, tailMean(focusNow))}
          mean={tailMean(focusNow)}
        />
      </section>

      <SectionTitle note={`${rows.length} channels`}>All channels</SectionTitle>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-8)',
        }}
      >
        {rows.map((row) => (
          <div key={row.spec.id} className="glass card" style={{ padding: 'var(--space-3)' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="card-title" style={{ fontSize: 14 }}>
                {row.spec.name}
              </span>
              <span className="row" style={{ gap: 8 }}>
                <span
                  className="tabular"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: row.deltaPct >= 0 ? 'var(--state-bahaya)' : 'var(--state-normal)',
                  }}
                >
                  {row.deltaPct >= 0 ? '+' : ''}
                  {row.deltaPct.toFixed(1)} %
                </span>
                <StatusTag status={row.status} />
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <MiniPane
                label="normal"
                value={row.normalMean}
                spec={row.spec}
                values={row.normal}
                domain={row.domain}
                status="AMAN"
              />
              <MiniPane
                label="now"
                value={row.nowMean}
                spec={row.spec}
                values={row.now}
                domain={row.domain}
                status={row.status}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="glass glass--chip card" style={{ padding: 'var(--space-4)' }}>
        <span className="card-kicker">How to read this</span>
        <p className="card-body" style={{ maxWidth: '78ch' }}>
          Both charts of a channel use the same axis range, and the warning (yellow) and critical
          (red) threshold lines sit at the same height in each. The percentage difference is taken
          from the mean of the last third of the data, not from a single instantaneous value, so one
          spike cannot move the number.
        </p>
      </div>
    </div>
  );
}

function ComparePanel({
  title,
  note,
  spec,
  values,
  domain,
  status,
  mean,
}: {
  title: string;
  note: string;
  spec: (typeof SENSORS)[number];
  values: number[];
  domain: [number, number];
  status: Status;
  mean: number;
}) {
  return (
    <div className="glass card" style={{ padding: 'var(--space-4)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <span className="card-kicker">{title}</span>
          <div className="text-muted" style={{ fontSize: 11 }}>
            {note}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="stat-value tabular" style={{ fontSize: 24 }}>
            {mean.toFixed(spec.dec)}
            <span className="stat-unit">{spec.unit}</span>
          </div>
          <StatusTag status={status} />
        </div>
      </div>

      <ThresholdChart sensor={spec} values={values} status={status} domain={domain} height={150} />

      <div className="text-muted tabular" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span>warning at {spec.warn}</span>
        <span>critical at {spec.crit}</span>
      </div>
    </div>
  );
}

function MiniPane({
  label,
  value,
  spec,
  values,
  domain,
  status,
}: {
  label: string;
  value: number;
  spec: (typeof SENSORS)[number];
  values: number[];
  domain: [number, number];
  status: Status;
}) {
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 11 }}>
        <span className="text-muted">{label}</span>
        <span className="tabular" style={{ fontWeight: 700 }}>
          {value.toFixed(spec.dec)}
        </span>
      </div>
      <ThresholdChart sensor={spec} values={values} status={status} domain={domain} height={68} />
    </div>
  );
}
