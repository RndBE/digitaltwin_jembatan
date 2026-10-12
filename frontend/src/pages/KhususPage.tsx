import { useMemo, useSyncExternalStore } from 'react';
import type { Bridge, Telemetry } from '../lib/types';
import { PageHeader, Stat } from '../components/Ui';
import { TabelUsulan } from '../components/TabelUsulan';
import { dossierFor, tanggalPendek } from '../domain/demoData';
import { nilaiTemuan } from '../domain/pedoman';
import { daftarTemuan, langganTemuan, versiTemuan } from '../domain/temuan';
import { susunUsulan } from '../domain/usulan';

/**
 * Pemeriksaan khusus (Bab 4.3.4 dan 9).
 *
 * Pedoman menyebutnya tindak lanjut pengamatan visual: pengujian yang lebih
 * cermat dengan peralatan khusus, dikerjakan sarjana teknik berpengalaman
 * (Bab 9.2). Halaman ini tidak mencatat hasil pengujian — itu belum ada — dan
 * hanya mengerjakan dua hal: menyebut **elemen mana** yang layak diuji beserta
 * alasannya, dan mengingatkan alat yang cocok dari Tabel 9 dan 10.
 *
 * Usulannya dari `susunUsulan`, sumber yang sama dengan halaman Rutin.
 */

/** Tabel 9 dan 10 Bab 9, ringkas; yang relevan untuk jembatan rangka baja. */
const PENGUJIAN: Array<{ kelompok: string; rujukan: string; butir: Array<[string, string]> }> = [
  {
    kelompok: 'Elemen baja',
    rujukan: 'Tabel 9 · hlm. 91',
    butir: [
      ['Hardness test', 'Mengukur kekerasan material besi dan baja'],
      ['Kunci torsi', 'Mengukur kekencangan baut'],
      ['Ultrasonic thickness gauge', 'Mengukur ketebalan baja dan cat'],
      ['Coating thickness gauge', 'Mengukur ketebalan cat'],
      ['Dye penetration test', 'Mengetahui cacat permukaan pada elemen baja'],
      ['Ultrasonic flaw detector', 'Mengetahui cacat hasil pengelasan'],
    ],
  },
  {
    kelompok: 'Struktur',
    rujukan: 'Tabel 10 · hlm. 91',
    butir: [
      ['Pengujian statis', 'Mengetahui kekuatan atau kapasitas struktur terhadap beban statis'],
      ['Pengujian dinamis', 'Mengetahui kekakuan dan karakteristik getaran terhadap beban dinamis'],
    ],
  },
  {
    kelompok: 'Geometri',
    rujukan: 'Bab 9.3 · hlm. 89',
    butir: [
      ['Total station, digital level', 'Dimensi, penampang, alinyemen vertikal, dan deformasi'],
      ['GPS geodetik, TLS', 'Pengukuran geometri dan deformasi jembatan'],
    ],
  },
];

export interface KhususPageProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
}

export function KhususPage({ bridge, telemetry }: KhususPageProps) {
  const versi = useSyncExternalStore(langganTemuan, versiTemuan);
  const temuan = useMemo(() => nilaiTemuan(daftarTemuan(bridge.id)), [bridge.id, versi]);
  const usulan = useMemo(() => susunUsulan(telemetry?.readings ?? null, temuan), [telemetry, temuan]);
  const terakhir = [...(dossierFor(bridge.id)?.inspections ?? [])]
    .filter((i) => i.kind === 'Khusus')
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="screen">
      <PageHeader
        kicker="Pemeriksaan"
        title="Pemeriksaan khusus"
        lede="Elemen yang diusulkan untuk pengujian lebih cermat, beserta alat yang cocok menurut Bab 9 pedoman."
        rujukan="Bab 4.3.4, 9 · hlm. 9, 88–92"
      />

      <section
        className="glass glass--chip stat-row"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 'var(--space-3)' }}
      >
        <Stat
          label="Usulan pemeriksaan khusus"
          value={usulan.khusus.length}
          tone={usulan.khusus.length ? 'warn' : 'accent'}
        />
        <Stat
          label="Tindakan darurat"
          value={usulan.daruratDisarankan ? 'Disarankan' : 'Tidak'}
          tone={usulan.daruratDisarankan ? 'critical' : 'accent'}
        />
        <Stat
          label="Pemeriksaan khusus terakhir"
          value={terakhir ? tanggalPendek(terakhir.date) : '—'}
          note={terakhir ? `nilai kondisi ${terakhir.conditionValue}` : 'belum ada catatan'}
        />
      </section>

      <div className="glass card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
        <div className="card-head">
          <span className="card-kicker">Usulan pemeriksaan khusus</span>
          <span className="text-muted" style={{ fontSize: 11 }}>dari kanal sensor dan temuan NK ≥ 3</span>
        </div>
        <TabelUsulan baris={usulan.khusus} kosong="Tidak ada elemen yang diusulkan." tampilkanUji />
      </div>

      <div className="glass card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
        <div className="card-head">
          <span className="card-kicker">Alat dan pengujian</span>
          <span className="text-muted" style={{ fontSize: 11 }}>Bab 9.3 · hlm. 88–91</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <tbody>
              {PENGUJIAN.flatMap((k) => [
                <tr key={k.kelompok}>
                  <td colSpan={2} style={{ fontWeight: 700, background: 'rgb(255 255 255 / 0.04)' }}>
                    {k.kelompok} <span className="text-muted" style={{ fontWeight: 400, fontSize: 11 }}>· {k.rujukan}</span>
                  </td>
                </tr>,
                ...k.butir.map(([alat, fungsi]) => (
                  <tr key={`${k.kelompok}-${alat}`}>
                    <td style={{ minWidth: 220 }}>{alat}</td>
                    <td className="text-muted" style={{ minWidth: 280, lineHeight: 1.5 }}>{fungsi}</td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-muted" style={{ fontSize: 12, lineHeight: 1.6, margin: 0 }}>
        Pemeriksaan khusus dilaksanakan sarjana teknik yang berpengalaman di bidang jembatan (Bab 9.2).
        Hasil pengujian belum dapat dicatat di aplikasi ini.
      </p>
    </div>
  );
}
