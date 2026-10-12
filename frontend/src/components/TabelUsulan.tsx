import type { Usulan } from '../domain/usulan';

/** Tabel usulan tindakan darurat atau pemeriksaan khusus (Tabel A.12, A.16). */
export function TabelUsulan({
  baris,
  kosong,
  tampilkanUji,
}: {
  baris: Usulan[];
  kosong: string;
  tampilkanUji?: boolean;
}) {
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
              <td style={{ minWidth: 260, lineHeight: 1.5 }}>{u.alasan}</td>
              {tampilkanUji ? <td style={{ minWidth: 240, lineHeight: 1.5 }}>{u.pengujian}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
