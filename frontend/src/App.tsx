import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Bridge } from './lib/types';
import { api, ping } from './lib/api';
import { BRIDGES as LOCAL_BRIDGES, DEFAULT_BRIDGE_ID } from './domain/bridges';
import { useTelemetry } from './hooks/useTelemetry';
import { Sidebar, SCREEN_TITLES, type ScreenKey, type SidebarProps } from './components/Sidebar';
import { AppHeader } from './components/AppHeader';
import { Backdrop } from './components/Ui';
import { activeRule } from './domain/alertRules';
import { STATUS_COLOR } from './domain/sensors';
import { DEFAULT_SCREEN, pathForScreen, screenFromPath } from './lib/routes';
import { langganAlarm, ringkasAlarm, versiAlarm } from './domain/alarms';
import { DashboardPage } from './pages/DashboardPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { DataPage } from './pages/DataPage';
import { CameraPage } from './pages/CameraPage';
import { ConditionPage } from './pages/ConditionPage';
import { InfoPage, InspectionPage, RepairPage, SensorPage } from './pages/AssetPages';
import { ThresholdPage } from './pages/ThresholdPage';
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
  /*
   * Layar yang sedang dibuka, dibaca dari alamat halaman.
   *
   * Alamatnya sumber kebenaran saat memuat, bukan sekadar cerminnya: yang
   * membuka `/digital-twin` langsung mendarat di model 3D, dan menyegarkan
   * halaman tidak membuang tempat berdirinya. Alamat yang tidak dikenali
   * jatuh ke dashboard, dan efek di bawah membetulkan bilah alamatnya.
   */
  const [screen, setScreen] = useState<ScreenKey>(
    () => screenFromPath(window.location.pathname) ?? DEFAULT_SCREEN,
  );

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

  /*
   * Kejadian yang belum dibaca.
   *
   * Penanda hanya untuk kejadian yang lahir setelah aplikasi dibuka: log
   * selalu berisi baris pembuka, dan menandainya sebagai "baru" membuat titik
   * itu menyala sejak detik pertama — tanda yang selalu menyala sama saja
   * dengan tidak ada tanda.
   */
  // Menekan "Akui" di halaman Data harus memadamkan titik pada rel seketika,
  // bukan pada cuplikan berikutnya.
  useSyncExternalStore(langganAlarm, versiAlarm);

  const newestAlert = controller.alerts[0]?.at ?? '';
  const [seenAlertAt, setSeenAlertAt] = useState('');

  useEffect(() => {
    if (!newestAlert) return;
    // Baris pembuka dianggap sudah terbaca; sesudahnya, hanya membuka halaman
    // Data yang menandainya terbaca.
    if (!seenAlertAt || screen === 'data') setSeenAlertAt(newestAlert);
  }, [newestAlert, seenAlertAt, screen]);

  if (!bridge) return <p style={{ padding: 40 }}>Katalog jembatan kosong.</p>;

  const status = controller.telemetry?.assessment.status ?? 'AMAN';
  const demo = !apiAvailable;

  /*
   * Titik penanda pada rel.
   *
   * Dua butir saja yang dapat memanggil: Tingkat siaga ketika strukturnya
   * memang sedang keluar rentang, dan Data ketika ada kejadian yang belum
   * dibaca. Menandai lebih banyak butir daripada itu membuat seluruh relnya
   * berbintik, dan rel berbintik tidak menunjuk ke mana pun.
   */
  const berlaku = activeRule(controller.telemetry?.readings ?? []);
  const alarmRingkas = ringkasAlarm(controller.alerts);
  const dots: SidebarProps['dots'] = {};
  if (!isReference && berlaku.rule.level !== 'AMAN') {
    dots.ambang = {
      color: STATUS_COLOR[berlaku.rule.level],
      title: `tingkat siaga ${berlaku.rule.level}, aturan ${berlaku.rule.code}`,
    };
  }
  /*
   * Titik pada butir Data menandai **alarm yang belum diakui**, bukan sekadar
   * baris log yang belum dibaca.
   *
   * Keduanya sempat sama artinya ketika log hanya dapat dibaca. Sejak alarm
   * punya siklus, yang menuntut seseorang berbuat sesuatu adalah alarm yang
   * belum diakui — dan itulah satu-satunya yang pantas memanggil dari rel.
   * Kejadian baru yang sudah diakui tidak lagi menyalakan titiknya.
   */
  if (!isReference && alarmRingkas.baru > 0) {
    dots.data = {
      color: 'var(--state-bahaya)',
      title: `${alarmRingkas.baru} alarm belum diakui`,
    };
  } else if (!isReference && newestAlert && newestAlert !== seenAlertAt) {
    dots.data = { color: 'var(--brand-300)', title: 'ada kejadian baru yang belum dibaca' };
  }

  // Judul tab menyebut layar dan asetnya. Nama layar diletakkan di depan karena
  // itu bagian yang membedakan, dan tab yang sempit memotong dari belakang.
  useEffect(() => {
    document.title = `${SCREEN_TITLES[screen]} · ${bridge.name} — Bridge Digital Twin`;
  }, [screen, bridge.name]);

  /*
   * Bilah alamat mengikuti layar.
   *
   * `pushState` supaya tiap perpindahan menjadi satu langkah riwayat — tombol
   * kembali peramban lalu berarti "layar sebelumnya", yang memang yang
   * diharapkan orang. Perkecualiannya kunjungan pertama: alamat yang kosong
   * atau tidak dikenali dibetulkan dengan `replaceState`, karena langkah
   * kembali menuju alamat yang barusan ditolak bukan langkah yang berguna.
   */
  useEffect(() => {
    const target = pathForScreen(screen);
    if (window.location.pathname === target) return;
    const mengoreksi = screenFromPath(window.location.pathname) === null;
    window.history[mengoreksi ? 'replaceState' : 'pushState']({ screen }, '', target);
  }, [screen]);

  // Tombol maju dan mundur peramban: alamatnya sudah berpindah, layarnya yang
  // menyusul. Perpindahan lewat rel navigasi tidak lewat sini.
  useEffect(() => {
    const onPop = () => setScreen(screenFromPath(window.location.pathname) ?? DEFAULT_SCREEN);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const page = () => {
    if (!probed) return <p className="text-muted">Memeriksa ketersediaan API…</p>;

    switch (screen) {
      case 'dash':
        return (
          <DashboardPage
            bridge={bridge}
            telemetry={controller.telemetry}
            alerts={controller.alerts}
            residual={controller.residual}
            alertSince={controller.alertSince}
            onOpenTwin={() => setScreen('twin')}
            onOpenCondition={() => setScreen('kondisi')}
            onOpenCamera={() => setScreen('kamera')}
            onOpenScenario={() => setScreen('scenario')}
            onOpenAsset={() => setScreen('info')}
            onOpenEvents={() => setScreen('data')}
          />
        );
      case 'twin':
        return (
          <DigitalTwinPage
            bridge={bridge}
            telemetry={controller.telemetry}
            series={controller.series}
            residual={controller.residual}
            onScenario={controller.setScenario}
            onStop={controller.stopScenario}
            onTogglePause={controller.togglePause}
            onRepair={controller.recordRepair}
          />
        );
      case 'data':
        return (
          <DataPage
            bridge={bridge}
            telemetry={controller.telemetry}
            series={controller.series}
            alerts={controller.alerts}
            source={controller.source}
            intervalMs={controller.intervalMs}
          />
        );
      case 'kamera':
        return <CameraPage bridge={bridge} telemetry={controller.telemetry} />;
      case 'ambang':
        return (
          <ThresholdPage
            bridge={bridge}
            telemetry={controller.telemetry}
            source={controller.source}
            alertSince={controller.alertSince}
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
      case 'kondisi':
        return (
          <ConditionPage
            bridge={bridge}
            telemetry={controller.telemetry}
            onOpenInspection={() => setScreen('inspection')}
          />
        );
      case 'repair':
        return <RepairPage bridge={bridge} />;
      case 'sensors':
        return (
          <SensorPage bridge={bridge} telemetry={controller.telemetry} intervalMs={controller.intervalMs} />
        );
      case 'analysis':
        return (
          <AnalysisPage
            bridge={bridge}
            telemetry={controller.telemetry}
            series={controller.series}
            source={controller.source}
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
      {/*
        * Tautan lompat: butir pertama yang dijangkau Tab, tidak terlihat sampai
        * ia dapat fokus. Tanpa ini pengguna papan ketik menelusuri delapan
        * butir navigasi yang sama setiap kali berpindah halaman — navigasinya
        * berada di depan isi pada setiap layar, jadi ongkosnya berulang.
        */}
      <a className="lompat-isi" href="#isi">
        Lompat ke isi
      </a>
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
          dots={dots}
        />

        <div className="app-column">
          {/*
            * Kepala berdiri di luar `main`, bukan di dalamnya.
            *
            * `main` dipasangi `key={screen}` supaya isinya benar-benar diganti
            * tiap berpindah layar; kepala ini justru yang tidak boleh ikut
            * diganti — ia keadaan jembatan, bukan bagian dari halaman mana pun.
            * Nama halamannya diberikan sebagai nilai, jadi yang berganti cuma
            * satu untai teks.
            */}
          <AppHeader
            title={SCREEN_TITLES[screen]}
            telemetry={controller.telemetry}
            alertSince={controller.alertSince}
            intervalMs={controller.intervalMs}
            reference={isReference}
            onOpenRules={() => setScreen('ambang')}
          />

          {/* `tabIndex={-1}` supaya fokus benar-benar berpindah ke sini saat
              tautan lompat diikuti, bukan sekadar halamannya yang tergulir. */}
          <main key={screen} id="isi" tabIndex={-1} className="app-main">
            {page()}
          </main>
        </div>
      </div>
    </div>
  );
}
