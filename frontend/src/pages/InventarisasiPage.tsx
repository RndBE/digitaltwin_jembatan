import { useSyncExternalStore } from 'react';
import type { Bridge } from '../lib/types';
import type { ScreenKey } from '../components/Sidebar';
import { PageHeader, Stat } from '../components/Ui';
import { administrasiAset, langganAdministrasi, versiAdministrasi } from '../domain/administrasi';
import { dossierFor } from '../domain/demoData';
import { ELEMEN_BY_KODE, ELEMEN_UTAMA } from '../domain/pedoman';

/**
 * Pemeriksaan inventarisasi (Bab 6): halaman cakupan, bukan formulir.
 *
 * Inventarisasi mendata jembatan sekali — administrasi, pembangunan, kapasitas,
 * komponen — sebagai dasar semua pemeriksaan lain. Aplikasi ini belum punya
 * formulirnya, jadi halaman ini mengatakannya terus terang: empat bagian
 * lembar isian Bab 6.4, dan untuk tiap klaster apa yang **sudah** bisa dibaca
 * dari data yang ada dan apa yang belum. Yang sudah ada diambil langsung dari
 * data aset, bukan disalin, jadi tidak akan berselisih dengan halaman
 * Informasi.
 */

type Status = 'ada' | 'sebagian' | 'belum';

const KELAS: Record<Status, string> = {
  ada: 'tag tag-normal',
  sebagian: 'tag tag-waspada',
  belum: 'tag tag-siaga',
};
const LABEL: Record<Status, string> = { ada: 'ADA', sebagian: 'SEBAGIAN', belum: 'BELUM ADA' };

interface Klaster {
  nama: string;
  status: Status;
  /** Yang sudah terbaca dari data aset. */
  ada: string;
  /** Yang belum. */
  kurang?: string;
}

interface Bagian {
  no: number;
  judul: string;
  rujukan: string;
  klaster: Klaster[];
}

export interface InventarisasiPageProps {
  bridge: Bridge;
  onOpen: (screen: ScreenKey) => void;
}

