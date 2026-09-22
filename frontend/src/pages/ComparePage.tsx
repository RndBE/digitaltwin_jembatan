import { useState } from 'react';
import type { Status, Telemetry } from '../lib/types';
import type { Series } from '../hooks/useTelemetry';
import { SENSORS, SENSOR_BY_ID, statusOf } from '../domain/sensors';
import { SCENARIOS } from '../domain/scenarios';
import { OverlayChart, sharedDomain } from '../components/Charts';
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
        kicker="Perbandingan"
        title="Kondisi normal dibanding kondisi sekarang"
        lede={
          referenceFrozen ? (
            <>
              Dua keadaan struktur yang sama, ditumpuk pada satu sumbu. Garis putus adalah rekaman
              kondisi normal, dibekukan saat skenario{' '}
              <strong style={{ fontWeight: 700, color: 'var(--mist-100)' }}>{scenario.name}</strong>{' '}
              dijalankan; garis penuh adalah kondisi sekarang. Daerah yang terarsir di antara
              keduanya itulah selisihnya — dan selisih itulah yang sedang dicari, bukan nilai mutlak
              salah satunya.
            </>
          ) : (
            <>
              Jembatan sedang berada pada kondisi normal, sehingga kedua garis berimpit dan tidak
              ada yang terarsir. Jalankan sebuah skenario untuk membekukan rekaman pembandingnya dan
              melihat seberapa jauh keadaannya berpisah.
            </>
          )
        }
        actions={
          referenceFrozen ? undefined : (
            <button type="button" className="btn btn-primary btn-sm" onClick={onOpenScenario}>
              Pilih skenario
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
          <span className="stat-label">Kondisi pembanding</span>
          <span className="stat-value" style={{ fontSize: 18 }}>
            Normal
          </span>
          <span className="stat-note">
            {referenceFrozen ? 'rekaman dibekukan' : 'sedang direkam'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Kondisi sekarang</span>
          <span className="stat-value" style={{ fontSize: 18 }}>
            {scenario.name}
          </span>
          <span className="stat-note">{scenario.impact}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Kanal bergeser</span>
          <span className="stat-value">
            {moved.length}
            <span className="stat-unit">/{rows.length}</span>
          </span>
          <span className="stat-note">selisih lebih dari 10 %</span>
        </div>
        <div className="stat">
          <span className="stat-label">Pulih sendiri</span>
          <span
            className="stat-value"
            style={{ fontSize: 18, color: scenario.reversible ? 'var(--state-normal)' : 'var(--state-bahaya)' }}
          >
            {scenario.reversible ? 'Ya' : 'Tidak'}
          </span>
          <span className="stat-note">
            {scenario.reversible
              ? 'kembali ke dasar saat beban hilang'
              : 'perlu perbaikan tercatat'}
          </span>
        </div>
      </section>

      <SectionTitle note={`${focusSpec.unit} · ${focusSpec.node}`}>
        Telaah satu kanal
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
        <div className="glass card" style={{ padding: 'var(--space-4)', gridColumn: '1 / -1' }}>
          <div
            className="row"
            style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-2)' }}
          >
            <div>
              <span className="card-kicker">Kanal disorot</span>
              <div className="card-title" style={{ fontSize: 16 }}>
                {focusSpec.name}{' '}
                <span className="text-muted" style={{ fontWeight: 400, fontSize: 12 }}>
                  ({focusSpec.unit}) · {focusSpec.node}
                </span>
              </div>
            </div>
            <StatusTag status={statusOf(focusSpec, tailMean(focusNow))} />
          </div>

          <OverlayChart
            sensor={focusSpec}
            current={focusNow}
            reference={focusNormal}
            status={statusOf(focusSpec, tailMean(focusNow))}
            domain={focusDomain}
            height={200}
          />

          <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-2)' }}>
            Putus abu = rekaman normal · penuh berwarna = sekarang · satu sumbu tegak.
          </p>
        </div>
      </section>

      <SectionTitle note={`${rows.length} kanal`}>Seluruh kanal</SectionTitle>

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

            {/* Sepasang bagan kecil berdampingan menuntut mata mengurangkan
                dua gambar; ditumpuk, selisihnya menjadi satu bentuk yang
                langsung terlihat besar-kecilnya. */}
            <OverlayChart
              sensor={row.spec}
              current={row.now}
              reference={row.normal}
              status={row.status}
              domain={row.domain}
              height={76}
              compact
            />

            <div
              className="row tabular"
              style={{ justifyContent: 'space-between', fontSize: 11.5, marginTop: 2 }}
            >
              <span className="text-muted">
                normal{' '}
                <span style={{ color: 'var(--mist-200)' }}>
                  {row.normalMean.toFixed(row.spec.dec)}
                </span>
              </span>
              <span className="text-muted">
                sekarang{' '}
                <span style={{ color: '#fff' }}>{row.nowMean.toFixed(row.spec.dec)}</span>{' '}
                {row.spec.unit}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
