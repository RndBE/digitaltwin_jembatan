import type { AlertEvent, Bridge, DataSource, Telemetry } from '../lib/types';
import type { Series } from '../hooks/useTelemetry';
import { HealthRing, RiskMeter } from '../components/Gauges';
import { MaintenancePanel } from '../components/MaintenancePanel';
import { EventLog } from '../components/EventLog';
import { SensorCard } from '../components/SensorCard';
import { LiveStrip } from '../components/LiveStrip';
import { PageHeader, SectionTitle, Stat, StatusTag } from '../components/Ui';
import {
  CONDITION_LABELS,
  dossierFor,
  inspeksiTerakhir,
  jarakWaktu,
  pekerjaanBerikutnya,
  pekerjaanBerjalan,
  tanggalPendek,
} from '../domain/demoData';

export interface DashboardPageProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
  alerts: AlertEvent[];
  series: Record<string, Series>;
  source: DataSource;
  /** Jarak antar cuplikan yang sedang dipakai. */
  intervalMs: number;
  /** Kanal yang masih membawa sisa kerusakan. */
  residual: Record<string, number>;
  onOpenTwin: () => void;
  onOpenScenario: () => void;
  onOpenAsset: () => void;
}

/**
 * Dashboard: satu layar yang menjawab tiga pertanyaan — seberapa baik kondisinya,
 * apa yang harus dilakukan, dan apa yang baru saja terjadi.
 */