export function InventarisasiPage({ bridge, onOpen }: InventarisasiPageProps) {
  useSyncExternalStore(langganAdministrasi, versiAdministrasi);
  const admin = administrasiAset(bridge.id);
  const dossier = dossierFor(bridge.id);
  const jumlahElemen = Object.keys(ELEMEN_BY_KODE).length;
  const elemenAtas = ELEMEN_UTAMA.filter((e) => e.komponen.nama === 'Bangunan Atas').length;

  const bagian: Bagian[] = [
    {
      no: 1,
      judul: 'Administrasi, pembangunan, kapasitas muatan, lalu lintas, perlintasan',
      rujukan: 'Bab 6.4.1 · hlm. 51–55',
      klaster: [
        {
          nama: 'Data administrasi',
          status: admin.nomorJembatan ? 'ada' : 'sebagian',
          ada: `Nama, lokasi${dossier ? ', koordinat' : ''}${admin.nomorJembatan ? `, nomor ${admin.nomorJembatan}` : ''}.`,
          kurang: admin.nomorJembatan ? undefined : 'Nomor jembatan resmi belum diisi (isiannya ada di Formulir Rutin).',
        },
        {
          nama: 'Informasi pembangunan',
          status: 'sebagian',
          ada: `Tahun bangun ${bridge.builtYear}${dossier ? `; pemilik ${dossier.owner}` : ''}.`,
          kurang: 'Pelebaran, serah terima, biaya, konsultan, kontraktor, dan pengawas.',
        },
        {
          nama: 'Kapasitas muatan dan lalu lintas',
          status: dossier ? 'sebagian' : 'belum',
          ada: dossier
            ? `Beban rencana ${dossier.designLoad}; lalu lintas harian ${dossier.trafficPerDay.toLocaleString('id-ID')} kendaraan, ${Math.round(dossier.heavyShare * 100)}% berat.`
            : 'Tidak ada.',
          kurang: 'Bridge load rating, jalan memutar (detour), dampak lebar jembatan (Tabel 3–5).',
        },
        {
          nama: 'Perlintasan jembatan',
          status: dossier?.river ? 'sebagian' : 'belum',
          ada: dossier?.river ? `Melintasi ${dossier.river}.` : 'Tidak ada.',
          kurang: 'Data banjir tertinggi (Tabel 6) dan perlintasan lain.',
        },
      ],
    },
    {
      no: 2,
      judul: 'Referensi kode komponen dan elemen',
      rujukan: 'Bab 6.4.2 · hlm. 55–57',
      klaster: [
        {
          nama: 'Kode komponen dan elemen Lampiran B',
          status: 'sebagian',
          ada: `${jumlahElemen} elemen Level 4 jembatan rangka baja, dipakai oleh halaman Detail.`,
          kurang: 'Bangunan bawah, aliran sungai, jalan pendekat, siar muai, dan drainase.',
        },
      ],
    },
    {
      no: 3,
      judul: 'Inventarisasi komponen dan elemen',
      rujukan: 'Bab 6.4.3 · hlm. 57–65',
      klaster: [
        {
          nama: 'Geometri jembatan',
          status: 'sebagian',
          ada: `${bridge.type}; bentang ${bridge.spanMeters} m, lebar ${bridge.widthMeters} m, ${bridge.lanes} lajur.`,
          kurang: 'Panjang tiap bentang, tinggi ruang bebas, skew, dan kelengkungan (Gambar 17–22).',
        },
        {
          nama: 'Bangunan atas',
          status: 'sebagian',
          ada: `${elemenAtas} elemen utama rangka dan lantai, sesuai model 3D.`,
          kurang: 'Tipe dan bahan per elemen dari pengamatan lapangan.',
        },
        {
          nama: 'Bangunan bawah dan perlengkapan',
          status: 'belum',
          ada: 'Perletakan dan SMKS sudah ada di halaman Detail dan Rutin.',
          kurang: 'Kepala jembatan, pilar, fondasi, dan perlengkapan lain.',
        },
      ],
    },
    {
      no: 4,
      judul: 'Pelebaran jembatan',
      rujukan: 'Bab 6.4.4 · hlm. 65',
      klaster: [
        {
          nama: 'Komponen dan elemen pelebaran',
          status: 'belum',
          ada: 'Tidak ada.',
          kurang: 'Hanya relevan bila jembatan pernah dilebarkan; belum ada isiannya.',
        },
      ],
    },
  ];

  const semua = bagian.flatMap((b) => b.klaster);
  const hitung = (s: Status) => semua.filter((k) => k.status === s).length;

  return (
    <div className="screen">
      <PageHeader
        kicker="Pemeriksaan"
        title="Pemeriksaan inventarisasi"
        lede="Cakupan Pemeriksaan Inventarisasi menurut Bab 6 pedoman, dan apa yang sudah terbaca dari data aset."
        rujukan="Bab 6 · hlm. 44–65"
        actions={
          <button type="button" className="btn btn-sm" onClick={() => onOpen('info')}>
            Buka Informasi aset
          </button>
        }
      />

      <div
        role="note"
        className="row"
        style={{
          gap: 8,
          marginBottom: 'var(--space-3)',
          padding: '6px 12px',
          borderRadius: 12,
          background: 'rgb(251 191 36 / 0.1)',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <span className="tag tag-waspada">SEGERA</span>
        <span>Formulir inventarisasi belum tersedia. Halaman ini hanya menunjukkan cakupannya.</span>
      </div>

      <section
        className="glass glass--chip stat-row"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 'var(--space-3)' }}
      >
        <Stat label="Klaster ada" value={hitung('ada')} tone="accent" />
        <Stat label="Sebagian" value={hitung('sebagian')} tone="warn" />
        <Stat label="Belum ada" value={hitung('belum')} tone="critical" />
      </section>

      {bagian.map((b) => (
        <div key={b.no} className="glass card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
          <div className="card-head">
            <span className="card-kicker">Bagian ke-{b.no} · {b.judul}</span>
            <span className="text-muted" style={{ fontSize: 11 }}>{b.rujukan}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <tbody>
                {b.klaster.map((k) => (
                  <tr key={k.nama}>
                    <td style={{ minWidth: 200 }}><strong style={{ fontWeight: 600 }}>{k.nama}</strong></td>
                    <td><span className={KELAS[k.status]}>{LABEL[k.status]}</span></td>
                    <td style={{ minWidth: 320, lineHeight: 1.5 }}>
                      {k.ada}
                      {k.kurang ? <div className="text-muted" style={{ fontSize: 11.5 }}>Belum: {k.kurang}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
