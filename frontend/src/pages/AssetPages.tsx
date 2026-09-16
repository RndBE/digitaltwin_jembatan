import type { Bridge, Telemetry } from '../lib/types';
import { PageHeader, SectionTitle, Stat, StatusTag } from '../components/Ui';
import { Meter } from '../components/Charts';
import {
  CONDITION_LABELS,
  dossierFor,
  inspeksiTerakhir,
  jarakWaktu,
  pekerjaanBerikutnya,
  pekerjaanBerjalan,
  rupiah,
  tanggal,
  tanggalPendek,
  type BridgeDossier,
} from '../domain/demoData';

/**
 * Berkas aset, dipecah menjadi empat halaman.
 *
 * Satu halaman panjang berisi lima tabel memaksa pembacanya menggulir untuk
 * mencari satu hal, padahal tiap bagiannya dipakai orang yang berbeda pada saat
 * yang berbeda: penanggung jawab membuka data teknisnya, pemeriksa membuka
 * riwayat inspeksi, pelaksana membuka pekerjaan perbaikan, teknisi membuka
 * inventaris sensor. Karena itu keempatnya berdiri sendiri sebagai halaman —
 * tetapi tetap satu berkas yang sama, jadi tinggal di satu modul dan membaca
 * satu sumber data.
 */

interface AssetPageProps {
  bridge: Bridge;
  telemetry?: Telemetry | null;
}

/** Aset acuan tidak punya berkas; halaman mana pun menyatakan itu dengan kalimat yang sama. */
function NoDossier({ bridge, what }: { bridge: Bridge; what: string }) {
  return (
    <div className="screen">
      <PageHeader
        kicker="Asset"
        title={bridge.name}
        lede={`This asset is a reference model and has no ${what}. What it does carry is geometry governance metadata, which can be opened on the Digital twin page.`}
      />
    </div>
  );
}

const statusTaken: Record<string, string> = {
  Completed: 'tag tag-normal',
  'In progress': 'tag tag-waspada',
  Planned: 'tag tag-neutral',
};

const biayaTerealisasi = (dossier: BridgeDossier) =>
  dossier.maintenance
    .filter((item) => item.status !== 'Planned')
    .reduce((sum, item) => sum + item.cost, 0);

/* ------------------------------------------------------------------ informasi */

export interface InfoPageProps extends AssetPageProps {
  onOpen: (key: 'inspection' | 'repair' | 'sensors') => void;
}

/**
 * Informasi: identitas aset.
 *
 * Isinya hal-hal yang jarang berubah — ukuran, kelas jalan, beban rencana,
 * siapa yang bertanggung jawab. Justru karena jarang berubah, inilah acuan yang
 * dipakai membaca semua angka yang berubah tiap menit di halaman lain.
 */