export function DashboardPage({
  bridge,
  telemetry,
  alerts,
  series,
  source,
  intervalMs,
  residual,
  onOpenTwin,
  onOpenScenario,
  onOpenAsset,
}: DashboardPageProps) {
  if (!telemetry) {
    return <p className="text-muted">Menyiapkan aliran telemetri…</p>;
  }

  const { assessment } = telemetry;
  const critical = assessment.status === 'KRITIS';
  const dossier = dossierFor(bridge.id);
  const inspection = dossier ? inspeksiTerakhir(dossier) : null;
  const ongoing = dossier ? pekerjaanBerjalan(dossier) : null;
  const planned = dossier ? pekerjaanBerikutnya(dossier) : null;
  const warnCount = telemetry.readings.filter((r) => r.status !== 'AMAN').length;
  const residualIds = Object.keys(residual);

  return (
    <div className="screen">
      <LiveStrip
        telemetry={telemetry}
        source={source}
        sensorCount={bridge.sensorCount}
        intervalMs={intervalMs}
      />

      {critical ? (
        <div
          role="alert"
          className="glass card"
          style={{
            background: 'rgb(248 113 113 / 0.14)',
            borderColor: 'rgb(248 113 113 / 0.42)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            gap: 'var(--space-1)',
          }}
        >
          <div className="row">
            <StatusTag status="KRITIS" />
            <strong style={{ fontFamily: 'var(--font-sans)' }}>
              {warnCount} kanal melewati ambang · {assessment.maintenance.recommendation}
            </strong>
          </div>
        </div>
      ) : null}

      {residualIds.length > 0 ? (
        <div
          role="status"
          className="glass card"
          style={{
            background: 'rgb(251 191 36 / 0.12)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13 }}>
              <strong style={{ fontWeight: 700 }}>Sisa kerusakan belum diperbaiki</strong> ·{' '}
              {residualIds.length} kanal tidak akan kembali ke nilai dasarnya tanpa pekerjaan
              lapangan.
            </span>
            <button type="button" className="btn btn-sm" onClick={onOpenScenario}>
              Buka halaman skenario
            </button>
          </div>
        </div>
      ) : null}

      <PageHeader
        kicker="Dashboard kondisi"
        title={bridge.name}
        lede={
          <>
            {bridge.location} · {bridge.type} · bentang {bridge.spanMeters} m · {bridge.lanes} lajur ·
            dibangun {bridge.builtYear}
          </>
        }
        actions={
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={onOpenTwin}>
              Buka model 3D
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenScenario}>
              Jalankan skenario
            </button>
          </>
        }
      />

      <section
        className="glass glass--chip stat-row"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          marginBottom: 'var(--space-6)',
        }}
      >
        <Stat
          label="Indeks kesehatan"
          value={assessment.health}
          note={assessment.status}
          tone={assessment.health < 45 ? 'critical' : assessment.health < 75 ? 'warn' : 'accent'}
        />
        <Stat
          label="Skor risiko"
          value={assessment.risk.score}
          unit="/100"
          note={assessment.risk.level}
          tone={assessment.risk.score > 50 ? 'critical' : assessment.risk.score > 25 ? 'warn' : 'default'}
        />
        <Stat label="Kanal di luar rentang" value={warnCount} unit={`/${telemetry.readings.length}`} note="ambang waspada & kritis" />
        <Stat label="Skenario aktif" value={telemetry.scenario === 'idle' ? '—' : telemetry.runtimeSeconds} unit={telemetry.scenario === 'idle' ? '' : 's'} note={telemetry.scenarioName} />
        <Stat
          label="Nilai kondisi"
          value={dossier ? `${dossier.conditionValue}/5` : '—'}
          note={dossier ? `inspeksi ${jarakWaktu(bridge.lastInspection)}` : 'model acuan'}
        />
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 'var(--space-3)',
          alignItems: 'stretch',
          marginBottom: 'var(--space-8)',
        }}
      >
        <div className="glass card" style={{ padding: 'var(--space-4)' }}>
          <span className="card-kicker">Kondisi struktur</span>

          <div
            style={{
              display: 'flex',
              gap: 'var(--space-4)',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <HealthRing health={assessment.health} status={assessment.status} />
            <div style={{ flex: '1 1 160px', minWidth: 0 }} className="stack">
              <div className="row">
                <StatusTag status={assessment.status} />
              </div>
              <RiskMeter score={assessment.risk.score} level={assessment.risk.level} />
            </div>
          </div>

          <div className="hairline" style={{ marginTop: 'auto' }} />

          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '6px var(--space-3)',
              fontSize: 12.5,
              margin: 0,
            }}
          >
            <dt className="text-muted">Skenario</dt>
            <dd style={{ textAlign: 'right' }}>{telemetry.scenarioName}</dd>
            <dt className="text-muted">Lalu lintas</dt>
            <dd className="tabular" style={{ textAlign: 'right' }}>
              {telemetry.scenario === 'idle'
                ? '—'
                : `${telemetry.traffic.cars} mobil, ${telemetry.traffic.trucks} truk`}
            </dd>
            <dt className="text-muted">Sensor daring</dt>
            <dd className="tabular" style={{ textAlign: 'right' }}>
              {bridge.sensorCount}
            </dd>
          </dl>
        </div>

        <div className="glass card" style={{ padding: 'var(--space-4)' }}>
          <span className="card-kicker">Rekomendasi pemeliharaan</span>
          <MaintenancePanel assessment={assessment} />
        </div>

        {/*
          * Acuan dari berkas aset.
          *
          * Angka telemetri tidak dapat ditafsirkan sendirian: 84 µm/m itu banyak
          * atau sedikit tergantung beban rencananya, dan lendutan yang naik
          * berarti lain bila inspeksi tiga bulan lalu sudah mencatat retak di
          * gelagar yang sama. Kartu ini menaruh acuan itu berdampingan dengan
          * pembacaannya, alih-alih menyimpannya di halaman terpisah.
          */}
        {dossier ? (
          <div className="glass card" style={{ padding: 'var(--space-4)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="card-kicker">Acuan aset</span>
              <button type="button" className="btn btn-sm" onClick={onOpenAsset}>
                Buka berkas
              </button>
            </div>

            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '6px var(--space-3)',
                fontSize: 12.5,
                margin: 0,
              }}
            >
              <dt className="text-muted">Beban rencana</dt>
              <dd style={{ textAlign: 'right' }}>{dossier.designLoad}</dd>
              <dt className="text-muted">Lalu lintas harian</dt>
              <dd className="tabular" style={{ textAlign: 'right' }}>
                {dossier.trafficPerDay.toLocaleString('id-ID')} kend · {Math.round(dossier.heavyShare * 100)} % berat
              </dd>
              <dt className="text-muted">Nilai kondisi</dt>
              <dd style={{ textAlign: 'right' }}>
                {dossier.conditionValue}/5 · {CONDITION_LABELS[dossier.conditionValue]}
              </dd>
              <dt className="text-muted">Pemeliharaan</dt>
              <dd style={{ textAlign: 'right' }}>
                {ongoing
                  ? `${ongoing.work} · berjalan`
                  : planned
                    ? `${planned.work} · ${jarakWaktu(planned.date)}`
                    : 'tidak ada pekerjaan terbuka'}
              </dd>
            </dl>

            {inspection ? (
              <>
                <div className="hairline" style={{ marginTop: 'auto' }} />
                <div className="text-muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                  <strong style={{ fontWeight: 600, color: 'var(--mist-100)' }}>
                    Temuan inspeksi {tanggalPendek(inspection.date)}
                  </strong>{' '}
                  · {inspection.findings}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="glass card" style={{ padding: 'var(--space-4)' }}>
          <span className="card-kicker">Log peristiwa</span>
          <EventLog events={alerts} limit={9} />
        </div>
      </section>

      <section>
        <SectionTitle
          note={`${telemetry.readings.length} kanal · tiap nilai rerata 1 menit · ${series.vib?.values.length ?? 0} titik riwayat`}
        >
          Kanal sensor
        </SectionTitle>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {telemetry.readings.map((reading) => (
            <SensorCard key={reading.id} reading={reading} values={series[reading.id]?.values ?? []} />
          ))}
        </div>
      </section>
    </div>
  );
}
