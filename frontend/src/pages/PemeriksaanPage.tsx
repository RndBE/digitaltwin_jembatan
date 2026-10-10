import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Bridge } from '../lib/types';
import {
  ELEMEN_BY_KODE,
  ELEMEN_UTAMA,
  KERUSAKAN,
  NK_KELAS,
  NK_URAIAN,
  ambangKuantitas,
  hitungSkor,
  kerusakanUntuk,
  lokasiLabel,
  nilaiTemuan,
  ringkasKondisi,
  type Biner,
  type FotoTemuan,
  type SimpulKondisi,
} from '../domain/pedoman';
import {
  MAKS_FOTO,
  daftarTemuan,
  hapusTemuan,
  langganTemuan,
  pemeriksaBawaan,
  tambahTemuan,
  versiTemuan,
} from '../domain/temuan';
import { dossierFor, type Camera } from '../domain/demoData';
import { tangkapSvg } from '../lib/tangkap';
import { intipTitipan, kosongkanTitipan } from '../domain/lokasiModel';
import { CameraFrame } from '../components/CameraTile';
import { Modal } from '../components/Modal';
import { Select, type SelectGroup } from '../components/Select';
import { PageHeader, Stat } from '../components/Ui';

/**
 * Pemeriksaan detail menurut Pedoman Pemeriksaan Jembatan No. 01/P/BM/2022.
 *
 * Halaman ini mencatat **kerusakan**, bukan kondisi: pedoman hanya meminta
 * elemen yang rusak dicatat, dan menilainya dengan lima pertanyaan — Struktur
 * (S), Kerusakan (R), Kuantitas (K), Fungsi (F), Pengaruh (P) — yang
 * jumlahnya menjadi Nilai Kondisi 0–5 (Bab 5.7, Tabel F.1). S dan R tidak
 * ditebak: keduanya dibaca dari kolom Penyebab dan Pengukuran Lampiran D, dan
 * K dari rasio volume. F dan P adalah penilaian pemeriksa.
 *
 * Nilainya tidak bercampur dengan skor telemetri di halaman Kondisi elemen.
 * Pedoman tidak mengatur penggabungan sensor dengan pemeriksaan visual, jadi
 * dua angka itu dibiarkan berdampingan dan masing-masing menyebut asalnya.
 */

const angka = (teks: string): number => {
  const nilai = Number(teks.trim().replace(',', '.'));
  return Number.isFinite(nilai) ? nilai : NaN;
};

const bilanganBulat = (teks: string): number | undefined => {
  if (!teks.trim()) return undefined;
  const nilai = Math.trunc(Number(teks));
  return Number.isFinite(nilai) && nilai >= 0 ? nilai : undefined;
};

const hariIni = () => new Date().toISOString().slice(0, 10);

const tgl = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

