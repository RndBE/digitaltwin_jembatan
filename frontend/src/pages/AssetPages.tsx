import type { Bridge, Telemetry } from '../lib/types';
import { PageHeader, SectionTitle, Stat } from '../components/Ui';
import { Meter } from '../components/Charts';
import { clockOf } from '../components/EventLog';
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
        kicker="Aset"
        title={bridge.name}
        lede={`Aset ini adalah model acuan dan tidak memiliki ${what}. Yang tersedia untuknya adalah metadata tata kelola geometri, yang dapat dibuka di halaman Digital Twin.`}
      />
    </div>
  );
}

const statusTaken: Record<string, string> = {
  Selesai: 'tag tag-normal',
  Berjalan: 'tag tag-waspada',
  Direncanakan: 'tag tag-neutral',
};

const biayaTerealisasi = (dossier: BridgeDossier) =>
  dossier.maintenance
    .filter((item) => item.status !== 'Direncanakan')
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
export function InfoPage({ bridge, onOpen }: InfoPageProps) {
  const dossier = dossierFor(bridge.id);
  if (!dossier) return <NoDossier bridge={bridge} what="berkas teknis" />;

  const inspection = inspeksiTerakhir(dossier);
  const ongoing = pekerjaanBerjalan(dossier);
  const planned = pekerjaanBerikutnya(dossier);

  return (
    <div className="screen">
      <PageHeader
        kicker="Informasi aset"
        title={bridge.name}
        lede={
          <>
            {bridge.type} di atas {dossier.river}. {dossier.roadClass}, milik {dossier.owner}.
            Berkas ini adalah data contoh untuk keperluan peraga.
          </>
        }
      />

      <section
        className="glass glass--chip stat-row"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          marginBottom: 'var(--space-6)',
        }}
      >
        <Stat
          label="Panjang bentang"
          value={bridge.spanMeters}
          unit="m"
          note={`${bridge.lanes} lajur · lebar ${bridge.widthMeters} m`}
        />
        <Stat
          label="Tahun dibangun"
          value={bridge.builtYear}
          note={`usia ${new Date().getFullYear() - bridge.builtYear} tahun`}
        />
        <Stat
          label="Nilai kondisi"
          value={dossier.conditionValue}
          unit="/5"
          note={CONDITION_LABELS[dossier.conditionValue]}
          tone={
            dossier.conditionValue >= 3 ? 'critical' : dossier.conditionValue === 2 ? 'warn' : 'accent'
          }
        />
        <Stat
          label="Lalu lintas harian"
          value={dossier.trafficPerDay.toLocaleString('id-ID')}
          note={`${Math.round(dossier.heavyShare * 100)} % kendaraan berat`}
        />
        <Stat label="Sensor terpasang" value={dossier.sensors.length} note={`${bridge.sensorCount} kanal daring`} />
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
          <span className="card-kicker">Data teknis</span>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '7px var(--space-3)',
              fontSize: 13,
              margin: 0,
            }}
          >
            <dt className="text-muted">Koordinat</dt>
            <dd className="tabular" style={{ textAlign: 'right' }}>
              {dossier.coordinates}
            </dd>
            <dt className="text-muted">Rintangan</dt>
            <dd style={{ textAlign: 'right' }}>{dossier.river}</dd>
            <dt className="text-muted">Kelas jalan</dt>
            <dd style={{ textAlign: 'right' }}>{dossier.roadClass}</dd>
            <dt className="text-muted">Beban rencana</dt>
            <dd style={{ textAlign: 'right' }}>{dossier.designLoad}</dd>
            <dt className="text-muted">Tipe struktur</dt>
            <dd style={{ textAlign: 'right' }}>{bridge.type}</dd>
            <dt className="text-muted">Inspeksi terakhir</dt>
            <dd style={{ textAlign: 'right' }}>{tanggal(bridge.lastInspection)}</dd>
          </dl>
        </div>

        <div className="glass card" style={{ padding: 'var(--space-4)' }}>
          <span className="card-kicker">Penanggung jawab</span>
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
        <SectionTitle note="berkas terkait">Catatan lapangan</SectionTitle>
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
            <span className="card-kicker">Inspeksi</span>
            <div className="card-title" style={{ fontSize: 15 }}>
              {dossier.inspections.length} catatan
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {inspection ? `terakhir ${jarakWaktu(inspection.date)}` : 'belum ada catatan'}
            </div>
          </button>

          <button
            type="button"
            className="glass card card-interactive"
            style={{ padding: 'var(--space-4)', textAlign: 'left' }}
            onClick={() => onOpen('repair')}
          >
            <span className="card-kicker">Perbaikan</span>
            <div className="card-title" style={{ fontSize: 15 }}>
              {dossier.maintenance.length} pekerjaan
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {ongoing
                ? `${ongoing.work} · berjalan`
                : planned
                  ? `berikutnya ${jarakWaktu(planned.date)}`
                  : 'tidak ada pekerjaan terbuka'}
            </div>
          </button>

          <button
            type="button"
            className="glass card card-interactive"
            style={{ padding: 'var(--space-4)', textAlign: 'left' }}
            onClick={() => onOpen('sensors')}
          >
            <span className="card-kicker">Sensor</span>
            <div className="card-title" style={{ fontSize: 15 }}>
              {dossier.sensors.length} unit
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              baterai terendah{' '}
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
  if (!dossier) return <NoDossier bridge={bridge} what="riwayat inspeksi" />;

  const records = [...dossier.inspections].sort((a, b) => b.date.localeCompare(a.date));
  const latest = records[0];

  return (
    <div className="screen">
      <PageHeader
        kicker="Riwayat inspeksi"
        title={bridge.name}
        lede="Pemeriksaan lapangan, temuannya, dan nilai kondisi yang diberikan pemeriksa. Nilai 0 berarti tanpa kerusakan, 5 berarti tidak berfungsi — skala yang sama dipakai di seluruh aplikasi."
      />

      <section
        className="glass glass--chip stat-row"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          marginBottom: 'var(--space-6)',
        }}
      >
        <Stat label="Catatan" value={records.length} note="empat tahun terakhir" />
        <Stat
          label="Nilai kondisi terakhir"
          value={latest.conditionValue}
          unit="/5"
          note={CONDITION_LABELS[latest.conditionValue]}
          tone={latest.conditionValue >= 3 ? 'critical' : latest.conditionValue === 2 ? 'warn' : 'accent'}
        />
        <Stat label="Diperiksa" value={tanggalPendek(latest.date)} note={jarakWaktu(latest.date)} />
        <Stat label="Jenis terakhir" value={latest.kind} note={latest.inspector} />
      </section>

      <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Jenis</th>
                <th>Pemeriksa</th>
                <th className="num">Nilai</th>
                <th>Temuan</th>
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
  if (!dossier) return <NoDossier bridge={bridge} what="catatan pekerjaan pemeliharaan" />;

  const records = [...dossier.maintenance].sort((a, b) => b.date.localeCompare(a.date));
  const ongoing = pekerjaanBerjalan(dossier);
  const planned = pekerjaanBerikutnya(dossier);
  const total = biayaTerealisasi(dossier);

  return (
    <div className="screen">
      <PageHeader
        kicker="Perbaikan & pemeliharaan"
        title={bridge.name}
        lede="Pekerjaan yang sudah selesai, yang sedang berjalan, dan yang sudah dijadwalkan. Biaya yang dijumlahkan hanya pekerjaan terealisasi — yang direncanakan belum tentu terserap."
      />

      <section
        className="glass glass--chip stat-row"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          marginBottom: 'var(--space-6)',
        }}
      >
        <Stat label="Biaya terealisasi" value={rupiah(total)} note="dua tahun terakhir" />
        <Stat label="Pekerjaan tercatat" value={records.length} note={`${records.filter((r) => r.status === 'Selesai').length} selesai`} />
        <Stat
          label="Sedang berjalan"
          value={ongoing ? 1 : 0}
          note={ongoing ? ongoing.work : 'tidak ada'}
          tone={ongoing ? 'warn' : 'default'}
        />
        <Stat
          label="Terjadwal berikutnya"
          value={planned ? tanggalPendek(planned.date) : '—'}
          note={planned ? `${planned.work} · ${jarakWaktu(planned.date)}` : 'belum ada'}
        />
      </section>

      <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Pekerjaan</th>
                <th>Elemen</th>
                <th className="num">Biaya</th>
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

