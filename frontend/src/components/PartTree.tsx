import { FALLBACK_GROUP, PART_GROUPS } from '../three/proceduralBridge';
import {
  CONFIDENCE_LABELS,
  PROVENANCE_COLOR,
  PROVENANCE_LABELS,
  partLabel,
  systemLabel,
  type Confidence,
  type PartMetadata,
  type PartsDocument,
} from '../three/mb3dModel';

/**
 * Pohon bagian untuk model prosedural.
 *
 * Tiap baris punya dua tindakan terpisah: kotak centang menyembunyikan
 * kelompok, dan nama kelompok menyorotinya. Dua hal itu sengaja tidak
 * digabungkan — menyembunyikan dipakai untuk melihat ke dalam struktur,
 * menyorot dipakai untuk menunjukkan letak sesuatu.
 */
export function ProceduralPartTree({
  counts,
  hidden,
  selected,
  onToggle,
  onSelect,
}: {
  counts: Record<string, number>;
  hidden: string[];
  selected: string | null;
  onToggle: (key: string) => void;
  onSelect: (key: string) => void;
}) {
  const groups = [...PART_GROUPS.map((g) => ({ key: g.key, name: g.name })), FALLBACK_GROUP];

  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      {groups.map((group) => {
        const isHidden = hidden.includes(group.key);
        return (
          <div key={group.key} className="row" style={{ gap: 'var(--space-2)', fontSize: 13 }}>
            <input
              type="checkbox"
              id={`grp-${group.key}`}
              checked={!isHidden}
              onChange={() => onToggle(group.key)}
              aria-label={`Tampilkan ${group.name}`}
            />
            <button
              type="button"
              onClick={() => onSelect(group.key)}
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                cursor: 'pointer',
                font: 'inherit',
                textAlign: 'left',
                flex: 1,
                color: selected === group.key ? 'var(--brand-400)' : 'var(--color-text)',
                opacity: isHidden ? 0.45 : 1,
              }}
            >
              {group.name}
            </button>
            <span className="text-muted tabular" style={{ fontSize: 11 }}>
              {counts[group.key] ?? 0}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Pohon sistem untuk model GLB bersumber, beserta ringkasan tingkat
 * kepercayaan tiap sistem. Angka di kanan adalah jumlah bagian, bukan jumlah
 * mesh: satu bagian dapat terdiri dari banyak mesh.
 */
export function GlbSystemTree({
  doc,
  hidden,
  onToggle,
}: {
  doc: PartsDocument;
  hidden: Set<string>;
  onToggle: (system: string) => void;
}) {
  const systems = new Map<string, PartMetadata[]>();
  doc.parts.forEach((part) => {
    const list = systems.get(part.system) ?? [];
    list.push(part);
    systems.set(part.system, list);
  });

  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      {[...systems.entries()].map(([system, parts]) => {
        // Sistem diberi tingkat kepercayaan terlemah di antara bagiannya:
        // satu bagian bermutu D sudah cukup membuat keseluruhannya belum pasti.
        const weakest = parts.reduce<Confidence>(
          (acc, part) => (part.confidence > acc ? part.confidence : acc),
          'A',
        );
        return (
          <div key={system} className="row" style={{ gap: 'var(--space-2)', fontSize: 13 }}>
            <input
              type="checkbox"
              id={`sys-${system}`}
              checked={!hidden.has(system)}
              onChange={() => onToggle(system)}
              aria-label={`Tampilkan ${systemLabel(system)}`}
            />
            <label htmlFor={`sys-${system}`} style={{ flex: 1, cursor: 'pointer' }}>
              {systemLabel(system)}
            </label>
            <span
              className="tag"
              style={{
                background: doc.confidence_colors[weakest],
                color: '#fff',
                fontSize: 10,
                padding: '2px 7px',
              }}
              title={CONFIDENCE_LABELS[weakest]}
            >
              {weakest}
            </span>
            <span className="text-muted tabular" style={{ fontSize: 11, minWidth: 22, textAlign: 'right' }}>
              {parts.length}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Keterangan warna tingkat kepercayaan dan asal-usul geometri. */
export function ConfidenceLegend({ doc }: { doc: PartsDocument }) {
  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="card-kicker">Confidence grade</span>
        {(Object.keys(CONFIDENCE_LABELS) as Confidence[]).map((grade) => (
          <div
            key={grade}
            style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.45 }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 12,
                height: 12,
                marginTop: 3,
                borderRadius: 2,
                background: doc.confidence_colors[grade],
                flex: 'none',
              }}
            />
            <span>{CONFIDENCE_LABELS[grade]}</span>
          </div>
        ))}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="card-kicker">Geometry provenance</span>
        {(Object.keys(PROVENANCE_LABELS) as Array<keyof typeof PROVENANCE_LABELS>).map((kind) => (
          <div
            key={kind}
            style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.45 }}
          >
            <span
              aria-hidden="true"
              style={{ width: 12, height: 2, marginTop: 8, background: PROVENANCE_COLOR[kind], flex: 'none' }}
            />
            <span>{PROVENANCE_LABELS[kind]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Panel metadata satu bagian terpilih pada model GLB. */
export function PartMetadataPanel({ part, doc }: { part: PartMetadata; doc: PartsDocument }) {
  const controls = doc.controls.filter((control) => part.control_refs.includes(control.control_id));

  return (
    <div className="stack" style={{ gap: 'var(--space-2)', fontSize: 13 }}>
      <span className="card-title" style={{ fontSize: 15 }}>
        {partLabel(part)}
      </span>
      <div className="row" style={{ gap: 6 }}>
        <span
          className="tag"
          style={{ background: doc.confidence_colors[part.confidence], color: '#fff' }}
          title={CONFIDENCE_LABELS[part.confidence]}
        >
          Kepercayaan {part.confidence}
        </span>
        <span className="tag tag-neutral" title={PROVENANCE_LABELS[part.geometry_provenance]}>
          {part.geometry_provenance}
        </span>
      </div>
      <div className="text-muted">
        {systemLabel(part.system)}
        {part.subsystem ? ` · ${part.subsystem.replace(/_/g, ' ')}` : ''} · material {part.material.replace(/_/g, ' ')}
      </div>
      {part.notes ? <p style={{ lineHeight: 1.5 }}>{part.notes}</p> : null}

      {controls.length > 0 ? (
        <div className="stack" style={{ gap: 4 }}>
          <span className="card-kicker">Dimensional controls used</span>
          {controls.map((control) => (
            <div key={control.control_id} className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
              <span className="text-muted">
                {control.control_id} · {control.key.replace(/_/g, ' ')}
              </span>
              <span className="tabular">
                {control.value} {control.unit}
                {control.is_placeholder ? ' · provisional' : ''}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {part.open_questions.length > 0 ? (
        <div className="text-muted" style={{ fontSize: 12 }}>
          Open questions: {part.open_questions.join(', ')}
        </div>
      ) : null}
    </div>
  );
}
