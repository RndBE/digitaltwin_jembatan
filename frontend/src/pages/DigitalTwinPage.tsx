import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Bridge, DataSource, Telemetry } from '../lib/types';
import type { Series } from '../hooks/useTelemetry';
import {
  FAMILY_LABELS,
  FAMILY_ORDER,
  SCENARIOS,
  SPEED_LABEL,
  scenariosOf,
} from '../domain/scenarios';
import { TrussViewer } from '../three/TrussViewer';
import { GlbViewer, type GlbViewerHandle } from '../three/GlbViewer';
import type { TwinScene } from '../three/proceduralBridge';
import { GLB_VIEW_ORDER, GLB_VIEW_PRESETS, type GlbViewMode, type PartsDocument } from '../three/mb3dModel';
import {
  ConfidenceLegend,
  GlbSystemTree,
  PartMetadataPanel,
  ProceduralPartTree,
} from '../components/PartTree';
import { SensorCard } from '../components/SensorCard';
import { LiveStrip } from '../components/LiveStrip';
import { PageHeader, Stage, StatusTag } from '../components/Ui';
import { clearSpots, hasCustomSpots } from '../lib/sensorSpots';

export interface DigitalTwinPageProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
  series: Record<string, Series>;
  source: DataSource;
  /** Jarak antar cuplikan yang sedang dipakai. */
  intervalMs: number;
  /** Kanal yang masih membawa sisa kerusakan. */
  residual: Record<string, number>;
  onScenario: (key: string) => void;
  onStop: () => void;
  onTogglePause: () => void;
  /** Catat bahwa perbaikan sudah dikerjakan; membersihkan sisa kerusakan. */
  onRepair: () => void;
}

export function DigitalTwinPage(props: DigitalTwinPageProps) {
  return props.bridge.model.kind === 'glb' ? (
    <ReferenceModelView bridge={props.bridge} />
  ) : (
    <LiveTwinView {...props} />
  );
}

const PANEL_GRID = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 2.2fr) minmax(270px, 1fr)',
  gap: 'var(--space-6)',
  alignItems: 'start',
} as const;

/* ------------------------------------------------------------------ prosedural */