export interface SensorPageProps extends AssetPageProps {
  /** Jarak antar cuplikan yang sedang dipakai, dalam milidetik. */
  intervalMs?: number;
}

/** Jarak antar cuplikan, ditulis dalam satuan yang enak dibaca. */
function jarakCuplikan(ms: number): string {
  if (ms >= 60_000) return `${Math.round(ms / 60_000)} menit`;
  if (ms >= 1_000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} detik`;
  return `${ms} ms`;
}

/** Lama pemantauan berjalan, dibulatkan ke satuan yang masih terbaca sekilas. */
function lamaJalan(detik: number): string {
  if (detik >= 3600) return `${Math.floor(detik / 3600)} jam ${Math.floor((detik % 3600) / 60)} menit`;
  if (detik >= 60) return `${Math.floor(detik / 60)} menit`;
  return `${Math.round(detik)} detik`;
}

/**
 * Sensor: alat yang terpasang, umurnya, sisa dayanya, dan aliran datanya.
 *
 * Dua hal berbeda dijawab satu halaman karena keduanya menjawab pertanyaan yang
 * sama — "apakah angka di layar masih boleh dipercaya". Alat yang bagus dengan
 * paket yang berhenti masuk sama tidak berartinya dengan paket yang lancar dari
 * alat yang bateranya tinggal seperempat.
 */
export function SensorPage({ bridge, telemetry, intervalMs }: SensorPageProps) {
  const dossier = dossierFor(bridge.id);
  if (!dossier) return <NoDossier bridge={bridge} what="inventaris sensor" />;

  const units = dossier.sensors;
  const lowest = units.reduce((worst, unit) => (unit.battery < worst.battery ? unit : worst), units[0]);
  const weakest = units.reduce((worst, unit) => (unit.signal < worst.signal ? unit : worst), units[0]);

  return (
    <div className="screen">
      <PageHeader
        kicker="Inventaris sensor"
        title={bridge.name}
        lede="Alat yang benar-benar terpasang di struktur, beserta letak, umur pemasangan, sisa baterai, dan kualitas sinyalnya. Kanal yang bergerak aneh belum tentu strukturnya — bisa juga alatnya yang mulai habis daya."
      />

      <section
        className="glass glass--chip stat-row"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          marginBottom: 'var(--space-6)',
        }}
      >
        <Stat label="Unit terpasang" value={units.length} note={`${bridge.sensorCount} kanal daring`} />
        <Stat
          label="Baterai terendah"
          value={lowest.battery}
          unit="%"
          note={`${lowest.id} · ${lowest.channel}`}
          tone={lowest.battery < 70 ? 'warn' : 'default'}
        />
        <Stat label="Sinyal terlemah" value={weakest.signal} unit="%" note={`${weakest.id} · ${weakest.channel}`} />
        <Stat
          label="Pemasangan terakhir"
          value={tanggalPendek(units.reduce((latest, unit) => (unit.installed > latest.installed ? unit : latest), units[0]).installed)}
          note="unit terbaru"
        />
      </section>

      {telemetry ? (
        <>
          <SectionTitle note="cuplikan yang benar-benar sampai ke antarmuka">
            Data masuk
          </SectionTitle>
          <section
            className="glass glass--chip stat-row"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              marginBottom: 'var(--space-6)',
            }}
          >
            <Stat
              label="Paket diterima"
              value={telemetry.packets.toLocaleString('id-ID')}
              note="sejak pemantauan dimulai"
            />
            <Stat
              label="Cuplikan terakhir"
              value={clockOf(telemetry.at)}
              note={telemetry.paused ? 'aliran data dijeda' : 'aliran data berjalan'}
              tone={telemetry.paused ? 'warn' : 'default'}
            />
            <Stat
              label="Jarak cuplikan"
              value={intervalMs ? jarakCuplikan(intervalMs) : '—'}
              note={
                intervalMs && intervalMs >= 60_000 ? 'pemantauan rutin' : 'pemantauan langsung'
              }
            />
            <Stat
              label="Kanal mengirim"
              value={`${telemetry.readings.length}/${units.length}`}
              note="kanal daring terhadap unit terpasang"
              tone={telemetry.readings.length < units.length ? 'warn' : 'default'}
            />
            <Stat
              label="Lama berjalan"
              value={lamaJalan(telemetry.runtimeSeconds)}
              note="tanpa terputus"
            />
          </section>
        </>
      ) : null}

      <SectionTitle note="letak, umur pemasangan, sisa daya">Unit terpasang</SectionTitle>
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
                sejak {tanggalPendek(unit.installed)}
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
                label="Baterai"
                color={unit.battery < 70 ? 'var(--state-waspada)' : 'var(--brand-400)'}
              />
              <Meter pct={unit.signal} label="Kualitas sinyal" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
