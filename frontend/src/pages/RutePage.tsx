import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Bridge, Status, Telemetry } from '../lib/types';
import { PageHeader } from '../components/Ui';
import type { PadananBagian } from '../domain/lokasiModel';
import { ELEMEN_BY_KODE, NK_KELAS, NK_URAIAN, lokasiLabel, nilaiTemuan } from '../domain/pedoman';
import {
  kosongkanRute,
  langganRute,
  ringkasRute,
  sensorPerStasiun,
  setTandaRute,
  susunRute,
  tandaRute,
  versiRute,
  type RingkasStasiun,
} from '../domain/rute';
import { daftarTemuan, langganTemuan, versiTemuan } from '../domain/temuan';
import { STATUS_COLOR } from '../domain/sensors';
import { tanggalPendek } from '../domain/demoData';

/**
 * Rute pemeriksaan: stasiun demi stasiun dari A1 ke A2.
 *
 * Pedoman memulai pemeriksaan dari kepala jembatan di kilometer terkecil dan
 * berjalan ke ujung lainnya (Bab 5.5 hlm. 41). Halaman ini menjadikan itu
 * daftar yang dapat dicentang di lapangan — dan menaruh di sebelah tiap
 * stasiun apa yang sudah diketahui tentangnya: temuan terdahulu beserta
 * nilai kondisinya, dan sensor yang dipasang di sana beserta statusnya.
 * Bab 4.4.2 hlm. 10 memang menyebut riwayat pemeriksaan dan foto terdahulu
 * sebagai bahan tinjauan sebelum pemeriksaan dimulai.
 *
 * Urutan "Prioritas" hanya mengubah urutan tampil: yang sensornya di atas
 * ambang dan yang bernilai kondisi tinggi naik ke atas. Pedoman tidak
 * mengatur prioritas itu; ia bantuan, bukan pengganti rute.
 */

export interface RutePageProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
  onRecordDamage: (padanan: PadananBagian) => void;
}

const STATUS_KELAS: Record<Status, string> = {
  AMAN: 'tag tag-normal',
  WASPADA: 'tag tag-waspada',
  KRITIS: 'tag tag-bahaya',
};

/** Lokasi anggota satu kelompok, tanpa awalan bentang; yang kembar ditulis sekali dengan jumlahnya. */
function ringkasLokasi(anggota: PadananBagian[]): string {
  const hitung = new Map<string, number>();
  anggota.forEach((p) => {
    const label = lokasiLabel(p).replace(/^[AB]\d\.?/, '') || '—';
    hitung.set(label, (hitung.get(label) ?? 0) + 1);
  });
  return [...hitung].map(([label, n]) => (n > 1 ? `${label} ×${n}` : label)).join(' · ');
}