const persen = (v: number) => `${(v * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

const GRUP_ELEMEN: SelectGroup[] = ELEMEN_UTAMA.flatMap((utama) =>
  utama.klaster.map((klaster) => ({
    label: `${utama.kode} ${utama.nama} · ${klaster.kode} ${klaster.nama}`,
    options: klaster.elemen.map((el) => ({
      value: el.kode,
      label: `${el.kode} · ${el.nama}`,
      hint: el.struktural ? 'struktural' : 'non-struktural',
    })),
  })),
);

/**
 * Kamera yang paling mungkin memperlihatkan sebuah elemen: tumpuan (4.61x)
 * dilihat kamera tumpuan, selebihnya kamera bentang. Hanya saran awal —
 * pemeriksa dapat memilih kamera lain.
 */
function kameraUntukElemen(kode: string, kamera: Camera[]): Camera | undefined {
  const view: Camera['view'] = kode.startsWith('4.61') ? 'tumpuan' : 'bentang';
  const bisa = kamera.filter((c) => c.status !== 'luring');
  return bisa.find((c) => c.view === view && c.status === 'daring') ?? bisa.find((c) => c.view === view) ?? bisa[0];
}

export interface PemeriksaanPageProps {
  bridge: Bridge;
}

export function PemeriksaanPage({ bridge }: PemeriksaanPageProps) {
  const versi = useSyncExternalStore(langganTemuan, versiTemuan);
  const temuan = useMemo(() => nilaiTemuan(daftarTemuan(bridge.id)), [bridge.id, versi]);
  const ringkas = useMemo(() => ringkasKondisi(temuan), [temuan]);

  /*
   * Bagian model 3D yang ditunjuk pemeriksa sebelum membuka halaman ini.
   *
   * Dibaca sekali sebagai nilai awal; titipannya dikosongkan di efek di bawah
   * supaya kunjungan berikutnya tidak membawa pilihan yang basi.
   */
  const [awal] = useState(() => intipTitipan());
  useEffect(() => {
    kosongkanTitipan();
  }, []);

  const [elemenKode, setElemenKode] = useState(() =>
    awal && ELEMEN_BY_KODE[awal.elemen] ? awal.elemen : '4.453b',
  );
  const elemen = ELEMEN_BY_KODE[elemenKode].elemen;
  const pilihanKerusakan = useMemo(() => kerusakanUntuk(elemen), [elemen]);

  const [kerusakanKode, setKerusakanKode] = useState(pilihanKerusakan[0].kode);
  // Pindah elemen dapat membuat kode yang dipilih tidak berlaku lagi; pakai
  // yang pertama yang berlaku alih-alih membiarkan pilihan menggantung.
  const kerusakan = KERUSAKAN[pilihanKerusakan.some((k) => k.kode === kerusakanKode) ? kerusakanKode : pilihanKerusakan[0].kode];

  const [sebab, setSebab] = useState(0);
  const [ukur, setUkur] = useState(0);
  const teks = (v?: number) => (v === undefined ? '' : String(v));
  const [bentang, setBentang] = useState(() => String(awal?.bentang ?? 1));
  const [posisi, setPosisi] = useState<'' | 'A1' | 'A2'>(awal?.posisi ?? '');
  const [x, setX] = useState(() => teks(awal?.x));
  const [y, setY] = useState(() => teks(awal?.y));
  const [z, setZ] = useState(() => teks(awal?.z));
  const [dariModel, setDariModel] = useState<string | null>(awal?.bagian ?? null);
  const [volumeRusak, setVolumeRusak] = useState('');
  const [volumeTotal, setVolumeTotal] = useState('');
  const [f, setF] = useState<Biner>(0);
  const [p, setP] = useState<Biner>(0);
  const [tanggal, setTanggal] = useState(hariIni);
  const [pemeriksa, setPemeriksa] = useState(() => pemeriksaBawaan());
  const [catatan, setCatatan] = useState('');

  // Foto (Lampiran G): tangkapan bingkai kamera yang dilampirkan pada temuan.
  const kamera = useMemo(() => dossierFor(bridge.id)?.cameras ?? [], [bridge.id]);
  const [kameraPilih, setKameraPilih] = useState<string | null>(null);
  const kameraAktif = kamera.find((c) => c.id === kameraPilih && c.status !== 'luring') ?? kameraUntukElemen(elemenKode, kamera);
  const [foto, setFoto] = useState<FotoTemuan[]>([]);
  const [galatFoto, setGalatFoto] = useState<string | null>(null);
  const [peringatan, setPeringatan] = useState<string | null>(null);
  const [lihat, setLihat] = useState<{ foto: FotoTemuan; judul: string } | null>(null);
  const pratinjau = useRef<HTMLDivElement>(null);

  const ambilFoto = async () => {
    const svg = pratinjau.current?.querySelector('svg');
    if (!svg || !kameraAktif) return;
    setGalatFoto(null);
    try {
      const waktu = new Date();
      const hasil = await tangkapSvg(svg, { kamera: kameraAktif.id, tempat: kameraAktif.place, waktu });
      setFoto((lama) => [
        ...lama,
        { ...hasil, kamera: kameraAktif.id, tempat: kameraAktif.place, at: waktu.toISOString(), peraga: true },
      ]);
    } catch (e) {
      setGalatFoto(e instanceof Error ? e.message : 'Tangkapan gagal.');
    }
  };

  const ukurAman = Math.min(ukur, kerusakan.ukur.length - 1);
  const sebabAman = kerusakan.sebab ? Math.min(sebab, kerusakan.sebab.length - 1) : undefined;
  const rusak = angka(volumeRusak);
  const total = angka(volumeTotal);
  const volumeSah = Number.isFinite(rusak) && Number.isFinite(total) && rusak >= 0 && total > 0 && rusak <= total;

  const skor = hitungSkor(elemen, kerusakan, {
    sebab: sebabAman,
    ukur: ukurAman,
    volumeRusak: Number.isFinite(rusak) ? rusak : 0,
    volumeTotal: Number.isFinite(total) ? total : 0,
    f,
    p,
  });

  const gantiElemen = (kode: string) => {
    setElemenKode(kode);
    setKerusakanKode(kerusakanUntuk(ELEMEN_BY_KODE[kode].elemen)[0].kode);
    setSebab(0);
    setUkur(0);
  };

  const gantiKerusakan = (kode: string) => {
    setKerusakanKode(kode);
    setSebab(0);
    setUkur(0);
  };

  const simpan = () => {
    if (!volumeSah || !pemeriksa.trim()) return;
    const tersimpan = tambahTemuan(bridge.id, {
      tanggal,
      pemeriksa: pemeriksa.trim(),
      elemen: elemenKode,
      kerusakan: kerusakan.kode,
      bentang: bilanganBulat(bentang) ?? 1,
      posisi: posisi || undefined,
      x: bilanganBulat(x),
      y: bilanganBulat(y),
      z: bilanganBulat(z),
      sebab: sebabAman,
      ukur: ukurAman,
      volumeRusak: rusak,
      volumeTotal: total,
      f,
      p,
      catatan: catatan.trim(),
      foto: foto.length ? foto : undefined,
    });
    setPeringatan(
      tersimpan
        ? null
        : 'Penyimpanan peramban penuh, jadi temuan ini hanya ada di ingatan halaman dan hilang saat halaman ditutup. Hapus temuan lama atau lampirkan lebih sedikit foto.',
    );
    setFoto([]);
    setVolumeRusak('');
    setVolumeTotal('');
    setF(0);
    setP(0);
    setCatatan('');
  };

  const kelompokKerusakan: SelectGroup[] = [...new Set(pilihanKerusakan.map((k) => k.kelompok))].map((label) => ({
    label,
    options: pilihanKerusakan
      .filter((k) => k.kelompok === label)
      .map((k) => ({ value: k.kode, label: `${k.kode} · ${k.nama}` })),
  }));

  const lokasiPratinjau = lokasiLabel({
    bentang: bilanganBulat(bentang) ?? 1,
    posisi: posisi || undefined,
    x: bilanganBulat(x),
    y: bilanganBulat(y),
    z: bilanganBulat(z),
  });

  const uraian = NK_URAIAN[ringkas.nk];

  return (
    <div className="screen">
      <PageHeader
        kicker="Pedoman Bina Marga"
        title="Pemeriksaan detail"
        lede="Pencatatan kerusakan elemen menurut Pedoman Pemeriksaan Jembatan No. 01/P/BM/2022. Nilai Kondisi = S + R + K + F + P, dibaca dari kriteria Lampiran D."
      />

      <section className="glass glass--chip stat-row" style={{ gridTemplateColumns: 'minmax(200px, 320px)', marginBottom: 'var(--space-3)' }}>
        <Stat
          label="Nilai Kondisi jembatan"
          value={ringkas.nk}
          unit="/5"
          note={uraian.label}
          tone={ringkas.nk >= 3 ? 'critical' : ringkas.nk === 2 ? 'warn' : 'accent'}
        />
      </section>

      <div
        className="split"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 1fr)',
          gap: 'var(--space-3)',
          alignItems: 'start',
        }}
      >
        <div className="glass card" style={{ padding: 'var(--space-4)' }}>
          <span className="card-kicker">Catat kerusakan</span>

          <div className="stack" style={{ gap: 'var(--space-3)', marginTop: 6 }}>
            {dariModel ? (
              <div
                role="status"
                className="row"
                style={{
                  gap: 'var(--space-2)',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: 'rgb(71 166 255 / 0.12)',
                  fontSize: 12.5,
                }}
              >
                <span>
                  Dari model 3D: <strong className="tabular">{dariModel}</strong>
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDariModel(null)}>
                  Tutup
                </button>
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="pm-elemen">Elemen</label>
              <Select id="pm-elemen" value={elemenKode} onChange={gantiElemen} groups={GRUP_ELEMEN} />
            </div>

            <div className="field">
              <label>Lokasi (kosongkan bila seluruh elemen)</label>
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                {(
                  [
                    ['Bentang', bentang, setBentang, 'B'],
                    ['X memanjang', x, setX, 'X'],
                    ['Y melintang', y, setY, 'Y'],
                    ['Z vertikal', z, setZ, 'Z'],
                  ] as const
                ).map(([nama, nilai, setNilai, kunci]) => (
                  <input
                    key={kunci}
                    className="input"
                    inputMode="numeric"
                    placeholder={nama}
                    aria-label={nama}
                    value={nilai}
                    onChange={(e) => setNilai(e.target.value)}
                    style={{ width: 108 }}
                  />
                ))}
                <div style={{ width: 120 }}>
                  <Select
                    aria-label="Posisi abutmen"
                    value={posisi}
                    onChange={(v) => setPosisi(v as '' | 'A1' | 'A2')}
                    placeholder="Bentang"
                    groups={[
                      {
                        options: [
                          { value: '', label: 'Bentang (B)' },
                          { value: 'A1', label: 'Abutmen A1' },
                          { value: 'A2', label: 'Abutmen A2' },
                        ],
                      },
                    ]}
                  />
                </div>
                <span className="tag tag-outline tabular">{lokasiPratinjau}</span>
              </div>
            </div>

            <div className="field">
              <label htmlFor="pm-kerusakan">Kerusakan</label>
              <Select id="pm-kerusakan" value={kerusakan.kode} onChange={gantiKerusakan} groups={kelompokKerusakan} />
            </div>

            {kerusakan.sebab ? (
              <div className="field">
                <label htmlFor="pm-sebab">Penyebab</label>
                <Select
                  id="pm-sebab"
                  value={String(sebabAman)}
                  onChange={(v) => setSebab(Number(v))}
                  groups={[
                    {
                      options: kerusakan.sebab.map((item, i) => ({
                        value: String(i),
                        label: item.label,
                        hint: item.s ? 'berbahaya' : 'tidak berbahaya',
                      })),
                    },
                  ]}
                />
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="pm-ukur">Pengukuran</label>
              <Select
                id="pm-ukur"
                value={String(ukurAman)}
                onChange={(v) => setUkur(Number(v))}
                groups={[
                  {
                    options: kerusakan.ukur.map((item, i) => ({
                      value: String(i),
                      label: item.label,
                      hint: item.r ? 'parah' : 'tidak parah',
                    })),
                  },
                ]}
              />
            </div>

            <div className="field">
              <label>Kuantitas ({kerusakan.satuan})</label>
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="Volume rusak"
                  aria-label="Volume kerusakan"
                  value={volumeRusak}
                  onChange={(e) => setVolumeRusak(e.target.value)}
                  style={{ width: 130 }}
                />
                <span className="text-muted">dari</span>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="Volume total"
                  aria-label="Volume total elemen"
                  value={volumeTotal}
                  onChange={(e) => setVolumeTotal(e.target.value)}
                  style={{ width: 130 }}
                />
                {volumeSah ? (
                  <span className="tag tag-outline tabular">
                    {persen(skor.rasio)} · ambang {persen(ambangKuantitas(elemen.struktural))}
                  </span>
                ) : null}
              </div>
              {volumeRusak && volumeTotal && !volumeSah ? (
                <span style={{ fontSize: 11, color: 'var(--state-waspada)' }}>
                  Volume total harus lebih dari nol dan tidak lebih kecil dari volume rusak.
                </span>
              ) : null}
            </div>

            <div className="field">
              <label>Penilaian</label>
              <label className="row" style={{ gap: 8, fontSize: 12.5, color: 'var(--mist-100)' }}>
                <input type="checkbox" checked={f === 1} onChange={(e) => setF(e.target.checked ? 1 : 0)} />
                <span>
                  <strong>F</strong> · elemen tidak lagi berfungsi
                </span>
              </label>
              <label className="row" style={{ gap: 8, fontSize: 12.5, color: 'var(--mist-100)' }}>
                <input type="checkbox" checked={p === 1} onChange={(e) => setP(e.target.checked ? 1 : 0)} />
                <span>
                  <strong>P</strong> · memengaruhi elemen lain atau pengguna
                </span>
              </label>
            </div>

            <div className="field">
              <label>Foto (maks. {MAKS_FOTO})</label>
              {kameraAktif ? (
                <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                  <div ref={pratinjau} style={{ width: 160, flex: 'none', borderRadius: 10, overflow: 'hidden' }}>
                    <CameraFrame camera={kameraAktif} at={new Date().toISOString()} />
                  </div>
                  <div className="stack" style={{ gap: 8, flex: 1, minWidth: 200 }}>
                    <Select
                      id="pm-kamera"
                      aria-label="Kamera sumber foto"
                      value={kameraAktif.id}
                      onChange={setKameraPilih}
                      groups={[
                        {
                          options: kamera
                            .filter((c) => c.status !== 'luring')
                            .map((c) => ({ value: c.id, label: `${c.id} · ${c.place}`, hint: c.status })),
                        },
                      ]}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={foto.length >= MAKS_FOTO}
                      onClick={ambilFoto}
                    >
                      Ambil tangkapan ({foto.length}/{MAKS_FOTO})
                    </button>
                    {galatFoto ? <span style={{ fontSize: 11, color: 'var(--state-bahaya)' }}>{galatFoto}</span> : null}
                  </div>
                </div>
              ) : (
                <span className="text-muted" style={{ fontSize: 11 }}>Tidak ada kamera.</span>
              )}
              {foto.length ? (
                <div className="row" style={{ gap: 'var(--space-2)', marginTop: 6 }}>
                  {foto.map((f, i) => (
                    <figure key={f.at} style={{ margin: 0, position: 'relative' }}>
                      <img
                        src={f.data}
                        alt={`Tangkapan ${f.kamera}`}
                        width={120}
                        style={{ display: 'block', borderRadius: 8, cursor: 'zoom-in' }}
                        onClick={() => setLihat({ foto: f, judul: `${elemenKode} · ${kerusakan.kode}` })}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={`Buang tangkapan ${i + 1}`}
                        style={{ position: 'absolute', top: 2, right: 2, padding: '2px 8px' }}
                        onClick={() => setFoto((lama) => lama.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    </figure>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <div className="field" style={{ flex: '0 0 150px' }}>
                <label htmlFor="pm-tanggal">Tanggal</label>
                <input id="pm-tanggal" className="input" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label htmlFor="pm-pemeriksa">Pemeriksa</label>
                <input id="pm-pemeriksa" className="input" value={pemeriksa} onChange={(e) => setPemeriksa(e.target.value)} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="pm-catatan">Catatan</label>
              <input id="pm-catatan" className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
            </div>

            <div className="hairline" />

            <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <div className="row" style={{ gap: 6 }} aria-label="Rincian penilaian">
                {(
                  [
                    ['S', skor.s],
                    ['R', skor.r],
                    ['K', skor.k],
                    ['F', skor.f],
                    ['P', skor.p],
                  ] as const
                ).map(([huruf, nilai]) => (
                  <span key={huruf} className={nilai ? 'tag tag-waspada' : 'tag tag-neutral'} style={{ minWidth: 34, justifyContent: 'center' }}>
                    {huruf} {nilai}
                  </span>
                ))}
                <span className="text-muted">=</span>
                <span className={NK_KELAS[skor.nk]} style={{ fontSize: 13 }}>
                  NK {skor.nk} · {NK_URAIAN[skor.nk].label}
                </span>
              </div>
              <button type="button" className="btn btn-primary" disabled={!volumeSah || !pemeriksa.trim()} onClick={simpan}>
                Simpan temuan
              </button>
            </div>
            {peringatan ? (
              <p role="alert" style={{ fontSize: 12, margin: 0, color: 'var(--state-waspada)', lineHeight: 1.5 }}>
                {peringatan}
              </p>
            ) : null}
          </div>
        </div>

        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="card-head">
              <span className="card-kicker">Nilai Kondisi per level</span>
            </div>
            <div style={{ padding: 'var(--space-2) 0 var(--space-3)' }}>
              <Pohon simpul={ringkas} kedalaman={0} />
            </div>
          </div>
        </div>
      </div>

      <div className="glass card" style={{ padding: 0, overflow: 'hidden', marginTop: 'var(--space-3)' }}>
        <div className="card-head">
          <span className="card-kicker">Temuan tercatat</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Elemen</th>
                <th>Lokasi</th>
                <th>Kerusakan</th>
                <th className="num">S</th>
                <th className="num">R</th>
                <th className="num">K</th>
                <th className="num">F</th>
                <th className="num">P</th>
                <th className="num">NK</th>
                <th>Foto</th>
                <th>Pemeriksa</th>
                <th aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {temuan.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-muted">Belum ada kerusakan yang dicatat.</td>
                </tr>
              ) : null}
              {temuan.map((t) => (
                <tr key={t.id}>
                  <td className="tabular" style={{ whiteSpace: 'nowrap' }}>{tgl(t.tanggal)}</td>
                  <td style={{ minWidth: 180 }}>
                    <span className="tabular text-muted">{t.elemen}</span> {t.elemenSpec.nama}
                  </td>
                  <td className="tabular" style={{ whiteSpace: 'nowrap' }}>{lokasiLabel(t)}</td>
                  <td style={{ minWidth: 220, lineHeight: 1.45 }}>
                    <span className="tabular text-muted">{t.kerusakan}</span> {t.kerusakanSpec.nama}
                    {t.catatan ? <div className="text-muted" style={{ fontSize: 11.5 }}>{t.catatan}</div> : null}
                  </td>
                  <td className="num">{t.skor.s}</td>
                  <td className="num">{t.skor.r}</td>
                  <td className="num" title={`${persen(t.skor.rasio)} dari elemen`}>{t.skor.k}</td>
                  <td className="num">{t.skor.f}</td>
                  <td className="num">{t.skor.p}</td>
                  <td className="num">
                    <span className={NK_KELAS[t.skor.nk]}>{t.skor.nk}</span>
                  </td>
                  <td>
                    {t.foto?.length ? (
                      <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        {t.foto.map((f) => (
                          <img
                            key={f.at}
                            src={f.data}
                            alt={`Tangkapan ${f.kamera}`}
                            width={56}
                            style={{ borderRadius: 6, cursor: 'zoom-in', display: 'block' }}
                            onClick={() => setLihat({ foto: f, judul: `${t.elemen} · ${t.kerusakan}` })}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td style={{ minWidth: 140 }}>
                    {t.pemeriksa}
                    {t.contoh ? <span className="tag tag-neutral" style={{ marginLeft: 6, fontSize: 10 }}>CONTOH</span> : null}
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => hapusTemuan(bridge.id, t.id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal
        open={lihat !== null}
        title="Foto kerusakan"
        size="lebar"
        subtitle={lihat ? `${lihat.judul} · ${lihat.foto.kamera} · ${tgl(lihat.foto.at)}` : undefined}
        onClose={() => setLihat(null)}
      >
        {lihat ? (
          <>
            <img src={lihat.foto.data} alt={`Tangkapan ${lihat.foto.kamera}`} style={{ width: '100%', borderRadius: 10, display: 'block' }} />
            <a className="btn btn-sm" href={lihat.foto.data} download={`${lihat.judul.replace(/[^\w.-]+/g, '_')}_${lihat.foto.kamera}.jpg`}>
              Unduh JPEG
            </a>
          </>
        ) : null}
      </Modal>
    </div>
  );
}

/** Pohon Level 1 sampai 4; tiap baris membawa kode pedomannya dan Nilai Kondisinya. */
function Pohon({ simpul, kedalaman }: { simpul: SimpulKondisi; kedalaman: number }) {
  return (
    <>
      <div
        className="elemen-baris"
        style={{ paddingLeft: `calc(var(--space-4) + ${kedalaman * 14}px)`, cursor: 'default' }}
      >
        <span className="tabular text-muted" style={{ fontSize: 11, flex: 'none', minWidth: 46 }}>
          {simpul.kode}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontWeight: simpul.level <= 3 ? 600 : 400 }}>{simpul.nama}</span>
        {!simpul.struktural ? (
          <span className="tag tag-neutral" style={{ fontSize: 10 }}>non-struktural</span>
        ) : null}
        {simpul.temuan ? <span className="text-muted tabular" style={{ fontSize: 11 }}>{simpul.temuan} temuan</span> : null}
        <span className={NK_KELAS[simpul.nk]} style={{ minWidth: 28, justifyContent: 'center' }}>{simpul.nk}</span>
      </div>
      {simpul.anak.filter((a) => a.level <= 3 || a.temuan > 0).map((anak) => (
        <Pohon key={anak.kode} simpul={anak} kedalaman={kedalaman + 1} />
      ))}
    </>
  );
}