export function InfoPage({ bridge, telemetry, onOpen }: InfoPageProps) {
  const dossier = dossierFor(bridge.id);
  if (!dossier) return <NoDossier bridge={bridge} what="technical record" />;

  const inspection = inspeksiTerakhir(dossier);
  const ongoing = pekerjaanBerjalan(dossier);
  const planned = pekerjaanBerikutnya(dossier);

  return (
    <div className="screen">
      <PageHeader
        kicker="Asset information"
        title={bridge.name}
        lede={
          <>
            {bridge.type} over the {dossier.river}. {dossier.roadClass}, owned by {dossier.owner}.
            This record is sample data, for demonstration purposes.
          </>
        }
        actions={telemetry ? <StatusTag status={telemetry.assessment.status} /> : undefined}
      />

      <section
        className="glass glass--chip stat-row"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          marginBottom: 'var(--space-6)',
        }}
      >
        <Stat
          label="Span length"
          value={bridge.spanMeters}
          unit="m"
          note={`${bridge.lanes} lanes · ${bridge.widthMeters} m wide`}
        />
        <Stat
          label="Year built"
          value={bridge.builtYear}
          note={`${new Date().getFullYear() - bridge.builtYear} years old`}
        />
        <Stat
          label="Condition rating"
          value={dossier.conditionValue}
          unit="/5"
          note={CONDITION_LABELS[dossier.conditionValue]}
          tone={
            dossier.conditionValue >= 3 ? 'critical' : dossier.conditionValue === 2 ? 'warn' : 'accent'
          }
        />
        <Stat
          label="Daily traffic"
          value={dossier.trafficPerDay.toLocaleString('en-US')}
          note={`${Math.round(dossier.heavyShare * 100)} % heavy vehicles`}
        />
        <Stat label="Sensors installed" value={dossier.sensors.length} note={`${bridge.sensorCount} channels online`} />
      </section>

      <section
        className="split"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-3)',
          alignItems: 'start',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div className="glass card" style={{ padding: 'var(--space-4)' }}>
          <span className="card-kicker">Technical data</span>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '7px var(--space-3)',
              fontSize: 13,
              margin: 0,
            }}
          >
            <dt className="text-muted">Coordinates</dt>
            <dd className="tabular" style={{ textAlign: 'right' }}>
              {dossier.coordinates}
            </dd>
            <dt className="text-muted">Obstacle crossed</dt>
            <dd style={{ textAlign: 'right' }}>{dossier.river}</dd>
            <dt className="text-muted">Road class</dt>
            <dd style={{ textAlign: 'right' }}>{dossier.roadClass}</dd>
            <dt className="text-muted">Design load</dt>
            <dd style={{ textAlign: 'right' }}>{dossier.designLoad}</dd>
            <dt className="text-muted">Structure type</dt>
            <dd style={{ textAlign: 'right' }}>{bridge.type}</dd>
            <dt className="text-muted">Last inspection</dt>
            <dd style={{ textAlign: 'right' }}>{tanggal(bridge.lastInspection)}</dd>
          </dl>
        </div>

        <div className="glass card" style={{ padding: 'var(--space-4)' }}>
          <span className="card-kicker">People responsible</span>
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            {dossier.contacts.map((contact) => (
              <div key={contact.role} style={{ fontSize: 13 }}>
                <div className="text-muted" style={{ fontSize: 11 }}>
                  {contact.role}
                </div>
                <div style={{ fontWeight: 600 }}>{contact.name}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {contact.unit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/*
        * Tiga halaman sisanya disebut di sini, bukan disembunyikan di bilah
        * samping saja: halaman identitas adalah tempat orang mendarat lebih
        * dulu, dan dari situ ia menuju catatan yang dicarinya.
        */}
      <section>
        <SectionTitle note="related records">Field records</SectionTitle>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          <button
            type="button"
            className="glass card card-interactive"
            style={{ padding: 'var(--space-4)', textAlign: 'left' }}
            onClick={() => onOpen('inspection')}
          >
            <span className="card-kicker">Inspections</span>
            <div className="card-title" style={{ fontSize: 15 }}>
              {dossier.inspections.length} records
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {inspection ? `last one ${jarakWaktu(inspection.date)}` : 'no records yet'}
            </div>
          </button>

          <button
            type="button"
            className="glass card card-interactive"
            style={{ padding: 'var(--space-4)', textAlign: 'left' }}
            onClick={() => onOpen('repair')}
          >
            <span className="card-kicker">Maintenance</span>
            <div className="card-title" style={{ fontSize: 15 }}>
              {dossier.maintenance.length} jobs
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {ongoing
                ? `${ongoing.work} · in progress`
                : planned
                  ? `next one ${jarakWaktu(planned.date)}`
                  : 'no open work'}
            </div>
          </button>

          <button
            type="button"
            className="glass card card-interactive"
            style={{ padding: 'var(--space-4)', textAlign: 'left' }}
            onClick={() => onOpen('sensors')}
          >
            <span className="card-kicker">Sensors</span>
            <div className="card-title" style={{ fontSize: 15 }}>
              {dossier.sensors.length} units
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              lowest battery{' '}
              {Math.min(...dossier.sensors.map((unit) => unit.battery))} %
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------- inspeksi */

/** Inspeksi: apa yang pernah ditemukan orang di lapangan, bukan yang terbaca sensor. */
export function InspectionPage({ bridge }: AssetPageProps) {
  const dossier = dossierFor(bridge.id);
  if (!dossier) return <NoDossier bridge={bridge} what="inspection history" />;

  const records = [...dossier.inspections].sort((a, b) => b.date.localeCompare(a.date));
  const latest = records[0];

  return (
    <div className="screen">
      <PageHeader
        kicker="Inspection history"
        title={bridge.name}
        lede="Field inspections, what they found, and the condition rating the inspector gave. A rating of 0 means no damage, 5 means out of service — the same scale is used throughout the application."
      />

      <section
        className="glass glass--chip stat-row"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          marginBottom: 'var(--space-6)',
        }}
      >
        <Stat label="Records" value={records.length} note="last four years" />
        <Stat
          label="Latest condition rating"
          value={latest.conditionValue}
          unit="/5"
          note={CONDITION_LABELS[latest.conditionValue]}
          tone={latest.conditionValue >= 3 ? 'critical' : latest.conditionValue === 2 ? 'warn' : 'accent'}
        />
        <Stat label="Inspected" value={tanggalPendek(latest.date)} note={jarakWaktu(latest.date)} />
        <Stat label="Latest type" value={latest.kind} note={latest.inspector} />
      </section>

      <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Inspector</th>
                <th className="num">Rating</th>
                <th>Findings</th>
              </tr>
            </thead>
            <tbody>
              {records.map((item) => (
                <tr key={item.date}>
                  <td className="tabular" style={{ whiteSpace: 'nowrap' }}>
                    {tanggalPendek(item.date)}
                  </td>
                  <td>
                    <span className="tag tag-outline">{item.kind}</span>
                  </td>
                  <td>{item.inspector}</td>
                  <td className="num">
                    <strong style={{ fontWeight: 600 }}>{item.conditionValue}</strong>
                  </td>
                  <td style={{ minWidth: 280, lineHeight: 1.5 }}>{item.findings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ perbaikan */

/** Perbaikan: pekerjaan yang sudah, sedang, dan akan dikerjakan di lapangan. */
export function RepairPage({ bridge }: AssetPageProps) {
  const dossier = dossierFor(bridge.id);
  if (!dossier) return <NoDossier bridge={bridge} what="maintenance records" />;

  const records = [...dossier.maintenance].sort((a, b) => b.date.localeCompare(a.date));
  const ongoing = pekerjaanBerjalan(dossier);
  const planned = pekerjaanBerikutnya(dossier);
  const total = biayaTerealisasi(dossier);

  return (
    <div className="screen">
      <PageHeader
        kicker="Repairs & maintenance"
        title={bridge.name}
        lede="Work that is finished, work in progress, and work already scheduled. The cost total covers realised work only — planned work has not necessarily been spent yet."
      />

      <section
        className="glass glass--chip stat-row"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          marginBottom: 'var(--space-6)',
        }}
      >
        <Stat label="Realised cost" value={rupiah(total)} note="last two years" />
        <Stat label="Jobs recorded" value={records.length} note={`${records.filter((r) => r.status === 'Completed').length} completed`} />
        <Stat
          label="In progress"
          value={ongoing ? 1 : 0}
          note={ongoing ? ongoing.work : 'none'}
          tone={ongoing ? 'warn' : 'default'}
        />
        <Stat
          label="Next scheduled"
          value={planned ? tanggalPendek(planned.date) : '—'}
          note={planned ? `${planned.work} · ${jarakWaktu(planned.date)}` : 'none yet'}
        />
      </section>

      <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Work</th>
                <th>Element</th>
                <th className="num">Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((item) => (
                <tr key={`${item.date}-${item.work}`}>
                  <td className="tabular" style={{ whiteSpace: 'nowrap' }}>
                    {tanggalPendek(item.date)}
                  </td>
                  <td>{item.work}</td>
                  <td className="text-muted">{item.element}</td>
                  <td className="num">{rupiah(item.cost)}</td>
                  <td>
                    <span className={statusTaken[item.status]}>{item.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- sensor */

/** Sensor: alat yang terpasang, umurnya, dan sisa dayanya. */
export function SensorPage({ bridge }: AssetPageProps) {
  const dossier = dossierFor(bridge.id);
  if (!dossier) return <NoDossier bridge={bridge} what="sensor inventory" />;

  const units = dossier.sensors;
  const lowest = units.reduce((worst, unit) => (unit.battery < worst.battery ? unit : worst), units[0]);
  const weakest = units.reduce((worst, unit) => (unit.signal < worst.signal ? unit : worst), units[0]);

  return (
    <div className="screen">
      <PageHeader
        kicker="Sensor inventory"
        title={bridge.name}
        lede="The instruments actually mounted on the structure, with their location, installation date, remaining battery, and signal quality. A channel behaving oddly is not necessarily the structure — it can just as easily be an instrument running out of power."
      />

      <section
        className="glass glass--chip stat-row"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          marginBottom: 'var(--space-6)',
        }}
      >
        <Stat label="Units installed" value={units.length} note={`${bridge.sensorCount} channels online`} />
        <Stat
          label="Lowest battery"
          value={lowest.battery}
          unit="%"
          note={`${lowest.id} · ${lowest.channel}`}
          tone={lowest.battery < 70 ? 'warn' : 'default'}
        />
        <Stat label="Weakest signal" value={weakest.signal} unit="%" note={`${weakest.id} · ${weakest.channel}`} />
        <Stat
          label="Most recent install"
          value={tanggalPendek(units.reduce((latest, unit) => (unit.installed > latest.installed ? unit : latest), units[0]).installed)}
          note="newest unit"
        />
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {units.map((unit) => (
          <div key={unit.id} className="glass card" style={{ padding: 'var(--space-3)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="card-kicker">{unit.id}</span>
              <span className="text-muted" style={{ fontSize: 11 }}>
                since {tanggalPendek(unit.installed)}
              </span>
            </div>
            <div className="card-title" style={{ fontSize: 15 }}>
              {unit.channel}
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {unit.model}
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {unit.location}
            </div>
            <div className="stack" style={{ gap: 6, marginTop: 6 }}>
              <Meter
                pct={unit.battery}
                label="Battery"
                color={unit.battery < 70 ? 'var(--state-waspada)' : 'var(--brand-400)'}
              />
              <Meter pct={unit.signal} label="Signal quality" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
