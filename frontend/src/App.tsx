import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Bridge } from './lib/types';
import { api, ping } from './lib/api';
import { BRIDGES as LOCAL_BRIDGES, DEFAULT_BRIDGE_ID } from './domain/bridges';
import { useTelemetry } from './hooks/useTelemetry';
import { Sidebar, SCREEN_TITLES, type LayarTujuan, type ScreenKey, type SidebarProps } from './components/Sidebar';
import { AppHeader } from './components/AppHeader';
import { Backdrop, TabBar } from './components/Ui';
import { activeRule } from './domain/alertRules';
import { STATUS_COLOR } from './domain/sensors';
import { DEFAULT_SCREEN, pathForScreen, screenFromPath, tujuanFromPath } from './lib/routes';
import { keluar, langganSesi, pulihkanSesi, sesiKini } from './lib/session';
import { LoginPage } from './pages/LoginPage';
import { langganAlarm, ringkasAlarm, versiAlarm } from './domain/alarms';
import { penandaRutin } from './domain/rutin';
import { titipkanPadanan } from './domain/lokasiModel';
import { langganTemuan, versiTemuan } from './domain/temuan';
import { DashboardPage } from './pages/DashboardPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { DataPage } from './pages/DataPage';
import { CameraPage } from './pages/CameraPage';
import { ConditionPage } from './pages/ConditionPage';
import { PemeriksaanPage } from './pages/PemeriksaanPage';
import { RutinPage } from './pages/RutinPage';
import { KesesuaianPage } from './pages/KesesuaianPage';
import { RutePage } from './pages/RutePage';
import { PeriksaPage } from './pages/PeriksaPage';
import { InventarisasiPage } from './pages/InventarisasiPage';
import { KhususPage } from './pages/KhususPage';
import { LaporanPage } from './pages/LaporanPage';
import { AsetPage, RepairPage, type AsetTab } from './pages/AssetPages';
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

type AnalisaTab = 'deret' | 'banding' | 'skenario';
type DetailTab = 'catat' | 'rute';

const TAB_ANALISA: Array<{ key: AnalisaTab; label: string }> = [
  { key: 'deret', label: 'Deret waktu' },
  { key: 'banding', label: 'Perbandingan' },
  { key: 'skenario', label: 'Skenario' },
];

const TAB_DETAIL: Array<{ key: DetailTab; label: string }> = [
  { key: 'catat', label: 'Catat kerusakan' },
  { key: 'rute', label: 'Rute pemeriksaan' },
];

/** Layar dan tab yang ditunjuk sebuah tujuan; tujuan lama menjadi tab. */
function terjemah(tujuan: LayarTujuan): { screen: ScreenKey; analisa?: AnalisaTab; detail?: DetailTab } {
  switch (tujuan) {
    case 'analysis':
      return { screen: 'analisa', analisa: 'deret' };
    case 'compare':
      return { screen: 'analisa', analisa: 'banding' };
    case 'scenario':
      return { screen: 'analisa', analisa: 'skenario' };
    case 'rute':
      return { screen: 'pemeriksaan', detail: 'rute' };
    case 'pemeriksaan':
      return { screen: 'pemeriksaan', detail: 'catat' };
    default:
      return { screen: tujuan };
  }
}