function LiveTwinView({
  bridge,
  telemetry,
  series,
  source,
  intervalMs,
  residual,
  onScenario,
  onStop,
  onTogglePause,
  onRepair,
}: DigitalTwinPageProps) {
  const [scene, setScene] = useState<TwinScene | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [scaleMetres, setScaleMetres] = useState(0);
  const [partsOpen, setPartsOpen] = useState(false);
  // Apakah ada penanda yang pernah digeser pada jembatan ini; menentukan
  // munculnya tombol pemulihan, dan dibaca sekali per aset.
  const [spotsMoved, setSpotsMoved] = useState(() => hasCustomSpots(bridge.id));
  const toolsRef = useRef<HTMLDivElement | null>(null);

  const handleReady = useCallback((instance: TwinScene | null) => {
    setScene(instance);
    if (!instance) {
      setHidden([]);
      setSelectedGroup(null);
    }
  }, []);

  // Daftar bagian menutup sendiri begitu perhatian pindah — ke model di
  // belakangnya, ke panel lain, atau lewat Esc. Menu yang menggantung terbuka
  // di atas gambar justru menutupi benda yang sedang diatur.
  useEffect(() => {
    if (!partsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!toolsRef.current?.contains(event.target as Node)) setPartsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPartsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [partsOpen]);

  const reset = () => {
    scene?.reset();
    setHidden([]);
    setSelectedGroup(null);
    setPicked(null);
    setAutoRotate(true);
  };

  const scenario = telemetry ? SCENARIOS[telemetry.scenario] : SCENARIOS.idle;
  const running = telemetry ? telemetry.scenario !== 'idle' : false;
  const damagedCount = telemetry?.damagedParts.length ?? 0;
  const residualCount = Object.keys(residual).length;
  const hiddenCount = hidden.length;
  const keyReadings = (telemetry?.readings ?? []).filter((r) =>
    ['vib', 'strain', 'defl', 'tilt', 'crack'].includes(r.id),
  );
  const pickedReading = picked ? telemetry?.readings.find((r) => r.id === picked) : undefined;

  return (
    <div className="screen">
      <LiveStrip
        telemetry={telemetry}
        source={source}
        sensorCount={bridge.sensorCount}
        intervalMs={intervalMs}
      />

      <PageHeader
        kicker="Digital Twin"
        title={bridge.name}
        lede="Seret untuk memutar, gulir untuk memperbesar, klik penanda sensor untuk membaca nilainya di tempat. Penanda dapat diseret ke titik pasang yang sebenarnya — letaknya menempel pada elemen dan tersimpan di peramban ini. Warna batang mengikuti regangan yang terukur, warna penanda mengikuti status kanalnya."
        actions={telemetry ? <StatusTag status={telemetry.assessment.status} /> : undefined}
      />

      <section className="split" style={PANEL_GRID}>
        <div>
          <div className="row" style={{ marginBottom: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setAutoRotate((value) => !value)}
            >
              {autoRotate ? 'Hentikan putaran' : 'Putar otomatis'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
              Setel ulang pandangan
            </button>
            {spotsMoved ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  scene?.resetSpots();
                  clearSpots(bridge.id);
                  setSpotsMoved(false);
                }}
              >
                Kembalikan letak penanda
              </button>
            ) : null}
          </div>

          <Stage>
            <TrussViewer
              bridge={bridge}
              telemetry={telemetry}
              pickedSensor={picked}
              autoRotate={autoRotate}
              onPick={setPicked}
              onScale={setScaleMetres}
              onReady={handleReady}
              onSpotMove={() => setSpotsMoved(true)}
            />

            <div
              className="row"
              style={{
                position: 'absolute',
                top: 'var(--space-3)',
                left: 'var(--space-3)',
                zIndex: 2,
                gap: 6,
                flexWrap: 'wrap',
                maxWidth: 'calc(100% - 210px)',
              }}
            >
              <span className="stage-chip" style={{ position: 'static' }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: running ? 'var(--state-bahaya)' : 'var(--brand-300)',
                    animation: telemetry?.paused ? 'none' : 'blink 1.2s infinite',
                  }}
                />
                {scenario.name}
              </span>

              {running ? (
                <span className="stage-chip" style={{ position: 'static' }}>
                  {scenario.cars} mobil · {scenario.trucks} truk ·{' '}
                  {SPEED_LABEL[String(scenario.speed)] ?? '—'}
                </span>
              ) : null}
            </div>

            <div className="stage-tools" ref={toolsRef}>
              <button
                type="button"
                className="stage-chip stage-chip--button"
                aria-expanded={partsOpen}
                onClick={() => setPartsOpen((open) => !open)}
              >
                Bagian struktur
                {hiddenCount > 0 ? (
                  <span className="text-muted">{hiddenCount} disembunyikan</span>
                ) : null}
                <svg className="stage-caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <path
                    d="M2 4l3 3 3-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {partsOpen ? (
                <div className="stage-menu">
                  <ProceduralPartTree
                    counts={scene?.counts ?? {}}
                    hidden={hidden}
                    selected={selectedGroup}
                    onToggle={(key) => {
                      if (!scene) return;
                      setHidden(scene.toggleGroup(key));
                    }}
                    onSelect={(key) => {
                      if (!scene) return;
                      setSelectedGroup(scene.selectGroup(key));
                    }}
                  />
                  <p className="text-muted" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 8 }}>
                    Kotak centang menyembunyikan kelompok; namanya menyorot.
                  </p>
                </div>
              ) : null}
            </div>

            {pickedReading ? (
              <div className="stage-chip" style={{ bottom: 'var(--space-3)', right: 'var(--space-3)' }}>
                {pickedReading.name}{' '}
                <strong style={{ fontWeight: 600 }}>
                  {pickedReading.value} {pickedReading.unit}
                </strong>
              </div>
            ) : null}

            {scaleMetres > 0 ? (
              <div className="scalebar">
                <div className="scalebar-rule" style={{ width: 120 }} />
                <span className="tabular">{scaleMetres} m</span>
              </div>
            ) : null}
          </Stage>

          {/*
            * Kenapa masih ada yang merah setelah skenario dihentikan.
            *
            * Keluarga kerusakan memang tidak pulih sendiri — itulah yang
            * membedakannya dari beban lalu lintas. Tetapi aturan itu hanya
            * masuk akal bila dikatakan di tempat tandanya terlihat, bukan
            * hanya di halaman skenario.
            */}
          {residualCount > 0 && !running ? (
            <div
              role="status"
              className="glass card"
              style={{
                background: 'rgb(251 191 36 / 0.12)',
                padding: 'var(--space-3) var(--space-4)',
                marginTop: 'var(--space-3)',
              }}
            >
              <div
                className="row"
                style={{ justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}
              >
                <span style={{ fontSize: 13, lineHeight: 1.55, maxWidth: '72ch' }}>
                  <strong style={{ fontWeight: 700 }}>Sisa kerusakan</strong> · {damagedCount} elemen
                  tetap disorot merah walaupun skenarionya sudah dihentikan. Kerusakan struktur tidak
                  pulih sendiri seperti beban lalu lintas: tandanya hilang setelah perbaikan
                  dikerjakan dan dicatat.
                </span>
                <button type="button" className="btn btn-sm" onClick={onRepair}>
                  Catat perbaikan
                </button>
              </div>
            </div>
          ) : null}

          <div
            className="row"
            style={{ gap: 'var(--space-6)', marginTop: 'var(--space-3)', fontSize: 12, color: 'var(--mist-300)' }}
          >
            <span>
              Dampak yang diharapkan: <strong style={{ fontWeight: 600 }}>{scenario.impact}</strong>
            </span>
            {damagedCount > 0 ? <span>{damagedCount} elemen disorot merah</span> : null}
            {pickedReading ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked(null)}>
                bersihkan pilihan sensor
              </button>
            ) : null}
          </div>
        </div>

        <aside className="stack" style={{ gap: 'var(--space-3)' }}>
          <div className="glass card" style={{ padding: 'var(--space-4)' }}>
            <span className="card-kicker">Kendali simulasi</span>
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {/*
                * Daftar dikelompokkan menurut keluarga skenario, bukan disusun
                * sebagai sepuluh baris sejajar: yang dicari pembaca adalah
                * jenis pembebanannya dulu — lalu lintas, lingkungan, atau
                * kerusakan — baru anak tangganya.
                */}
              <select
                className="input"
                value={telemetry?.scenario ?? 'idle'}
                onChange={(event) => onScenario(event.target.value)}
                aria-label="Pilih skenario pembebanan"
              >
                <option value="idle">Pemantauan langsung</option>
                {FAMILY_ORDER.map((family) => (
                  <optgroup key={family} label={FAMILY_LABELS[family]}>
                    {scenariosOf(family).map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="row">
                <button type="button" className="btn btn-secondary btn-sm" onClick={onTogglePause}>
                  {telemetry?.paused ? 'Lanjutkan' : 'Jeda'}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onStop} disabled={!running}>
                  Hentikan skenario
                </button>
              </div>
              {running ? (
                <p className="text-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                  {scenario.desc}
                </p>
              ) : null}
            </div>
          </div>

          <div className="glass card" style={{ padding: 'var(--space-4)' }}>
            <span className="card-kicker">Kanal struktural</span>
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {keyReadings.map((reading) => (
                <SensorCard
                  key={reading.id}
                  reading={reading}
                  values={series[reading.id]?.values ?? []}
                  selected={picked === reading.id}
                  onSelect={(id) => setPicked(picked === id ? null : id)}
                />
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------ model acuan GLB */

/**
 * Tampilan model kendali bersumber.
 *
 * Model ini tidak punya telemetri: yang ditampilkan adalah metadata tata kelola
 * geometrinya — tingkat kepercayaan tiap bagian, asal-usul bentuknya, dan
 * kontrol dimensi yang dipakainya. Itulah bedanya dengan kembaran digital yang
 * dipantau: yang satu menjawab "seberapa kuat dasar bentuk ini", yang lain
 * menjawab "bagaimana keadaannya sekarang".
 */
function ReferenceModelView({ bridge }: { bridge: Bridge }) {
  const [doc, setDoc] = useState<PartsDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState<GlbViewerHandle | null>(null);
  const [viewMode, setViewMode] = useState<GlbViewMode>('iso');
  const [hiddenSystems, setHiddenSystems] = useState<Set<string>>(new Set());
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [confidenceOverlay, setConfidenceOverlay] = useState(false);
  const [provenanceOutlines, setProvenanceOutlines] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = bridge.model.metadataUrl;
    if (!url) return;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`manifes bagian tidak terbaca (${response.status})`);
        return response.json() as Promise<PartsDocument>;
      })
      .then((data) => {
        if (!cancelled) setDoc(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(`Manifes bagian gagal dimuat: ${err.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [bridge.model.metadataUrl]);

  useEffect(() => {
    handle?.setHiddenSystems(hiddenSystems);
  }, [handle, hiddenSystems]);
  useEffect(() => {
    handle?.setConfidenceOverlay(confidenceOverlay);
  }, [handle, confidenceOverlay]);
  useEffect(() => {
    handle?.setProvenanceOutlines(provenanceOutlines);
  }, [handle, provenanceOutlines]);
  useEffect(() => {
    handle?.focus(selectedPart);
  }, [handle, selectedPart]);

  const selectedMetadata = useMemo(
    () => doc?.parts.find((part) => part.part_id === selectedPart) ?? null,
    [doc, selectedPart],
  );

  const histogram = (doc?.measures?.confidence_histogram ?? {}) as Record<string, number>;

  return (
    <div className="screen">
      <PageHeader
        kicker="Model kendali bersumber"
        title={bridge.name}
        lede={`${bridge.location} · ${bridge.type} · bentang utama ${bridge.spanMeters} m. Setiap bagian membawa tingkat kepercayaan geometrinya dan kontrol dimensi yang dipakainya.`}
      />

      <section className="split" style={PANEL_GRID}>
        <div>
          <div className="row" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="seg" style={{ flexWrap: 'wrap', overflow: 'visible' }}>
              {GLB_VIEW_ORDER.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className="seg-opt"
                  aria-pressed={viewMode === mode}
                  title={GLB_VIEW_PRESETS[mode].description}
                  onClick={() => {
                    setViewMode(mode);
                    handle?.setView(mode);
                  }}
                >
                  {GLB_VIEW_PRESETS[mode].label}
                </button>
              ))}
            </div>
            <label className="row" style={{ gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={confidenceOverlay}
                onChange={(event) => setConfidenceOverlay(event.target.checked)}
              />
              Warnai menurut kepercayaan
            </label>
            <label className="row" style={{ gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={provenanceOutlines}
                onChange={(event) => setProvenanceOutlines(event.target.checked)}
              />
              Garis asal-usul
            </label>
          </div>

          {error ? (
            <div
              role="alert"
              className="glass card"
              style={{ background: 'rgb(248 113 113 / 0.14)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}
            >
              {error}
            </div>
          ) : null}

          {doc && bridge.model.url ? (
            <Stage>
              <GlbViewer
                modelUrl={bridge.model.url}
                doc={doc}
                selectedId={selectedPart}
                onSelect={setSelectedPart}
                onReady={setHandle}
                onError={setError}
              />
              <div className="stage-chip" style={{ top: 'var(--space-3)', left: 'var(--space-3)' }}>
                {doc.parts.length} bagian beradres · {GLB_VIEW_PRESETS[viewMode].label}
              </div>
              {selectedMetadata ? (
                <div className="stage-chip" style={{ bottom: 'var(--space-3)', right: 'var(--space-3)' }}>
                  {selectedMetadata.part_id.replace(/_/g, ' ')}
                </div>
              ) : null}
            </Stage>
          ) : (
            !error && <p className="text-muted">Memuat model kendali…</p>
          )}

          <p className="text-muted" style={{ fontSize: 11, marginTop: 'var(--space-3)', lineHeight: 1.6, maxWidth: '78ch' }}>
            {bridge.model.credit}{' '}
            <a href="https://github.com/Ethical-Tech-CoLab/manhattan-bridge-3d" target="_blank" rel="noreferrer">
              Sumber model
            </a>
            . Angka dimensi pada model ini milik proyek tersebut, bukan hasil pengukuran aset yang
            dipantau aplikasi ini.
          </p>
        </div>

        <aside className="stack" style={{ gap: 'var(--space-3)' }}>
          {doc ? (
            <>
              <div className="glass card" style={{ padding: 'var(--space-4)' }}>
                <span className="card-kicker">Sistem struktur</span>
                <GlbSystemTree
                  doc={doc}
                  hidden={hiddenSystems}
                  onToggle={(system) =>
                    setHiddenSystems((previous) => {
                      const next = new Set(previous);
                      if (next.has(system)) next.delete(system);
                      else next.add(system);
                      return next;
                    })
                  }
                />
                <div className="hairline" style={{ margin: 'var(--space-2) 0' }} />
                <div className="text-muted" style={{ fontSize: 12 }}>
                  milestone {doc.milestone} ·{' '}
                  {Object.entries(histogram)
                    .map(([grade, count]) => `${grade}:${count}`)
                    .join(' · ')}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 'var(--space-2)' }}
                  onClick={() => {
                    setHiddenSystems(new Set());
                    setSelectedPart(null);
                    setViewMode('iso');
                    handle?.reset();
                  }}
                >
                  Setel ulang
                </button>
              </div>

              <div className="glass card" style={{ padding: 'var(--space-4)' }}>
                <span className="card-kicker">Bagian terpilih</span>
                {selectedMetadata ? (
                  <PartMetadataPanel part={selectedMetadata} doc={doc} />
                ) : (
                  <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                    Klik satu bagian pada model untuk melihat tingkat kepercayaan, asal-usul geometri,
                    dan kontrol dimensi yang dipakainya.
                  </p>
                )}
              </div>

              <div className="glass card" style={{ padding: 'var(--space-4)' }}>
                <span className="card-kicker">Keterangan</span>
                <ConfidenceLegend doc={doc} />
              </div>
            </>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
