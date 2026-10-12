import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { Bridge, Telemetry } from '../lib/types';
import type { ScreenKey } from '../components/Sidebar';
import { PageHeader } from '../components/Ui';
import { dossierFor, tanggalPendek } from '../domain/demoData';
import { bridgeCondition } from '../domain/elements';
import { conditionStatus, CONDITION_CLASS, CONDITION_LABEL } from '../domain/condition';
import { STATUS_JADWAL_KELAS, STATUS_JADWAL_LABEL, susunJadwal } from '../domain/jadwal';
import { kemajuan, langganLembar, lembarTahun, versiLembar } from '../domain/lembarRutin';
import { NK_KELAS, NK_URAIAN, nilaiTemuan, ringkasKondisi } from '../domain/pedoman';
import { daftarTemuan, langganTemuan, versiTemuan } from '../domain/temuan';
import { susunUsulan } from '../domain/usulan';

/**
 * Ringkasan pemeriksaan: pintu masuk kelompok Pemeriksaan.
 *
 * Susunannya mengikuti Pedoman Pemeriksaan Jembatan No. 01/P/BM/2022 dua
 * kali. Di atas, tiga langkah kerja Bab 4.4.1 — perencanaan, pelaksanaan,
 * dokumentasi dan laporan — dengan tombol ke layar tempat tiap langkah
 * dikerjakan. Di bawah, empat jenis pemeriksaan Bab 4.3, masing-masing satu
 * kartu yang menyebut kapan terakhir dikerjakan, kapan berikutnya, dan apa
 * yang tertunda.
 *
 * Dua angka kondisi sengaja ditulis berdampingan dan diberi nama asalnya:
 * Nilai Kondisi (hasil pemeriksa, mengikuti pedoman) dan indeks kondisi
 * elemen (sensor + inspeksi, di luar pedoman). Pedoman Bab 1 mengecualikan
 * evaluasi yang menggabungkan keduanya, jadi keduanya tidak dicampur.
 */

export interface PeriksaPageProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
  onOpen: (screen: ScreenKey | 'rute') => void;
}

function Kartu({
  judul,
  rujukan,
  status,
  children,
  aksi,
  onAksi,
}: {
  judul: string;
  rujukan: string;
  status: ReactNode;
  children: ReactNode;
  aksi: string;
  onAksi: () => void;
}) {
  return (
    <div className="glass card periksa-kartu">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 1 }}>
          <span className="card-kicker">{judul}</span>
          <span className="text-muted" style={{ fontSize: 11 }}>{rujukan}</span>
        </div>
        {status}
      </div>
      <div className="stack" style={{ gap: 6, fontSize: 13, lineHeight: 1.5, flex: 1 }}>{children}</div>
      <div>
        <button type="button" className="btn btn-sm" onClick={onAksi}>{aksi}</button>
      </div>
    </div>
  );
}

const Baris = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="periksa-baris">
    <span className="text-muted">{label}</span>
    <span>{children}</span>
  </div>
);