export default function App() {
  const [apiAvailable, setApiAvailable] = useState(false);
  const [probed, setProbed] = useState(!API_ENABLED);
  /*
   * Sesi pengguna.
   *
   * `sesiSiap` dan `probed` dua hal berbeda dan urutannya penting: cara sesi
   * dipulihkan bergantung pada ada tidaknya server, jadi pemulihannya baru
   * dijalankan setelah pemeriksaan API selesai. Selama keduanya belum selesai
   * layar dibiarkan kosong — layar masuk yang berkedip sesaat pada pengguna
   * yang sebenarnya masih punya sesi lebih buruk daripada satu jenak diam.
   */
  const sesi = useSyncExternalStore(langganSesi, sesiKini);
  const [sesiSiap, setSesiSiap] = useState(false);
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
  const [awal] = useState(() => terjemah(tujuanFromPath(window.location.pathname) ?? DEFAULT_SCREEN));
  const [screen, setScreen] = useState<ScreenKey>(awal.screen);
  // Tab pada halaman yang memuat beberapa tampilan; di sini supaya tombol dari
  // halaman lain dapat memilihnya.
  const [analisaTab, setAnalisaTab] = useState<AnalisaTab>(awal.analisa ?? 'deret');
  const [detailTab, setDetailTab] = useState<DetailTab>(awal.detail ?? 'catat');

  /** Buka sebuah tujuan, termasuk yang kini berupa tab di halaman lain. */
  const bukaLayar = (tujuan: LayarTujuan) => {
    const t = terjemah(tujuan);
    if (t.analisa) setAnalisaTab(t.analisa);
    if (t.detail) setDetailTab(t.detail);
    setScreen(t.screen);
  };
  // Tab halaman Informasi; di sini supaya tautan dari halaman lain dapat memilihnya.
  const [asetTab, setAsetTab] = useState<AsetTab>('data');

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
  // Mencatat atau menghapus temuan harus menyalakan atau memadamkan titik Pemeriksaan rutin seketika.
  useSyncExternalStore(langganTemuan, versiTemuan);

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
   * Titik pada butir Pemeriksaan rutin: merah bila ada usulan tindakan
   * darurat, kuning bila pemeriksaan terlambat atau wajib dijadwalkan.
   * "Mendekati" tidak menyalakan apa pun; lihat `domain/rutin.ts`.
   */
  const rutin = isReference ? null : penandaRutin(bridge.id, controller.telemetry?.readings ?? null);
  if (rutin) {
    dots.periksa = {
      color: rutin.tingkat === 'darurat' ? 'var(--state-bahaya)' : 'var(--state-waspada)',
      title: rutin.judul,
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

  // Sesi dipulihkan sekali, setelah jelas ada atau tidaknya server: di mode
  // API token yang tersimpan ditanyakan ke /auth/me, di mode peraga cukup
  // dibaca dari peramban.
  useEffect(() => {
    if (!probed) return;
    let cancelled = false;
    pulihkanSesi(!apiAvailable).finally(() => {
      if (!cancelled) setSesiSiap(true);
    });
    return () => {
      cancelled = true;
    };
  }, [probed, apiAvailable]);

  // Tombol maju dan mundur peramban: alamatnya sudah berpindah, layarnya yang
  // menyusul. Perpindahan lewat rel navigasi tidak lewat sini.
  useEffect(() => {
    const onPop = () => bukaLayar(tujuanFromPath(window.location.pathname) ?? DEFAULT_SCREEN);
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
            onOpenScenario={() => bukaLayar('scenario')}
            onOpenPeriksa={() => setScreen('periksa')}
            onOpenAsset={() => {
              setAsetTab('data');
              setScreen('info');
            }}
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
            onRecordDamage={(padanan) => {
              titipkanPadanan(padanan);
              bukaLayar('pemeriksaan');
            }}
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
          <AsetPage
            bridge={bridge}
            telemetry={controller.telemetry}
            intervalMs={controller.intervalMs}
            tab={asetTab}
            onTab={setAsetTab}
            onOpenRepair={() => setScreen('repair')}
          />
        );
      case 'periksa':
        return <PeriksaPage bridge={bridge} telemetry={controller.telemetry} onOpen={bukaLayar} />;
      case 'inventarisasi':
        return <InventarisasiPage bridge={bridge} onOpen={setScreen} />;
      case 'pemeriksaan':
        return (
          <>
            <TabBar tabs={TAB_DETAIL} value={detailTab} onChange={setDetailTab} label="Tampilan pemeriksaan detail" />
            {detailTab === 'rute' ? (
              <RutePage
                bridge={bridge}
                telemetry={controller.telemetry}
                onRecordDamage={(padanan) => {
                  titipkanPadanan(padanan);
                  setDetailTab('catat');
                }}
              />
            ) : (
              <PemeriksaanPage bridge={bridge} />
            )}
          </>
        );
      case 'rutin':
        return <RutinPage bridge={bridge} telemetry={controller.telemetry} onOpen={setScreen} />;
      case 'khusus':
        return <KhususPage bridge={bridge} telemetry={controller.telemetry} />;
      case 'kesesuaian':
        return <KesesuaianPage onOpen={bukaLayar} />;
      case 'laporan':
        return <LaporanPage bridge={bridge} telemetry={controller.telemetry} />;
      case 'kondisi':
        return (
          <ConditionPage
            telemetry={controller.telemetry}
            onOpenInspection={() => {
              setAsetTab('inspeksi');
              setScreen('info');
            }}
            onOpenPemeriksaan={() => setScreen('pemeriksaan')}
          />
        );
      case 'repair':
        return <RepairPage bridge={bridge} />;
      case 'analisa':
        return (
          <>
            <TabBar tabs={TAB_ANALISA} value={analisaTab} onChange={setAnalisaTab} label="Tampilan analisa" />
            {analisaTab === 'deret' ? (
              <AnalysisPage
                bridge={bridge}
                telemetry={controller.telemetry}
                series={controller.series}
                source={controller.source}
              />
            ) : analisaTab === 'banding' ? (
              <ComparePage
                telemetry={controller.telemetry}
                series={controller.series}
                reference={controller.reference}
                referenceFrozen={controller.referenceFrozen}
                onOpenScenario={() => setAnalisaTab('skenario')}
              />
            ) : (
              <ScenarioPage
                telemetry={controller.telemetry}
                residual={controller.residual}
                onRun={controller.setScenario}
                onStop={controller.stopScenario}
                onTogglePause={controller.togglePause}
                onRepair={controller.recordRepair}
                onOpenTwin={() => setScreen('twin')}
                onOpenCompare={() => setAnalisaTab('banding')}
                controlError={controller.controlError}
              />
            )}
          </>
        );
      default:
        return null;
    }
  };

  // Belum jelas siapa yang membuka: jangan gambar apa pun dulu.
  if (!probed || !sesiSiap) {
    return (
      <div className="app-shell">
        <Backdrop />
      </div>
    );
  }

  if (!sesi) {
    return (
      <>
        <Backdrop />
        <LoginPage modePeraga={!apiAvailable} />
      </>
    );
  }

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
          onScreen={bukaLayar}
          bridges={bridges}
          bridge={bridge}
          onBridge={setBridgeId}
          status={isReference ? 'AMAN' : status}
          repairNeeded={Object.keys(controller.residual).length > 0}
          dots={dots}
          user={sesi}
          onLogout={keluar}
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
