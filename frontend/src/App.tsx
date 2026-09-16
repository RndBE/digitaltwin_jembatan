import { useEffect, useMemo, useState } from 'react';
import type { Bridge } from './lib/types';
import { api, ping } from './lib/api';
import { BRIDGES as LOCAL_BRIDGES, DEFAULT_BRIDGE_ID } from './domain/bridges';
import { useTelemetry } from './hooks/useTelemetry';
import { Sidebar, type ScreenKey } from './components/Sidebar';
import { Backdrop } from './components/Ui';
import { DashboardPage } from './pages/DashboardPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { InfoPage, InspectionPage, RepairPage, SensorPage } from './pages/AssetPages';
import { AnalysisPage } from './pages/AnalysisPage';
import { ComparePage } from './pages/ComparePage';
import { ScenarioPage } from './pages/ScenarioPage';

/**
 * Kerangka aplikasi.
 *
 * Bawaannya adalah mode peraga: seluruh angka dibangkitkan mesin simulasi di
 * peramban dan data contoh, tanpa memerlukan server sama sekali. Setel
 * `VITE_API_ENABLED=true` untuk menyambungkannya ke API — antarmukanya sama
 * persis di kedua keadaan, yang berbeda hanya keterangan sumber data.
 */
const API_ENABLED = import.meta.env.VITE_API_ENABLED === 'true';

export default function App() {
  const [apiAvailable, setApiAvailable] = useState(false);
  const [probed, setProbed] = useState(!API_ENABLED);
  const [bridges, setBridges] = useState<Bridge[]>(LOCAL_BRIDGES);
  const [bridgeId, setBridgeId] = useState(DEFAULT_BRIDGE_ID);
  const [screen, setScreen] = useState<ScreenKey>('dash');

  // Satu pemeriksaan saat mulai; hasilnya menentukan mode untuk sesi ini.
  useEffect(() => {
    if (!API_ENABLED) return;
    let cancelled = false;
    ping().then((alive) => {
      if (cancelled) return;
      setApiAvailable(alive);
      setProbed(true);
      if (!alive) return;
      api
        .listBridges()
        .then((list) => {
          if (!cancelled && list.length) setBridges(list);
        })
        .catch(() => {
          /* katalog bawaan tetap dipakai */
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const bridge = useMemo(
    () => bridges.find((item) => item.id === bridgeId) ?? bridges[0],
    [bridges, bridgeId],
  );

  const isReference = bridge?.model.kind === 'glb';
  const controller = useTelemetry(bridge, apiAvailable && !isReference);

  // Model acuan tidak punya telemetri; halaman yang membacanya tidak bermakna
  // untuknya, jadi pandangannya dialihkan ke yang memang bisa ditampilkan.
  useEffect(() => {
    if (isReference && !['twin', 'info'].includes(screen)) setScreen('twin');
  }, [isReference, screen]);

  if (!bridge) return <p style={{ padding: 40 }}>The bridge catalogue is empty.</p>;

  const status = controller.telemetry?.assessment.status ?? 'AMAN';
  const demo = !apiAvailable;

  const page = () => {
    if (!probed) return <p className="text-muted">Checking whether the API is available…</p>;

    switch (screen) {
      case 'dash':
        return (
          <DashboardPage
            bridge={bridge}
            telemetry={controller.telemetry}
            alerts={controller.alerts}
            series={controller.series}
            source={controller.source}
            intervalMs={controller.intervalMs}
            residual={controller.residual}
            onOpenTwin={() => setScreen('twin')}
            onOpenScenario={() => setScreen('scenario')}
            onOpenAsset={() => setScreen('info')}
          />
        );
      case 'twin':
        return (
          <DigitalTwinPage
            bridge={bridge}
            telemetry={controller.telemetry}
            series={controller.series}
            source={controller.source}
            intervalMs={controller.intervalMs}
            residual={controller.residual}
            onScenario={controller.setScenario}
            onStop={controller.stopScenario}
            onTogglePause={controller.togglePause}
            onRepair={controller.recordRepair}
          />
        );
      case 'info':
        return (
          <InfoPage
            bridge={bridge}
            telemetry={controller.telemetry}
            onOpen={(key) => setScreen(key)}
          />
        );
      case 'inspection':
        return <InspectionPage bridge={bridge} />;
      case 'repair':
        return <RepairPage bridge={bridge} />;
      case 'sensors':
        return <SensorPage bridge={bridge} />;
      case 'analysis':
        return (
          <AnalysisPage
            bridge={bridge}
            telemetry={controller.telemetry}
            series={controller.series}
          />
        );
      case 'compare':
        return (
          <ComparePage
            telemetry={controller.telemetry}
            series={controller.series}
            reference={controller.reference}
            referenceFrozen={controller.referenceFrozen}
            onOpenScenario={() => setScreen('scenario')}
          />
        );
      case 'scenario':
      default:
        return (
          <ScenarioPage
            telemetry={controller.telemetry}
            residual={controller.residual}
            onRun={controller.setScenario}
            onStop={controller.stopScenario}
            onTogglePause={controller.togglePause}
            onRepair={controller.recordRepair}
            onOpenTwin={() => setScreen('twin')}
            onOpenCompare={() => setScreen('compare')}
            controlError={controller.controlError}
          />
        );
    }
  };

  return (
    <div className="app-shell">
      <Backdrop />

      <div className="app-container">
        <Sidebar
          screen={screen}
          onScreen={setScreen}
          bridges={bridges}
          bridge={bridge}
          onBridge={setBridgeId}
          status={isReference ? 'AMAN' : status}
          source={controller.source}
          demo={demo}
          repairNeeded={Object.keys(controller.residual).length > 0}
        />

        <main key={screen} className="app-main">
          {page()}
        </main>
      </div>
    </div>
  );
}