export function PeriksaPage({ bridge, telemetry, onOpen }: PeriksaPageProps) {
  const versiT = useSyncExternalStore(langganTemuan, versiTemuan);
  useSyncExternalStore(langganLembar, versiLembar);
  const temuan = useMemo(() => nilaiTemuan(daftarTemuan(bridge.id)), [bridge.id, versiT]);
  const ringkas = useMemo(() => ringkasKondisi(temuan), [temuan]);
  const readings = telemetry?.readings ?? null;
  const usulan = useMemo(() => susunUsulan(readings, temuan), [readings, temuan]);
  const dossier = dossierFor(bridge.id);

  if (!dossier) {
    return (
      <div className="screen">
        <PageHeader
          kicker="Pemeriksaan"
          title="Ringkasan pemeriksaan"
          lede="Aset ini adalah model acuan dan tidak memiliki riwayat inspeksi."
        />
        <p className="text-muted">Aset ini adalah model acuan dan tidak memiliki riwayat inspeksi.</p>
      </div>
    );
  }

  const hariIni = new Date().toISOString().slice(0, 10);
  const [rutin, detail] = susunJadwal(dossier.inspections, hariIni);
  const tahun = new Date().getFullYear();
  const lembar = lembarTahun(bridge.id, tahun);
  const maju = kemajuan(lembar);
  const khususTerakhir = [...dossier.inspections]
    .filter((i) => i.kind === 'Khusus')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const berat = temuan.filter((t) => t.skor.nk >= 3).length;

  const kondisi = bridgeCondition(readings ?? []);
  const statusKondisi = conditionStatus(kondisi.index);

  const langkah: Array<{ no: string; judul: string; rujukan: string; isi: string; aksi: string; buka: ScreenKey | 'rute' }> = [
    {
      no: '1',
      judul: 'Perencanaan dan persiapan',
      rujukan: 'Bab 4.4.2 · hlm. 9',
      isi: 'Tinjau riwayat dan temuan terdahulu, lalu susun rute dari A1 ke A2.',
      aksi: 'Buka rute',
      buka: 'rute',
    },
    {
      no: '2',
      judul: 'Pelaksanaan di lapangan',
      rujukan: 'Bab 4.4.3 · hlm. 12',
      isi: 'Catat kerusakan per elemen, atau isi formulir Rutin.',
      aksi: 'Catat kerusakan',
      buka: 'pemeriksaan',
    },
    {
      no: '3',
      judul: 'Dokumentasi dan laporan',
      rujukan: 'Bab 4.4.4 · hlm. 18',
      isi: 'Cetak laporan sesuai susunan Lampiran A, atau unduh CSV temuan.',
      aksi: 'Buka laporan',
      buka: 'laporan',
    },
  ];

  return (
    <div className="screen">
      <PageHeader
        kicker="Pemeriksaan"
        title="Ringkasan pemeriksaan"
        lede="Tiga langkah kerja dan empat jenis pemeriksaan menurut Pedoman Pemeriksaan Jembatan No. 01/P/BM/2022."
        rujukan="Bab 4.3–4.4 · hlm. 6–19"
      />

      <section className="periksa-langkah" aria-label="Tahapan pemeriksaan">
        {langkah.map((l) => (
          <div key={l.no} className="glass glass--chip periksa-langkah-butir">
            <span className="periksa-no" aria-hidden="true">{l.no}</span>
            <div className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 13 }}>{l.judul}</strong>
              <span className="text-muted" style={{ fontSize: 11 }}>{l.rujukan}</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.45 }}>{l.isi}</span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(l.buka)}>{l.aksi}</button>
          </div>
        ))}
      </section>

      <section className="periksa-dua" aria-label="Dua penilaian kondisi">
        <div className="glass glass--chip periksa-nilai">
          <span className="stat-label">Hasil pemeriksa · pedoman</span>
          <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
            <span className="tabular" style={{ fontSize: 26, fontWeight: 650 }}>{ringkas.nk}<span className="text-muted" style={{ fontSize: 14 }}> /5</span></span>
            <span className={NK_KELAS[ringkas.nk]}>{NK_URAIAN[ringkas.nk].label}</span>
          </div>
          <span className="text-muted" style={{ fontSize: 11.5 }}>
            Nilai Kondisi jembatan dari {temuan.length} temuan tercatat · maksimum elemen struktural (Bab 4.3.2).
          </span>
        </div>
        <div className="glass glass--chip periksa-nilai">
          <span className="stat-label">Hasil sensor · di luar pedoman</span>
          <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
            <span className="tabular" style={{ fontSize: 26, fontWeight: 650 }}>{kondisi.index.toFixed(2)}</span>
            <span className={CONDITION_CLASS[statusKondisi]}>{CONDITION_LABEL[statusKondisi]}</span>
          </div>
          <span className="text-muted" style={{ fontSize: 11.5 }}>
            Indeks kondisi elemen dari sensor, inspeksi, dan uji diagnostik. Tidak dicampur dengan Nilai Kondisi (Bab 1).
          </span>
        </div>
      </section>

      <section className="periksa-kartu-grid" aria-label="Jenis pemeriksaan">
        <Kartu
          judul="Inventarisasi"
          rujukan="Bab 6 · hlm. 44–65"
          status={<span className="tag tag-outline">SEGERA</span>}
          aksi="Lihat cakupan"
          onAksi={() => onOpen('inventarisasi')}
        >
          <Baris label="Fungsi">Mendata administrasi, teknis, dan komponen jembatan sekali, sebagai dasar pemeriksaan lain.</Baris>
          <Baris label="Sekarang">Hanya sebagian data tersedia di halaman Informasi.</Baris>
        </Kartu>

        <Kartu
          judul="Detail"
          rujukan="Bab 7 · hlm. 66–75"
          status={<span className={STATUS_JADWAL_KELAS[detail.status]}>{STATUS_JADWAL_LABEL[detail.status]}</span>}
          aksi="Catat kerusakan"
          onAksi={() => onOpen('pemeriksaan')}
        >
          <Baris label="Terakhir">
            {detail.terakhir ? `${tanggalPendek(detail.terakhir.date)} · nilai kondisi ${detail.terakhir.conditionValue}` : 'Belum ada catatan'}
          </Baris>
          <Baris label="Jatuh tempo">
            {detail.jatuhTempo ? `${tanggalPendek(detail.jatuhTempo)} (${detail.sisaHari} hari)` : '—'}
          </Baris>
          <Baris label="Temuan">
            {temuan.length} tercatat{berat ? ` · ${berat} dengan NK ≥ 3` : ''}
          </Baris>
        </Kartu>

        <Kartu
          judul="Rutin"
          rujukan="Bab 8 · hlm. 75–87"
          status={<span className={STATUS_JADWAL_KELAS[rutin.status]}>{STATUS_JADWAL_LABEL[rutin.status]}</span>}
          aksi="Buka formulir"
          onAksi={() => onOpen('rutin')}
        >
          <Baris label="Terakhir">
            {rutin.terakhir ? `${tanggalPendek(rutin.terakhir.date)} · ${rutin.terakhir.kind}` : 'Belum ada catatan'}
          </Baris>
          <Baris label="Jatuh tempo">
            {rutin.jatuhTempo ? `${tanggalPendek(rutin.jatuhTempo)} (${rutin.sisaHari} hari)` : '—'}
          </Baris>
          <Baris label={`Lembar ${tahun}`}>
            {lembar.selesai ? 'Selesai dan terkunci' : `${maju.terjawab} / ${maju.total} butir terjawab`}
          </Baris>
          {usulan.daruratDisarankan ? (
            <Baris label="Darurat"><span className="tag tag-bahaya">DISARANKAN</span></Baris>
          ) : null}
        </Kartu>

        <Kartu
          judul="Khusus"
          rujukan="Bab 4.3.4, 9 · hlm. 88–92"
          status={
            usulan.khusus.length ? (
              <span className="tag tag-waspada">{usulan.khusus.length} USULAN</span>
            ) : (
              <span className="tag tag-normal">TIDAK ADA USULAN</span>
            )
          }
          aksi="Lihat usulan"
          onAksi={() => onOpen('khusus')}
        >
          <Baris label="Terakhir">
            {khususTerakhir ? `${tanggalPendek(khususTerakhir.date)} · nilai kondisi ${khususTerakhir.conditionValue}` : 'Belum ada catatan'}
          </Baris>
          <Baris label="Pemicu">Kanal struktural di luar rentang atau temuan dengan NK ≥ 4.</Baris>
        </Kartu>
      </section>
    </div>
  );
}
