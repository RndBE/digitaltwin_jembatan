import { useState, useSyncExternalStore } from 'react';
import type { Bridge, DataSource, SensorSpec, Telemetry } from '../lib/types';
import { SENSORS, STATUS_COLOR, formatValue, statusOf } from '../domain/sensors';
import {
  AMBANG_BAWAAN,
  diubah,
  jumlahDiubah,
  langganAmbang,
  resetAmbang,
  setAmbang,
  versiAmbang,
} from '../domain/thresholds';
import { ALERT_RULES, activeRule, jamSejak, lamaSejak } from '../domain/alertRules';
import { PageHeader, SectionTitle, Stat, StatusTag } from '../components/Ui';
import { Modal } from '../components/Modal';
import { cetakHalaman, stempelBerkas, unduhCsv, waktuBerkas, type BarisCsv } from '../lib/export';

/**
 * Tingkat siaga: ambang batas tiap parameter, dan tempat mengubahnya.
 *
 * Ambang adalah satu-satunya angka di seluruh sistem yang tidak datang dari
 * alat ukur — ia keputusan orang. Selama angka itu tertanam di dalam kode,
 * status "waspada" pada layar tidak dapat ditelusuri oleh orang yang harus
 * menandatanganinya. Halaman ini memunculkannya: berapa batasnya sekarang,
 * berapa bawaannya, siapa yang mengubahnya menjadi berapa, dan bagaimana
 * mengembalikannya.
 *
 * Batas yang perlu dinyatakan terang-terangan: perubahan di sini berlaku untuk
 * peramban ini. Pada mode API status tiap pembacaan dihitung server dengan
 * ambangnya sendiri, dan yang berubah di sini hanya penilaian yang dilakukan
 * antarmuka — termasuk warna sel pada halaman Data dan garis ambang pada bagan.
 */

/** Satu pita status, ditulis sebagai selang yang benar-benar dipakai `statusOf`. */
function pita(spec: SensorSpec) {
  return [
    { label: 'Aman', teks: `< ${formatValue(spec, spec.warn)}`, kelas: 'tag tag-normal' },
    {
      label: 'Waspada',
      teks: `${formatValue(spec, spec.warn)} – ${formatValue(spec, spec.crit)}`,
      kelas: 'tag tag-waspada',
    },
    { label: 'Kritis', teks: `≥ ${formatValue(spec, spec.crit)}`, kelas: 'tag tag-bahaya' },
  ];
}

interface Draf {
  warn: string;
  crit: string;
}

export interface ThresholdPageProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
  source: DataSource;
  /** Sejak kapan tingkat siaga yang sekarang berlaku. */
  alertSince: string;
}

