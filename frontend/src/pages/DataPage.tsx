import { useMemo, useState, useSyncExternalStore } from 'react';
import type { AlertEvent, Bridge, DataSource, Status, Telemetry } from '../lib/types';
import type { Series } from '../hooks/useTelemetry';
import {
  SENSORS,
  SENSOR_BY_ID,
  STATUS_COLOR,
  TAG_CLASS,
  formatValue,
  statusOf,
} from '../domain/sensors';
import { langganAmbang, versiAmbang } from '../domain/thresholds';
import {
  ALARM_CLASS,
  ALARM_LABEL,
  JEJAK_KATA,
  akui,
  bukaKembali,
  idAlarm,
  jamJejak,
  keadaanAlarm,
  langganAlarm,
  perluTindakan,
  petugas,
  ringkasAlarm,
  tugaskan,
  tutup,
  versiAlarm,
  type AlarmStatus,
} from '../domain/alarms';
import { PageHeader, Stat, StatusTag } from '../components/Ui';
import { Select } from '../components/Select';
import { cetakHalaman, stempelBerkas, unduhCsv, waktuBerkas, type BarisCsv } from '../lib/export';

/**
 * Data: tabel angka mentah, dengan penyaring, ringkasan, unduhan, dan cetak.
 *
 * Bagan menjawab "apakah ada yang berubah". Yang tidak dijawabnya adalah
 * "berapa persisnya, pukul berapa" — pertanyaan yang muncul begitu sebuah angka
 * harus masuk laporan, dicocokkan dengan catatan lapangan, atau dikirim ke
 * pihak ketiga. Halaman inilah jawabannya, dan karena itu tabelnya dapat
 * diunduh sebagai CSV dan dicetak apa adanya.
 *
 * Isinya jendela riwayat yang sama yang menggerakkan bagan: cuplikan terakhir
 * tiap kanal, masing-masing rerata satu menit. Tidak ada yang ditarik ulang
 * dari server, jadi halaman ini tetap berisi walau API tidak tersedia.
 */

type Periode = 'semua' | '30m' | '1j' | '3j';
type Tab = 'cuplikan' | 'kejadian';

const PERIODE: Array<{ value: Periode; label: string; ms: number }> = [
  { value: '30m', label: '30 menit terakhir', ms: 30 * 60_000 },
  { value: '1j', label: '1 jam terakhir', ms: 60 * 60_000 },
  { value: '3j', label: '3 jam terakhir', ms: 3 * 60 * 60_000 },
  { value: 'semua', label: 'Seluruh jendela riwayat', ms: Number.POSITIVE_INFINITY },
];

const TINGKAT: Status[] = ['AMAN', 'WASPADA', 'KRITIS'];

/**
 * `19/09/2026 14:35:07` — tanggal ikut ditulis karena jendelanya melewati
 * tengah malam.
 *
 * Milidetik hanya muncul saat cuplikannya memang datang lebih rapat dari satu
 * detik. Pada pemantauan langsung lima baris berturut-turut jatuh pada detik
 * yang sama, dan tabel yang menuliskannya sama persis terbaca seperti data yang
 * tergandakan — padahal isinya lima cuplikan yang berbeda.
 */
