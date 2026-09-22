import type { StructuralPart } from '../three/structuralDetails';
import { PART_GROUPS } from '../three/proceduralBridge';

export function StructureInspector({ parts, selectedId, damaged, onSelect, onFocus }: {
  parts: StructuralPart[];
  selectedId: string | null;
  damaged: string[];
  onSelect: (id: string | null) => void;
  onFocus: () => void;
}) {
  const part = parts.find((item) => item.id === selectedId);
  const damagedPart = part && damaged.includes(part.id);
  return (
    <section className="glass card structure-inspector" aria-label="Inspeksi komponen">
      <div className="structure-inspector-heading">
        <h2>Inspeksi komponen</h2>
        <span className="text-muted tabular">{parts.length} elemen</span>
      </div>
      <label className="field" htmlFor="inspect-part">
        <span>Pilih elemen atau klik langsung pada model</span>
        <select id="inspect-part" className="input" value={selectedId ?? ''}
          onChange={(event) => onSelect(event.target.value || null)} disabled={!parts.length}>
          <option value="">Pilih komponen struktur</option>
          {PART_GROUPS.filter((group) => parts.some((item) => item.group === group.key)).map((group) => (
            <optgroup key={group.key} label={group.name}>
              {parts.filter((item) => item.group === group.key).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {part ? (
        <div className="structure-inspector-detail">
          <div className="structure-part-id">{part.id}</div>
          <h3>{part.name}</h3>
          <p className="text-muted">{part.location}</p>
          <p>{part.description}</p>
          <ul>{part.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
          <div className="structure-inspector-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={onFocus}>Fokus dekat</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelect(null)}>Hapus pilihan</button>
          </div>
          <p className={damagedPart ? 'structure-damage' : 'text-muted'}>
            {damagedPart ? 'Ditandai rusak oleh skenario aktif.' : 'Pilihan oranye menunjukkan elemen yang sedang diperiksa.'}
          </p>
          <div className="structure-inspector-check"><strong>Titik pemeriksaan</strong><p>{part.checks}</p></div>
        </div>
      ) : (
        <p className="text-muted">Pilih sambungan untuk melihat pelat dan bautnya, atau periksa rangka, gelagar, dan tumpuan. Gunakan Fokus dekat untuk memperbesar elemen.</p>
      )}
      <p className="structure-model-note">Detail geometri bersifat ilustratif, belum berdasarkan gambar fabrikasi atau survei aset. Jumlah baut adalah isi model, bukan hasil inspeksi lapangan.</p>
    </section>
  );
}
