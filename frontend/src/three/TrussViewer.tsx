import { useEffect, useRef } from 'react';
import type { Bridge, Telemetry } from '../lib/types';
import { SENSOR_BY_ID, excessRatio, statusOf } from '../domain/sensors';
import { SCENARIOS } from '../domain/scenarios';
import { buildTwinScene, type TwinScene } from './proceduralBridge';
import { loadSpots, saveSpot } from '../lib/sensorSpots';
import { sagBand } from '../domain/deflectionScale';

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
  /** Penanda boleh digeser; bila mati, penanda hanya dapat diklik untuk dibaca. */
  editSpots: boolean;
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
    `<span style="color:${color}">${status}</span><br>` +
    `<span style="opacity:.65">${spec.node} · ambang ${spec.warn.toFixed(spec.dec)} ${spec.unit}</span>`
  );
}

export function TrussViewer({
  bridge,
  telemetry,
  pickedSensor,
  autoRotate,
  editSpots,
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

    /*
     * Rasio tegangan dihitung dari nilai sensor, bukan dari keadaan internal
     * mesin simulasi, sehingga model bereaksi sama baik saat data datang dari
     * API maupun dari mesin lokal.
     *
     * Pembaginya adalah **jarak dasar ke ambang kritis**, bukan pengali tetap.
     * Sebelum ini rasionya `(nilai/dasar − 1) / 1,1`, yang mencapai satu pada
     * 178,5 µm/m sementara ambang kritisnya 190: dua batang pada 178 dan 195
     * µm/m tergambar dengan warna yang sama persis, dan perpindahan pita —
     * satu-satunya hal yang ingin dikabarkan warna itu — tidak terlihat di
     * model. `excessRatio` memakai ambang yang sama dengan yang dipakai kartu
     * sensor dan halaman Tingkat siaga, jadi merah penuh jatuh tepat di ambang
     * kritis dan ikut berpindah bila operator mengubah ambangnya.
     */
    const stressRatio = strain ? excessRatio(strainSpec, strain.value) : 0;
    const tiltRatio = tilt ? Math.max(0, tilt.value / tiltSpec.base - 1) : 0;

    /*
     * Lendutan dibaca dari kanalnya, dalam milimeter, lalu dibawa ke satuan
     * adegan lewat panjang bentang yang sebenarnya: satu satuan adegan setara
     * `spanMeters / spanUnits` meter di lapangan. Skala gambarnya — yang
     * bertingkat menurut pita ambang — dikerjakan `sagBand`, sehingga adegan
     * hanya menerima satu angka dan tidak perlu tahu apa-apa soal milimeter.
     *
     * Pitanya ikut dikirim karena adegan memakainya untuk peredaman, bukan
     * untuk besarnya: aman turun tenang, kritis mengayun dan lama tenangnya.
     */
    const deflection = telemetry?.readings.find((r) => r.id === 'defl');
    const metresPerUnit = bridge.spanMeters / (bridge.model.spanUnits ?? 12);
    const band = deflection ? sagBand(deflection.value) : null;
    const sagUnits = band ? band.drawnMetres / metresPerUnit : 0;

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
      sagUnits,
      sagStatus: band?.status ?? 'AMAN',
      damaged: telemetry?.damagedParts ?? [],
      cars: telemetry?.traffic.cars ?? 0,
      trucks: telemetry?.traffic.trucks ?? 0,
      speed: telemetry?.traffic.speedFactor ?? 0,
      sensorStatus,
      windRatio,
      floodRatio,
      paused: telemetry?.paused ?? false,
    });
  }, [telemetry, bridge.spanMeters, bridge.model.spanUnits]);

  useEffect(() => {
    sceneRef.current?.setState({ pickedSensor });
  }, [pickedSensor]);

  useEffect(() => {
    sceneRef.current?.setState({ autoRotate });
  }, [autoRotate]);

  useEffect(() => {
    sceneRef.current?.setState({ editSpots });
  }, [editSpots]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={
        `Model tiga dimensi ${bridge.name}. Seret untuk memutar, gulir untuk memperbesar, ` +
        `klik penanda sensor untuk melihat nilainya.` +
        (editSpots ? ' Mode geser penanda menyala: seret penanda untuk memindahkan letaknya.' : '')
      }
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
