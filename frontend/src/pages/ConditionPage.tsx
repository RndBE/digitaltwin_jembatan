import { useState } from 'react';
import type { Telemetry } from '../lib/types';
import {
  CONDITION_CLASS,
  CONDITION_COLOR,
  CONDITION_LABEL,
  CONDITION_THRESHOLDS,
} from '../domain/condition';
import { bridgeCondition, type ScoredElement } from '../domain/elements';
import { Meter } from '../components/Charts';
import { PageHeader, Stat } from '../components/Ui';

/**
 * Kondisi elemen: satu skor per elemen struktur, dan alasannya.
 *
 * Halaman ini menjawab pertanyaan yang tidak dijawab telemetri maupun berkas
 * inspeksi sendiri-sendiri: *elemen mana* yang paling buruk kondisinya, dan
 * atas dasar apa. Sensor melihat sepetak kecil dengan sangat sering, inspeksi
 * melihat seluruhnya dengan sangat jarang — digabung dengan bobot, keduanya
 * menjadi satu angka per elemen yang bisa dibawa ke rapat anggaran.
 *
 * Aturan yang dipegang: **tiap angka harus bisa dibongkar**. Skor gabungan
 * selalu tampil bersama elemen penyebabnya, dan skor elemen selalu tampil
 * bersama ketiga sukunya beserta bobotnya.
 */

export interface ConditionPageProps {
  telemetry: Telemetry | null;
  onOpenInspection: () => void;
}

const persen = (v: number) => `${(v * 100).toFixed(0)} %`;
const skor = (v: number) => v.toFixed(2);

