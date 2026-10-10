import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Bridge, Telemetry } from '../lib/types';
import { PageHeader } from '../components/Ui';
import { tanggalPendek } from '../domain/demoData';
import {
  identitasLaporan,
  langganAdministrasi,
  versiAdministrasi,
} from '../domain/administrasi';
import { BAGIAN_FORM, BUTIR_FORM } from '../domain/formRutin';
import { barisCsvTemuan, hierarkiCetak } from '../domain/laporan';
import {
  kemajuan,
  lembarTahun,
  tahunTersimpan,
  langganLembar,
  versiLembar,
} from '../domain/lembarRutin';
import { NK_URAIAN, lokasiLabel, nilaiTemuan, ringkasKondisi } from '../domain/pedoman';
import { daftarTemuan, langganTemuan, versiTemuan } from '../domain/temuan';
import { TINDAKAN_DARURAT, susunUsulan } from '../domain/usulan';
import { stempelBerkas, unduhCsv } from '../lib/export';

/**
 * Laporan pemeriksaan, disusun menurut Lampiran A.
 *
 * Lembar yang dapat dicetak atau disimpan sebagai PDF lewat dialog cetak
 * peramban. Isinya mengikuti urutan formulir pedoman: identitas, usulan
 * pemeriksaan khusus, tindakan darurat, lalu penilaian kondisi (Detail) atau
 * kondisi jembatan (Rutin).
 *
 * **Bukan formulir resmi.** Pedoman meminta isian pada formulir bernomor di
 * Lampiran A; lembar ini memuat isian yang sama dalam susunan serupa dan
 * mengatakan asalnya di kakinya. Data contoh yang ikut tercetak diberi
 * penanda supaya tidak terbawa ke dokumen sebagai hasil lapangan.
 */

export interface LaporanPageProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
}

type Jenis = 'detail' | 'rutin';

const Ya = (v: boolean | null) => (v === null ? '—' : v ? 'Ya' : 'Tidak');

