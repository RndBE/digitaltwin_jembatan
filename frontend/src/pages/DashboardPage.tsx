import { useSyncExternalStore } from 'react';
import type { AlertEvent, Bridge, Telemetry } from '../lib/types';
import { RiskMeter } from '../components/Gauges';
import { MaintenancePanel } from '../components/MaintenancePanel';
import { EventLog } from '../components/EventLog';
import { Stat, StatusTag } from '../components/Ui';
import { AlertLadder } from '../components/AlertLadder';
import { CameraTile } from '../components/CameraTile';
import { BridgeElevation } from '../components/BridgeElevation';
import { SENSOR_BY_ID } from '../domain/sensors';
import { bridgeCondition } from '../domain/elements';
import { SCENARIOS } from '../domain/scenarios';
import {
  CONDITION_COLOR,
  CONDITION_THRESHOLDS,
  conditionStatus,
  driver,
  rollUp,
} from '../domain/condition';
import { dossierFor, inventarisNode, lalulintasPerJam } from '../domain/demoData';
import { environmentAt, keteranganAir } from '../domain/environment';
import { NOTICE_CLASS, pengumuman } from '../domain/notices';
import { langganAlarm, ringkasAlarm, versiAlarm } from '../domain/alarms';

export interface DashboardPageProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
  alerts: AlertEvent[];
  /** Kanal yang masih membawa sisa kerusakan. */
  residual: Record<string, number>;
  /** Sejak kapan tingkat siaga yang sekarang berlaku. */
  alertSince: string;
  onOpenTwin: () => void;
  onOpenCondition: () => void;
  onOpenCamera: () => void;
  onOpenScenario: () => void;
  onOpenAsset: () => void;
  onOpenEvents: () => void;
}

/**
 * Dashboard: satu layar yang menjawab tiga pertanyaan — seberapa baik
 * kondisinya, apa yang harus dilakukan, dan apa yang baru saja terjadi.
 *
 * Susunannya tiga kolom tetap, bukan kartu yang mengalir mengikuti lebar
 * layar. Bedanya bukan selera: kartu yang berpindah tempat tiap kali jendela
 * diubah memaksa operator mencari lagi kartu yang kemarin ada di sebelah
 * kanan, dan pekerjaan mencari itu terjadi justru ketika sesuatu sedang
 * berlangsung. Kolom kiri tentang **apa yang harus dilakukan**, kolom tengah
 * tentang **keadaan strukturnya**, kolom kanan tentang **apa yang baru saja
 * terjadi** — dan ketiganya tetap di sana.
 *
 * Judul halaman sengaja tidak ada. Nama jembatan, pemiliknya, dan tingkat
 * siaganya sudah berdiri di bilah atas yang tidak ikut tergulir; mengulangnya
 * di sini hanya memakan baris pertama layar, yaitu baris yang paling mahal.
 */
