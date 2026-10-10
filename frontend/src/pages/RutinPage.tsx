import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Bridge, Telemetry } from '../lib/types';
import { dossierFor, tanggalPendek } from '../domain/demoData';
import { nilaiTemuan } from '../domain/pedoman';
import { daftarTemuan, langganTemuan, versiTemuan } from '../domain/temuan';
import { STATUS_JADWAL_KELAS, STATUS_JADWAL_LABEL, susunJadwal } from '../domain/jadwal';
import { periksaSmks } from '../domain/smks';
import { susunUsulan, type Usulan } from '../domain/usulan';
import { PageHeader } from '../components/Ui';
import { FormulirRutin } from '../components/FormulirRutin';

/**
 * Pemeriksaan rutin dan tindak lanjutnya.
 *
 * Tiga hal dari Pedoman Pemeriksaan Jembatan No. 01/P/BM/2022 yang dapat
 * disiapkan dari data yang sudah dimiliki monitoring ini:
 *
 *   Jadwal          kapan Rutin dan Detail jatuh tempo (Bab 4.3, 7.1.1)
 *   Usulan          "Apakah tindakan darurat disarankan?" dan elemen yang
 *                   memerlukan Pemeriksaan Khusus (Tabel A.12, A.16)
 *   SMKS            ketidaklengkapan dan tidak berfungsinya elemen SMKS
 *                   (Tabel A.18)
 *
 * Semuanya jawaban **awal**: dihitung dari telemetri, inventaris, dan temuan
 * yang tercatat, bukan dari pengamatan lapangan. Tiap baris menyebut alasan
 * dan pasalnya supaya inspektur dapat memeriksa dasarnya, bukan sekadar
 * menerima kesimpulannya.
 */

export interface RutinPageProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
}

const Ya = ({ nilai }: { nilai: boolean | null }) =>
  nilai === null ? (
    <span className="text-muted">—</span>
  ) : nilai ? (
    <span className="tag tag-bahaya">Ya</span>
  ) : (
    <span className="tag tag-normal">Tidak</span>
  );

