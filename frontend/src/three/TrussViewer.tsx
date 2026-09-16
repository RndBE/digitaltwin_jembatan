import { useEffect, useRef } from 'react';
import type { Bridge, Telemetry } from '../lib/types';
import { SENSOR_BY_ID, STATUS_LABEL, excessRatio, statusOf } from '../domain/sensors';
import { SCENARIOS } from '../domain/scenarios';
import { buildTwinScene, type TwinScene } from './proceduralBridge';
import { loadSpots, saveSpot } from '../lib/sensorSpots';

/**
 * Pembungkus React untuk adegan three.js prosedural.
 *
 * Adegan dibangun sekali per jembatan dan tidak dibangun ulang saat telemetri
 * berubah: nilai baru hanya disalin ke dalam adegan lewat `setState`, sehingga
 * 200 ms sekali tidak memicu pembuatan ulang geometri apa pun.
 */

export interface TrussViewerProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
  pickedSensor: string | null;
  autoRotate: boolean;
  onPick: (sensorId: string | null) => void;
  onScale: (metres: number) => void;
  onReady: (scene: TwinScene | null) => void;
  /** Sebuah penanda selesai dipindahkan dan letak barunya sudah disimpan. */
  onSpotMove?: () => void;
}

/** Isi label melayang di samping penanda sensor yang sedang dipilih. */
function labelHtml(sensorId: string, telemetry: Telemetry | null): string {
  const spec = SENSOR_BY_ID[sensorId];
  if (!spec) return '';
  const reading = telemetry?.readings.find((r) => r.id === sensorId);
  const value = reading?.value ?? spec.base;
  const status = statusOf(spec, value);
  const color = status === 'AMAN' ? '#006786' : '#aa0b56';
  return (
    `<b style="font-weight:600">${spec.name}</b> · ${value.toFixed(spec.dec)} ${spec.unit} ` +
    `<span style="color:${color}">${STATUS_LABEL[status]}</span><br>` +
    `<span style="opacity:.65">${spec.node} · warn at ${spec.warn.toFixed(spec.dec)} ${spec.unit}</span>`
  );
}

export function TrussViewer({
  bridge,
  telemetry,
  pickedSensor,
  autoRotate,
  onPick,
  onScale,
  onReady,
  onSpotMove,
}: TrussViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TwinScene | null>(null);
  // Nilai terbaru disimpan di ref supaya panggilan balik yang diserahkan ke
  // three.js tidak perlu dibuat ulang tiap render.
  const telemetryRef = useRef<Telemetry | null>(telemetry);
  telemetryRef.current = telemetry;
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const scaleRef = useRef(onScale);
  scaleRef.current = onScale;
  const spotMoveRef = useRef(onSpotMove);
  spotMoveRef.current = onSpotMove;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = buildTwinScene({
      host,
      panels: bridge.model.panels ?? 10,
      spanUnits: bridge.model.spanUnits ?? 12,
      // Letak penanda yang pernah digeser dibaca sekali saat adegan dibangun.
      spots: loadSpots(bridge.id),
      callbacks: {
        onPick: (id) => pickRef.current(id),
        onScale: (metres) => scaleRef.current(metres),
        onSpotMove: (id, spot) => {
          saveSpot(bridge.id, id, spot);
          spotMoveRef.current?.();
        },
        labelFor: (id) => labelHtml(id, telemetryRef.current),
      },
    });

    sceneRef.current = scene;
    onReady(scene);

    return () => {
      onReady(null);
      sceneRef.current = null;
      scene.dispose();
    };
    // Adegan hanya dibangun ulang bila jembatannya berganti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.id]);

  // Salin keadaan telemetri ke adegan setiap kali nilai baru tiba.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const strain = telemetry?.readings.find((r) => r.id === 'strain');
    const tilt = telemetry?.readings.find((r) => r.id === 'tilt');
    const strainSpec = SENSOR_BY_ID.strain;
    const tiltSpec = SENSOR_BY_ID.tilt;

    // Rasio tegangan dihitung dari nilai sensor, bukan dari keadaan internal
    // mesin simulasi, sehingga model bereaksi sama baik saat data datang dari
    // API maupun dari mesin lokal.
    const stressRatio = strain
      ? Math.min(1, Math.max(0, (strain.value / strainSpec.base - 1) / 1.1))
      : 0;
    const tiltRatio = tilt ? Math.max(0, tilt.value / tiltSpec.base - 1) : 0;

    // Kantong angin membaca anemometer, bukan skenarionya: benda itu memang
    // menunjukkan angin yang sedang bertiup, dari mana pun angkanya datang.
    const wind = telemetry?.readings.find((r) => r.id === 'wind');
    const windRatio = wind ? excessRatio(SENSOR_BY_ID.wind, wind.value) : 0;
    // Muka air tidak punya sensor pada aset ini, jadi datang dari skenarionya.
    const floodRatio = telemetry
      ? (SCENARIOS[telemetry.scenario]?.environment?.flood ?? 0)
      : 0;

    // Status tiap kanal ikut dikirim: penanda di model mewarnai dirinya sendiri
    // menurut status itu, sehingga kanal yang keluar rentang terlihat langsung
    // pada strukturnya, bukan hanya pada kartu di sebelahnya.
    const sensorStatus: Record<string, 'AMAN' | 'WASPADA' | 'KRITIS'> = {};
    telemetry?.readings.forEach((reading) => {
      sensorStatus[reading.id] = reading.status;
    });

    scene.setState({
      stressRatio,
      tiltRatio,
      damaged: telemetry?.damagedParts ?? [],
      cars: telemetry?.traffic.cars ?? 0,
      trucks: telemetry?.traffic.trucks ?? 0,
      speed: telemetry?.traffic.speedFactor ?? 0,
      sensorStatus,
      windRatio,
      floodRatio,
      paused: telemetry?.paused ?? false,
    });
  }, [telemetry]);

  useEffect(() => {
    sceneRef.current?.setState({ pickedSensor });
  }, [pickedSensor]);

  useEffect(() => {
    sceneRef.current?.setState({ autoRotate });
  }, [autoRotate]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={`Three-dimensional model of ${bridge.name}. Drag to orbit, scroll to zoom, click a sensor marker to read its value, drag a marker to move it.`}
      style={{
        width: '100%',
        aspectRatio: '16 / 10',
        minHeight: 360,
        background: 'var(--ink-900)',
        borderRadius: 'var(--radius-glass)',
        overflow: 'hidden',
        boxShadow: '0 24px 60px -22px rgb(2 8 20 / 0.72)',
        position: 'relative',
      }}
    />
  );
}