export function DashboardPage({
  bridge,
  telemetry,
  alerts,
  residual,
  alertSince,
  onOpenTwin,
  onOpenCondition,
  onOpenCamera,
  onOpenScenario,
  onOpenAsset,
  onOpenEvents,
}: DashboardPageProps) {
  // Keadaan alarm hidup di luar React dan diubah dari halaman Data; tanpa
  // langganan ini, lencana "belum diakui" baru menyusul pada cuplikan
  // berikutnya — satu menit kemudian, saat struktur sedang tenang.
  useSyncExternalStore(langganAlarm, versiAlarm);

  if (!telemetry) {
    return <p className="text-muted">Menyiapkan aliran telemetri…</p>;
  }

  const { assessment } = telemetry;
  const critical = assessment.status === 'KRITIS';
  const dossier = dossierFor(bridge.id);
  const warnCount = telemetry.readings.filter((r) => r.status !== 'AMAN').length;
  const residualIds = Object.keys(residual);

  /*
   * Kondisi elemen, dihitung dari cuplikan yang sama dengan yang dipakai
   * kartu-kartu lain di halaman ini.
   *
   * Indeks kesehatan menjawab "kanal sedang bagaimana"; indeks kondisi
   * menjawab "elemen mana yang paling buruk". Keduanya ditaruh berdampingan
   * karena keduanya memang sering berbeda — seluruh kanal boleh saja aman
   * sementara pelat buhul sudah berkarat sejak inspeksi tiga bulan lalu, dan
   * dashboard yang hanya menampilkan yang pertama akan menyebut jembatan itu
   * sehat.
   */
  const kondisi = bridgeCondition(telemetry.readings);
  const kondisiStatus = conditionStatus(kondisi.index);

  const deflSpec = SENSOR_BY_ID.defl;
  const defl = telemetry.readings.find((r) => r.id === 'defl');
  const deflShare = defl && deflSpec ? Math.round((defl.value / deflSpec.warn) * 100) : null;

  const angin = telemetry.readings.find((r) => r.id === 'wind');
  const suhu = telemetry.readings.find((r) => r.id === 'temp');
  const getaran = telemetry.readings.find((r) => r.id === 'vib');

  // Keadaan lingkungan mengikuti jam cuplikan, dan naik bersama skenario
  // banjir bila ada yang sedang berjalan.
  const flood = SCENARIOS[telemetry.scenario]?.environment?.flood ?? 0;
  const env = environmentAt(telemetry.at, flood);
  const lalin = lalulintasPerJam(dossier, telemetry.at);
  const nodes = inventarisNode(bridge.sensorCount, dossier);
  const notices = pengumuman({
    assessment,
    dossier,
    env,
    readings: telemetry.readings,
    nodes,
  });

  /** Skor tiap bagian struktur, dengan aturan minimum berbobot yang sama. */
  const SISTEM = ['Lantai', 'Rangka utama', 'Sambungan & ikatan', 'Tumpuan'] as const;
  const perSistem = SISTEM.map((sistem) => {
    const anggota = kondisi.structural.filter((e) => e.system === sistem);
    const skor = rollUp(anggota.map((e) => e.score));
    return { sistem, skor, terburuk: driver(anggota) };
  });

  // Dua ubin kamera, bukan seluruh dindingnya: sisanya punya ruang monitor
  // sendiri, dan dua sudah cukup untuk menjawab "yang lewat tadi apa".
  const kamera = (dossier?.cameras ?? []).filter((cam) => cam.status !== 'luring').slice(0, 2);

  // Kejadian yang lahir satu jam terakhir. Dihitung terhadap jam cuplikan,
  // bukan jam peramban, supaya angkanya tidak bergerak sendiri saat data jeda.
  const sekarang = Date.parse(telemetry.at) || Date.now();
  const barusan = alerts.filter((a) => sekarang - Date.parse(a.at) < 3_600_000).length;

  /*
   * Alarm yang belum diakui siapa pun.
   *
   * Ia mendahului pencacah "baru" pada kepala kartu, karena keduanya menjawab
   * pertanyaan yang berbeda dan hanya satu yang menuntut tindakan: "3 baru"
   * berarti tiga hal terjadi, "3 belum diakui" berarti tiga hal terjadi dan
   * tidak ada yang menyatakan melihatnya.
   */
  const alarm = ringkasAlarm(alerts);

  return (
    <div className="screen">
      {/*
        * Tajuk halaman, tidak digambar tetapi tetap ada.
        *
        * Dashboard tidak lagi memakai `PageHeader`, dan tanpa `<h1>` halaman
        * ini menjadi satu-satunya layar yang tidak punya tajuk sama sekali:
        * pembaca layar kehilangan batas dokumennya, dan tautan "Lompat ke isi"
        * mendarat di wilayah yang tidak dapat diumumkan namanya.
        */}
      <h1 className="sr-only">Dashboard kondisi · {bridge.name}</h1>

      {critical ? (
        <div
          role="alert"
          className="glass card"
          style={{
            background: 'rgb(248 113 113 / 0.14)',
            borderColor: 'rgb(248 113 113 / 0.42)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-3)',
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
            marginBottom: 'var(--space-3)',
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

      {/*
        * Enam angka utama, tiap-tiapnya beserta **penyebabnya**.
        *
        * Angka tanpa penyebab hanya memberi tahu bahwa ada yang berubah, dan
        * orang tidak dapat mengerjakan "ada yang berubah". Indeks kondisi 0,77
        * tidak menyuruh siapa pun berbuat apa-apa; indeks kondisi 0,77 yang
        * ditarik turun oleh pelat buhul menyuruh orang melihat pelat buhul.
        *
        * Tiap ubin berdiri sebagai kartunya sendiri, bukan sebagai kolom di
        * dalam satu bilah panjang: pada lebar layar apa pun ubinnya lalu
        * membungkus sebagai kesatuan, dan tidak ada angka yang tiba-tiba
        * berdiri sendirian di baris kedua tanpa labelnya.
        */}
      <section className="dash-ubin">
        <div className="glass glass--chip card">
          <Stat
            label="Indeks kesehatan"
            value={assessment.health}
            note={`${assessment.status} · kanal sekarang`}
            tone={assessment.health < 45 ? 'critical' : assessment.health < 75 ? 'warn' : 'accent'}
          />
        </div>
        <div className="glass glass--chip card">
          <Stat
            label="Indeks kondisi"
            value={kondisi.index.toFixed(2)}
            note={
              kondisi.driver ? (
                <>
                  ditarik turun oleh {kondisi.driver.name}{' '}
                  <span className="tabular">({kondisi.driver.score.toFixed(2)})</span>
                </>
              ) : (
                'sensor · inspeksi · uji'
              )
            }
            tone={
              kondisiStatus === 'tindak' ? 'critical' : kondisiStatus === 'pantau' ? 'warn' : 'accent'
            }
          />
        </div>
        <div className="glass glass--chip card">
          <Stat
            label="Lendutan tengah"
            value={defl ? defl.value.toFixed(1) : '—'}
            unit={defl ? ' mm' : ''}
            note={
              deflShare !== null && deflSpec
                ? `${deflShare} % dari ambang waspada ${deflSpec.warn} mm`
                : 'kanal tidak terbaca'
            }
            tone={
              defl?.status === 'KRITIS' ? 'critical' : defl?.status === 'WASPADA' ? 'warn' : 'default'
            }
          />
        </div>
        <div className="glass glass--chip card">
          <Stat
            label="Lalu lintas"
            value={lalin ? lalin.perHour.toLocaleString('id-ID') : '—'}
            unit={lalin ? ' kend/jam' : ''}
            note={
              lalin
                ? `${lalin.peak ? 'jam puncak' : lalin.rising ? 'sedang menanjak' : 'di luar jam puncak'} · ${telemetry.traffic.cars + telemetry.traffic.trucks} kendaraan di bentang`
                : 'berkas aset tidak memuat lalu lintas harian'
            }
          />
        </div>
        <div className="glass glass--chip card">
          <Stat
            label="Muka air"
            value={env.water.toFixed(2)}
            unit=" m"
            note={keteranganAir(env)}
            tone={env.flood > 0 ? 'warn' : 'default'}
          />
        </div>
        <div className="glass glass--chip card">
          <Stat
            label="Node daring"
            value={nodes.online}
            unit={`/${nodes.total}`}
            note={
              nodes.offline.length === 0 && nodes.lowBattery.length === 0
                ? 'seluruh simpul melapor'
                : [
                    nodes.offline.length > 0 ? `${nodes.offline.length} tidak melapor` : null,
                    nodes.lowBattery.length > 0 ? `${nodes.lowBattery.length} baterai rendah` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
            }
            tone={nodes.offline.length > 0 ? 'warn' : 'default'}
          />
        </div>
      </section>

      <section className="dash-utama">
        {/*
          * Kolom kiri: apa yang harus dilakukan.
          *
          * Tangga tingkat siaga di atas, rekomendasi pemeliharaan di bawahnya.
          * Bilah di atas layar sudah menyebut tingkat yang berlaku, tetapi ia
          * satu baris dan tidak punya ruang untuk menyebut tingkat berikutnya.
          * Kartu ini yang menyebutnya: ketiga tingkat berurutan beserta
          * kriterianya, jadi orang tahu apa yang harus terjadi supaya
          * keadaannya naik — tanpa menunggu keadaannya naik.
          */}
        <div className="dash-kolom dash-area--siaga">
          <div className="glass card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="card-kicker">Tingkat siaga</span>
              <StatusTag status={assessment.status} />
            </div>
            <AlertLadder readings={telemetry.readings} since={alertSince} />
          </div>

          <div className="glass card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="card-kicker">Rekomendasi pemeliharaan</span>
              <button type="button" className="btn btn-sm" onClick={onOpenScenario}>
                Uji skenario
              </button>
            </div>
            <RiskMeter score={assessment.risk.score} level={assessment.risk.level} />
            <div className="hairline" />
            <MaintenancePanel assessment={assessment} />
          </div>
        </div>

        {/*
          * Kolom tengah: keadaan strukturnya.
          *
          * Gambar elevasi menjawab "bagian mana" sebelum satu angka pun
          * dibaca; strip lingkungan di bawahnya menjawab "kenapa" — angin,
          * suhu, dan hujan adalah tiga hal yang paling sering menjelaskan
          * kenapa angka hari ini berbeda dari kemarin, dan ketiganya bukan
          * cacat struktur.
          */}
        <div className="dash-kolom dash-area--kondisi">
          <div className="glass card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="card-kicker">Kondisi struktur</span>
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="btn btn-sm" onClick={onOpenCondition}>
                  Kondisi elemen
                </button>
                <button type="button" className="btn btn-sm btn-primary" onClick={onOpenTwin}>
                  Buka model 3D
                </button>
              </div>
            </div>

            <div className="dash-elevasi">
              <BridgeElevation
                elements={kondisi.elements}
                panels={bridge.model.panels ?? 10}
                waterRatio={(env.water - 1) / 5.1}
                waterMetres={env.water}
                onOpen={onOpenCondition}
              />
            </div>

            <div className="dash-lingkungan">
              <Ubin label="Angin" value={angin ? angin.value.toFixed(0) : '—'} unit={angin?.unit ?? ''} />
              <Ubin label="Suhu deck" value={suhu ? suhu.value.toFixed(1) : '—'} unit={suhu?.unit ?? ''} />
              <Ubin label="Curah hujan" value={env.rain.toFixed(1)} unit="mm/j" />
              <Ubin
                label="Getaran RMS"
                value={getaran ? getaran.value.toFixed(3) : '—'}
                unit={getaran?.unit ?? ''}
              />
            </div>

            <div className="hairline" />

            {/*
              * Bagian bawah kartu: kondisi **elemen**, bukan kanal.
              *
              * Angka di ubin teratas bergerak tiap cuplikan dan turun lagi
              * begitu truk lewat; batang di bawah ini hampir tidak bergerak
              * sepanjang hari. Itu bukan kekurangan — keduanya memang menjawab
              * pertanyaan yang berbeda, dan menaruhnya dalam satu halaman justru
              * supaya selisihnya terbaca. Karat pada pelat buhul tidak akan
              * pernah muncul di indeks kesehatan, dan truk yang sedang melintas
              * tidak akan pernah muncul di batang ini.
              */}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="text-muted" style={{ fontSize: 11.5 }}>
                Indeks kondisi elemen
              </span>
              <span
                className="tabular"
                style={{ fontSize: 20, fontWeight: 650, color: CONDITION_COLOR[kondisiStatus] }}
              >
                {kondisi.index.toFixed(2)}
              </span>
            </div>

            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {perSistem.map(({ sistem, skor, terburuk }) => {
                const status = conditionStatus(skor);
                return (
                  <div className="bagian-baris" key={sistem}>
                    <span className="text-muted" style={{ fontSize: 11.5 }} title={terburuk?.name}>
                      {sistem}
                    </span>
                    <span className="bagian-rel">
                      <span
                        className="bagian-isi"
                        style={{
                          width: `${Math.round(skor * 100)}%`,
                          background: CONDITION_COLOR[status],
                        }}
                      />
                      <span
                        className="bagian-ambang"
                        style={{ left: `${CONDITION_THRESHOLDS.pantau * 100}%` }}
                      />
                      <span
                        className="bagian-ambang"
                        style={{ left: `${CONDITION_THRESHOLDS.baik * 100}%` }}
                      />
                    </span>
                    <span className="tabular" style={{ fontSize: 11.5 }}>
                      {skor.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-muted" style={{ fontSize: 11, lineHeight: 1.5, margin: 0 }}>
              Ambang <span className="tabular">0,70</span> · <span className="tabular">0,85</span> ·
              minimum berbobot
              {kondisi.driver ? (
                <>
                  {' · '}
                  <strong style={{ fontWeight: 600, color: 'var(--mist-100)' }}>
                    {kondisi.driver.name}
                  </strong>{' '}
                  <span className="tabular">({kondisi.driver.score.toFixed(2)})</span>.
                </>
              ) : null}
            </p>
          </div>

          <div className="glass card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="card-kicker">CCTV</span>
              <button type="button" className="btn btn-sm" onClick={onOpenCamera}>
                Ruang monitor
              </button>
            </div>
            {kamera.length > 0 ? (
              <div className="dash-kamera">
                {kamera.map((cam) => (
                  <CameraTile
                    key={cam.id}
                    camera={cam}
                    at={telemetry.at}
                    detection={
                      cam.channel === 'wim' && telemetry.traffic.trucks > 0
                        ? `${telemetry.traffic.trucks} truk`
                        : null
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted" style={{ fontSize: 13 }}>
                Tidak ada kamera daring.
              </p>
            )}
          </div>
          </div>

        {/* Kolom kanan: apa yang baru saja terjadi, lalu apa yang sedang berlaku. */}
        <div className="dash-kolom dash-area--kejadian">
          <div className="glass card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="card-kicker">Kejadian terbaru</span>
              <div className="row" style={{ gap: 6 }}>
                {alarm.baru > 0 ? (
                  <button
                    type="button"
                    className="tag tag-bahaya"
                    style={{ border: 0, cursor: 'pointer', font: 'inherit' }}
                    title="alarm yang belum diakui siapa pun — buka daftar kerja"
                    onClick={onOpenEvents}
                  >
                    {alarm.baru} belum diakui
                  </button>
                ) : barusan > 0 ? (
                  <span className="tag tag-brand" title="kejadian dalam satu jam terakhir">
                    {barusan} baru
                  </span>
                ) : null}
                <button type="button" className="btn btn-sm" onClick={onOpenEvents}>
                  Semua
                </button>
              </div>
            </div>
            <EventLog events={alerts} limit={12} />
          </div>
          {/*
            * Papan pengumuman.
            *
            * Log peristiwa di kolom kanan mencatat apa yang **berubah**; papan
            * ini menyatakan apa yang sedang **berlaku** — pembatasan beban,
            * pekerjaan yang sedang berjalan, cuaca yang menahan pekerjaan di
            * ketinggian. Keduanya tidak saling menggantikan: kejadian pukul
            * 14:06 sudah lewat, sedangkan pembatasan 30 ton masih mengikat
            * petugas di lapangan sampai seseorang mencabutnya.
            */}
          <div className="glass card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="card-kicker">Informasi</span>
              <button type="button" className="btn btn-sm" onClick={onOpenAsset}>
                Berkas aset
              </button>
            </div>
            {notices.length > 0 ? (
              <ul className="stack" style={{ listStyle: 'none', gap: 'var(--space-3)' }}>
                {notices.map((notice, i) => (
                  <li key={`${notice.kind}-${i}`} className="stack" style={{ gap: 4 }}>
                    <div className="row" style={{ gap: 'var(--space-2)' }}>
                      <span className={NOTICE_CLASS[notice.kind]}>{notice.kind}</span>
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        {notice.when}
                      </span>
                    </div>
                    <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{notice.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted" style={{ fontSize: 13 }}>
                Tidak ada pembatasan, pekerjaan, atau peringatan cuaca yang berlaku.
              </p>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}

/** Ubin kecil untuk strip lingkungan di bawah gambar elevasi. */
function Ubin({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="glass glass--inset dash-lingkungan-ubin">
      <span className="text-muted" style={{ fontSize: 10.5, letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span className="tabular" style={{ fontSize: 19, fontWeight: 650, lineHeight: 1.1 }}>
        {value}
        {unit ? (
          <span className="text-muted" style={{ fontSize: 11.5, fontWeight: 500, marginLeft: 4 }}>
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  );
}