export function ThresholdPage({ bridge, telemetry, source, alertSince }: ThresholdPageProps) {
  const [sunting, setSunting] = useState<string | null>(null);
  const [draf, setDraf] = useState<Draf>({ warn: '', crit: '' });
  const [galat, setGalat] = useState<string | null>(null);

  // Ambang disimpan di luar React — ia dibaca mesin simulasi tiap langkah, jauh
  // dari pohon komponen. Langganan inilah yang membuat tabel ikut berubah.
  useSyncExternalStore(langganAmbang, versiAmbang);

  const berubah = jumlahDiubah();

  /**
   * Status dihitung ulang di sini, bukan dibaca dari `reading.status`.
   *
   * Nilai yang dibawa cuplikan sudah dinilai saat ia dibuat — pada pemantauan
   * rutin, satu menit sebelum ambangnya diubah. Angka yang baru saja diketik
   * operator harus terlihat akibatnya seketika, bukan pada cuplikan berikutnya.
   */
  const berlaku = activeRule(telemetry?.readings ?? []);

  const lewat = (telemetry?.readings ?? [])
    .map((r) => {
      const spec = SENSORS.find((s) => s.id === r.id);
      return spec ? statusOf(spec, r.value) : 'AMAN';
    })
    .filter((s) => s !== 'AMAN');

  /** Kanal yang jendelanya sedang terbuka; `null` berarti tidak ada. */
  const specSunting = sunting ? (SENSORS.find((item) => item.id === sunting) ?? null) : null;

  const mulaiSunting = (spec: SensorSpec) => {
    setSunting(spec.id);
    setDraf({ warn: String(spec.warn), crit: String(spec.crit) });
    setGalat(null);
  };

  const batal = () => {
    setSunting(null);
    setGalat(null);
  };

  const simpan = (spec: SensorSpec) => {
    const alasan = setAmbang(spec.id, {
      warn: Number(draf.warn.replace(',', '.')),
      crit: Number(draf.crit.replace(',', '.')),
    });
    if (alasan) {
      setGalat(alasan);
      return;
    }
    setSunting(null);
    setGalat(null);
  };

  const unduh = () => {
    const baris: BarisCsv[] = [
      ['Aset', bridge.name],
      ['Ambang diubah', `${berubah} dari ${SENSORS.length} kanal`],
      ['Diunduh', waktuBerkas(Date.now())],
      [],
      [
        'Parameter',
        'Satuan',
        'Titik ukur',
        'Ambang waspada',
        'Ambang kritis',
        'Bawaan waspada',
        'Bawaan kritis',
        'Nilai sekarang',
        'Status',
      ],
      ...SENSORS.map((spec): BarisCsv => {
        const reading = telemetry?.readings.find((r) => r.id === spec.id);
        const bawaan = AMBANG_BAWAAN[spec.id];
        return [
          spec.name,
          spec.unit,
          spec.node,
          spec.warn,
          spec.crit,
          bawaan.warn,
          bawaan.crit,
          reading ? Number(reading.value.toFixed(spec.dec)) : '',
          reading ? statusOf(spec, reading.value) : '',
        ];
      }),
    ];
    unduhCsv(`tingkat-siaga_${bridge.id}_${stempelBerkas()}`, baris);
  };

  return (
    <div className="screen">
      <PageHeader
        kicker="Berkas aset"
        title="Tingkat siaga"
        lede={
          <>
            Tiap parameter punya dua ambang, dan keduanya membelah nilainya jadi tiga pita:{' '}
            <span className="tag tag-normal">aman</span> di bawah ambang waspada,{' '}
            <span className="tag tag-waspada">waspada</span> dari ambang waspada sampai ambang
            kritis, <span className="tag tag-bahaya">kritis</span> mulai dari ambang kritis. Status
            berpindah tepat saat nilainya menyentuh ambang — tanpa jeda dan tanpa penghalusan — jadi
            status mana pun di layar selalu dapat dihitung ulang dari angka di tabel ini.
          </>
        }
        actions={
          <div className="row d-print-none" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => resetAmbang()}
              disabled={berubah === 0}
            >
              Kembalikan semua ke bawaan
            </button>
            <button type="button" className="btn btn-sm" onClick={unduh}>
              Unduh CSV
            </button>
            <button type="button" className="btn btn-sm" onClick={cetakHalaman}>
              Cetak
            </button>
          </div>
        }
      />

      <section
        className="glass glass--chip stat-row"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          marginBottom: 'var(--space-4)',
        }}
      >
        <Stat
          label="Parameter dipantau"
          value={SENSORS.length}
          note="masing-masing dengan dua ambang"
        />
        <Stat
          label="Ambang diubah operator"
          value={`${berubah} dari ${SENSORS.length}`}
          note={berubah ? 'sisanya masih ambang bawaan' : 'seluruhnya masih ambang bawaan'}
          tone={berubah ? 'warn' : 'default'}
        />
        <Stat
          label="Kanal melewati ambang"
          value={lewat.length}
          note="pada cuplikan terakhir"
          tone={
            lewat.some((s) => s === 'KRITIS')
              ? 'critical'
              : lewat.length
                ? 'warn'
                : 'default'
          }
        />
        <Stat
          label="Status dihitung di"
          value={source === 'api' ? 'Server API' : 'Peramban ini'}
          note={source === 'api' ? 'ambang server' : 'ambang tabel ini'}
        />
      </section>

      {source === 'api' ? (
        <div
          className="glass card"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            fontSize: 12.5,
            lineHeight: 1.55,
          }}
        >
          <span className="card-kicker">Catatan mode API</span>
          <p className="text-muted">
            Perubahan di sini hanya berlaku bagi penilaian di peramban. Ambang server ada di{' '}
            <code>backend/src/domain/sensors.js</code>.
          </p>
        </div>
      ) : null}

      {/*
        * Aturan yang sedang berlaku, bukan sekadar status.
        *
        * Sebuah lencana bertuliskan KRITIS tidak memberi tahu apa pun yang
        * dapat ditindaklanjuti. Yang ditindaklanjuti orang adalah kalimatnya:
        * aturan mana, kanal mana yang melanggarnya, berapa nilainya terhadap
        * ambang, sejak pukul berapa, dan apa yang dituntut.
        */}
      <div
        className="glass card"
        style={{
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
          borderColor:
            berlaku.rule.level === 'AMAN' ? undefined : 'rgb(251 191 36 / 0.36)',
          background:
            berlaku.rule.level === 'KRITIS'
              ? 'rgb(248 113 113 / 0.1)'
              : berlaku.rule.level === 'WASPADA'
                ? 'rgb(251 191 36 / 0.1)'
                : undefined,
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <span className="card-kicker">Tingkat siaga yang berlaku</span>
          <span className="text-muted" style={{ fontSize: 11.5 }}>
            sejak pukul <span className="tabular">{jamSejak(alertSince)}</span> ·{' '}
            {lamaSejak(alertSince)} berjalan
          </span>
        </div>

        <div className="row" style={{ gap: 'var(--space-3)', marginTop: 4 }}>
          <StatusTag status={berlaku.rule.level} />
          <span className="tag tag-outline tabular">{berlaku.rule.code}</span>
          <strong style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.45 }}>
            {berlaku.rule.criteria}
          </strong>
        </div>

        {berlaku.triggered.length ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Kanal pelanggar:
            </span>
            {berlaku.triggered.map((reading) => {
              const spec = SENSORS.find((s) => s.id === reading.id);
              if (!spec) return null;
              const status = statusOf(spec, reading.value);
              return (
                <span key={reading.id} className="tag tag-outline tabular" style={{ fontSize: 11.5 }}>
                  {spec.name} {formatValue(spec, reading.value)} {spec.unit}
                  <span className="text-muted">
                    {' '}
                    · ambang {formatValue(spec, status === 'KRITIS' ? spec.crit : spec.warn)}
                  </span>
                </span>
              );
            })}
          </div>
        ) : null}

        <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.55, maxWidth: '86ch' }}>
          <strong style={{ fontWeight: 600, color: 'var(--mist-100)' }}>Yang dituntut</strong> ·{' '}
          {berlaku.rule.action}
        </p>
      </div>

      <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-head">
          <span className="card-kicker">Ambang batas parameter</span>
          <span className="text-muted" style={{ fontSize: 11 }}>
            tersimpan di peramban ini
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Satuan</th>
                <th>Titik ukur</th>
                <th>Pita aman</th>
                <th>Pita waspada</th>
                <th>Pita kritis</th>
                <th className="num">Nilai sekarang</th>
                <th>Status</th>
                <th className="d-print-none">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {SENSORS.map((spec) => {
                const reading = telemetry?.readings.find((r) => r.id === spec.id);
                const status = reading ? statusOf(spec, reading.value) : null;
                const bawaan = AMBANG_BAWAAN[spec.id];
                const disunting = sunting === spec.id;
                const berbeda = diubah(spec.id);

                return (
                  <tr key={spec.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600 }}>{spec.name}</div>
                      {/* Baris yang belum disentuh tidak perlu diberi label
                          "bawaan" — itu keadaan biasa, dan delapan label yang
                          sama hanya menenggelamkan satu baris yang memang
                          berubah. */}
                      {berbeda ? (
                        <span style={{ fontSize: 11, color: 'var(--state-waspada)' }}>
                          diubah · bawaannya waspada {formatValue(spec, bawaan.warn)}, kritis{' '}
                          {formatValue(spec, bawaan.crit)}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                      {spec.unit}
                    </td>
                    <td className="text-muted">{spec.node}</td>

                    {/*
                      * Pita selalu tergambar, juga ketika barisnya sedang
                      * disunting. Sebelumnya ketiga selnya diganti formulir,
                      * dan akibatnya angka yang sedang diubah operator justru
                      * menghilang tepat pada saat ia dibutuhkan sebagai
                      * pembanding — bersama seluruh bentuk tabelnya, yang ikut
                      * melompat karena tiga kolom berubah jadi satu.
                      */}
                    {pita(spec).map((p) => (
                      <td key={p.label} style={{ whiteSpace: 'nowrap' }}>
                        <span className={p.kelas}>{p.teks}</span>
                      </td>
                    ))}

                    <td
                      className="num"
                      style={{ color: status ? STATUS_COLOR[status] : undefined }}
                    >
                      {reading ? formatValue(spec, reading.value) : '—'}
                    </td>
                    <td>{status ? <StatusTag status={status} /> : <span className="text-muted">—</span>}</td>

                    <td className="d-print-none" style={{ whiteSpace: 'nowrap' }}>
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          type="button"
                          className={disunting ? 'btn btn-sm btn-primary' : 'btn btn-sm'}
                          onClick={() => mulaiSunting(spec)}
                        >
                          Ubah
                        </button>
                        {berbeda ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => resetAmbang(spec.id)}
                          >
                            Bawaan
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-8)' }}>
        <SectionTitle note={`${ALERT_RULES.length} aturan`}>
          Aturan tingkat siaga
        </SectionTitle>

        <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Tingkat</th>
                  <th>Kriteria</th>
                  <th>Yang dituntut</th>
                  <th>Berlaku</th>
                </tr>
              </thead>
              <tbody>
                {ALERT_RULES.map((rule) => {
                  const aktif = rule.code === berlaku.rule.code;
                  return (
                    <tr
                      key={rule.code}
                      style={aktif ? { background: 'rgb(71 166 255 / 0.08)' } : undefined}
                    >
                      <td className="tabular" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {rule.code}
                      </td>
                      <td>
                        <StatusTag status={rule.level} />
                      </td>
                      <td style={{ maxWidth: '44ch' }}>{rule.criteria}</td>
                      <td className="text-muted" style={{ maxWidth: '40ch' }}>
                        {rule.action}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {aktif ? (
                          <span className="tag tag-brand">sekarang</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

     </div>

      {/*
        * Penyuntingan ambang pindah ke jendela bertumpuk.
        *
        * Sebelumnya formulirnya tumbuh di dalam barisnya sendiri, menggantikan
        * tiga sel pita sekaligus. Tiga hal rusak karenanya: angka yang sedang
        * diubah menghilang justru ketika ia dibutuhkan sebagai pembanding,
        * lebar kolom melompat karena tiga sel berubah jadi satu, dan pada
        * tabel selebar ini barisnya sering berada di luar layar sehingga
        * operator mengetik di tempat yang harus digulir dulu untuk dilihat.
        *
        * Di dalam jendela ketiganya hilang: nilai bawaan dan nilai sekarang
        * ditulis berdampingan dengan kotak isiannya, tabelnya tidak bergerak
        * sama sekali, dan fokus papan ketik terkurung di formulirnya.
        */}
      <Modal
        open={specSunting !== null}
        title={specSunting ? `Ubah ambang · ${specSunting.name}` : ''}
        subtitle={
          specSunting ? (
            <>
              {specSunting.node} · satuan {specSunting.unit} · bawaan pabrik waspada{' '}
              <span className="tabular">
                {formatValue(specSunting, AMBANG_BAWAAN[specSunting.id].warn)}
              </span>
              , kritis{' '}
              <span className="tabular">
                {formatValue(specSunting, AMBANG_BAWAAN[specSunting.id].crit)}
              </span>
            </>
          ) : undefined
        }
        onClose={batal}
        footer={
          specSunting ? (
            <>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => simpan(specSunting)}>
                Simpan
              </button>
              <button type="button" className="btn btn-sm" onClick={batal}>
                Batal
              </button>
              {diubah(specSunting.id) ? (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => {
                    resetAmbang(specSunting.id);
                    batal();
                  }}
                >
                  Kembalikan ke bawaan
                </button>
              ) : null}
            </>
          ) : null
        }
      >
        {specSunting ? (
          <>
            <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
              <label className="field" style={{ flex: '1 1 140px' }}>
                <span style={{ fontSize: 11 }}>Ambang waspada ({specSunting.unit})</span>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={draf.warn}
                  autoFocus
                  onChange={(e) => setDraf((d) => ({ ...d, warn: e.target.value }))}
                />
              </label>
              <label className="field" style={{ flex: '1 1 140px' }}>
                <span style={{ fontSize: 11 }}>Ambang kritis ({specSunting.unit})</span>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={draf.crit}
                  onChange={(e) => setDraf((d) => ({ ...d, crit: e.target.value }))}
                />
              </label>
            </div>

            {/*
              * Nilai yang sedang terbaca ditaruh di dalam jendela juga.
              * Tanpanya operator harus menutup jendela untuk melihat angka
              * yang justru menjadi alasan ia membukanya.
              */}
            <div className="row" style={{ gap: 'var(--space-4)', fontSize: 12 }}>
              <span className="text-muted">
                Nilai sekarang{' '}
                <span className="tabular" style={{ color: 'var(--mist-100)' }}>
                  {(() => {
                    const bacaan = telemetry?.readings.find((r) => r.id === specSunting.id);
                    return bacaan ? `${formatValue(specSunting, bacaan.value)} ${specSunting.unit}` : '—';
                  })()}
                </span>
              </span>
              <span className="text-muted">
                Kondisi layan normal{' '}
                <span className="tabular" style={{ color: 'var(--mist-100)' }}>
                  {formatValue(specSunting, specSunting.base)} {specSunting.unit}
                </span>
              </span>
            </div>

            {galat ? (
              <p role="alert" style={{ color: 'var(--state-bahaya)', fontSize: 12, margin: 0 }}>
                {galat}
              </p>
            ) : null}

            <p className="text-muted" style={{ fontSize: 11.5, margin: 0 }}>
              Tersimpan di peramban ini saja · kritis wajib lebih besar daripada waspada.
            </p>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