function TabelUsulan({ baris, kosong, tampilkanUji }: { baris: Usulan[]; kosong: string; tampilkanUji?: boolean }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Elemen</th>
            <th>Lokasi</th>
            <th>Alasan</th>
            {tampilkanUji ? <th>Pengujian yang disarankan</th> : null}
          </tr>
        </thead>
        <tbody>
          {baris.length === 0 ? (
            <tr>
              <td colSpan={tampilkanUji ? 5 : 4} className="text-muted">{kosong}</td>
            </tr>
          ) : null}
          {baris.map((u) => (
            <tr key={`${u.jenis}-${u.kode}-${u.sumber}`}>
              <td className="tabular" style={{ whiteSpace: 'nowrap' }}>{u.kode}</td>
              <td style={{ minWidth: 150 }}>{u.elemen}</td>
              <td style={{ minWidth: 140 }}>{u.lokasi}</td>
              <td style={{ minWidth: 260, lineHeight: 1.5 }}>
                {u.alasan}
              </td>
              {tampilkanUji ? <td style={{ minWidth: 240, lineHeight: 1.5 }}>{u.pengujian}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RutinPage({ bridge, telemetry }: RutinPageProps) {
  const dossier = dossierFor(bridge.id);
  const versi = useSyncExternalStore(langganTemuan, versiTemuan);
  const temuan = useMemo(() => nilaiTemuan(daftarTemuan(bridge.id)), [bridge.id, versi]);
  const readings = telemetry?.readings ?? null;
  const usulan = useMemo(() => susunUsulan(readings, temuan), [readings, temuan]);
  const smks = useMemo(() => periksaSmks(bridge.id, readings), [bridge.id, readings]);

  const [tab, setTab] = useState<'ringkasan' | 'formulir'>('ringkasan');

  if (!dossier) {
    return (
      <div className="screen">
        <PageHeader
          kicker="Pedoman Bina Marga"
          title="Pemeriksaan rutin"
          lede="Aset ini adalah model acuan dan tidak memiliki riwayat inspeksi atau inventaris sensor."
        />
      </div>
    );
  }

  const hariIni = new Date().toISOString().slice(0, 10);
  const jadwal = susunJadwal(dossier.inspections, hariIni);

  return (
    <div className="screen">
      <PageHeader
        kicker="Pedoman Bina Marga"
        title="Pemeriksaan rutin"
        lede="Jadwal, usulan tindakan darurat dan pemeriksaan khusus, serta SMKS."
      />

      <div className="seg" role="group" aria-label="Bagian halaman" style={{ marginBottom: 'var(--space-3)' }}>
        <button type="button" className="seg-opt" aria-pressed={tab === 'ringkasan'} onClick={() => setTab('ringkasan')}>
          Ringkasan
        </button>
        <button type="button" className="seg-opt" aria-pressed={tab === 'formulir'} onClick={() => setTab('formulir')}>
          Formulir Rutin
        </button>
      </div>

      {tab === 'formulir' ? (
        <FormulirRutin bridge={bridge} telemetry={telemetry} />
      ) : (
      <>

      <div className="glass card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
        <div className="card-head">
          <span className="card-kicker">Jadwal pemeriksaan</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Jenis</th>
                <th>Terakhir</th>
                <th>Jatuh tempo</th>
                <th className="num">Sisa hari</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {jadwal.map((b) => (
                <tr key={b.jenis}>
                  <td><span className="tag tag-outline">{b.jenis}</span></td>
                  <td style={{ minWidth: 280, lineHeight: 1.5 }}>
                    {b.terakhir ? (
                      <>
                        {b.terakhir.kind} terakhir {tanggalPendek(b.terakhir.date)} · nilai kondisi {b.terakhir.conditionValue}
                      </>
                    ) : (
                      'Belum ada catatan'
                    )}
                  </td>
                  <td className="tabular" style={{ whiteSpace: 'nowrap' }}>{b.jatuhTempo ? tanggalPendek(b.jatuhTempo) : '—'}</td>
                  <td className="num">{b.sisaHari ?? '—'}</td>
                  <td><span className={STATUS_JADWAL_KELAS[b.status]}>{STATUS_JADWAL_LABEL[b.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
        <div className="card-head">
          <span className="card-kicker">Tindakan darurat</span>
          <span className="row" style={{ gap: 8 }}>
            <span className="text-muted" style={{ fontSize: 11 }}>Apakah tindakan darurat disarankan?</span>
            <Ya nilai={usulan.daruratDisarankan} />
          </span>
        </div>
        <TabelUsulan baris={usulan.darurat} kosong="Tidak ada." />
      </div>

      <div className="glass card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
        <div className="card-head">
          <span className="card-kicker">Usulan pemeriksaan khusus</span>
        </div>
        <TabelUsulan
          baris={usulan.khusus}
          kosong="Tidak ada."
          tampilkanUji
        />
      </div>

      <div className="glass card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
        <div className="card-head">
          <span className="card-kicker">SMKS</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Elemen</th>
                <th>Lokasi</th>
                <th>Tidak lengkap?</th>
                <th>Tidak berfungsi?</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {(smks?.baris ?? []).map((b) => (
                <tr key={b.kode}>
                  <td className="tabular" style={{ whiteSpace: 'nowrap' }}>{b.kode}</td>
                  <td style={{ minWidth: 170 }}>{b.nama}</td>
                  <td style={{ minWidth: 150 }}>{b.lokasi}</td>
                  <td><Ya nilai={b.tidakLengkap} /></td>
                  <td><Ya nilai={b.tidakBerfungsi} /></td>
                  <td style={{ minWidth: 240, lineHeight: 1.5 }} className="text-muted">
                    {b.alasan.length ? b.alasan.map((a) => <div key={a}>{a}</div>) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