function KartuStasiun({
  r,
  diperiksa,
  terbuka,
  onTanda,
  onBuka,
  onCatat,
}: {
  r: RingkasStasiun;
  diperiksa: boolean;
  terbuka: boolean;
  onTanda: (v: boolean) => void;
  onBuka: () => void;
  onCatat: (p: PadananBagian) => void;
}) {
  const { stasiun } = r;
  // Padanan dikelompokkan menurut kode elemen: satu baris "4.453b ×2" lebih
  // terbaca daripada dua belas baris batang yang hampir sama.
  const kelompok = [...new Set(stasiun.padanan.map((p) => p.elemen))].map((kode) => ({
    kode,
    nama: ELEMEN_BY_KODE[kode]?.elemen.nama ?? kode,
    anggota: stasiun.padanan.filter((p) => p.elemen === kode),
  }));

  return (
    <div className="glass card" style={{ padding: 'var(--space-3) var(--space-4)', opacity: diperiksa ? 0.7 : 1 }}>
      <div className="row" style={{ gap: 'var(--space-3)', justifyContent: 'space-between' }}>
        <label className="row" style={{ gap: 10, cursor: 'pointer', flex: 1, minWidth: 220 }}>
          <input type="checkbox" checked={diperiksa} onChange={(e) => onTanda(e.target.checked)} aria-label={`${stasiun.judul} sudah diperiksa`} />
          <strong style={{ fontWeight: 650 }}>{stasiun.judul}</strong>
        </label>
        <div className="row" style={{ gap: 6 }}>
          {r.sensor.map((s) => (
            <span key={s.kanal} className={s.status ? STATUS_KELAS[s.status] : 'tag tag-neutral'} title={`${s.nama} ${s.teks}`}>
              <span className="tag-dot" style={{ background: s.status ? STATUS_COLOR[s.status] : undefined }} aria-hidden="true" />
              {s.nama} {s.teks}
            </span>
          ))}
          {r.temuan.length ? (
            <span className={NK_KELAS[r.nk]} title={NK_URAIAN[r.nk].arti}>
              NK {r.nk} · {r.temuan.length} temuan
            </span>
          ) : null}
          {stasiun.padanan.length ? (
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={terbuka} onClick={onBuka}>
              {terbuka ? 'Tutup' : `${stasiun.padanan.length} bagian`}
            </button>
          ) : null}
        </div>
      </div>

      {r.temuan.length ? (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.55 }}>
          {r.temuan.map((t) => (
            <li key={t.id}>
              <span className="tabular text-muted">{tanggalPendek(t.tanggal)}</span> · {t.elemen} {t.elemenSpec.nama} ·{' '}
              {t.kerusakan} {t.kerusakanSpec.nama} · <span className={NK_KELAS[t.skor.nk]} style={{ fontSize: 10.5 }}>NK {t.skor.nk}</span>
              {t.contoh ? <span className="tag tag-neutral" style={{ fontSize: 10, marginLeft: 6 }}>CONTOH</span> : null}
              {t.foto?.length ? <span className="text-muted"> · {t.foto.length} foto</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {terbuka ? (
        <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          {kelompok.map((k) => (
            <div key={k.kode} className="row" style={{ gap: 'var(--space-2)', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span>
                <span className="tabular text-muted">{k.kode}</span> {k.nama}{' '}
                <span className="text-muted tabular">
                  {ringkasLokasi(k.anggota)}
                </span>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCatat(k.anggota[0])}>
                Catat kerusakan
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RutePage({ bridge, telemetry, onRecordDamage }: RutePageProps) {
  const panels = bridge.model.panels ?? 10;
  const spanUnits = bridge.model.spanUnits ?? 12;

  const versiT = useSyncExternalStore(langganTemuan, versiTemuan);
  const versiR = useSyncExternalStore(langganRute, versiRute);
  const temuan = useMemo(() => nilaiTemuan(daftarTemuan(bridge.id)), [bridge.id, versiT]);
  const tanda = useMemo(() => tandaRute(bridge.id), [bridge.id, versiR]);

  const rute = useMemo(() => susunRute(panels), [panels]);
  const { peta } = useMemo(() => sensorPerStasiun(panels, spanUnits), [panels, spanUnits]);
  const readings = telemetry?.readings ?? null;
  const ringkas = useMemo(() => ringkasRute(rute, temuan, peta, readings), [rute, temuan, peta, readings]);

  const [terbuka, setTerbuka] = useState<Set<string>>(() => new Set());

  // Stasiun "seluruh elemen" hanya muncul bila ada temuan Level 4 untuk ditunjukkan.
  const tampil = ringkas.filter((r) => r.stasiun.jenis !== 'umum' || r.temuan.length > 0);

  const fisik = tampil.filter((r) => r.stasiun.jenis !== 'umum');
  const sudah = fisik.filter((r) => tanda[r.stasiun.kunci]).length;

  const alihBuka = (kunci: string) =>
    setTerbuka((lama) => {
      const baru = new Set(lama);
      if (baru.has(kunci)) baru.delete(kunci);
      else baru.add(kunci);
      return baru;
    });

  return (
    <div className="screen">
      <PageHeader
        kicker="Pemeriksaan detail"
        title="Rute pemeriksaan"
        lede="Stasiun dari A1 ke A2, dengan temuan terdahulu dan sensor di tiap stasiun."
        rujukan="Bab 5.5 · hlm. 41"
      />

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <strong>
          {sudah} / {fisik.length} stasiun diperiksa hari ini
        </strong>
        <button type="button" className="btn btn-ghost btn-sm" disabled={sudah === 0} onClick={() => kosongkanRute(bridge.id)}>
          Mulai rute baru
        </button>
      </div>

      <div className="stack" style={{ gap: 'var(--space-2)' }}>
        {tampil.map((r) => (
          <KartuStasiun
            key={r.stasiun.kunci}
            r={r}
            diperiksa={Boolean(tanda[r.stasiun.kunci])}
            terbuka={terbuka.has(r.stasiun.kunci)}
            onTanda={(v) => setTandaRute(bridge.id, r.stasiun.kunci, v)}
            onBuka={() => alihBuka(r.stasiun.kunci)}
            onCatat={onRecordDamage}
          />
        ))}
      </div>
    </div>
  );
}
