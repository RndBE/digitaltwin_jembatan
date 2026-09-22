import type { Reading } from '../lib/types';
import { SENSOR_BY_ID, formatValue } from '../domain/sensors';
import { ALERT_RULES, activeRule, jamSejak, lamaSejak } from '../domain/alertRules';
import { STATUS_TONE } from './Ui';

/**
 * Tangga tingkat siaga.
 *
 * Status tunggal di pojok layar menjawab "sekarang apa" dan berhenti di situ.
 * Yang tidak dijawabnya adalah pertanyaan yang justru diajukan orang yang
 * belum pernah melihat sistem ini: **tingkat berikutnya apa, dan apa yang
 * harus terjadi supaya naik ke sana**. Selama seluruh tangganya tidak
 * kelihatan, satu-satunya cara mengetahui itu adalah menunggu keadaan
 * memburuk.
 *
 * Karena itu ketiga tingkat digambar sekaligus, berurutan dari yang paling
 * ringan, dengan kriteria masing-masing tertulis apa adanya. Yang sedang
 * berlaku disorot dan diberi lencana; dua yang lain tetap terbaca sebagai
 * batas yang belum dilewati.
 *
 * Kriterianya tidak ditulis ulang di sini — seluruhnya dibaca dari
 * `ALERT_RULES`, sumber yang sama yang dipakai bilah atas dan halaman Aturan
 * & ambang. Kalimat yang disalin akan berbeda pada hari aturannya diubah, dan
 * layar yang menyebut kriteria lain daripada yang dipakai sistem lebih buruk
 * daripada layar yang diam.
 */

export interface AlertLadderProps {
  readings: Reading[];
  /** Sejak kapan tingkat yang sekarang berlaku. */
  since: string;
}

export function AlertLadder({ readings, since }: AlertLadderProps) {
  const berlaku = activeRule(readings);
  // Dari yang paling ringan ke yang paling berat: tangga dibaca naik, bukan
  // turun. `ALERT_RULES` sendiri sengaja tersusun sebaliknya karena yang
  // pertama cocok itulah yang berlaku.
  const tangga = [...ALERT_RULES].reverse();

  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      {tangga.map((rule) => {
        const aktif = rule.code === berlaku.rule.code;
        const warna = STATUS_TONE[rule.level];
        return (
          <div
            key={rule.code}
            className="siaga-langkah"
            data-aktif={aktif ? 'ya' : undefined}
            style={{ borderColor: aktif ? warna : undefined }}
          >
            <span className="siaga-titik" style={{ background: warna }} aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <strong style={{ fontSize: 12.5, letterSpacing: '.04em', color: warna }}>
                  {rule.level}
                </strong>
                <span className="tag tag-outline tabular" style={{ fontSize: 10.5 }}>
                  {rule.code}
                </span>
                {aktif ? (
                  <span className="tag" style={{ background: warna, color: '#06101f', fontSize: 10 }}>
                    SEKARANG
                  </span>
                ) : null}
              </div>
              <p className="text-muted" style={{ fontSize: 11.5, lineHeight: 1.45, margin: 0 }}>
                {rule.criteria}
              </p>
            </div>
          </div>
        );
      })}

      <div className="hairline" />

      <p className="text-muted" style={{ fontSize: 11.5, lineHeight: 1.5, margin: 0 }}>
        Sejak <span className="tabular">{jamSejak(since)}</span> · {lamaSejak(since)} ·{' '}
        <span className="tabular">{berlaku.rule.code}</span>
        {berlaku.triggered.map((reading) => {
          const spec = SENSOR_BY_ID[reading.id];
          return (
            <span key={reading.id}>
              {' · '}
              <strong style={{ fontWeight: 600, color: 'var(--mist-100)' }}>
                {spec?.name ?? reading.id}
              </strong>{' '}
              <span className="tabular">
                {spec ? formatValue(spec, reading.value) : reading.value} {spec?.unit ?? ''}
              </span>
            </span>
          );
        })}
      </p>
    </div>
  );
}