function waktuPenuh(ms: number, milidetik = false): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  const jam = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  const sisa = milidetik ? `,${String(d.getMilliseconds()).padStart(3, '0')}` : '';
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${jam}${sisa}`;
}

interface Baris {
  t: number;
  nilai: Record<string, number>;
  dasar: Record<string, number>;
}

/**
 * Lama sebuah rentang, ditulis dalam satuan yang masih terbaca sekilas.
 *
 * Ini yang membuat penyaring periode dapat dipercaya. Jendela riwayat berisi
 * 180 cuplikan, dan pada pemantauan langsung seluruhnya berumur setengah menit
 * — memilih "1 jam terakhir" lalu membaca "180 baris" membuat orang menyangka
 * ia sedang melihat satu jam data. Rentang sebenarnya karena itu selalu ikut
 * ditulis, di sebelah periode yang diminta.
 */
function lamaRentang(ms: number): string {
  if (ms < 1000) return 'kurang dari 1 detik';
  const detik = Math.round(ms / 1000);
  if (detik < 90) return `${detik} detik`;
  const menit = Math.round(detik / 60);
  if (menit < 90) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa ? `${jam} jam ${sisa} menit` : `${jam} jam`;
}

function ringkas(values: number[]) {
  if (values.length === 0) return { min: 0, avg: 0, max: 0 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
  };
}

/**
 * Keterangan warna.
 *
 * Tabel penuh angka yang sebagian berwarna menuntut pembacanya menebak aturan
 * warnanya, dan tebakannya berbeda-beda: sebagian mengira warna menandai nilai
 * tertinggi, sebagian mengira nilai yang berubah. Aturannya cuma satu — warna
 * muncul saat nilainya melewati ambang — dan lebih murah menuliskannya daripada
 * membiarkan delapan lajur angka menjelaskannya sendiri.
 */
function Legenda() {
  const butir: Array<{ warna: string; label: string }> = [
    { warna: 'var(--mist-200)', label: 'aman' },
    { warna: 'var(--state-waspada)', label: 'waspada' },
    { warna: 'var(--state-bahaya)', label: 'kritis' },
  ];
  return (
    <span className="row" style={{ gap: 'var(--space-3)', fontSize: 11 }}>
      <span className="text-muted">Warna nilai:</span>
      {butir.map((b) => (
        <span key={b.label} className="row" style={{ gap: 5 }}>
          <span
            aria-hidden="true"
            style={{ width: 7, height: 7, borderRadius: '50%', background: b.warna, flex: 'none' }}
          />
          <span className="text-muted">{b.label}</span>
        </span>
      ))}
    </span>
  );
}

export interface DataPageProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
  series: Record<string, Series>;
  alerts: AlertEvent[];
  source: DataSource;
  intervalMs: number;
}

export function DataPage({ bridge, telemetry, series, alerts, source, intervalMs }: DataPageProps) {
  const [tab, setTab] = useState<Tab>('cuplikan');
  const [periode, setPeriode] = useState<Periode>('1j');
  const [kanal, setKanal] = useState<string>('semua');
  const [tingkat, setTingkat] = useState<string>('semua');
  const [batas, setBatas] = useState(60);
  /** Penyaring siklus alarm, terpisah dari penyaring tingkat. */
  const [saringan, setSaringan] = useState<string>('semua');
  /** Alarm yang barisnya sedang dibuka untuk melihat jejak dan menutupnya. */
  const [dibuka, setDibuka] = useState<string | null>(null);
  const [catatan, setCatatan] = useState('');
  const nama = petugas();

  // Ambang dapat diubah di halaman Tingkat siaga. Tanpa langganan ini, warna
  // sel tabel baru ikut berubah pada cuplikan berikutnya — satu menit
  // sesudahnya, ketika struktur sedang tenang.
  useSyncExternalStore(langganAmbang, versiAmbang);
  // Keadaan alarm hidup di luar React — diubah oleh tombol di halaman ini dan
  // dibaca juga oleh dashboard. Tanpa langganan ini, menekan "Akui" tidak
  // mengubah apa pun di layar sampai cuplikan berikutnya datang.
  useSyncExternalStore(langganAlarm, versiAlarm);

  // Deret disalin menjadi baris sekali per pembaruan, bukan dibaca ulang tiap
  // sel: tabel penuh berisi 180 baris kali delapan kanal.
  const semuaBaris = useMemo<Baris[]>(() => {
    const entri = SENSORS.map((s) => ({ id: s.id, deret: series[s.id] })).filter(
      (e): e is { id: string; deret: Series } => Boolean(e.deret?.times?.length),
    );
    if (entri.length === 0) return [];

    const n = Math.min(...entri.map((e) => Math.min(e.deret.times.length, e.deret.values.length)));
    const acuan = entri[0].deret;
    const hasil: Baris[] = [];

    // Dari yang terbaru ke yang terlama: itu urutan yang dibaca operator, dan
    // juga urutan yang benar ketika tabelnya dipotong oleh batas tampil.
    for (let i = n - 1; i >= 0; i--) {
      const nilai: Record<string, number> = {};
      const dasar: Record<string, number> = {};
      entri.forEach(({ id, deret }) => {
        nilai[id] = deret.values[deret.values.length - n + i];
        dasar[id] = deret.baseline[deret.baseline.length - n + i];
      });
      hasil.push({ t: acuan.times[acuan.times.length - n + i], nilai, dasar });
    }
    return hasil;
  }, [series]);

  const rentang = PERIODE.find((p) => p.value === periode) ?? PERIODE[1];

  // Titik acuan penyaring adalah cuplikan terbaru, bukan jam dinding. Jendela
  // riwayat berisi 180 cuplikan berapa pun lajunya, dan pada pemantauan
  // langsung seluruhnya berumur kurang dari satu menit — diukur terhadap jam
  // dinding, "30 menit terakhir" selalu berisi seluruh tabel.
  const terbaru = semuaBaris[0]?.t ?? Date.now();
  const tersaring = useMemo(
    () => semuaBaris.filter((b) => terbaru - b.t <= rentang.ms),
    [semuaBaris, terbaru, rentang.ms],
  );

  const kanalTampil = kanal === 'semua' ? SENSORS : SENSORS.filter((s) => s.id === kanal);
  const terlihat = tersaring.slice(0, batas);
  const satu = kanal === 'semua' ? null : (kanalTampil[0] ?? null);
  /** Pada laju di bawah satu detik, jam tanpa milidetik tidak lagi membedakan baris. */
  const rapat = intervalMs < 1000;

  // Rentang yang benar-benar termuat tabel, bukan rentang yang diminta.
  const awal = tersaring.length ? tersaring[tersaring.length - 1].t : 0;
  const akhir = tersaring.length ? tersaring[0].t : 0;
  const lama = akhir - awal;
  /** Jendela riwayat habis sebelum periode yang diminta tercapai. */
  const jendelaHabis = tersaring.length === semuaBaris.length && lama < rentang.ms;

  const ringkasan = ringkasAlarm(alerts);

  const kejadian = useMemo(() => {
    const perTingkat = tingkat === 'semua' ? alerts : alerts.filter((a) => a.level === tingkat);
    if (saringan === 'semua') return perTingkat;
    return perTingkat.filter((e) => {
      if (!perluTindakan(e)) return false;
      const status = keadaanAlarm(e).status;
      if (saringan === 'baru') return status === 'baru';
      if (saringan === 'terbuka') return status !== 'ditutup';
      return status === 'ditutup';
    });
    // `versiAlarm()` ikut jadi pemicu: menutup satu alarm mengubah isi daftar
    // ketika penyaringnya sedang "belum ditutup".
  }, [alerts, tingkat, saringan, versiAlarm()]);

  const unduhCuplikan = () => {
    const kepala: BarisCsv = [
      'Waktu',
      ...kanalTampil.map((s) => `${s.name} (${s.unit})`),
      ...(satu ? ['Garis dasar', 'Status'] : []),
    ];
    const isi: BarisCsv[] = tersaring.map((b) => [
      waktuBerkas(b.t, rapat),
      ...kanalTampil.map((s) => Number(b.nilai[s.id].toFixed(s.dec))),
      ...(satu ? [Number(b.dasar[satu.id].toFixed(satu.dec)), statusOf(satu, b.nilai[satu.id])] : []),
    ]);

    unduhCsv(`data-telemetri_${bridge.id}${satu ? `_${satu.id}` : ''}_${stempelBerkas()}`, [
      ['Aset', bridge.name],
      ['Lokasi', bridge.location],
      ['Periode', rentang.label],
      ['Cuplikan', `${tersaring.length} baris · tiap baris rerata satu menit`],
      ['Sumber', source === 'api' ? 'API digital twin' : 'mesin simulasi di peramban'],
      ['Diunduh', waktuBerkas(Date.now())],
      [],
      kepala,
      ...isi,
    ]);
  };

  /*
   * Unduhan kejadian membawa **siklusnya**, bukan hanya barisnya.
   *
   * Berkas yang dilampirkan ke laporan bulanan harus dapat menjawab
   * pertanyaan yang sama dengan layarnya: berapa alarm yang terjadi, berapa
   * yang diakui, siapa yang menutupnya, dan apa yang dikerjakan. Log tanpa
   * kolom itu hanya membuktikan bahwa alatnya berbunyi.
   */
  const unduhKejadian = () => {
    unduhCsv(`log-kejadian_${bridge.id}_${stempelBerkas()}`, [
      ['Aset', bridge.name],
      ['Tingkat', tingkat === 'semua' ? 'seluruh tingkat' : tingkat],
      ['Siklus', saringan === 'semua' ? 'seluruh keadaan' : saringan],
      ['Belum diakui', ringkasan.baru],
      ['Terbuka', ringkasan.terbuka],
      ['Ditutup', ringkasan.ditutup],
      ['Diunduh', waktuBerkas(Date.now())],
      [],
      ['Waktu', 'Tingkat', 'Kanal', 'Keterangan', 'Siklus', 'Pemilik', 'Diakui', 'Ditutup', 'Catatan tindakan'],
      ...kejadian.map((e): BarisCsv => {
        const keadaan = keadaanAlarm(e);
        const diakui = keadaan.jejak.find((j) => j.aksi === 'akui');
        const ditutup = [...keadaan.jejak].reverse().find((j) => j.aksi === 'tutup');
        return [
          waktuBerkas(Date.parse(e.at)),
          e.level,
          e.sensorId ? (SENSOR_BY_ID[e.sensorId]?.name ?? e.sensorId) : 'sistem',
          e.text,
          perluTindakan(e) ? ALARM_LABEL[keadaan.status] : 'kabar',
          keadaan.pemilik ?? '',
          diakui ? `${waktuBerkas(Date.parse(diakui.at))} · ${diakui.oleh}` : '',
          ditutup ? `${waktuBerkas(Date.parse(ditutup.at))} · ${ditutup.oleh}` : '',
          ditutup?.catatan ?? '',
        ];
      }),
    ]);
  };

  if (!telemetry) return <p className="text-muted">Menyiapkan data…</p>;

  // Dinilai ulang dengan ambang yang sedang berlaku, bukan dengan status yang
  // ikut dibawa cuplikan: ambang yang baru diubah di halaman Tingkat siaga
  // harus terbaca di sini sekarang, bukan satu menit lagi.
  const lewat = telemetry.readings
    .map((r) => (SENSOR_BY_ID[r.id] ? statusOf(SENSOR_BY_ID[r.id], r.value) : 'AMAN'))
    .filter((s) => s !== 'AMAN');

  return (
    <div className="screen">

      <PageHeader
        kicker="Pemantauan"
        title="Data telemetri"
        lede={
          <>
            Angka mentah di balik seluruh bagan. <strong>Satu baris = satu cuplikan</strong>, terbaru
            di atas; <strong>satu lajur = satu kanal ukur</strong>. Nilainya bukan bacaan sesaat
            melainkan <strong>rerata satu menit</strong>, sama seperti yang dikirim alat ukur di
            lapangan. Delapan kanal di sini adalah parameter yang diukur — jumlah alat yang
            memasoknya ada di halaman Sensor. Tombol <strong>Unduh CSV</strong> dan{' '}
            <strong>Cetak</strong> mengambil seluruh baris yang sedang tersaring, bukan hanya yang
            terlihat di layar.
          </>
        }
        actions={
          <div className="row d-print-none" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={tab === 'cuplikan' ? unduhCuplikan : unduhKejadian}
            >
              Unduh CSV
            </button>
            <button type="button" className="btn btn-sm" onClick={cetakHalaman}>
              Cetak
            </button>
          </div>
        }
        leading={
          <div className="tabs d-print-none" role="tablist" aria-label="Jenis data">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'cuplikan'}
              className={tab === 'cuplikan' ? 'tab tab--active' : 'tab'}
              onClick={() => setTab('cuplikan')}
            >
              Cuplikan sensor
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'kejadian'}
              className={tab === 'kejadian' ? 'tab tab--active' : 'tab'}
              onClick={() => setTab('kejadian')}
            >
              Log kejadian
            </button>
          </div>
        }
      />

      {tab === 'cuplikan' ? (
        <>
          <div className="glass glass--chip toolbar d-print-none">
            <div className="field" style={{ minWidth: 210 }}>
              <label htmlFor="pilih-periode" id="label-periode">
                Periode
              </label>
              <Select
                id="pilih-periode"
                aria-labelledby="label-periode"
                value={periode}
                onChange={(v) => setPeriode(v as Periode)}
                groups={[{ options: PERIODE.map((p) => ({ value: p.value, label: p.label })) }]}
              />
            </div>

            <div className="field" style={{ minWidth: 210 }}>
              <label htmlFor="pilih-kanal" id="label-kanal">
                Kanal
              </label>
              <Select
                id="pilih-kanal"
                aria-labelledby="label-kanal"
                value={kanal}
                onChange={setKanal}
                groups={[
                  {
                    options: [
                      { value: 'semua', label: 'Seluruh kanal' },
                      ...SENSORS.map((s) => ({ value: s.id, label: `${s.name} (${s.unit})` })),
                    ],
                  },
                ]}
              />
            </div>

            <span className="text-muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
              Menampilkan {terlihat.length} dari {tersaring.length} baris
            </span>
          </div>

          {/*
            * Peringatan ini yang membuat penyaring periode jujur. Jendela
            * riwayat panjangnya tetap 180 cuplikan, jadi periode yang lebih
            * panjang dari isi jendela tidak menambah satu baris pun — dan
            * tanpa kalimat ini, tabel berisi setengah menit data terbaca
            * seolah berisi satu jam.
            */}
          {jendelaHabis ? (
            <p
              className="text-muted"
              style={{ fontSize: 12, marginTop: 'calc(var(--space-4) * -1 + 4px)', marginBottom: 'var(--space-4)' }}
            >
              Jendela hanya memuat {semuaBaris.length} cuplikan · {lamaRentang(lama)}, lebih
              pendek daripada {rentang.label.toLowerCase()}.
            </p>
          ) : null}

          <section
            className="glass glass--chip stat-row"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              marginBottom: 'var(--space-4)',
            }}
          >
            <Stat
              label="Cuplikan di tabel"
              value={tersaring.length}
              unit="baris"
              note="satu baris = satu cuplikan"
            />
            <Stat
              label="Rentang waktu tabel"
              value={tersaring.length ? lamaRentang(lama) : '—'}
              note={
                tersaring.length
                  ? `${waktuPenuh(awal).slice(11, 19)} – ${waktuPenuh(akhir).slice(11, 19)}`
                  : 'belum ada cuplikan'
              }
              tone={jendelaHabis ? 'warn' : 'default'}
            />
            <Stat
              label="Cuplikan terakhir masuk"
              value={semuaBaris.length ? waktuPenuh(semuaBaris[0].t).slice(11, 19) : '—'}
              note={
                semuaBaris.length
                  ? `${waktuPenuh(semuaBaris[0].t).slice(0, 10)} · tiap ${
                      intervalMs >= 60_000 ? `${Math.round(intervalMs / 60_000)} menit` : `${intervalMs} ms`
                    }`
                  : 'belum ada data'
              }
            />
            <Stat
              label="Kanal melewati ambang"
              value={`${lewat.length} dari ${telemetry.readings.length}`}
              note={lewat.length ? 'lihat lajur berwarna di tabel' : 'seluruh kanal di bawah ambang waspada'}
              tone={lewat.some((s) => s === 'KRITIS') ? 'critical' : lewat.length ? 'warn' : 'default'}
            />
          </section>

          <div
            className="glass card"
            style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-4)' }}
          >
            <div className="card-head">
              <span className="card-kicker">Ringkasan per kanal</span>
              <span className="text-muted" style={{ fontSize: 11 }}>
                {tersaring.length} cuplikan
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Titik ukur</th>
                    <th className="num">Min</th>
                    <th className="num">Rerata</th>
                    <th className="num">Maks</th>
                    <th className="num">Nilai terakhir</th>
                    <th className="num">Ambang waspada</th>
                    <th className="num">Ambang kritis</th>
                    <th>Status terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {kanalTampil.map((spec) => {
                    const nilai = tersaring.map((b) => b.nilai[spec.id]);
                    const stat = ringkas(nilai);
                    const terakhir = nilai[0] ?? 0;
                    const status = statusOf(spec, terakhir);
                    return (
                      <tr key={spec.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {spec.name}{' '}
                          <span className="text-muted" style={{ fontSize: 11 }}>
                            ({spec.unit})
                          </span>
                        </td>
                        <td className="text-muted">{spec.node}</td>
                        <td className="num">{formatValue(spec, stat.min)}</td>
                        <td className="num">{formatValue(spec, stat.avg)}</td>
                        <td className="num">{formatValue(spec, stat.max)}</td>
                        {/* Warna dipakai dengan aturan yang sama di seluruh
                            halaman: hanya nilai yang sudah melewati ambang
                            yang berwarna. Angka aman yang ikut diwarnai
                            membuat warna berhenti berarti apa-apa. */}
                        <td
                          className="num"
                          style={{ color: status === 'AMAN' ? undefined : STATUS_COLOR[status] }}
                        >
                          {formatValue(spec, terakhir)}
                        </td>
                        <td className="num text-muted">{formatValue(spec, spec.warn)}</td>
                        <td className="num text-muted">{formatValue(spec, spec.crit)}</td>
                        <td>
                          <StatusTag status={status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="card-head">
              <span className="card-kicker">Cuplikan sensor</span>
              <Legenda />
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '62vh' }}>
              <table className="table table--sticky">
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>Waktu</th>
                    {kanalTampil.map((spec) => (
                      <th key={spec.id} className="num" style={{ whiteSpace: 'nowrap' }}>
                        {spec.name}
                        {/* Satuan tidak ikut dibesarkan hurufnya: `µm/m` yang
                            ditulis `ΜM/M` bukan lagi satuan yang sama. */}
                        <span className="satuan text-muted" style={{ fontWeight: 400 }}>
                          {' '}
                          ({spec.unit})
                        </span>
                      </th>
                    ))}
                    {satu ? (
                      <>
                        <th className="num">Garis dasar</th>
                        <th className="num">Selisih</th>
                        <th>Status</th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {terlihat.map((b, i) => (
                    // Dua cuplikan dapat jatuh pada milidetik yang sama saat
                    // laju penuh; nomor urutnya yang memisahkan barisnya.
                    <tr key={`${b.t}-${i}`}>
                      <td className="tabular" style={{ whiteSpace: 'nowrap' }}>
                        {waktuPenuh(b.t, rapat)}
                      </td>
                      {kanalTampil.map((spec) => {
                        const nilai = b.nilai[spec.id];
                        const status = statusOf(spec, nilai);
                        return (
                          <td
                            key={spec.id}
                            className="num"
                            style={{ color: status === 'AMAN' ? undefined : STATUS_COLOR[status] }}
                          >
                            {formatValue(spec, nilai)}
                          </td>
                        );
                      })}
                      {satu ? (
                        <>
                          <td className="num text-muted">{formatValue(satu, b.dasar[satu.id])}</td>
                          <td className="num">
                            {b.dasar[satu.id]
                              ? `${(((b.nilai[satu.id] - b.dasar[satu.id]) / b.dasar[satu.id]) * 100).toFixed(1)} %`
                              : '—'}
                          </td>
                          <td>
                            <span className={TAG_CLASS[statusOf(satu, b.nilai[satu.id])]}>
                              {statusOf(satu, b.nilai[satu.id])}
                            </span>
                          </td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                  {terlihat.length === 0 ? (
                    <tr>
                      <td colSpan={kanalTampil.length + (satu ? 4 : 1)} className="text-muted">
                        Belum ada cuplikan pada periode ini.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {tersaring.length > terlihat.length ? (
              <div className="card-foot d-print-none">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setBatas(tersaring.length)}
                >
                  Tampilkan seluruh {tersaring.length} baris
                </button>
              </div>
            ) : null}
          </div>

          <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-4)' }}>
            CSV: pemisah titik koma, desimal koma · jendela {semuaBaris.length} cuplikan terakhir.
          </p>
        </>
      ) : (
        <>
          <div className="glass glass--chip toolbar d-print-none">
            <div className="field" style={{ minWidth: 210 }}>
              <label htmlFor="pilih-tingkat" id="label-tingkat">
                Tingkat
              </label>
              <Select
                id="pilih-tingkat"
                aria-labelledby="label-tingkat"
                value={tingkat}
                onChange={setTingkat}
                groups={[
                  {
                    options: [
                      { value: 'semua', label: 'Seluruh tingkat' },
                      ...TINGKAT.map((t) => ({ value: t, label: t })),
                    ],
                  },
                ]}
              />
            </div>
            <div className="field" style={{ minWidth: 210 }}>
              <label htmlFor="pilih-siklus" id="label-siklus">
                Siklus alarm
              </label>
              <Select
                id="pilih-siklus"
                aria-labelledby="label-siklus"
                value={saringan}
                onChange={setSaringan}
                groups={[
                  {
                    options: [
                      { value: 'semua', label: 'Seluruh kejadian' },
                      { value: 'baru', label: `Belum diakui (${ringkasan.baru})` },
                      { value: 'terbuka', label: `Belum ditutup (${ringkasan.baru + ringkasan.terbuka})` },
                      { value: 'ditutup', label: `Sudah ditutup (${ringkasan.ditutup})` },
                    ],
                  },
                ]}
              />
            </div>

            {/* Nama yang tercatat pada tiap pengakuan: pengguna yang sedang masuk. */}
            <span className="text-muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
              Petugas jaga <strong style={{ color: 'var(--mist-100)' }}>{nama}</strong> ·{' '}
              {kejadian.length} kejadian tercatat
            </span>
          </div>

          {/*
            * Papan siklus.
            *
            * Angka pertama yang dicari orang ketika membuka layar ini bukan
            * "berapa kejadian" melainkan "berapa yang belum disentuh". Tiga
            * angka ini yang menjawabnya, dan yang berwarna merah hanya yang
            * memang menuntut tindakan malam ini.
            */}
          <section
            className="glass glass--chip stat-row"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
          >
            <Stat
              label="Belum diakui"
              value={ringkasan.baru}
              note={ringkasan.baru > 0 ? 'belum ada yang menyatakan melihat' : 'seluruhnya sudah dilihat'}
              tone={ringkasan.baru > 0 ? 'critical' : 'default'}
            />
            <Stat
              label="Terbuka"
              value={ringkasan.terbuka}
              note="sudah diakui atau ditugaskan, belum ditutup"
              tone={ringkasan.terbuka > 0 ? 'warn' : 'default'}
            />
            <Stat label="Ditutup" value={ringkasan.ditutup} note="dengan catatan tindakan" />
            <Stat
              label="Kritis terbuka"
              value={ringkasan.kritisTerbuka}
              note={ringkasan.kritisTerbuka > 0 ? 'alarm kritis belum ditutup' : 'tidak ada'}
              tone={ringkasan.kritisTerbuka > 0 ? 'critical' : 'default'}
            />
          </section>

          <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="card-head">
              <span className="card-kicker">Log kejadian</span>
              <span className="text-muted" style={{ fontSize: 11 }}>
                perpindahan status kanal dan perintah skenario
              </span>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '62vh' }}>
              <table className="table table--sticky">
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>Waktu</th>
                    <th>Tingkat</th>
                    <th>Kanal</th>
                    <th>Keterangan</th>
                    <th>Siklus</th>
                    <th className="d-print-none">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {kejadian.map((e, i) => {
                    const id = idAlarm(e);
                    const alarm = perluTindakan(e);
                    const keadaan = keadaanAlarm(e);
                    const status: AlarmStatus = keadaan.status;
                    const buka = dibuka === id;

                    return [
                      <tr key={`${e.at}-${i}`}>
                        <td className="tabular" style={{ whiteSpace: 'nowrap' }}>
                          {waktuPenuh(Date.parse(e.at))}
                        </td>
                        <td>
                          <span className={TAG_CLASS[e.level]}>{e.level}</span>
                        </td>
                        <td className="text-muted">
                          {e.sensorId ? (SENSOR_BY_ID[e.sensorId]?.name ?? e.sensorId) : 'sistem'}
                        </td>
                        <td>{e.text}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {alarm ? (
                            <>
                              <span className={ALARM_CLASS[status]}>{ALARM_LABEL[status]}</span>
                              {keadaan.pemilik ? (
                                <span className="text-muted" style={{ fontSize: 11, marginLeft: 6 }}>
                                  {keadaan.pemilik}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-muted" style={{ fontSize: 11 }}>
                              kabar
                            </span>
                          )}
                        </td>
                        <td className="d-print-none" style={{ whiteSpace: 'nowrap' }}>
                          {alarm ? (
                            <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                              {status === 'baru' ? (
                                <button type="button" className="btn btn-sm" onClick={() => akui(e, nama)}>
                                  Akui
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost"
                                aria-expanded={buka}
                                onClick={() => {
                                  setDibuka(buka ? null : id);
                                  setCatatan('');
                                }}
                              >
                                {buka
                                  ? 'Tutup rincian'
                                  : `Rincian${keadaan.jejak.length ? ` (${keadaan.jejak.length})` : ''}`}
                              </button>
                            </span>
                          ) : null}
                        </td>
                      </tr>,
                      /*
                       * Baris rincian: jejak yang sudah terjadi, lalu tindakan
                       * berikutnya. Jejaknya di atas dengan sengaja — sebelum
                       * menutup sebuah alarm, yang pertama perlu dibaca adalah
                       * apa yang sudah dikerjakan orang sebelumnya.
                       */
                      buka ? (
                        <tr key={`${e.at}-${i}-rinci`}>
                          <td colSpan={6} style={{ background: 'rgb(255 255 255 / 0.03)' }}>
                            <div className="stack" style={{ gap: 'var(--space-2)' }}>
                              {keadaan.jejak.length ? (
                                <ul className="stack" style={{ listStyle: 'none', gap: 4, fontSize: 12 }}>
                                  {keadaan.jejak.map((j, n) => (
                                    <li key={n} className="row" style={{ gap: 8 }}>
                                      <span className="text-muted tabular" style={{ fontSize: 11 }}>
                                        {jamJejak(j.at)}
                                      </span>
                                      <span>
                                        {JEJAK_KATA[j.aksi]}{' '}
                                        {j.aksi === 'tugaskan' ? (
                                          <strong style={{ fontWeight: 600 }}>{j.catatan}</strong>
                                        ) : null}{' '}
                                        oleh <strong style={{ fontWeight: 600 }}>{j.oleh}</strong>
                                        {j.aksi !== 'tugaskan' && j.catatan ? ` — ${j.catatan}` : ''}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-muted" style={{ fontSize: 12 }}>
                                  Belum ada tindakan tercatat pada alarm ini.
                                </span>
                              )}

                              <div className="row" style={{ gap: 'var(--space-2)' }}>
                                <input
                                  className="input"
                                  style={{ flex: '1 1 260px' }}
                                  value={catatan}
                                  onChange={(event) => setCatatan(event.target.value)}
                                  placeholder={
                                    status === 'ditutup'
                                      ? 'Alasan dibuka kembali'
                                      : 'Catatan tindakan, atau nama petugas yang ditugaskan'
                                  }
                                />
                                {status === 'ditutup' ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => {
                                      bukaKembali(e, catatan, nama);
                                      setCatatan('');
                                    }}
                                  >
                                    Buka kembali
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      disabled={!catatan.trim()}
                                      onClick={() => {
                                        tugaskan(e, catatan, nama);
                                        setCatatan('');
                                      }}
                                    >
                                      Tugaskan
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-primary"
                                      disabled={!catatan.trim()}
                                      title={
                                        catatan.trim()
                                          ? undefined
                                          : 'Catatan tindakan wajib diisi sebelum alarm ditutup'
                                      }
                                      onClick={() => {
                                        if (tutup(e, catatan, nama)) {
                                          setCatatan('');
                                          setDibuka(null);
                                        }
                                      }}
                                    >
                                      Tutup alarm
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })}
                  {kejadian.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted">
                        Belum ada kejadian yang cocok dengan penyaring ini.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <p
            className="text-muted"
            style={{ fontSize: 12, marginTop: 'var(--space-4)', maxWidth: '78ch' }}
          >
            40 kejadian terakhir · perpindahan status kanal, skenario, dan perbaikan.
          </p>
        </>
      )}
    </div>
  );
}
