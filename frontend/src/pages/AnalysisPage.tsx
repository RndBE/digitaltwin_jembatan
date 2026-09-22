import { useEffect, useState } from 'react';
import type { Bridge, DataSource, Telemetry } from '../lib/types';
import type { Series } from '../hooks/useTelemetry';
import { SENSORS } from '../domain/sensors';
import { ThresholdChart } from '../components/Charts';
import { PageHeader, StatusTag } from '../components/Ui';
import { RANGES, muatRiwayat, ringkas, type HistoryResult } from '../domain/history';
import { stempelBerkas, unduhCsv, waktuBerkas, type BarisCsv } from '../lib/export';
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
  /** Sumber data yang sedang dipakai; menentukan dari mana riwayat diambil. */
  source: DataSource;
}

/** Tanggal pendek beserta jam, untuk menyebut ujung rentang. */
function saat(ms: number, denganJam: boolean): string {
  const d = new Date(ms);
  const tanggal = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  if (!denganJam) return tanggal;
  return `${tanggal} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':')}`;
}

/**
 * Analisa: deret waktu tiap kanal terhadap ambangnya.
 *
 * Dua cara membaca kanal yang sama, dan keduanya diperlukan:
 *
 *   **Langsung** — penyangga pemantauan, beberapa menit terakhir, tiap titik
 *   rerata satu menit. Menjawab "sedang bagaimana".
 *
 *   **Rentang** — riwayat tersimpan, sampai sembilan puluh hari ke belakang,
 *   diringkas per keranjang. Menjawab "sepanjang bulan ini bagaimana" — dan
 *   itulah pertanyaan yang dipakai menyusun anggaran, bukan yang pertama.
 *
 * Pada tampilan rentang yang digambar **nilai tertinggi tiap keranjang**,
 * bukan reratanya. Satu truk berlebih yang lewat pukul dua pagi mengangkat
 * regangan selama tiga puluh detik; pada keranjang enam jam reratanya nyaris
 * tidak bergerak, sementara kejadian itu justru satu-satunya yang penting di
 * sepanjang hari itu. Rerata dan nilai terendahnya tetap disebut di bawah
 * bagan, jadi tidak ada yang hilang — yang berubah hanya angka mana yang
 * mendapat garis.
 */
