import { useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Bridge, Telemetry } from '../lib/types';
import { dossierFor, tanggalPendek } from '../domain/demoData';
import { environmentAt } from '../domain/environment';
import { BAGIAN_FORM, BUTIR_FORM, petunjukUntuk, type ButirForm, type KonteksPetunjuk } from '../domain/formRutin';
import {
  kemajuan,
  lembarTahun,
  bukaLembar,
  selesaikanLembar,
  simpanLembar,
  tahunTersimpan,
  type Jawaban,
  type Lembar,
} from '../domain/lembarRutin';
import { nilaiTemuan } from '../domain/pedoman';
import { periksaSmks } from '../domain/smks';
import { daftarTemuan, langganTemuan, versiTemuan } from '../domain/temuan';
import { TINDAKAN_DARURAT, susunUsulan } from '../domain/usulan';
import {
  administrasiAset,
  langganAdministrasi,
  simpanAdministrasi,
  versiAdministrasi,
} from '../domain/administrasi';
import { petugas } from '../domain/alarms';
import { BilahBagian, type BagianFormulir } from './BilahBagian';

/**
 * Formulir Pemeriksaan Rutin, Bagian ke-1 dan ke-2 (Tabel A.16–A.19).
 *
 * Ini **formulirnya**, bukan ringkasan: setiap butir kondisi jembatan dari
 * pedoman punya jawaban Ya/Tidak, lokasi, dan — bila datanya ada — petunjuk
 * dari monitoring beserta satu tombol untuk memakai sarannya. Sarannya tidak
 * pernah mengisi sendiri. Yang berdiri di jembatan dan melihat langsung
 * adalah pemeriksa; sensor hanya memberi tahu ke mana harus melihat dulu.
 *
 * Jawaban tersimpan per tahun (Pemeriksaan Rutin dilakukan setiap tahun) dan
 * tidak dapat ditandai selesai sebelum seluruh butir dijawab dan setiap
 * jawaban "Ya" punya lokasi.
 */

/** Lembar isian Rutin dibagi dua (Bab 8.4, Lampiran A). */
const BAGIAN: BagianFormulir[] = [
  { id: 'rutin-bagian-1', judul: 'Administrasi, tindakan darurat, catatan', rujukan: 'Bab 8.4.1 · hlm. 81' },
  { id: 'rutin-bagian-2', judul: 'Kondisi jembatan', rujukan: 'Bab 8.4.2 · hlm. 82' },
];

export interface FormulirRutinProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
}

const YaTidak = ({
  nilai,
  onPilih,
  mati,
  nama,
}: {
  nilai: boolean | null;
  onPilih: (v: boolean | null) => void;
  mati: boolean;
  nama: string;
}) => (
  <div className="seg" role="group" aria-label={nama} style={{ flexWrap: 'nowrap' }}>
    <button
      type="button"
      className="seg-opt"
      aria-pressed={nilai === true}
      disabled={mati}
      onClick={() => onPilih(nilai === true ? null : true)}
      style={nilai === true ? { background: 'rgb(248 113 113 / 0.28)', color: '#fff' } : undefined}
    >
      Ya
    </button>
    <button
      type="button"
      className="seg-opt"
      aria-pressed={nilai === false}
      disabled={mati}
      onClick={() => onPilih(nilai === false ? null : false)}
    >
      Tidak
    </button>
  </div>
);