export function ConditionPage({ telemetry, onOpenInspection }: ConditionPageProps) {
  const kondisi = bridgeCondition(telemetry?.readings ?? []);
  const [pilih, setPilih] = useState<string | null>(null);

  const terpilih: ScoredElement =
    kondisi.elements.find((e) => e.id === pilih) ?? kondisi.driver ?? kondisi.elements[0];

  /*
   * Dua pita dihitung terpisah, bukan digabung.
   *
   * Digabung, angkanya berbohong ke arah yang paling mahal: tiga belas elemen
   * yang berada di pita **pantau** — masih di atas 0,70, cukup sehat untuk
   * dijadwalkan — terbaca sebagai tiga belas elemen yang menuntut tindakan,
   * pada jembatan yang seluruh kanalnya sedang AMAN. Angka yang menyuruh orang
   * mengerahkan tim ke lapangan wajib menghitung hanya yang memang menuntutnya.
   */
  const pantau = kondisi.structural.filter((e) => e.status === 'pantau');
  const tindak = kondisi.structural.filter((e) => e.status === 'tindak');
  const perlu = [...tindak, ...pantau];
  const systems = [...new Set(kondisi.elements.map((e) => e.system))];

  return (
    <div className="screen">
      <PageHeader
        kicker="Berkas aset"
        title="Kondisi elemen"
        lede={
          <>
            Satu skor per elemen struktur, digabung dari tiga sumber yang melihat hal yang sama dari
            sudut berbeda: <strong>sensor kontinu</strong> (cakupan sempit, frekuensi tinggi),{' '}
            <strong>inspeksi visual</strong> (cakupan luas, frekuensi rendah), dan{' '}
            <strong>uji diagnostik</strong> (akurasi tinggi, jarang). Indeks jembatannya bukan
            rata-rata — ia ditarik ke arah elemen terburuk, karena kegagalan setempat itulah yang
            dicari. Perlengkapan yang tidak memikul beban ikut didaftar tetapi tidak ikut
            menentukan indeksnya.
          </>
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
          label="Indeks kondisi jembatan"
          value={skor(kondisi.index)}
          note={kondisi.driver ? `ditarik turun oleh ${kondisi.driver.name}` : '—'}
          tone={kondisi.index < CONDITION_THRESHOLDS.pantau ? 'critical' : kondisi.index < CONDITION_THRESHOLDS.baik ? 'warn' : 'accent'}
        />
        <Stat
          label="Rata-rata polos"
          value={skor(kondisi.mean)}
          note={`selisih ${(kondisi.mean - kondisi.index).toFixed(2)}`}
        />
        <Stat
          label="Elemen di bawah ambang baik"
          value={`${perlu.length} dari ${kondisi.structural.length}`}
          note={
            perlu.length === 0
              ? 'seluruhnya di atas 0,85'
              : `${tindak.length} perlu tindakan${tindak.length ? ` (${tindak.map((e) => e.id).join(', ')})` : ''} · ${pantau.length} cukup dipantau`
          }
          tone={tindak.length ? 'critical' : perlu.length ? 'warn' : 'default'}
        />
        <Stat
          label="Elemen terburuk"
          value={kondisi.driver ? skor(kondisi.driver.score) : '—'}
          note={kondisi.driver ? `${kondisi.driver.id} · ${kondisi.driver.name}` : '—'}
          tone="warn"
        />
      </section>

      <div
        className="split"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, 1fr)',
          gap: 'var(--space-3)',
          alignItems: 'start',
        }}
      >
        <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-head">
            <span className="card-kicker">Pohon struktur</span>
            <span className="text-muted" style={{ fontSize: 11 }}>
              {kondisi.elements.length} elemen · pilih untuk melihat rinciannya
            </span>
          </div>

          <div style={{ padding: 'var(--space-2) 0 var(--space-3)' }}>
            {systems.map((system) => (
              <div key={system}>
                <div className="nav-section" style={{ padding: 'var(--space-3) var(--space-4) 4px' }}>
                  {system}
                </div>
                {kondisi.elements
                  .filter((e) => e.system === system)
                  .map((element) => {
                    const aktif = element.id === terpilih.id;
                    return (
                      <button
                        key={element.id}
                        type="button"
                        className="elemen-baris"
                        aria-pressed={aktif}
                        onClick={() => setPilih(element.id)}
                      >
                        <span
                          className="tag-dot"
                          style={{ background: CONDITION_COLOR[element.status] }}
                          aria-hidden="true"
                        />
                        <span className="tabular text-muted" style={{ fontSize: 11, width: 46, flex: 'none' }}>
                          {element.id}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>{element.name}</span>
                        {!element.channel ? (
                          <span className="tag tag-neutral" style={{ fontSize: 10 }}>
                            tanpa sensor
                          </span>
                        ) : null}
                        {element.id === kondisi.driver?.id ? (
                          <span className="tag tag-outline" style={{ fontSize: 10 }}>
                            penarik
                          </span>
                        ) : null}
                        <span
                          className="tabular"
                          style={{ fontWeight: 700, color: CONDITION_COLOR[element.status] }}
                        >
                          {skor(element.score)}
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>

        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <div className="glass card" style={{ padding: 'var(--space-4)' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="card-kicker">{terpilih.id}</span>
              <span className={CONDITION_CLASS[terpilih.status]}>
                {CONDITION_LABEL[terpilih.status]}
              </span>
            </div>
            <div className="card-title" style={{ fontSize: 17 }}>
              {terpilih.name}
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {terpilih.location}
            </div>
            <div
              className="tabular"
              style={{ fontSize: 40, fontWeight: 800, color: CONDITION_COLOR[terpilih.status], lineHeight: 1.1 }}
            >
              {skor(terpilih.score)}
            </div>
          </div>

          <div className="glass card" style={{ padding: 'var(--space-4)' }}>
            <span className="card-kicker">Dekomposisi skor</span>

            <div className="stack" style={{ gap: 'var(--space-3)', marginTop: 4 }}>
              {terpilih.breakdown.parts.map((part) => (
                <div key={part.key}>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                    <span>
                      {part.label}{' '}
                      <span className="text-muted">
                        {part.value === null
                          ? '· tidak tersedia, bobotnya dikeluarkan'
                          : `· bobot ${part.weight.toFixed(1)}`}
                      </span>
                    </span>
                    <span className="tabular" style={{ fontWeight: 700 }}>
                      {part.value === null ? '—' : persen(part.value)}
                    </span>
                  </div>
                  <Meter
                    pct={(part.value ?? 0) * 100}
                    hideValue
                    color={part.key === 'sensor' ? 'var(--brand-400)' : 'var(--mist-300)'}
                  />
                </div>
              ))}
            </div>

            <div className="hairline" />

            <div className="tabular text-muted" style={{ fontSize: 12, lineHeight: 1.7 }}>
              ({terpilih.breakdown.parts
                .filter((p) => p.value !== null)
                .map((p) => `${(p.value as number).toFixed(2)}×${p.weight.toFixed(1)}`)
                .join(' + ')}
              ) / {terpilih.breakdown.denominator.toFixed(1)} ={' '}
              <strong style={{ color: '#fff' }}>{skor(terpilih.score)}</strong>
            </div>

            {terpilih.reading ? (
              <p className="text-muted" style={{ fontSize: 12 }}>
                Kanal <strong style={{ color: 'var(--mist-100)' }}>{terpilih.reading.name}</strong>{' '}
                · {terpilih.reading.value.toFixed(2)} {terpilih.reading.unit} · ambang{' '}
                {terpilih.reading.warn}/{terpilih.reading.crit}
              </p>
            ) : (
              <p className="text-muted" style={{ fontSize: 12 }}>
                Tidak tersensor · suku sensor diisi rata-rata kedua sumber lain.
              </p>
            )}
          </div>

          <div className="glass glass--chip card" style={{ padding: 'var(--space-4)' }}>
            <span className="card-kicker">Asal angkanya</span>
            <p className="card-body">Sensor dari telemetri · visual dan diagnostik data contoh.</p>
            <button type="button" className="btn btn-sm" onClick={onOpenInspection}>
              Buka riwayat inspeksi
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