export function AnalysisPage({ bridge, telemetry, series, source }: AnalysisPageProps) {
  const [showBaseline, setShowBaseline] = useState(true);
  const [rangeKey, setRangeKey] = useState<string>('live');
  const [riwayat, setRiwayat] = useState<HistoryResult | null>(null);
  const [memuat, setMemuat] = useState(false);

  const dossier = dossierFor(bridge.id);
  const inspection = dossier ? inspeksiTerakhir(dossier) : null;
  const opsi = RANGES.find((r) => r.key === rangeKey) ?? null;

  /*
   * Riwayat dimuat sekali tiap pilihan rentang, bukan tiap cuplikan telemetri.
   *
   * Cuplikan datang tiap 200 ms saat ada yang bergerak; memuat ulang tiga
   * puluh hari data pada laju itu akan membakar jaringan untuk menggeser
   * grafik satu piksel. Ujung kanannya dipaku pada saat pilihan dibuat, dan
   * tombol Muat ulang yang memajukannya.
   */
  const [tarikKe, setTarikKe] = useState(0);
  useEffect(() => {
    if (!opsi) {
      setRiwayat(null);
      return;
    }
    let dibatalkan = false;
    const to = Date.now();
    setMemuat(true);
    muatRiwayat({
      bridgeId: bridge.id,
      from: to - opsi.spanMs,
      to,
      bucketMs: opsi.bucketMs,
      source,
    })
      .then((hasil) => {
        if (!dibatalkan) setRiwayat(hasil);
      })
      .finally(() => {
        if (!dibatalkan) setMemuat(false);
      });
    return () => {
      dibatalkan = true;
    };
  }, [opsi, bridge.id, source, tarikKe]);

  if (!telemetry) return <p className="text-muted">Menyiapkan data…</p>;

  /** Unduhan mengikuti apa yang sedang tampil, bukan seluruh yang tersimpan. */
  const unduh = () => {
    const baris: BarisCsv[] = [];
    if (opsi && riwayat) {
      const kepala: BarisCsv = ['Waktu'];
      riwayat.series.forEach((s) => {
        kepala.push(`${s.name} min (${s.unit})`, `${s.name} rata-rata (${s.unit})`, `${s.name} maks (${s.unit})`);
      });
      baris.push(kepala);
      const waktu = riwayat.series[0]?.points.map((p) => p.t) ?? [];
      waktu.forEach((t, i) => {
        const row: BarisCsv = [waktuBerkas(t)];
        riwayat.series.forEach((s) => {
          const p = s.points[i];
          row.push(p?.min ?? null, p?.avg ?? null, p?.max ?? null);
        });
        baris.push(row);
      });
    } else {
      const kepala: BarisCsv = ['Waktu'];
      SENSORS.forEach((spec) => kepala.push(`${spec.name} (${spec.unit})`));
      baris.push(kepala);
      const acuan = series[SENSORS[0].id];
      (acuan?.times ?? []).forEach((t, i) => {
        const row: BarisCsv = [waktuBerkas(t)];
        SENSORS.forEach((spec) => row.push(series[spec.id]?.values[i] ?? null));
        baris.push(row);
      });
    }
    unduhCsv(`riwayat-${bridge.id}-${opsi ? opsi.key : 'langsung'}-${stempelBerkas()}`, baris);
  };

  return (
    <div className="screen">
      <PageHeader
        kicker="Kajian"
        title="Analisa deret waktu"
        lede="Setiap kanal ditampilkan terhadap dua ambangnya: garis kuning adalah batas waspada, garis merah batas kritis. Pilih rentang di bawah — pemantauan langsung membaca penyangga beberapa menit terakhir, rentang yang lebih panjang membaca riwayat tersimpan."
        actions={
          <>
            <label className="row" style={{ gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={showBaseline}
                disabled={Boolean(opsi)}
                onChange={(event) => setShowBaseline(event.target.checked)}
              />
              Tampilkan garis dasar
            </label>
            <button type="button" className="btn btn-sm" onClick={unduh}>
              Unduh CSV
            </button>
          </>
        }
      />

      {/*
        * Pemilih rentang.
        *
        * "Langsung" berdiri terpisah dari yang lain karena ia bukan rentang
        * yang lebih pendek, melainkan sumber yang berbeda: penyangga di
        * peramban, bukan simpanan di server.
        */}
      <div
        className="glass glass--chip card"
        style={{
          padding: 'var(--space-2) var(--space-3)',
          marginBottom: 'var(--space-4)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <span className="card-kicker">Rentang</span>
        <div className="seg" role="group" aria-label="Rentang waktu">
          <button
            type="button"
            className="seg-opt"
            aria-pressed={!opsi}
            onClick={() => setRangeKey('live')}
          >
            Langsung
          </button>
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className="seg-opt"
              aria-pressed={rangeKey === r.key}
              onClick={() => setRangeKey(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <span className="text-muted" style={{ fontSize: 11.5 }}>
          {opsi ? (
            riwayat ? (
              <>
                {saat(riwayat.from, opsi.spanMs <= 86_400_000)} –{' '}
                {saat(riwayat.to, opsi.spanMs <= 86_400_000)} · {opsi.note} ·{' '}
                {riwayat.series[0]?.points.length ?? 0} titik
              </>
            ) : (
              'memuat…'
            )
          ) : (
            <>
              {series[SENSORS[0].id]?.values.length ?? 0} nilai terakhir · rerata 1 menit tiap titik
            </>
          )}
        </span>

        {opsi ? (
          <span
            className={riwayat?.source === 'api' ? 'tag tag-normal' : 'tag tag-neutral'}
            title={
              riwayat?.source === 'api'
                ? 'Dibaca dari cuplikan yang tersimpan di server'
                : 'Server tidak menyimpan rentang ini; angkanya dibangkitkan model peraga di peramban'
            }
          >
            {riwayat?.source === 'api' ? 'tersimpan di server' : 'model peraga'}
          </span>
        ) : null}

        {opsi ? (
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => setTarikKe((n) => n + 1)}
            disabled={memuat}
          >
            {memuat ? 'Memuat…' : 'Muat ulang'}
          </button>
        ) : null}
      </div>

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
            <span className="card-kicker">Acuan berkas aset</span>
            <span className="text-muted">
              beban rencana {dossier.designLoad} · nilai kondisi {dossier.conditionValue}/5 ·
              inspeksi {tanggalPendek(inspection.date)} ({jarakWaktu(inspection.date)})
            </span>
          </div>
          <p className="text-muted" style={{ maxWidth: '96ch' }}>
            <strong style={{ fontWeight: 600, color: 'var(--mist-100)' }}>Temuan terakhir</strong> ·{' '}
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
          if (!reading) return null;

          const deret = riwayat?.series.find((s) => s.sensorId === spec.id);
          const entry = series[spec.id];
          if (opsi ? !deret : !entry) return null;

          // Pada tampilan rentang garisnya nilai tertinggi tiap keranjang;
          // pada pemantauan langsung tiap titik memang sudah satu nilai.
          const nilai = deret ? deret.points.map((p) => p.max) : entry.values;
          const stats = deret ? ringkas(deret) : { ...summarise(entry.values), lewatWaspada: 0, lewatKritis: 0 };
          const unit = sensorUnitFor(bridge.id, spec.name);

          return (
            <div key={spec.id} className="glass card" style={{ padding: 'var(--space-4)' }}>
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
                        baterai {unit.battery} %
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
                values={nilai}
                baseline={deret ? undefined : entry.baseline}
                status={reading.status}
                showBaseline={showBaseline && !deret}
              />

              <div
                className="text-muted tabular"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  marginTop: 6,
                }}
              >
                <span>min {stats.min.toFixed(spec.dec)}</span>
                <span>rata-rata {stats.avg.toFixed(spec.dec)}</span>
                <span>maks {stats.max.toFixed(spec.dec)}</span>
                <span>
                  ambang {spec.warn} / {spec.crit} {spec.unit}
                </span>
              </div>

              {/*
                * Berapa lama kanal ini berada di atas ambangnya sepanjang
                * rentang — bukan hanya seberapa tinggi puncaknya. Satu
                * keranjang yang menyentuh ambang waspada berbeda artinya
                * dengan dua belas keranjang berturut-turut yang menyentuhnya.
                */}
              {deret && (stats.lewatWaspada > 0 || stats.lewatKritis > 0) ? (
                <div className="row" style={{ gap: 6, marginTop: 6, fontSize: 11 }}>
                  {stats.lewatKritis > 0 ? (
                    <span className="tag tag-bahaya">{stats.lewatKritis} keranjang lewat kritis</span>
                  ) : null}
                  {stats.lewatWaspada > 0 ? (
                    <span className="tag tag-waspada">
                      {stats.lewatWaspada} keranjang lewat waspada
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-6)' }}>
        {opsi ? (
          <>
            Tiap titik = nilai tertinggi per {opsi.note.replace('keranjang ', '')} ·{' '}
            {riwayat?.source === 'api' ? 'cuplikan server' : 'model peraga'}
          </>
        ) : (
          <>
            {series[SENSORS[0].id]?.values.length ?? 0} nilai terakhir per kanal · rerata 1 menit
          </>
        )}
      </p>
    </div>
  );
}