export function FormulirRutin({ bridge, telemetry }: FormulirRutinProps) {
  const dossier = dossierFor(bridge.id);
  const tahunIni = new Date().getFullYear();
  const [tahun, setTahun] = useState(tahunIni);
  const [lembar, setLembarState] = useState<Lembar>(() => lembarTahun(bridge.id, tahunIni));
  /*
   * Nilai terbaru lembar, di luar siklus render.
   *
   * Dua perubahan yang datang sebelum render berikutnya — dua klik cepat, atau
   * satu penangan yang mengubah dua butir — masing-masing akan berangkat dari
   * `lembar` render yang sama, dan yang kedua menimpa yang pertama. Berangkat
   * dari ref menjamin tiap perubahan menumpuk di atas yang sebelumnya.
   */
  const lembarRef = useRef(lembar);
  const setLembar = (baru: Lembar) => {
    lembarRef.current = baru;
    setLembarState(baru);
  };
  const [peringatan, setPeringatan] = useState<string | null>(null);

  useSyncExternalStore(langganAdministrasi, versiAdministrasi);
  const versiT = useSyncExternalStore(langganTemuan, versiTemuan);
  const admin = administrasiAset(bridge.id);

  const readings = telemetry?.readings ?? null;
  const temuan = useMemo(() => nilaiTemuan(daftarTemuan(bridge.id)), [bridge.id, versiT]);
  const usulan = useMemo(() => susunUsulan(readings, temuan), [readings, temuan]);
  const smks = useMemo(() => periksaSmks(bridge.id, readings), [bridge.id, readings]);
  const konteks: KonteksPetunjuk = useMemo(
    () => ({
      readings,
      smks,
      temuan,
      dossier,
      mukaAir: telemetry ? environmentAt(telemetry.at).water : null,
    }),
    [readings, smks, temuan, dossier, telemetry],
  );

  const terkunci = Boolean(lembar.selesai);
  const maju = kemajuan(lembar);

  const simpan = (baru: Lembar) => {
    setLembar(baru);
    setPeringatan(
      simpanLembar(bridge.id, baru)
        ? null
        : 'Penyimpanan peramban penuh; isian hanya ada di ingatan halaman dan hilang saat halaman ditutup.',
    );
  };

  const ubah = (f: (l: Lembar) => Lembar) => simpan(f(lembarRef.current));

  const ubahJawaban = (id: string, bagian: Partial<Jawaban>) =>
    ubah((l) => ({
      ...l,
      jawaban: {
        ...l.jawaban,
        [id]: { ...(l.jawaban[id] ?? { ya: null, lokasi: '', catatan: '' }), ...bagian },
      },
    }));

  const gantiTahun = (t: number) => {
    setTahun(t);
    setLembar(lembarTahun(bridge.id, t));
    setPeringatan(null);
  };

  const daftarTahun = [...new Set([tahunIni, ...tahunTersimpan(bridge.id)])].sort((a, b) => b - a);

  const baris = (b: ButirForm) => {
    const j = lembar.jawaban[b.id];
    const petunjuk = petunjukUntuk(b.id, konteks);
    return (
      <tr key={b.id}>
        <td style={{ minWidth: 260, lineHeight: 1.45 }}>
          <span className="tabular text-muted">{b.huruf ? `${b.huruf}.` : ''}</span> {b.uraian}
          {petunjuk ? (
            <div className="text-muted" style={{ fontSize: 11.5, marginTop: 3 }}>
              {petunjuk.teks}{' '}
              {petunjuk.saran !== undefined && !terkunci && j?.ya !== petunjuk.saran ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '1px 8px' }}
                  onClick={() => ubahJawaban(b.id, { ya: petunjuk.saran as boolean })}
                >
                  Pakai saran: {petunjuk.saran ? 'Ya' : 'Tidak'}
                </button>
              ) : null}
            </div>
          ) : null}
        </td>
        <td>
          <YaTidak
            nama={`Jawaban ${b.elemen} ${b.huruf ?? ''}`}
            nilai={j?.ya ?? null}
            mati={terkunci}
            onPilih={(v) => ubahJawaban(b.id, { ya: v })}
          />
        </td>
        <td style={{ minWidth: 150 }}>
          <input
            className="input"
            aria-label={`Lokasi ${b.elemen} ${b.huruf ?? ''}`}
            placeholder={j?.ya ? 'wajib: lokasi' : 'lokasi'}
            value={j?.lokasi ?? ''}
            disabled={terkunci}
            onChange={(e) => ubahJawaban(b.id, { lokasi: e.target.value })}
            style={j?.ya && !j.lokasi.trim() ? { boxShadow: 'inset 0 0 0 1px var(--state-waspada)' } : undefined}
          />
        </td>
      </tr>
    );
  };

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <div id="rutin-bagian-1" className="glass card" style={{ padding: 'var(--space-4)', scrollMarginTop: 'var(--space-3)' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="card-kicker">Bagian ke-1 · Data administrasi</span>
          <div className="seg" role="group" aria-label="Tahun lembar">
            {daftarTahun.map((t) => (
              <button key={t} type="button" className="seg-opt" aria-pressed={tahun === t} onClick={() => gantiTahun(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 'var(--space-3)',
            marginTop: 8,
          }}
        >
          <div className="field">
            <label htmlFor="fr-nomor">Nomor jembatan</label>
            <input
              id="fr-nomor"
              className="input"
              value={admin.nomorJembatan}
              placeholder="belum diisi"
              onChange={(e) => simpanAdministrasi(bridge.id, { ...admin, nomorJembatan: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="fr-kota">Dari (kota asal / km nol)</label>
            <input
              id="fr-kota"
              className="input"
              value={admin.kotaAsal}
              placeholder="belum diisi"
              onChange={(e) => simpanAdministrasi(bridge.id, { ...admin, kotaAsal: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="fr-km">Km (jarak dari kota asal)</label>
            <input
              id="fr-km"
              className="input"
              value={admin.kilometer}
              placeholder="belum diisi"
              onChange={(e) => simpanAdministrasi(bridge.id, { ...admin, kilometer: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="fr-tanggal">Tanggal pemeriksaan</label>
            <input id="fr-tanggal" className="input" type="date" value={lembar.tanggal} disabled={terkunci} onChange={(e) => ubah((l) => ({ ...l, tanggal: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="fr-pemeriksa">Nama pemeriksa</label>
            <input
              id="fr-pemeriksa"
              className="input"
              value={lembar.pemeriksa}
              placeholder={petugas()}
              disabled={terkunci}
              onChange={(e) => ubah((l) => ({ ...l, pemeriksa: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="fr-nip">NIP</label>
            <input id="fr-nip" className="input" value={lembar.nip} disabled={terkunci} onChange={(e) => ubah((l) => ({ ...l, nip: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="glass card" style={{ padding: 'var(--space-4)' }}>
        <span className="card-kicker">Tindakan darurat</span>
        <div className="row" style={{ gap: 'var(--space-3)', marginTop: 8 }}>
          <span>Apakah tindakan darurat disarankan?</span>
          <YaTidak
            nama="Tindakan darurat disarankan"
            nilai={lembar.darurat}
            mati={terkunci}
            onPilih={(v) => ubah((l) => ({ ...l, darurat: v, tindakan: v ? l.tindakan : [] }))}
          />
          <span className="text-muted" style={{ fontSize: 12 }}>
            Usulan sistem: <strong>{usulan.daruratDisarankan ? 'Ya' : 'Tidak'}</strong>
            {usulan.daruratDisarankan ? ` (${[...new Set(usulan.darurat.map((u) => u.kode))].join(', ')})` : ''}
          </span>
          {!terkunci && lembar.darurat !== usulan.daruratDisarankan ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => ubah((l) => ({ ...l, darurat: usulan.daruratDisarankan }))}>
              Pakai usulan
            </button>
          ) : null}
        </div>
        {lembar.darurat ? (
          <div className="row" style={{ gap: 'var(--space-3)', marginTop: 10 }}>
            {TINDAKAN_DARURAT.map((t, i) => (
              <label key={t} className="row" style={{ gap: 6, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  disabled={terkunci}
                  checked={lembar.tindakan.includes(i)}
                  onChange={(e) =>
                    ubah((l) => ({
                      ...l,
                      tindakan: e.target.checked ? [...l.tindakan, i].sort() : l.tindakan.filter((x) => x !== i),
                    }))
                  }
                />
                {'abcdef'[i]}. {t}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="glass card" style={{ padding: 'var(--space-4)' }}>
        <span className="card-kicker">Catatan</span>
        {(
          [
            ['sesuaiInventarisasi', 'Apakah kondisi jembatan sesuai dengan Pemeriksaan Inventarisasi terakhir?'],
            ['sesuaiDetail', 'Apakah kondisi jembatan sesuai dengan Pemeriksaan Detail terakhir?'],
          ] as const
        ).map(([kunci, tanya]) => (
          <div key={kunci} className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 13 }}>{tanya}</span>
            <YaTidak nama={tanya} nilai={lembar[kunci]} mati={terkunci} onPilih={(v) => ubah((l) => ({ ...l, [kunci]: v }))} />
          </div>
        ))}
      </div>

      {BAGIAN_FORM.map((bagian) => {
        const isi = BUTIR_FORM.filter((b) => b.bagian === bagian);
        const elemen = [...new Set(isi.map((b) => b.elemen))];
        const dijawab = isi.filter((b) => lembar.jawaban[b.id]?.ya != null).length;
        return (
          <div
            key={bagian}
            id={bagian === BAGIAN_FORM[0] ? 'rutin-bagian-2' : undefined}
            className="glass card"
            style={{ padding: 0, overflow: 'hidden', scrollMarginTop: 'var(--space-3)' }}
          >
            <div className="card-head">
              <span className="card-kicker">{bagian === BAGIAN_FORM[0] ? 'Bagian ke-2 · ' : ''}{bagian}</span>
              <span className="text-muted" style={{ fontSize: 11 }}>{dijawab} / {isi.length}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Penjelasan</th>
                    <th>Ya / Tidak</th>
                    <th>Lokasi</th>
                  </tr>
                </thead>
                <tbody>
                  {elemen.map((nama) => (
                    <FragmenElemen key={nama} nama={nama}>
                      {isi.filter((b) => b.elemen === nama).map(baris)}
                    </FragmenElemen>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="glass card" style={{ padding: 'var(--space-4)' }}>
        <span className="card-kicker">Selesai</span>
        {lembar.selesai ? (
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <span>
              Data dimasukkan {tanggalPendek(lembar.selesai.tanggal)} oleh <strong>{lembar.selesai.oleh}</strong>. Lembar terkunci.
            </span>
            <button type="button" className="btn btn-sm" onClick={() => bukaLembar(bridge.id, lembar) && setLembar({ ...lembar, selesai: undefined })}>
              Buka kembali untuk koreksi
            </button>
          </div>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 8, gap: 'var(--space-3)' }}>
              <span style={{ fontSize: 13 }}>
                {maju.terjawab} / {maju.total} butir terjawab
                {maju.kurang.length ? ` · kurang: ${maju.kurang.join('; ')}` : ''}
              </span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={maju.kurang.length > 0}
                onClick={() => {
                  if (selesaikanLembar(bridge.id, lembar)) setLembar(lembarTahun(bridge.id, tahun));
                }}
              >
                Tandai selesai
              </button>
            </div>
          </>
        )}
        {peringatan ? (
          <p role="alert" style={{ fontSize: 12, margin: '8px 0 0', color: 'var(--state-waspada)' }}>{peringatan}</p>
        ) : null}
      </div>
      <BilahBagian bagian={BAGIAN} />
    </div>
  );
}

/** Judul kelompok elemen di dalam tabel, sebelum butir-butirnya. */
function FragmenElemen({ nama, children }: { nama: string; children: ReactNode }) {
  return (
    <>
      <tr>
        <td colSpan={3} style={{ fontWeight: 700, background: 'rgb(255 255 255 / 0.04)' }}>{nama}</td>
      </tr>
      {children}
    </>
  );
}
