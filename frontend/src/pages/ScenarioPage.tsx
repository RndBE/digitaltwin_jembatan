import type { Telemetry } from '../lib/types';
import {
  FAMILY_LABELS,
  FAMILY_NOTES,
  FAMILY_ORDER,
  ONSET_LABEL,
  SCENARIOS,
  scenariosOf,
} from '../domain/scenarios';
import { SENSOR_BY_ID } from '../domain/sensors';
import { PageHeader, SectionTitle, StatusTag } from '../components/Ui';

export interface ScenarioPageProps {
  telemetry: Telemetry | null;
  residual: Record<string, number>;
  onRun: (key: string) => void;
  onStop: () => void;
  onTogglePause: () => void;
  onRepair: () => void;
  onOpenTwin: () => void;
  onOpenCompare: () => void;
  controlError: string | null;
}

/**
 * Skenario pembebanan.
 *
 * Disusun sebagai tangga dalam tiga keluarga, karena itulah yang membedakan
 * satu keadaan waspada dari yang lain: waspada karena kemacetan hilang bersama
 * kemacetannya, sedangkan waspada karena retak lelah tidak. Tiap kartu menyebut
 * dampak yang diharapkan, laju perubahannya, dan apakah kondisinya pulih
 * sendiri — sebelum dijalankan, supaya hasilnya dapat dibandingkan dengan
 * dugaan dan bukan sekadar dilihat.
 */
export function ScenarioPage({
  telemetry,
  residual,
  onRun,
  onStop,
  onTogglePause,
  onRepair,
  onOpenTwin,
  onOpenCompare,
  controlError,
}: ScenarioPageProps) {
  const active = telemetry?.scenario ?? 'idle';
  const running = active !== 'idle';
  const scenario = SCENARIOS[active];
  const residualIds = Object.keys(residual);

  return (
    <div className="screen">
      <PageHeader
        kicker="Simulation"
        title="Loading scenarios"
        lede="Running a scenario changes the load acting on the model: readings move towards the new condition at their own rate, and the affected structural elements are highlighted on the 3D model."
        actions={telemetry ? <StatusTag status={telemetry.assessment.status} /> : undefined}
      />

      {controlError ? (
        <div
          role="status"
          className="glass card"
          style={{
            background: 'rgb(71 166 255 / 0.14)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
            fontSize: 13,
          }}
        >
          {controlError}
        </div>
      ) : null}

      {residualIds.length > 0 ? (
        <div
          role="status"
          className="glass card"
          style={{
            background: 'rgb(251 191 36 / 0.12)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <span className="card-kicker" style={{ color: 'var(--state-waspada)' }}>
                Unrepaired residual damage
              </span>
              <p style={{ fontSize: 13, marginTop: 4, maxWidth: '72ch' }}>
                {residualIds.map((id) => SENSOR_BY_ID[id]?.name ?? id).join(', ')} will not return to
                baseline even after the scenario is stopped. Record a repair once the field work is
                finished.
              </p>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={onRepair}>
              Record a repair
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="glass glass--panel card"
        style={{
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
          background: running ? 'hsl(210 40% 12% / 0.62)' : undefined,
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <span className="card-kicker">{running ? 'Running now' : 'No scenario'}</span>
            <div className="card-title" style={{ fontSize: 20 }}>
              {scenario.name}
            </div>
          </div>
          <div className="row">
            <span className="text-muted tabular" style={{ fontSize: 12 }}>
              {telemetry?.runtimeSeconds ?? 0} s
            </span>
            <button type="button" className="btn btn-sm" onClick={onTogglePause}>
              {telemetry?.paused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" className="btn btn-sm" onClick={onStop} disabled={!running}>
              Stop
            </button>
            <button type="button" className="btn btn-sm" onClick={onOpenCompare} disabled={!running}>
              Compare
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onOpenTwin}>
              See it on the 3D model
            </button>
          </div>
        </div>
        <p style={{ fontSize: 13, marginTop: 'var(--space-2)', maxWidth: '82ch', color: 'var(--mist-300)' }}>
          {scenario.desc}
        </p>
      </div>

      {FAMILY_ORDER.map((family) => (
        <section key={family} style={{ marginBottom: 'var(--space-8)' }}>
          <SectionTitle note={`${scenariosOf(family).length} scenarios`}>
            {FAMILY_LABELS[family]}
          </SectionTitle>
          <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.6, maxWidth: '82ch', marginBottom: 'var(--space-3)' }}>
            {FAMILY_NOTES[family]}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {scenariosOf(family).map((item) => {
              const isActive = item.key === active;
              const affected = Object.entries(item.mult)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([id, factor]) => `${SENSOR_BY_ID[id]?.name ?? id} ×${factor}`);

              return (
                <div
                  key={item.key}
                  className="glass card"
                  style={{
                    padding: 'var(--space-4)',
                    boxShadow: isActive
                      ? 'inset 0 1px 0 rgb(255 255 255 / 0.22), inset 0 0 0 1px rgb(124 196 255 / 0.55), var(--glass-lift)'
                      : undefined,
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="card-title">{item.name}</span>
                    <span className="row" style={{ gap: 6 }}>
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        expected
                      </span>
                      <StatusTag status={item.expected} />
                    </span>
                  </div>

                  <p className="card-body" style={{ maxWidth: '82ch' }}>
                    {item.desc}
                  </p>

                  <div
                    className="text-muted"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2) var(--space-4)', fontSize: 12 }}
                  >
                    <span>Traffic: {item.traffic}</span>
                    <span>Impact: {item.impact}</span>
                    <span>Onset: {ONSET_LABEL[item.onset]}</span>
                    <span
                      style={{ color: item.reversible ? 'var(--state-normal)' : 'var(--state-bahaya)' }}
                    >
                      {item.reversible ? 'Recovers on its own once the load is gone' : 'Leaves residual damage · needs a repair'}
                    </span>
                  </div>

                  <div
                    className="text-muted"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2) var(--space-4)', fontSize: 12 }}
                  >
                    <span>Channels affected: {affected.join(', ') || '—'}</span>
                    {item.damaged ? <span>Elements highlighted: {item.damaged.length}</span> : null}
                  </div>

                  <div className="row" style={{ marginTop: 'var(--space-1)' }}>
                    <button
                      type="button"
                      className={isActive ? 'btn btn-sm' : 'btn btn-primary btn-sm'}
                      onClick={() => (isActive ? onStop() : onRun(item.key))}
                    >
                      {isActive ? 'Stop the scenario' : 'Run this scenario'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