export function LaporanPage({ bridge, telemetry }: LaporanPageProps) {
  useSyncExternalStore(langganAdministrasi, versiAdministrasi);
  useSyncExternalStore(langganLembar, versiLembar);
  const versiT = useSyncExternalStore(langganTemuan, versiTemuan);

  const [jenis, setJenis] = useState<Jenis>('detail');
  const tahunIni = new Date().getFullYear();
  const daftarTahun = [...new Set([tahunIni, ...tahunTersimpan(bridge.id)])].sort((a, b) => b - a);
  const [tahun, setTahun] = useState(tahunIni);

  const identitas = identitasLaporan(bridge);
  const readings = telemetry?.readings ?? null;
  const temuan = useMemo(() => nilaiTemuan(daftarTemuan(bridge.id)), [bridge.id, versiT]);
  const ringkas = useMemo(() => ringkasKondisi(temuan), [temuan]);
  const usulan = useMemo(() => susunUsulan(readings, temuan), [readings, temuan]);
  const lembar = lembarTahun(bridge.id, tahun);
  const maju = kemajuan(lembar);
  const adaContoh = temuan.some((t) => t.contoh);

  const nilaiJembatan = NK_URAIAN[ringkas.nk];
  const sekarang = new Date();

  const unduh = () =>
    unduhCsv(`temuan-${bridge.id}-${stempelBerkas(sekarang)}`, barisCsvTemuan(temuan));

  // Kepala laporan Detail memakai temuan hasil lapangan yang paling baru; data
  // contoh tidak boleh menjadi tanggal dan nama pemeriksa sebuah laporan.
  const terbaru = temuan.filter((t) => !t.contoh).sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];
  const pemeriksa = jenis === 'rutin' ? lembar.pemeriksa : terbaru?.pemeriksa;
  const tanggalPeriksa = jenis === 'rutin' ? lembar.tanggal : terbaru?.tanggal;

  return (
    <div className="screen">
      <div className="no-print">
        <PageHeader
          kicker="Pedoman Bina Marga"
          title="Laporan pemeriksaan"
          lede="Lembar laporan menurut susunan Lampiran A."
        />
        <div className="row" style={{ justifyContent: 'space-between', margin: 'var(--space-3) 0' }}>
          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <div className="seg" role="group" aria-label="Jenis laporan">
              <button type="button" className="seg-opt" aria-pressed={jenis === 'detail'} onClick={() => setJenis('detail')}>
                Pemeriksaan Detail
              </button>
              <button type="button" className="seg-opt" aria-pressed={jenis === 'rutin'} onClick={() => setJenis('rutin')}>
                Pemeriksaan Rutin
              </button>
            </div>
            {jenis === 'rutin' ? (
              <div className="seg" role="group" aria-label="Tahun lembar">
                {daftarTahun.map((t) => (
                  <button key={t} type="button" className="seg-opt" aria-pressed={tahun === t} onClick={() => setTahun(t)}>
                    {t}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={unduh} disabled={temuan.length === 0}>
              Unduh temuan (CSV)
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
              Cetak / simpan PDF
            </button>
          </div>
        </div>
      </div>

      <article className="laporan-lembar" aria-label={`Laporan Pemeriksaan ${jenis === 'detail' ? 'Detail' : 'Rutin'}`}>
        <h2 className="laporan-judul">LAPORAN PEMERIKSAAN {jenis === 'detail' ? 'DETAIL' : 'RUTIN'} JEMBATAN</h2>
        {(adaContoh && jenis === 'detail') || (jenis === 'rutin' && !lembar.selesai) ? (
          <p className="laporan-catatan">
            {jenis === 'rutin' && !lembar.selesai ? 'DRAF' : ''}
            {adaContoh && jenis === 'detail' ? 'MEMUAT DATA CONTOH' : ''}
          </p>
        ) : null}

        <table className="laporan-tabel">
          <tbody>
            <tr>
              <th>Nomor jembatan</th>
              <td>{identitas.nomorJembatan || <em>belum diisi</em>}</td>
              <th>Nama jembatan</th>
              <td>{identitas.nama}</td>
            </tr>
            <tr>
              <th>Lokasi</th>
              <td>{identitas.lokasi}</td>
              <th>Koordinat</th>
              <td>{identitas.koordinat || <em>belum ada</em>}</td>
            </tr>
            <tr>
              <th>Dari (kota asal) / Km</th>
              <td>
                {identitas.kotaAsal || <em>belum diisi</em>} / {identitas.kilometer || <em>belum diisi</em>}
              </td>
              <th>Tahun pembangunan</th>
              <td>{identitas.tahunBangun}</td>
            </tr>
            <tr>
              <th>Tanggal pemeriksaan</th>
              <td>{tanggalPeriksa ? tanggalPendek(tanggalPeriksa) : <em>belum ada</em>}</td>
              <th>Nama pemeriksa / NIP</th>
              <td>
                {pemeriksa || <em>belum diisi</em>}
                {jenis === 'rutin' && lembar.nip ? ` / ${lembar.nip}` : ''}
              </td>
            </tr>
            <tr>
              <th>Lalu lintas harian (LHR)</th>
              <td>{identitas.lhr ? identitas.lhr.toLocaleString('id-ID') : <em>belum ada</em>}</td>
              <th>Sungai</th>
              <td>{identitas.sungai || '—'}</td>
            </tr>
          </tbody>
        </table>

        {jenis === 'detail' ? (
          <>
            <h3 className="laporan-bagian">Usulan pemeriksaan khusus</h3>
            <table className="laporan-tabel">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Elemen</th>
                  <th>Lokasi</th>
                  <th>Alasan untuk melakukan pemeriksaan khusus</th>
                </tr>
              </thead>
              <tbody>
                {usulan.khusus.length === 0 ? (
                  <tr><td colSpan={4}>Tidak ada.</td></tr>
                ) : (
                  usulan.khusus.map((u) => (
                    <tr key={`${u.kode}-${u.sumber}`}>
                      <td>{u.kode}</td>
                      <td>{u.elemen}</td>
                      <td>{u.lokasi}</td>
                      <td>{u.alasan}{u.pengujian ? ` Pengujian: ${u.pengujian}` : ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        ) : null}

        <h3 className="laporan-bagian">Tindakan darurat</h3>
        <table className="laporan-tabel">
          <tbody>
            <tr>
              <th>Apakah tindakan darurat disarankan?</th>
              <td>
                {jenis === 'rutin' ? (
                  <>
                    <strong>{Ya(lembar.darurat)}</strong> (keputusan pemeriksa) · usulan sistem: {usulan.daruratDisarankan ? 'Ya' : 'Tidak'}
                  </>
                ) : (
                  <>
                    <strong>{usulan.daruratDisarankan ? 'Ya' : 'Tidak'}</strong> (usulan sistem)
                  </>
                )}
              </td>
            </tr>
            {jenis === 'rutin' && lembar.darurat && lembar.tindakan.length ? (
              <tr>
                <th>Tindakan di atas jembatan</th>
                <td>{lembar.tindakan.map((i) => `${'abcdef'[i]}. ${TINDAKAN_DARURAT[i]}`).join('; ')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {usulan.darurat.length ? (
          <table className="laporan-tabel">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Elemen</th>
                <th>Lokasi</th>
                <th>Alasan untuk melakukan tindakan darurat</th>
              </tr>
            </thead>
            <tbody>
              {usulan.darurat.map((u) => (
                <tr key={`${u.kode}-${u.sumber}`}>
                  <td>{u.kode}</td>
                  <td>{u.elemen}</td>
                  <td>{u.lokasi}</td>
                  <td>{u.alasan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {jenis === 'detail' ? (
          <>
            <h3 className="laporan-bagian">Penilaian kondisi</h3>
            <p className="laporan-kecil">
              Nilai Kondisi jembatan: <strong>{ringkas.nk}</strong> ({nilaiJembatan.label})
            </p>
            <table className="laporan-tabel">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Level</th>
                  <th>Komponen / elemen</th>
                  <th>Temuan</th>
                  <th>NK</th>
                </tr>
              </thead>
              <tbody>
                {hierarkiCetak(ringkas).map(({ simpul, kedalaman }) => (
                  <tr key={`${simpul.kode}-${kedalaman}`}>
                    <td>{simpul.kode}</td>
                    <td>{simpul.level}</td>
                    <td style={{ paddingLeft: 8 + kedalaman * 12 }}>
                      {simpul.nama}
                      {!simpul.struktural ? ' (non-struktural)' : ''}
                    </td>
                    <td>{simpul.temuan || ''}</td>
                    <td><strong>{simpul.nk}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="laporan-bagian">Daftar kerusakan</h3>
            <table className="laporan-tabel">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kode elemen</th>
                  <th>Lokasi</th>
                  <th>Kerusakan</th>
                  <th>S</th>
                  <th>R</th>
                  <th>K</th>
                  <th>F</th>
                  <th>P</th>
                  <th>NK</th>
                  <th>Catatan / foto</th>
                </tr>
              </thead>
              <tbody>
                {temuan.length === 0 ? (
                  <tr><td colSpan={11}>Tidak ada kerusakan tercatat.</td></tr>
                ) : (
                  temuan.map((t) => (
                    <tr key={t.id}>
                      <td>{tanggalPendek(t.tanggal)}</td>
                      <td>{t.elemen} {t.elemenSpec.nama}</td>
                      <td>{lokasiLabel(t)}</td>
                      <td>{t.kerusakan} {t.kerusakanSpec.nama}</td>
                      <td>{t.skor.s}</td>
                      <td>{t.skor.r}</td>
                      <td>{t.skor.k}</td>
                      <td>{t.skor.f}</td>
                      <td>{t.skor.p}</td>
                      <td><strong>{t.skor.nk}</strong></td>
                      <td>
                        {t.contoh ? <strong>[CONTOH] </strong> : null}
                        {t.catatan}
                        {t.foto?.length ? (
                          <div className="laporan-foto">
                            {t.foto.map((f) => (
                              <img key={f.at} src={f.data} alt={`Tangkapan ${f.kamera}`} />
                            ))}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <h3 className="laporan-bagian">Catatan</h3>
            <table className="laporan-tabel">
              <tbody>
                <tr>
                  <th>Apakah kondisi jembatan sesuai dengan Pemeriksaan Inventarisasi terakhir?</th>
                  <td>{Ya(lembar.sesuaiInventarisasi)}</td>
                </tr>
                <tr>
                  <th>Apakah kondisi jembatan sesuai dengan Pemeriksaan Detail terakhir?</th>
                  <td>{Ya(lembar.sesuaiDetail)}</td>
                </tr>
              </tbody>
            </table>

            <h3 className="laporan-bagian">Kondisi jembatan</h3>
            <p className="laporan-kecil">
              {maju.terjawab} dari {maju.total} butir dijawab; {maju.ya} "Ya". Hanya butir "Ya" yang dicantumkan.
            </p>
            {BAGIAN_FORM.map((bagian) => {
              const ya = BUTIR_FORM.filter((b) => b.bagian === bagian && lembar.jawaban[b.id]?.ya === true);
              const belum = BUTIR_FORM.filter((b) => b.bagian === bagian && lembar.jawaban[b.id]?.ya == null).length;
              return (
                <table key={bagian} className="laporan-tabel">
                  <thead>
                    <tr>
                      <th colSpan={3}>{bagian.toUpperCase()}{belum ? ` — ${belum} butir belum dijawab` : ''}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ya.length === 0 ? (
                      <tr><td colSpan={3}>Tidak ada butir berjawaban "Ya".</td></tr>
                    ) : (
                      ya.map((b) => (
                        <tr key={b.id}>
                          <td>{b.elemen}</td>
                          <td>{b.huruf ? `${b.huruf}. ` : ''}{b.uraian}</td>
                          <td>{lembar.jawaban[b.id]?.lokasi || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              );
            })}
            <table className="laporan-tabel">
              <tbody>
                <tr>
                  <th>Hanya untuk keperluan kantor</th>
                  <td>
                    {lembar.selesai
                      ? `Data dimasukkan ${tanggalPendek(lembar.selesai.tanggal)} oleh ${lembar.selesai.oleh}`
                      : 'Belum dimasukkan (lembar masih draf)'}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <div className="laporan-ttd">
          <div>
            <div>Pemeriksa,</div>
            <div className="laporan-garis" />
            <div>{pemeriksa || '(nama)'}</div>
          </div>
          <div>
            <div>Diketahui,</div>
            <div className="laporan-garis" />
            <div>(ketua tim inspektur)</div>
          </div>
        </div>

        <p className="laporan-kaki">
          Dicetak {sekarang.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}. Bukan formulir resmi bernomor.
        </p>
      </article>
    </div>
  );
}
