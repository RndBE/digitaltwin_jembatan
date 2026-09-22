import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Bridge, Telemetry } from '../lib/types';
import type { Series } from '../hooks/useTelemetry';
import { SensorLabelCard } from '../components/SensorCamera';
import { SENSOR_BY_ID, excessRatio } from '../domain/sensors';
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
  /** Deret nilai per kanal; label memakainya sebagai acuan kondisi aman. */
  series: Record<string, Series>;
  onPick: (sensorId: string | null) => void;
  onScale: (metres: number) => void;
  /** Membuka panel perbandingan kamera untuk kanal ini. */
  onCompare?: (sensorId: string) => void;
  onReady: (scene: TwinScene | null) => void;
  /** Sebuah penanda selesai dipindahkan dan letak barunya sudah disimpan. */
  onSpotMove?: () => void;
}

export function TrussViewer({
  bridge,
  telemetry,
  series,
  pickedSensor,
  autoRotate,
  editSpots,
  onPick,
  onScale,
  onCompare,
  onReady,
  onSpotMove,
}: TrussViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TwinScene | null>(null);
  /*
   * Wadah label disimpan sebagai keadaan, bukan hanya di dalam `ref`.
   *
   * Portal React perlu menggambar ulang begitu wadahnya ada; `ref` berubah
   * tanpa memicu render, jadi labelnya akan tetap kosong sampai ada yang
   * kebetulan menggambar ulang komponen ini.
   */
  const [labelHost, setLabelHost] = useState<HTMLElement | null>(null);
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
      },
    });

    sceneRef.current = scene;
    setLabelHost(scene.labelHost);
    onReady(scene);

    return () => {
      onReady(null);
      setLabelHost(null);
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
      // Tronton tidak ikut dalam cuplikan telemetri — ia keterangan skenario,
      // bukan hasil pengukuran. Dibaca dari katalog skenario yang sama yang
      // dipakai halaman lain.
      tronton: telemetry ? (SCENARIOS[telemetry.scenario]?.tronton ?? 0) : 0,
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
    >
      {/*
        * Isi label digambar React ke dalam wadah milik adegan.
        *
        * Letaknya tetap dihitung adegan tiap bingkai — ia yang tahu di mana
        * penanda jatuh pada layar — sedangkan apa yang tertulis di dalamnya
        * urusan React sepenuhnya, termasuk bingkai kamera dan tombolnya.
        */}
      {labelHost && pickedSensor
        ? createPortal(
            <SensorLabelCard
              bridgeId={bridge.id}
              sensorId={pickedSensor}
              telemetry={telemetry}
              series={series}
              onCompare={onCompare}
            />,
            labelHost,
          )
        : null}
    </div>
  );
}
