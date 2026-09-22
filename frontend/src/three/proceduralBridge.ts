import * as THREE from 'three';
import { SENSOR_SPOTS } from '../domain/sensors';
import { SAG_DYNAMICS } from '../domain/deflectionScale';

/**
 * Kembaran digital jembatan rangka baja yang dibangkitkan secara prosedural.
 *
 * Modul ini mengendalikan three.js secara langsung, bukan lewat pencocok React.
 * Yang dibutuhkan lapisan 3D hanya empat hal — membangun, memutar pandangan,
 * memilih titik, dan mewarnai ulang — dan penerapan langsung membuat daur hidup
 * kanvas tetap jelas serta mudah ditelusuri, sementara React hanya mengurus
 * antarmuka di sekelilingnya. Pola ini mengikuti pendekatan penampil GLB pada
 * manhattan-bridge-3d.
 *
 * Seluruh elemen struktur diberi `userData.tag` sehingga skenario kerusakan
 * dapat menyebut elemen mana yang terdampak (mis. `bc5z0` = batang bawah panel
 * ke-5 sisi z pertama), dan `userData.grp` supaya pohon bagian dapat
 * menyembunyikan satu kelompok sekaligus.
 */

export interface PartGroup {
  key: string;
  name: string;
  test: RegExp;
}

/** Kelompok bagian struktur, dipakai pohon bagian di panel samping. */
export const PART_GROUPS: PartGroup[] = [
  { key: 'atas', name: 'Rangka atas', test: /^tc/ },
  { key: 'bawah', name: 'Rangka bawah', test: /^bc/ },
  { key: 'diagonal', name: 'Diagonal', test: /^d\d/ },
  { key: 'vertikal', name: 'Vertikal', test: /^v-?\d/ },
  { key: 'bracing', name: 'Bracing & gelagar', test: /^(tb|lb|fb)/ },
  { key: 'tumpuan', name: 'Tumpuan', test: /^bear/ },
  { key: 'sensor', name: 'Titik sensor', test: /^sensor/ },
];

/** Kelompok bawaan untuk elemen yang tidak cocok pola mana pun (lantai jalan, pagar, tiang lampu). */
export const FALLBACK_GROUP = { key: 'lantai', name: 'Lantai jalan' };

/**
 * Berapa bagian lendutan yang dibawa kendaraan yang sedang melintas.
 *
 * Sisanya dibawa berat sendiri dan beban tetap, yang bentuknya tidak berubah.
 * Pembagian ini yang membuat lantai "bernapas": saat bentang kosong ia naik ke
 * bagian tetapnya saja, saat konvoi berada di tengah ia turun penuh.
 *
 * Seperempat, bukan setengah. Gerak adalah isyarat terkuat di layar, dan
 * cekungan yang berjalan bersama tiap truk memakai isyarat itu untuk
 * mengabarkan hal yang paling biasa terjadi sepanjang hari — kendaraan
 * lewat. Yang tersisa pada seperempat masih terbaca sebagai lantai yang
 * bernapas, tetapi tidak lagi menarik mata setiap kali ada truk di bentang;
 * yang menarik mata kembali menjadi perpindahan pita ambang, yang memang
 * pantas.
 *
 * Angkanya perkiraan peraga, bukan hasil hitungan struktur.
 */
export const LIVE_SHARE = 0.25;

/*
 * Satu pandangan baku: isometri.
 *
 * Pandangan ortogonal — rencana, elevasi, potongan — adalah alat gambar teknik,
 * dan yang membuatnya berguna di sana justru tidak ada di sini: tidak ada garis
 * ukur, tidak ada kop, tidak ada skala yang dapat dicetak. Yang tersisa hanya
 * empat tombol yang mengubah sudut kamera, sementara menyeret tetikus sudah
 * melakukan hal yang sama dengan lebih leluasa.
 */
const ISO_VIEW: [number, number, number] = [0.75, 0.36, 16];

export type MarkerStatus = 'AMAN' | 'WASPADA' | 'KRITIS';

export interface SceneState {
  /** Rasio tegangan 0..1 — memerahkan batang seiring naiknya regangan. */
  stressRatio: number;
  /** Rasio kemiringan tumpuan, memiringkan seluruh lantai. */
  tiltRatio: number;
  /**
   * Lendutan tengah bentang dalam satuan adegan, sudah dikalikan pengalinya.
   *
   * Yang dikirim ke sini bukan milimeter melainkan hasil akhirnya, karena
   * pengali itu keputusan tampilan, bukan keputusan model: halaman yang
   * menentukan seberapa dilebih-lebihkan, dan halaman itu pula yang wajib
   * menuliskan pengalinya di layar.
   */
  sagUnits: number;
  /**
   * Pita ambang kanal lendutan saat ini.
   *
   * Bukan dipakai untuk besarnya — besarnya sudah masak di `sagUnits` — tetapi
   * untuk **peredamannya**. Rasio redaman yang turun adalah penanda kerusakan
   * yang sungguhan, jadi lantai yang mengayun lebih lama saat kritis
   * menyampaikan sesuatu yang benar, bukan sekadar menarik perhatian.
   */
  sagStatus: MarkerStatus;
  /** Tag elemen yang sedang rusak menurut skenario aktif. */
  damaged: string[];
  cars: number;
  trucks: number;
  /** Truk tronton yang sedang diminta skenario; bobotnya dua kali truk boks. */
  tronton: number;
  speed: number;
  /** Status tiap kanal, dipakai mewarnai penanda sensor di model. */
  sensorStatus: Record<string, MarkerStatus>;
  /** Kecepatan angin 0..1 terhadap ambang kritis; mempercepat putaran anemometer. */
  windRatio: number;
  /** Muka air banjir 0..1; menaikkan, mengeruhkan, dan mengasarkan sungai. */
  floodRatio: number;
  paused: boolean;
  autoRotate: boolean;
  pickedSensor: string | null;
  /**
   * Penanda boleh digeser.
   *
   * Dimatikan secara bawaan. Letak penanda adalah data pemasangan, dan model
   * ini lebih sering dibaca daripada diatur: tanpa sakelar, satu tarikan yang
   * meleset saat hendak memutar pandangan sudah memindahkan sensor tanpa
   * disadari. Saat mati, penanda tetap dapat diklik untuk dibaca.
   */
  editSpots: boolean;
}

export interface SceneCallbacks {
  onPick: (sensorId: string | null) => void;
  /** Penanda selesai diseret ke letak baru, dalam satuan adegan. */
  onSpotMove: (sensorId: string, spot: [number, number, number]) => void;
  /** Panjang batang ukur dalam meter, diperbarui saat kamera bergerak. */
  onScale: (metres: number) => void;
}

export interface TwinScene {
  counts: Record<string, number>;
  /**
   * Wadah label melayang di atas penanda terpilih.
   *
   * Adegan hanya menempatkannya — kiri, atas, dan tampil atau tidak — sedangkan
   * isinya digambar React lewat portal ke elemen ini. Sebelumnya isinya dirakit
   * sebagai untaian HTML lalu dipasang dengan `innerHTML`, dan itu menutup
   * pintu bagi apa pun yang lebih dari teks: bingkai kamera, tombol, dan
   * keadaan React tidak dapat hidup di dalam untaian.
   */
  labelHost: HTMLElement;
  setState(patch: Partial<SceneState>): void;
  /** Kembalikan seluruh penanda ke titik bawaannya. */
  resetSpots(): void;
  toggleGroup(key: string): string[];
  selectGroup(key: string | null): string | null;
  reset(): void;
  dispose(): void;
}

/** Tekstur derau kecil untuk kekasaran permukaan; jauh lebih murah daripada memuat berkas peta. */
function noiseTexture(size: number, base: number, amplitude: number, repeat: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < (size * size) / 5; i++) {
    const g = Math.max(0, Math.min(255, base + (Math.random() - 0.5) * amplitude)) | 0;
    ctx.fillStyle = `rgba(${g},${g},${g},0.55)`;
    ctx.fillRect(
      (Math.random() * size) | 0,
      (Math.random() * size) | 0,
      1 + ((Math.random() * 3) | 0),
      1 + ((Math.random() * 3) | 0),
    );
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  return texture;
}

export interface BuildOptions {
  host: HTMLElement;
  panels: number;
  spanUnits: number;
  /** Letak penanda sensor; bila kosong, dipakai titik bawaan katalog sensor. */
  spots?: Record<string, [number, number, number]>;
  callbacks: SceneCallbacks;
}

export function buildTwinScene({ host, panels, spanUnits, spots, callbacks }: BuildOptions): TwinScene {
  const state: SceneState = {
    stressRatio: 0,
    tiltRatio: 0,
    sagUnits: 0,
    sagStatus: 'AMAN',
    damaged: [],
    cars: 0,
    trucks: 0,
    tronton: 0,
    speed: 0,
    sensorStatus: {},
    windRatio: 0,
    floodRatio: 0,
    paused: false,
    // Mati sejak bingkai pertama. Halaman menyetelnya lewat `setState` tepat
    // setelah adegan siap, dan nilai awal `true` akan membuat model bergeser
    // sekejap sebelum setelan itu sampai.
    autoRotate: false,
    pickedSensor: null,
    editSpots: false,
  };

  // ---------------------------------------------------------------- penyaji
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText =
    'display:block;width:100%;height:100%;cursor:grab;touch-action:none';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);

  /*
   * Siang hari.
   *
   * Adegan senja memang lebih bergaya, tetapi yang dikerjakan di halaman ini
   * adalah membaca struktur: batang mana yang memerah, elemen mana yang
   * ditandai rusak, penanda sensor mana yang keluar rentang. Semua itu dibaca
   * dari warna, dan warna hanya terbaca kalau bendanya terang. Langitnya
   * dibuat sebagai gradien satu piksel lebar lalu dipetakan ekuirektangular:
   * cukup untuk memberi pantulan lingkungan pada baja tanpa memuat berkas HDR.
   */
  const SKY_W = 1024;
  const SKY_H = 512;
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = SKY_W;
  skyCanvas.height = SKY_H;
  const skyCtx = skyCanvas.getContext('2d')!;
  const gradient = skyCtx.createLinearGradient(0, 0, 0, SKY_H);
  gradient.addColorStop(0, '#2f6fb5');
  gradient.addColorStop(0.34, '#79aede');
  gradient.addColorStop(0.47, '#bcd8ee');
  gradient.addColorStop(0.52, '#dde9f0');
  gradient.addColorStop(0.58, '#93a58c');
  gradient.addColorStop(1, '#5f6c57');
  skyCtx.fillStyle = gradient;
  skyCtx.fillRect(0, 0, SKY_W, SKY_H);

  /*
   * Cakram matahari dan jalur awan.
   *
   * Langit gradien murni memantulkan baja sebagai satu bidang rata: permukaan
   * yang melengkung tidak punya apa pun untuk dipantulkan, sehingga bajanya
   * terbaca sebagai plastik kelabu. Yang membuat logam terbaca sebagai logam
   * adalah pantulan yang ikut berubah ketika arah permukaannya berubah — dan
   * untuk itu langitnya harus punya isi: terang di sekitar matahari, bergumpal
   * di jalur awan, sepi di sisi berlawanan.
   */
  const sunGlow = skyCtx.createRadialGradient(272, 116, 6, 272, 116, 230);
  sunGlow.addColorStop(0, 'rgba(255,253,240,0.95)');
  sunGlow.addColorStop(0.16, 'rgba(255,246,216,0.42)');
  sunGlow.addColorStop(1, 'rgba(255,246,216,0)');
  skyCtx.fillStyle = sunGlow;
  skyCtx.fillRect(0, 0, SKY_W, Math.round(SKY_H * 0.56));
  for (let i = 0; i < 110; i++) {
    const cx = Math.random() * SKY_W;
    const cy = 30 + Math.random() * 190;
    const rx = 26 + Math.random() * 96;
    const ry = rx * (0.2 + Math.random() * 0.22);
    const alpha = 0.08 + Math.random() * 0.2;
    const cloud = skyCtx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    cloud.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(3)})`);
    cloud.addColorStop(1, 'rgba(255,255,255,0)');
    skyCtx.save();
    skyCtx.translate(cx, cy);
    skyCtx.scale(1, ry / rx);
    skyCtx.translate(-cx, -cy);
    skyCtx.fillStyle = cloud;
    skyCtx.beginPath();
    skyCtx.arc(cx, cy, rx, 0, Math.PI * 2);
    skyCtx.fill();
    skyCtx.restore();
  }

  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTexture;

  /*
   * Peta lingkungan disaring lebih dulu.
   *
   * Tekstur langit yang dipasang mentah sebagai `scene.environment` dipantulkan
   * sama tajamnya oleh semua permukaan: baja yang kasar memantulkan awan
   * setajam kaca, padahal justru kaburnya pantulan itulah yang membedakan
   * keduanya. PMREM menyiapkan satu tangga pantulan dari tajam sampai kabur,
   * dan three.js memilih anak tangga yang sesuai dengan kekasaran tiap bahan.
   */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromEquirectangular(skyTexture);
  scene.environment = environmentTarget.texture;
  pmrem.dispose();
  /*
   * Kabut jarak, dan jangkauannya menentukan seberapa luas tanah harus dibuat.
   *
   * Apa pun yang berujung di dalam jangkauan ini terbaca sebagai tepi lembar
   * kertas, bukan sebagai kaki langit. Karena itu tanah dan sungai dibentang
   * sampai ±120 satuan — di luar `far`, jadi ujungnya larut sebelum sempat
   * terlihat.
   */
  scene.fog = new THREE.Fog(0xc3d8ea, 50, 165);

  // Matahari tinggi: bayangannya pendek dan tegas, dan seluruh permukaan
  // mendatar — lantai jalan, oprit, air — ikut terang.
  const sun = new THREE.DirectionalLight(0xfff3df, 3.1);
  sun.position.set(12, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(3072, 3072);
  sun.shadow.bias = -0.0006;
  sun.shadow.camera.far = 60;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xc3dcf3, 0x6d7159, 2));
  // Cahaya isi dari arah berlawanan: tanpa itu sisi yang membelakangi matahari
  // jatuh ke bayangan pekat, dan batang di sisi itu berhenti terbaca.
  const fill = new THREE.DirectionalLight(0xd8e8ff, 0.6);
  fill.position.set(-9, 5, -8);
  scene.add(fill);

  // ------------------------------------------------------------- bahan dasar
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const steelColor = new THREE.Color(0xa8a49c);
  const hotColor = new THREE.Color(0xf87171);
  const selectColor = new THREE.Color(0x47a6ff);
  const steelRough = noiseTexture(128, 140, 90, 2);
  const steel = new THREE.MeshStandardMaterial({
    color: steelColor,
    roughness: 0.55,
    metalness: 0.4,
    roughnessMap: steelRough,
    envMapIntensity: 0.9,
  });

  // -------------------------------------------------------------- rangka baja
  const bridge = new THREE.Group();
  scene.add(bridge);

  const L = spanUnits;
  const P = panels;
  const panelLength = L / P;
  const H = 1.7; // tinggi rangka
  const W = 2.2; // setengah lebar antar rangka
  const members: THREE.Mesh[] = [];

  /*
   * Lendutan.
   *
   * Lendutan sebenarnya 8 mm pada bentang 120 m adalah sepersepuluh ribu
   * panjangnya — tidak akan pernah kasat mata pada model seutuhnya. Karena itu
   * ia digambar dengan pengali, dan pengali itu wajib tertulis di layar:
   * lengkungan yang dibesarkan tanpa angka pengalinya membuat orang membaca
   * skala kerusakan yang sama sekali salah.
   *
   * Bentuk kurvanya bukan karangan. (1 − u²)(5 − u²)/5 adalah bentuk lendutan
   * balok di atas dua tumpuan sederhana dengan beban merata, dinormalkan
   * terhadap lendutan tengah bentangnya: bernilai 1 di tengah dan 0 tepat di
   * kedua tumpuan, dengan puncak yang datar seperti lendutan sungguhan.
   */
  const sagShape = (x: number): number => {
    const u = Math.min(1, Math.abs(x) / (L / 2));
    return ((1 - u * u) * (5 - u * u)) / 5;
  };

  /**
   * Garis pengaruh lendutan: berapa bagian sebuah titik pada absis `x` turun
   * akibat satu beban titik yang sedang berada di absis `a`.
   *
   * Rumus baku balok di atas dua tumpuan sederhana, dinormalkan sehingga
   * bernilai 1 ketika beban dan titik tinjau sama-sama di tengah bentang.
   * Inilah yang membuat cekungannya berjalan mengikuti truk, bukan sekadar
   * naik-turun di tempat: beban di seperempat bentang melendutkan bentang di
   * seperempat itu, bukan di tengahnya.
   */
  const influence = (x: number, a: number): number => {
    const s = x + L / 2;
    const p = a + L / 2;
    if (p <= 0 || p >= L) return 0; // beban belum atau sudah lewat bentang
    if (s <= 0 || s >= L) return 0;
    // Yang di kiri beban memakai rumusnya apa adanya; yang di kanan memakai
    // rumus yang sama dari ujung seberang — baloknya simetris.
    const [near, load] = s <= p ? [s, p] : [L - s, L - p];
    const b = L - load;
    return (b * near * (L * L - b * b - near * near) * 48) / (6 * L * L * L * L);
  };


  /**
   * Seberapa jauh kerusakan mencondongkan bentuk lendutan ke arahnya.
   *
   * Batang yang retak atau putus kehilangan sebagian kekakuannya, dan bentang
   * melendut paling dalam di dekat batang itu — bukan lagi tepat di tengah.
   * Itulah tanda yang dicari orang pada model: bukan "jembatannya melendut",
   * melainkan "melendutnya di sebelah sini".
   *
   * Bentuk condongnya memakai garis pengaruh yang sama dengan beban bergerak,
   * dinormalkan pada tengah bentang supaya angka yang terbaca sensor di tengah
   * tetap angka yang tergambar di tengah — yang berubah bentuknya, bukan
   * besarnya. Porsinya perkiraan peraga, bukan hasil hitungan kekakuan.
   */
  const DAMAGE_SKEW = 0.6;

  /**
   * Medan lendutan dicuplik pada titik-titik tetap sepanjang bentang, lalu
   * dibaca dengan sisipan lurus.
   *
   * Tanpa ini tiap simpul geometri — dan jumlahnya ribuan — harus menjumlahkan
   * sendiri sumbangan enam belas kendaraan tiap bingkai. Dengan tabel, jumlah
   * itu dikerjakan sembilan puluh tujuh kali saja, dan sisanya tinggal
   * menyisip. Sisipan juga memastikan dua batang yang bertemu di satu buhul
   * membaca angka yang sama persis, jadi rangkanya tidak terbuka di sana.
   */
  const FIELD_SAMPLES = 97;
  const fieldY = new Float32Array(FIELD_SAMPLES);
  const fieldNext = new Float32Array(FIELD_SAMPLES);
  const liveRaw = new Float32Array(FIELD_SAMPLES);

  /**
   * Panjang lintasan kendaraan **di luar bentang**, kedua oprit digabung.
   *
   * Bukan panjang oprit. Oprit dibuat 48 satuan tiap sisi supaya ujungnya
   * larut dalam kabut, tetapi kendaraan hanya berputar 18 satuan di luar
   * bentang tiap sisi: semakin panjang lintasannya, semakin sedikit kendaraan
   * yang berada di atas jembatan pada saat yang sama, dan jembatan yang
   * kosong tidak menunjukkan apa pun tentang lendutan.
   *
   * Angka ini wajib sama dengan `2 × (TRACK_HALF − L/2)`. Ia dipakai
   * menghitung berapa bagian armada yang **wajar** berada di atas bentang;
   * kalau meleset, lendutan beban bergeraknya ikut meleset.
   */
  const APPROACH_UNITS = 36;

  /** Lendutan tengah bentang yang sedang tergambar, dalam satuan adegan. */
  let sagNow = 0;
  /** Lajunya, disimpan antar bingkai karena peredamannya berupa pegas. */
  let sagVel = 0;

  /**
   * Langkah integrasi pegas, tetap dan tidak mengikuti laju bingkai.
   *
   * Satu langkah sebesar `dt` membuat lintasan pegas berbeda tiap kali laju
   * bingkainya berubah, dan laju bingkai yang naik-turun sedikit saja sudah
   * cukup membuat geraknya terbaca bergetar. Dengan langkah tetap, lintasannya
   * sama persis pada 30 bingkai per detik maupun pada 144.
   */
  const SAG_SUBSTEP = 1 / 240;

  const sagAt = (x: number): number => {
    const u = (x + L / 2) / L;
    if (u <= 0) return fieldY[0];
    if (u >= 1) return fieldY[FIELD_SAMPLES - 1];
    const t = u * (FIELD_SAMPLES - 1);
    const i = Math.floor(t);
    const f = t - i;
    return fieldY[i] * (1 - f) + fieldY[i + 1] * f;
  };

  /*
   * Penampang batang.
   *
   * Batang rangka jembatan baja bukan batang pejal berpenampang bujur sangkar.
   * Yang dipakai profil bersayap — dua sayap dihubungkan satu badan — karena
   * bahan di tepi penampang jauh lebih berguna menahan lentur daripada bahan
   * yang menumpuk di sumbunya. Bentuk itu pula yang membuat rangka terbaca
   * sebagai rangka baja dari kejauhan: ada bayangan di dalam profilnya, bukan
   * sekadar batang yang rata dari segala arah.
   *
   * Batang ikatan angin yang kecil tetap dibuat bulat, karena memang begitu
   * bentuknya di lapangan.
   *
   * Geometri dibuat sekali untuk tiap pasang ukuran lalu dipakai ulang: satu
   * bentang berisi ratusan batang, tetapi ukurannya hanya belasan.
   */
  const sectionCache = new Map<string, THREE.BufferGeometry>();

  const beamGeometry = (width: number, length: number): THREE.BufferGeometry => {
    const key = `I${width.toFixed(3)}x${length.toFixed(3)}`;
    const cached = sectionCache.get(key);
    if (cached) return cached;

    const half = width / 2;
    const web = width * 0.26; // tebal badan
    const flange = width * 0.24; // tebal sayap
    const shape = new THREE.Shape();
    shape.moveTo(-half, -half);
    shape.lineTo(half, -half);
    shape.lineTo(half, -half + flange);
    shape.lineTo(web / 2, -half + flange);
    shape.lineTo(web / 2, half - flange);
    shape.lineTo(half, half - flange);
    shape.lineTo(half, half);
    shape.lineTo(-half, half);
    shape.lineTo(-half, half - flange);
    shape.lineTo(-web / 2, half - flange);
    shape.lineTo(-web / 2, -half + flange);
    shape.lineTo(-half, -half + flange);
    shape.closePath();

    // Tepi ditumpulkan sedikit. Sudut yang benar-benar tajam menangkap cahaya
    // sebagai garis putih sempurna, dan garis seperti itu tidak ada pada baja
    // yang sudah dicat.
    const bevel = Math.min(width * 0.09, 0.01);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, length - bevel * 2),
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 1,
      steps: 1,
    });
    // Diekstrusi sepanjang sumbu z, sedangkan batang dipasang sepanjang sumbu y.
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -length / 2 + bevel, 0);
    geometry.computeVertexNormals();
    sectionCache.set(key, geometry);
    return geometry;
  };

  const rodGeometry = (width: number, length: number): THREE.BufferGeometry => {
    const key = `O${width.toFixed(3)}x${length.toFixed(3)}`;
    const cached = sectionCache.get(key);
    if (cached) return cached;
    const geometry = new THREE.CylinderGeometry(width / 2, width / 2, length, 10, 1);
    sectionCache.set(key, geometry);
    return geometry;
  };

  /** Menambahkan satu batang antara dua titik; panjang dan arahnya dihitung dari vektornya. */
  const addMember = (a: THREE.Vector3, b: THREE.Vector3, tag: string, radius = 0.075) => {
    const direction = new THREE.Vector3().subVectors(b, a);
    const length = direction.length();
    const geometry =
      radius >= 0.07 ? beamGeometry(radius * 1.5, length) : rodGeometry(radius * 0.9, length);
    const mesh = new THREE.Mesh(geometry, steel.clone());
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(V(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.tag = tag;
    /*
     * Kedua ujungnya disimpan supaya batang dapat dipasang ulang saat
     * jembatannya melendut. Menggeser turun batang sebagai satu benda utuh
     * tidak cukup: tiap batang akan turun sebanyak lendutan di titik
     * tengahnya, sementara tetangganya turun sebanyak lendutan di titik
     * tengahnya sendiri, dan rangka yang seharusnya menyatu terbuka di tiap
     * buhul. Dipasang ulang dari kedua ujungnya, buhulnya justru menjadi
     * tempat rangka berpatah — dan memang begitu rangka sungguhan melendut.
     */
    mesh.userData.member = true;
    mesh.userData.a = a.clone();
    mesh.userData.b = b.clone();
    mesh.userData.len = length;
    // Batang tepi (chord) memikul gaya aksial terbesar, jadi diwarnai lebih kuat
    // saat regangan naik daripada batang sekunder.
    mesh.userData.chord = /^(bc|d)/.test(tag);
    /*
     * Tiap batang diberi selisih warna kecil.
     *
     * Rangka yang seluruh batangnya berwarna persis sama terbaca sebagai
     * gambar komputer, bukan sebagai baja: cat di lapangan tidak pernah rata
     * antar batang — ada yang lebih lama kena matahari, ada yang baru dicat
     * ulang, ada yang tertutup jelaga. Selisihnya dibuat kecil saja supaya
     * warna status tetap terbaca sebagai warna status.
     */
    mesh.userData.tint = steelColor.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.07);
    bridge.add(mesh);
    members.push(mesh);
  };

  [-W, W].forEach((z, zi) => {
    for (let i = 0; i < P; i++) {
      const x0 = -L / 2 + i * panelLength;
      const x1 = x0 + panelLength;
      addMember(V(x0, 0, z), V(x1, 0, z), `bc${i}z${zi}`, 0.1);
      addMember(V(x0, H, z), V(x1, H, z), `tc${i}z${zi}`, 0.1);
      addMember(V(x1, 0, z), V(x1, H, z), `v${i}z${zi}`);
      // Diagonal berselang-seling arah — susunan rangka tipe Warren.
      addMember(
        i % 2 ? V(x0, H, z) : V(x0, 0, z),
        i % 2 ? V(x1, 0, z) : V(x1, H, z),
        `d${i}z${zi}`,
      );
    }
    addMember(V(-L / 2, 0, z), V(-L / 2, H, z), `v-1z${zi}`);
  });

  for (let i = 0; i <= P; i++) {
    const x = -L / 2 + i * panelLength;
    addMember(V(x, H, -W), V(x, H, W), `tb${i}`, 0.06); // ikatan angin atas
    addMember(V(x, -0.08, -W), V(x, -0.08, W), `fb${i}`, 0.12); // gelagar melintang
  }
  for (let i = 0; i < P; i++) {
    const x0 = -L / 2 + i * panelLength;
    const x1 = x0 + panelLength;
    addMember(V(x0, H, -W), V(x1, H, W), `lb${i}a`, 0.04);
    addMember(V(x0, H, W), V(x1, H, -W), `lb${i}b`, 0.04);
  }

  // Pelat buhul di tiap titik simpul.
  const gussetMaterial = new THREE.MeshStandardMaterial({
    color: 0x847f79,
    metalness: 0.4,
    roughness: 0.6,
    roughnessMap: steelRough,
  });
  /*
   * Paku keling pada pelat buhul.
   *
   * Kepala paku yang berderet di tepi pelat adalah satu-satunya detail yang
   * membuat sambungan rangka baja terbaca sebagai sambungan dan bukan sebagai
   * dua pelat yang saling menempel. Jumlahnya ratusan, jadi dipakai satu
   * geometri yang digambar berulang dalam sekali perintah — bukan ratusan objek
   * yang masing-masing minta gilirannya sendiri.
   */
  const rivetRing = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    return [Math.cos(angle) * 0.108, Math.sin(angle) * 0.108] as const;
  });
  const rivetGeometry = new THREE.CylinderGeometry(0.015, 0.017, 0.018, 8);
  rivetGeometry.rotateX(Math.PI / 2);
  const rivetMaterial = new THREE.MeshStandardMaterial({
    color: 0x767068,
    metalness: 0.5,
    roughness: 0.52,
  });
  /*
   * Bentuk pelat buhul: segi delapan, bukan bujur sangkar.
   *
   * Pelat buhul sungguhan dipotong mengikuti batang yang bertemu padanya —
   * tidak ada yang membiarkan sudut sembilan puluh derajat menonjol ke udara,
   * karena sudut itu tidak memikul apa-apa dan hanya menambah berat. Di layar
   * akibatnya persis sama: sudut lancip yang mencuat keluar dari siluet batang
   * membuat sambungannya terbaca sebagai ubin yang ditempelkan, bukan sebagai
   * pelat yang menyatukan.
   *
   * Tepinya ditumpulkan dengan alasan yang sama seperti pada batang: sudut
   * yang benar-benar tajam menangkap cahaya sebagai garis putih sempurna, dan
   * garis seperti itu tidak ada pada baja yang sudah dicat.
   *
   * Satu geometri untuk keempat puluh empat pelatnya. Bentuknya sama semua,
   * dan membuat geometri baru tiap simpul hanya menambah kerja unggah ke kartu
   * grafis tanpa menambah satu piksel pun yang berbeda.
   */
  const PLATE_HALF = 0.17;
  const PLATE_CUT = 0.055;
  const PLATE_THICK = 0.03;
  const gussetGeometry = (() => {
    const bevel = 0.006;
    const shape = new THREE.Shape();
    shape.moveTo(-PLATE_HALF + PLATE_CUT, -PLATE_HALF);
    shape.lineTo(PLATE_HALF - PLATE_CUT, -PLATE_HALF);
    shape.lineTo(PLATE_HALF, -PLATE_HALF + PLATE_CUT);
    shape.lineTo(PLATE_HALF, PLATE_HALF - PLATE_CUT);
    shape.lineTo(PLATE_HALF - PLATE_CUT, PLATE_HALF);
    shape.lineTo(-PLATE_HALF + PLATE_CUT, PLATE_HALF);
    shape.lineTo(-PLATE_HALF, PLATE_HALF - PLATE_CUT);
    shape.lineTo(-PLATE_HALF, -PLATE_HALF + PLATE_CUT);
    shape.closePath();

    const depth = PLATE_THICK - bevel * 2;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 1,
      steps: 1,
    });
    // Diekstrusi dari z = 0 ke depan; digeser supaya tebalnya terbagi rata di
    // kedua sisi titik pasangnya.
    geometry.translate(0, 0, -depth / 2);
    geometry.computeVertexNormals();
    return geometry;
  })();

  /*
   * Letak pelat: menempel pada muka luar batang tepi, bukan menembusnya.
   *
   * Batang tepi berpenampang I selebar 0,15 m, jadi muka luarnya berada 0,075 m
   * dari bidang rangka. Pelat yang dipasang 0,07 m dari bidang itu tertanam
   * separuh di dalam batangnya: yang tersisa di layar tinggal keempat sudutnya
   * yang mencuat, dan dua permukaan yang nyaris sebidang saling berebut
   * kedalaman sehingga tepinya berkedip saat kamera bergerak. Angka di bawah
   * ini menaruh muka dalam pelat dua milimeter di luar muka batang — menempel,
   * tanpa sebidang.
   */
  const CHORD_FACE = 0.075;
  const PLATE_Z = CHORD_FACE + PLATE_THICK / 2 + 0.002;

  const rivets = new THREE.InstancedMesh(
    rivetGeometry,
    rivetMaterial,
    (P + 1) * 4 * rivetRing.length,
  );
  rivets.castShadow = true;
  rivets.userData.proxy = true;
  const rivetMatrix = new THREE.Matrix4();
  let rivetIndex = 0;

  for (let i = 0; i <= P; i++) {
    [-W, W].forEach((z) =>
      [0, H].forEach((y) => {
        const plate = new THREE.Mesh(gussetGeometry, gussetMaterial);
        plate.position.set(-L / 2 + i * panelLength, y, z + Math.sign(z) * PLATE_Z);
        plate.castShadow = true;
        bridge.add(plate);

        const faceZ = plate.position.z + Math.sign(z) * (PLATE_THICK / 2 + 0.006);
        rivetRing.forEach(([rx, ry]) => {
          rivetMatrix.makeTranslation(plate.position.x + rx, y + ry, faceZ);
          rivets.setMatrixAt(rivetIndex++, rivetMatrix);
        });
      }),
    );
  }
  rivets.count = rivetIndex;
  rivets.instanceMatrix.needsUpdate = true;
  bridge.add(rivets);

  // ------------------------------------------------------------ lantai jalan
  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x57534e,
    map: noiseTexture(256, 150, 55, 10),
    roughnessMap: noiseTexture(256, 170, 70, 10),
    roughness: 0.95,
    metalness: 0,
    // Aspal hampir tidak memantulkan langit. Tanpa ditahan, oprit yang terbuka
    // memantulkan gradien langit dan terbaca seperti permukaan air, bukan jalan.
    envMapIntensity: 0.3,
  });
  /*
   * Benda yang membentang penuh dibagi menjadi ruas.
   *
   * Sebuah kotak sepanjang bentang hanya punya simpul di kedua ujungnya, jadi
   * ia tidak bisa melengkung — ia cuma bisa turun rata atau miring. Ruas
   * sebanyak ini tidak menambah satu pun panggilan gambar (geometrinya tetap
   * satu), hanya simpul yang cukup untuk mengikuti kurva lendutan.
   */
  const SPAN_SEGMENTS = P * 3;

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(L, 0.12, W * 2 - 0.5, SPAN_SEGMENTS),
    asphalt,
  );
  deck.position.y = 0.06;
  deck.castShadow = true;
  deck.receiveShadow = true;
  deck.userData.spanMesh = true;
  bridge.add(deck);

  const paint = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.7 });
  const dashCount = Math.round(L * 2.2);
  for (let i = 0; i < dashCount; i++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.05), paint);
    dash.position.set(-L / 2 + 0.25 + i * (L / dashCount), 0.121, 0);
    bridge.add(dash);
  }
  [-1, 1].forEach((side) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(L, 0.004, 0.05, SPAN_SEGMENTS), paint);
    edge.position.set(0, 0.121, side * (W - 0.62));
    edge.userData.spanMesh = true;
    bridge.add(edge);
  });

  const curbMaterial = new THREE.MeshStandardMaterial({
    color: 0xa8a39c,
    roughness: 0.92,
    map: noiseTexture(128, 200, 45, 8),
  });
  [-1, 1].forEach((side) => {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(L, 0.18, 0.32, SPAN_SEGMENTS), curbMaterial);
    curb.position.set(0, 0.13, side * (W - 0.4));
    curb.castShadow = true;
    curb.receiveShadow = true;
    curb.userData.spanMesh = true;
    bridge.add(curb);
  });

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0xa8a49e,
    metalness: 0.45,
    roughness: 0.5,
    roughnessMap: steelRough,
  });
  [-1, 1].forEach((side) => {
    const z = side * (W - 0.28);
    for (let i = 0; i <= P * 2; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.52, 8), railMaterial);
      post.position.set(-L / 2 + i * (L / (P * 2)), 0.44, z);
      post.castShadow = true;
      bridge.add(post);
    }
    [0.46, 0.68].forEach((y) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, 0.04, SPAN_SEGMENTS), railMaterial);
      rail.position.set(0, y, z);
      rail.castShadow = true;
      rail.userData.spanMesh = true;
      bridge.add(rail);
    });
  });

  // Tiang lampu penerangan.
  [-0.72, -0.24, 0.24, 0.72].forEach((fraction, i) => {
    const x = ((fraction * L) / 2) * 0.95;
    const z = (i % 2 ? 1 : -1) * (W - 0.22);
    const sign = Math.sign(z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 2.0, 10), railMaterial);
    pole.position.set(x, 1.1, z);
    pole.castShadow = true;
    bridge.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.36), railMaterial);
    arm.position.set(x, 2.08, z - sign * 0.18);
    bridge.add(arm);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.07, 0.24),
      // Lampu jalan padam di siang hari; yang tersisa hanya kap lampunya.
      new THREE.MeshStandardMaterial({ color: 0xd9d4c8, emissive: 0xffe0a0, emissiveIntensity: 0.12 }),
    );
    head.position.set(x, 2.03, z - sign * 0.34);
    bridge.add(head);
  });

  // ------------------------------------------------- tumpuan, abutmen, tanah
  const bearings: THREE.Mesh[] = [];
  ([
    [-L / 2, 'bearW'],
    [L / 2, 'bearE'],
  ] as Array<[number, string]>).forEach(([x, tag]) =>
    [-W, W].forEach((z, zi) => {
      const bearing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.42), steel.clone());
      bearing.position.set(x, -0.3, z);
      bearing.castShadow = true;
      bearing.receiveShadow = true;
      bearing.userData.tag = `${tag}${zi}`;
      scene.add(bearing);
      bearings.push(bearing);
    }),
  );

  const concrete = new THREE.MeshStandardMaterial({
    color: 0x9b968e,
    roughness: 0.95,
    map: noiseTexture(256, 195, 45, 4),
  });
  const grass = new THREE.MeshStandardMaterial({
    // Putih, bukan hijau. Warna simpul **dikalikan** dengan warna bahan, jadi
    // bahan yang sudah hijau akan mengalikan hijau dengan hijau dan seluruh
    // padang berubah gelap kehitaman. Dengan putih, warna simpullah yang
    // menjadi warna sebenarnya.
    color: 0xffffff,
    roughness: 1,
    map: noiseTexture(256, 180, 80, 14),
    // Warna per simpul dipakai membedakan rumput tepi sungai yang basah dari
    // padang yang lebih kering di kejauhan. Satu warna rata sepanjang dua
    // ratus empat puluh satuan terbaca sebagai karpet, bukan sebagai tanah.
    vertexColors: true,
  });
  const soil = new THREE.MeshStandardMaterial({
    color: 0x6b5c45,
    roughness: 1,
    map: noiseTexture(256, 170, 70, 9),
  });

  /*
   * Oprit dijahit ke ujung lantai jembatan.
   *
   * Sebelumnya perkerasan oprit dimulai 0,4 unit di luar ujung lantai, papan
   * tepinya menggantung 0,3 unit di luar perkerasan pada ketinggian yang tidak
   * sama dengan kerb jembatan, dan badan jalannya melayang 0,16 unit di atas
   * permukaan tanah. Dari pandangan isometri ketiganya terbaca sebagai potongan
   * jalan yang mengambang — ada celah tembus ke air tepat di sambungan.
   *
   * Sekarang: perkerasan dimulai tepat di ujung lantai, kerbnya meneruskan kerb
   * jembatan pada ketinggian dan jarak yang sama persis, dan di bawahnya ada
   * timbunan tanah yang menopang perkerasan sampai turun ke tebing.
   */
  /*
   * Panjang oprit tiap sisi.
   *
   * Angkanya bukan soal ketelitian melainkan soal ujung: jalan yang berhenti
   * di tengah padang terbaca sebagai potongan yang belum selesai, dan mata
   * langsung mencari di mana sisanya. Pada 48 satuan ujungnya jatuh jauh di
   * dalam kabut, jadi jalannya **menghilang**, bukan berhenti.
   *
   * Lintasan kendaraan tidak ikut sepanjang ini — lihat `TRACK_HALF`.
   */
  const APPROACH_LENGTH = 48;
  const approachStart = L / 2 - 0.06; // sedikit menumpang supaya sambungan rapat
  const approachMid = approachStart + APPROACH_LENGTH / 2;

  // Penampang timbunan digambar di bidang XY — sumbu x dipakai sebagai arah
  // melintang jalan — lalu diekstrusi sepanjang oprit dan diputar seperempat
  // putaran sehingga sumbu ekstrusinya berimpit dengan sumbu jalan.
  const fillShape = new THREE.Shape();
  fillShape.moveTo(-(W + 0.75), -0.02);
  fillShape.lineTo(W + 0.75, -0.02);
  fillShape.lineTo(W + 1.7, -1.1);
  fillShape.lineTo(-(W + 1.7), -1.1);
  fillShape.closePath();
  const fillGeometry = new THREE.ExtrudeGeometry(fillShape, {
    depth: APPROACH_LENGTH,
    bevelEnabled: false,
  });
  fillGeometry.rotateY(Math.PI / 2);
  fillGeometry.translate(-APPROACH_LENGTH / 2, 0, 0);

  [-1, 1].forEach((side) => {
    // Kepala jembatan: dudukan tumpuan di depan, dinding belakang menahan oprit.
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 3, W * 2 + 1.2), concrete);
    seat.position.set(side * (L / 2 + 0.9), -1.95, 0); // puncak -0,45 = alas tumpuan
    seat.castShadow = true;
    seat.receiveShadow = true;
    scene.add(seat);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.44, W * 2 + 1.2), concrete);
    backWall.position.set(side * (L / 2 + 1.1), -0.24, 0); // puncak -0,02 = alas perkerasan
    backWall.receiveShadow = true;
    scene.add(backWall);

    [-1, 1].forEach((wing) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.7, 0.36), concrete);
      wall.position.set(side * (L / 2 + 2.2), -1.37, wing * (W + 0.42));
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
    });

    const fill = new THREE.Mesh(fillGeometry, soil);
    fill.position.set(side * approachMid, 0, 0);
    fill.receiveShadow = true;
    scene.add(fill);

    const approach = new THREE.Mesh(new THREE.BoxGeometry(APPROACH_LENGTH, 0.14, W * 2 - 0.5), asphalt);
    approach.position.set(side * approachMid, 0.05, 0);
    approach.receiveShadow = true;
    scene.add(approach);

    /*
     * Marka meneruskan marka di atas bentang supaya jalannya terbaca menerus.
     *
     * Satu `InstancedMesh`, bukan seratus enam `Mesh`. Marka putus-putus
     * sepanjang 48 satuan pada kerapatan 2,2 per satuan berarti seratus enam
     * benda per sisi — dua ratus dua belas panggilan gambar untuk garis putih
     * yang lebarnya dua puluh dua sentimeter. Dengan instansi, satu.
     */
    const approachDashes = Math.round(APPROACH_LENGTH * 2.2);
    const dashInstance = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.22, 0.004, 0.05),
      paint,
      approachDashes,
    );
    const dashMatrix = new THREE.Matrix4();
    for (let i = 0; i < approachDashes; i++) {
      dashMatrix.makeTranslation(
        side * (approachStart + 0.25 + i * (APPROACH_LENGTH / approachDashes)),
        0.121,
        0,
      );
      dashInstance.setMatrixAt(i, dashMatrix);
    }
    dashInstance.instanceMatrix.needsUpdate = true;
    scene.add(dashInstance);

    [-1, 1].forEach((wing) => {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(APPROACH_LENGTH, 0.004, 0.05), paint);
      edge.position.set(side * approachMid, 0.121, wing * (W - 0.62));
      scene.add(edge);

      // Ukuran, tinggi, dan jarak kerb dari sumbu jalan sama persis dengan kerb
      // di atas bentang — sambungannya menerus, tidak ada undakan.
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(APPROACH_LENGTH, 0.18, 0.32), curbMaterial);
      kerb.position.set(side * approachMid, 0.13, wing * (W - 0.4));
      kerb.castShadow = true;
      kerb.receiveShadow = true;
      scene.add(kerb);

      /*
       * Pagar pengaman menemani seluruh panjang oprit, bukan delapan satuan
       * pertama saja. Pagar yang putus di tengah jalan lurus terbaca sebagai
       * pagar yang hilang, bukan sebagai pagar yang memang berakhir — dan
       * pada oprit sepanjang ini jaraknya terlalu jauh untuk dimaafkan mata.
       *
       * Tiangnya diinstansi dengan alasan yang sama seperti marka: tiap 1,4
       * satuan sepanjang 48 satuan berarti tiga puluh lima tiang per sayap,
       * seratus empat puluh untuk dua sisi.
       */
      const guardZ = wing * (W + 0.06);
      const guardCount = Math.floor(APPROACH_LENGTH / 1.4);
      const postInstance = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.03, 0.036, 0.46, 6),
        railMaterial,
        guardCount,
      );
      const postMatrix = new THREE.Matrix4();
      for (let i = 0; i < guardCount; i++) {
        postMatrix.makeTranslation(side * (approachStart + i * 1.4), 0.13, guardZ);
        postInstance.setMatrixAt(i, postMatrix);
      }
      postInstance.instanceMatrix.needsUpdate = true;
      postInstance.castShadow = true;
      scene.add(postInstance);

      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(APPROACH_LENGTH - 0.6, 0.11, 0.05),
        railMaterial,
      );
      beam.position.set(side * approachMid, 0.27, guardZ);
      beam.castShadow = true;
      scene.add(beam);
    });
  });

  /*
   * Tanah di kedua sisi sungai.
   *
   * Ukurannya bukan selera: lebarnya dihitung mundur dari jangkauan kabut.
   * Sebelumnya tanahnya 32 × 80 satuan sementara airnya 130 × 64, jadi air
   * menyembul **di luar** tepi tanah dan tergambar sebagai pita biru yang
   * mengambang di atas padang — persis di tempat yang seharusnya kaki langit.
   * Sekarang keduanya berbagi satu batas: tanah 110 × 240 dengan bibir tepat
   * di tepi alur, air selebar alurnya saja dan sepanjang tanahnya.
   *
   * Permukaannya tidak lagi rata. Bergelombang hanya **jauh dari sungai** —
   * bukit yang tumbuh tepat di bawah oprit akan menaikkan perkerasan yang
   * memang harus datar, jadi kelerengannya baru dimulai 26 satuan dari bibir
   * alur dan naik penuh pada 71 satuan.
   */
  const ALUR = 6.5;
  const BANK_W = 110;
  const BANK_Z = 240;

  const RUMPUT_BASAH = new THREE.Color(0x4e6b39);
  const RUMPUT_KERING = new THREE.Color(0x87824e);

  /**
   * Tinggi permukaan tanah pada jarak `dari` dari bibir alur dan pada `lz`.
   *
   * Dipisah sebagai fungsi karena dua hal harus memakai rumus yang **persis
   * sama**: simpul bidang rumputnya, dan kaki tiap pohon yang berdiri di
   * atasnya. Begitu keduanya dihitung terpisah, pohonnya melayang atau
   * terbenam — dan selisih sepuluh sentimeter pun langsung terlihat.
   */
  const tinggiTanah = (dari: number, lz: number): number => {
    const lereng = Math.min(1, Math.max(0, (dari - 24) / 40));
    const bukit =
      Math.sin(dari * 0.055) * 1.5 +
      Math.cos(lz * 0.042) * 1.1 +
      Math.sin(lz * 0.015 + dari * 0.024) * 2.3;
    return lereng * bukit;
  };

  const buatTebing = (side: number) => {
    const geometry = new THREE.PlaneGeometry(BANK_W, BANK_Z, 88, 96);
    geometry.rotateX(-Math.PI / 2);
    const pos = geometry.attributes.position;
    const warna = new Float32Array(pos.count * 3);
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      // Jarak dari bibir alur. Tandanya dibalik pada sisi seberang supaya
      // kedua tebing menghitungnya dari sungai, bukan dari sumbu adegan.
      const dari = BANK_W / 2 + side * lx;

      // Kerutan kecil tetap ada di mana-mana: tanah yang benar-benar rata
      // memantulkan cahaya terlalu seragam dan terbaca sebagai kaca.
      const kerut =
        Math.sin(lx * 0.5) * 0.045 + Math.cos(lz * 0.4) * 0.06 + Math.random() * 0.025;

      const y = kerut + tinggiTanah(dari, lz);
      pos.setY(i, y);

      // Makin jauh dari air makin kering, dan punggung bukit lebih pucat
      // daripada lembahnya — dua petunjuk yang sama-sama datang dari air.
      const lereng = Math.min(1, Math.max(0, (dari - 24) / 40));
      const kering = Math.min(1, lereng * 0.7 + Math.max(0, y) * 0.1);
      c.copy(RUMPUT_BASAH).lerp(RUMPUT_KERING, kering);
      const bintik = 0.94 + Math.random() * 0.12;
      warna[i * 3] = c.r * bintik;
      warna[i * 3 + 1] = c.g * bintik;
      warna[i * 3 + 2] = c.b * bintik;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(warna, 3));
    geometry.computeVertexNormals();
    return geometry;
  };

  [-1, 1].forEach((side) => {
    const pusat = side * (ALUR + BANK_W / 2);

    const bank = new THREE.Mesh(buatTebing(side), grass);
    bank.position.set(pusat, -0.55, 0);
    bank.receiveShadow = true;
    scene.add(bank);

    // Blok pejal di bawah rumput. Tanpanya tanahnya hanya selembar bidang
    // tipis yang, dilihat dari sudut rendah, menggantung dua setengah satuan
    // di atas air.
    const bankBody = new THREE.Mesh(new THREE.BoxGeometry(BANK_W - 0.4, 2.6, BANK_Z - 0.4), soil);
    bankBody.position.set(pusat, -1.98, 0); // puncak -0,68, di bawah rumput
    bankBody.receiveShadow = true;
    scene.add(bankBody);
  });

  /*
   * Rumpun pohon di kedua sisi.
   *
   * Padang kosong seluas dua ratus empat puluh satuan tidak punya apa pun yang
   * memberi tahu mata seberapa jauh ujungnya. Pohon adalah pengukur jarak
   * yang paling murah: tingginya diketahui semua orang, jadi yang mengecil di
   * kejauhan langsung terbaca sebagai jauh, bukan sebagai kecil.
   *
   * Dua `InstancedMesh`, bukan dua ratus `Mesh`. Seratus sepuluh pohon berarti
   * dua ratus dua puluh panggilan gambar kalau dibuat satu per satu — lebih
   * mahal daripada seluruh rangka jembatannya. Dengan instansi, dua.
   */
  const JUMLAH_POHON = 110;
  const batangGeometry = new THREE.CylinderGeometry(0.13, 0.2, 1.3, 5);
  batangGeometry.translate(0, 0.65, 0);
  const daunGeometry = new THREE.ConeGeometry(1.05, 2.6, 7);
  daunGeometry.translate(0, 2.4, 0);

  const batangMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  const daunMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: false });

  const batangInstance = new THREE.InstancedMesh(batangGeometry, batangMaterial, JUMLAH_POHON);
  const daunInstance = new THREE.InstancedMesh(daunGeometry, daunMaterial, JUMLAH_POHON);
  daunInstance.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(JUMLAH_POHON * 3),
    3,
  );
  batangInstance.castShadow = true;
  daunInstance.castShadow = true;

  const DAUN_MUDA = new THREE.Color(0x4a6b34);
  const DAUN_TUA = new THREE.Color(0x30492a);
  const matriks = new THREE.Matrix4();
  const putar = new THREE.Quaternion();
  const posisi = new THREE.Vector3();
  const skala = new THREE.Vector3();
  const warnaDaun = new THREE.Color();

  for (let i = 0; i < JUMLAH_POHON; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    /*
     * Dua daerah dikosongkan, dan keduanya punya alasan yang sama: pohon di
     * situ menutupi benda yang justru harus dilihat. Sampai 30 satuan dari
     * alur berdiri oprit beserta timbunannya, dan lorong selebar 20 satuan di
     * sekitar sumbu jalan adalah arah pandang ke jembatannya sendiri.
     */
    const dari = 30 + Math.random() * 78;
    let lz = (Math.random() * 2 - 1) * 112;
    if (Math.abs(lz) < 10 && dari < 64) lz += lz >= 0 ? 12 : -12;

    const x = side * (ALUR + dari);
    const y = -0.55 + tinggiTanah(dari, lz);
    const tinggi = 0.75 + Math.random() * 0.75;

    posisi.set(x, y, lz);
    putar.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
    skala.set(tinggi * (0.85 + Math.random() * 0.3), tinggi, tinggi * (0.85 + Math.random() * 0.3));
    matriks.compose(posisi, putar, skala);
    batangInstance.setMatrixAt(i, matriks);
    daunInstance.setMatrixAt(i, matriks);

    warnaDaun.copy(DAUN_MUDA).lerp(DAUN_TUA, Math.random());
    daunInstance.setColorAt(i, warnaDaun);
  }
  batangInstance.instanceMatrix.needsUpdate = true;
  daunInstance.instanceMatrix.needsUpdate = true;
  if (daunInstance.instanceColor) daunInstance.instanceColor.needsUpdate = true;
  scene.add(batangInstance);
  scene.add(daunInstance);

  /*
   * Kerapatan petak air ditentukan gelombang terpendek yang digambar, bukan
   * selera. Gelombang banjir melintang punya panjang gelombang 2π/1,6 ≈ 3,9
   * satuan; dengan petak 0,77 satuan satu gelombang disusun lima titik. Di
   * bawah dua titik per gelombang bentuknya tidak terwakili sama sekali —
   * yang tampil bukan riak yang berjalan, melainkan kedip yang berpindah acak
   * tiap bingkai.
   */
  const WATER_SEG_X = 26;
  const WATER_SEG_Z = 300;
  const AIR_W = 20;
  const waterGeometry = new THREE.PlaneGeometry(AIR_W, BANK_Z, WATER_SEG_X, WATER_SEG_Z);
  waterGeometry.rotateX(-Math.PI / 2);

  /*
   * Warna per simpul: tepian lebih pucat daripada tengah alur.
   *
   * Air sungguhan tidak berwarna rata — yang dangkal memantulkan dasarnya dan
   * tampak lebih terang serta lebih hijau, yang dalam menelan cahayanya. Satu
   * warna rata di seluruh permukaan adalah hal pertama yang membuat air
   * buatan terbaca sebagai plastik biru.
   *
   * Nilainya pengali, bukan warna jadi: warna dasar materialnya masih berubah
   * dari biru tenang ke cokelat banjir, dan pengali ini ikut terbawa.
   */
  const airPos = waterGeometry.attributes.position;
  const airWarna = new Float32Array(airPos.count * 3);
  for (let i = 0; i < airPos.count; i++) {
    const jarak = Math.abs(airPos.getX(i));
    // Halus dari tengah (0) ke tepi (1); `t*t*(3-2t)` supaya peralihannya
    // tidak meninggalkan garis lurus yang terlihat di permukaan.
    const t0 = Math.min(1, Math.max(0, (jarak - 2.5) / (ALUR - 2.5)));
    const t = t0 * t0 * (3 - 2 * t0);
    airWarna[i * 3] = 0.82 + t * 0.5;
    airWarna[i * 3 + 1] = 0.86 + t * 0.46;
    airWarna[i * 3 + 2] = 0.94 + t * 0.2;
  }
  waterGeometry.setAttribute('color', new THREE.BufferAttribute(airWarna, 3));

  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e6d97,
    metalness: 0.55,
    roughness: 0.22,
    envMapIntensity: 1.5,
    vertexColors: true,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.y = -2.7;
  water.receiveShadow = true;
  scene.add(water);
  const waterPos = water.geometry.attributes.position;
  const waterNormal = water.geometry.attributes.normal;
  const waterBase = Float32Array.from(waterPos.array as Float32Array);

  /*
   * Petak air tersusun sebagai kisi teratur: satu nilai x untuk tiap kolom,
   * satu nilai z untuk tiap baris. Sinus hanya bergantung pada salah satunya,
   * jadi cukup dihitung 97 + 81 kali per bingkai, bukan 7.857 kali — sisanya
   * tinggal penjumlahan. Itu yang membuat petak air bisa dirapatkan tanpa
   * menambah beban hitung.
   */
  const WATER_COLS = WATER_SEG_X + 1;
  const WATER_ROWS = WATER_SEG_Z + 1;
  const waterColX = new Float32Array(WATER_COLS);
  const waterRowZ = new Float32Array(WATER_ROWS);
  for (let c = 0; c < WATER_COLS; c++) waterColX[c] = waterBase[c * 3];
  for (let r = 0; r < WATER_ROWS; r++) waterRowZ[r] = waterBase[r * WATER_COLS * 3 + 2];
  const waveSinX = new Float32Array(WATER_COLS);
  const waveCosX = new Float32Array(WATER_COLS);
  const waveSinZ = new Float32Array(WATER_ROWS);
  const waveCosZ = new Float32Array(WATER_ROWS);
  const floodSinZ = new Float32Array(WATER_ROWS);
  const floodCosZ = new Float32Array(WATER_ROWS);

  /*
   * Air tenang gelap karena memantulkan langit senja; air banjir justru lebih
   * terang karena keruh — lumpurnya menghamburkan cahaya alih-alih
   * memantulkannya. Kalau dibuat gelap dan kasar sekaligus, sungainya berubah
   * menjadi lubang hitam di tengah adegan, bukan banjir.
   */
  const CALM_WATER = new THREE.Color(0x2e6d97);
  const FLOOD_WATER = new THREE.Color(0x8d6f42);
  const WATER_LEVEL = -2.7;

  // ------------------------------------------------------------- tiang angin
  /*
   * Tiang anemometer di oprit timur.
   *
   * Di puncaknya berdiri anemometer mangkuk, dan penanda kanal angin menancap
   * tepat di porosnya. Itu memang harus begitu: katalog sensor menyebut simpul
   * kanal ini "Anemometer, tiang oprit timur", dan penanda sensor yang menunjuk
   * benda yang tidak mengukur apa pun adalah janji yang tidak ditepati model
   * terhadap datanya sendiri.
   *
   * Keadaan angin di adegan ini sepenuhnya dibawa laju putar mangkuknya. Tidak
   * ada lagi kantong angin yang memberi bacaan bentuk dari kejauhan, jadi
   * putaran itu dibuat berbeda jauh antara tenang dan kencang — lihat
   * `rotorAngle` pada gelung gambar.
   */
  const windMast = new THREE.Group();
  windMast.position.set(L / 2 + 3.4, -0.02, 2.5);
  scene.add(windMast);

  const MAST_HEIGHT = 2.9;
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, MAST_HEIGHT, 10),
    railMaterial,
  );
  mast.position.y = MAST_HEIGHT / 2;
  mast.castShadow = true;
  windMast.add(mast);

  const rotor = new THREE.Group();
  rotor.position.y = MAST_HEIGHT;
  windMast.add(rotor);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.1, 10), railMaterial);
  hub.castShadow = true;
  rotor.add(hub);

  const cupMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8dee6,
    roughness: 0.55,
    metalness: 0.15,
    // Mangkuk itu cangkang: sisi dalamnya ikut terlihat, dan justru rongga
    // itulah yang membuat bendanya terbaca sebagai anemometer, bukan bola.
    side: THREE.DoubleSide,
  });

  const CUP_ARMS = 3;
  const CUP_REACH = 0.3;
  for (let i = 0; i < CUP_ARMS; i++) {
    const spoke = new THREE.Group();
    spoke.rotation.y = (i * Math.PI * 2) / CUP_ARMS;
    rotor.add(spoke);

    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, CUP_REACH, 6),
      railMaterial,
    );
    // Sumbu tabung tegak; direbahkan seperempat putaran agar berbaring
    // sepanjang sumbu x, lalu digeser setengah panjangnya supaya pangkalnya
    // bertemu poros.
    arm.rotation.z = -Math.PI / 2;
    arm.position.x = CUP_REACH / 2;
    arm.castShadow = true;
    spoke.add(arm);

    const cup = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      cupMaterial,
    );
    // Setengah bola menghadap +y; diputar −90° pada sumbu x sehingga
    // punggungnya ke −z dan rongganya ke +z. Ketiga mangkuk dibangun di dalam
    // kerangka lengannya masing-masing, jadi ketiganya menghadap arah putar
    // yang sama — itu yang membuat angin mendorongnya berputar, bukan
    // mengunci satu sama lain.
    cup.rotation.x = -Math.PI / 2;
    cup.position.x = CUP_REACH;
    cup.castShadow = true;
    spoke.add(cup);
  }

  // ------------------------------------------------------------ titik sensor
  /*
   * Penanda sensor berbentuk pelat bertangkai, bukan bola.
   *
   * Bola kecil berwarna sama untuk semua kanal hanya menyatakan "ada sesuatu di
   * sini" — ia tidak mengatakan apa yang ada di sana, tidak menunjuk titik
   * pasangnya, dan mudah tertukar dengan baut atau pantulan. Pelat dengan ujung
   * runcing menunjuk tepat ke titik ukurnya, berdiri tegak menghadap kamera dari
   * sudut mana pun, dan warnanya mengikuti status kanal: hijau di rentang aman,
   * kuning waspada, merah kritis. Jadi satu pandangan ke model sudah memberi
   * tahu kanal mana yang keluar rentang, sebelum satu angka pun dibaca.
   */
  const MARKER_FILL: Record<MarkerStatus, string> = {
    AMAN: '#22a06b',
    WASPADA: '#d9930b',
    KRITIS: '#d64545',
  };

  /** Siluet pelat: sudut membulat di atas, ujung runcing di bawah. */
  const markerPath = (ctx: CanvasRenderingContext2D, inset: number) => {
    const x = 14 + inset;
    const y = 10 + inset;
    const w = 100 - inset * 2;
    const h = 74 - inset * 2;
    const r = 20 - inset * 0.5;
    const tipY = 122 - inset;
    const half = 13 - inset * 0.7;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(64 + half, y + h);
    ctx.lineTo(64, tipY);
    ctx.lineTo(64 - half, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const markerTexture = (fill: string): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    // Tepi putih digambar sebagai siluet yang sedikit lebih besar di belakangnya:
    // penanda harus terbaca baik di depan langit terang maupun baja gelap.
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    markerPath(ctx, 0);
    ctx.fill();
    ctx.fillStyle = fill;
    markerPath(ctx, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(64, 46, 13, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  /*
   * Penanda digambar di atas segalanya (`depthTest: false`). Ia bukan benda di
   * dalam struktur melainkan lapisan keterangan di atasnya, dan penanda yang
   * separuh tertutup batang justru menyembunyikan hal yang ingin diberitahukan.
   */
  const pinMaterial = (fill: string) =>
    new THREE.SpriteMaterial({
      map: markerTexture(fill),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

  const markerMaterials: Record<MarkerStatus, THREE.SpriteMaterial> = {
    AMAN: pinMaterial(MARKER_FILL.AMAN),
    WASPADA: pinMaterial(MARKER_FILL.WASPADA),
    KRITIS: pinMaterial(MARKER_FILL.KRITIS),
  };

  const MARKER_SIZE = 0.5;
  // Ujung runcing berada di 95 % tinggi tekstur, jadi pelatnya diangkat sedikit
  // agar ujung itu jatuh persis di titik pasang sensornya.
  const MARKER_LIFT = MARKER_SIZE * 0.45;

  // Bola tak terlihat berjari-jari lebih besar dipasang di tiap penanda sebagai
  // sasaran klik: pelat 0,5 unit masih sempit untuk disentuh di layar ponsel.
  const pickMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const spotMeshes: THREE.Sprite[] = [];
  const pickProxies: THREE.Mesh[] = [];

  /** Letakkan satu penanda pada titik pasang (bukan pada pusat pelatnya). */
  const placeMarker = (sensorId: string, spot: [number, number, number]) => {
    const index = spotMeshes.findIndex((sprite) => sprite.userData.sensorId === sensorId);
    if (index < 0) return;
    // Titik pasang disimpan pada jembatan yang belum melendut; lendutan yang
    // sedang tergambar ditambahkan di sini. Kalau tidak, penanda akan
    // menggantung di udara persis sebanyak lendutan yang sedang dibesarkan.
    spotMeshes[index].position.set(
      spot[0],
      spot[1] + MARKER_LIFT - sagAt(spot[0]),
      spot[2],
    );
    spotMeshes[index].userData.spot = spot;
    pickProxies[index].position.copy(spotMeshes[index].position);
  };

  Object.keys(SENSOR_SPOTS).forEach((sensorId) => {
    const marker = new THREE.Sprite(markerMaterials.AMAN);
    marker.scale.set(MARKER_SIZE, MARKER_SIZE, 1);
    marker.userData.tag = 'sensor';
    marker.userData.sensorId = sensorId;
    marker.renderOrder = 10;
    bridge.add(marker);
    spotMeshes.push(marker);

    const proxy = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), pickMaterial);
    proxy.userData.tag = 'sensor';
    proxy.userData.proxy = true;
    proxy.userData.sensorId = sensorId;
    proxy.renderOrder = 2;
    bridge.add(proxy);
    pickProxies.push(proxy);

    placeMarker(sensorId, spots?.[sensorId] ?? SENSOR_SPOTS[sensorId]);
  });

  // -------------------------------------------------------------- kendaraan
  /*
   * Kendaraan dibentuk dari siluet sampingnya, bukan ditumpuk dari beberapa
   * kotak.
   *
   * Satu profil sudah memuat kap mesin, kemiringan kaca depan, garis atap, dan
   * buritan sekaligus, lalu diekstrusi ke arah lebar dengan tepi dibevel —
   * hasilnya terbaca sebagai mobil dari sudut mana pun, dan pantulan langit
   * tidak putus di sudut yang tajam. Kaca dibuat sebagai prisma kedua setebal
   * sedikit lebih lebar dari bodinya: sisi ekstrusinya menjadi kaca samping,
   * sedangkan bidang miring di ujungnya menjadi kaca depan dan belakang.
   *
   * Ukurannya dipilih terhadap lebar lajur, bukan terhadap bentang: satu lajur
   * selebar 1,95 unit, dan truk setinggi 1,05 unit masih lewat di bawah ikatan
   * angin atas yang berada 1,7 unit di atas lantai.
   */

  /** Prisma dari siluet samping; titik ditulis berlawanan arah jarum jam. */
  const profileGeometry = (points: Array<[number, number]>, width: number, bevel: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    const depth = width - bevel * 2;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 3,
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  };

  const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.9 });
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6,
    metalness: 0.75,
    roughness: 0.35,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.6, metalness: 0.3 });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x16242c,
    metalness: 0.6,
    roughness: 0.08,
    envMapIntensity: 1.8,
  });
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff6dd,
    emissive: 0xffe2a8,
    emissiveIntensity: 0.2,
  });
  const tailMaterial = new THREE.MeshStandardMaterial({
    color: 0x8e2b25,
    emissive: 0xff3b30,
    emissiveIntensity: 0.6,
  });
  const markerMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9a441,
    emissive: 0xffb545,
    emissiveIntensity: 0.35,
  });
  const boxMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9b4aa,
    metalness: 0.35,
    roughness: 0.55,
  });

  const CAR_TIRE = 0.105;
  const TRUCK_TIRE = 0.13;

  // Roda dibuat berjari-jari satu lalu diperkecil sesuai ukuran kendaraan;
  // lebarnya ikut terskala, jadi ditulis sebagai perbandingan terhadap jari-jari.
  const tireGeometry = new THREE.CylinderGeometry(1, 1, 0.7, 18);
  tireGeometry.rotateX(Math.PI / 2);
  const rimGeometry = new THREE.CylinderGeometry(0.56, 0.56, 0.72, 12);
  rimGeometry.rotateX(Math.PI / 2);
  const hubGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.74, 8);
  hubGeometry.rotateX(Math.PI / 2);

  /** Roda sebagai kelompok: ban gelap, pelek terang, sumbu berputar pada z. */
  const makeWheel = (radius: number) => {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(tireGeometry, tireMaterial);
    tire.castShadow = true;
    wheel.add(tire);
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    wheel.add(rim);
    const hub = new THREE.Mesh(hubGeometry, trimMaterial);
    wheel.add(hub);
    wheel.scale.setScalar(radius);
    return wheel;
  };

  const carBodyGeometry = profileGeometry(
    [
      [-0.575, 0.125],
      [0.575, 0.125],
      [0.6, 0.195],
      [0.59, 0.265],
      [0.27, 0.295],
      [0.055, 0.46],
      [-0.245, 0.472],
      [-0.415, 0.335],
      [-0.55, 0.305],
      [-0.575, 0.235],
    ],
    0.575,
    0.03,
  );
  // Puncak kaca ditahan di bawah garis atap: dari pandangan rencana, atap yang
  // sewarna bodi itulah yang membedakan mobil dari kotak kaca.
  const carGlassGeometry = profileGeometry(
    [
      [0.245, 0.31],
      [0.085, 0.422],
      [-0.225, 0.432],
      [-0.385, 0.33],
    ],
    0.586,
    0.012,
  );
  const truckCabGeometry = profileGeometry(
    [
      [0.5, 0.31],
      [1.08, 0.31],
      [1.1, 0.45],
      [1.1, 0.9],
      [1.05, 1.0],
      [0.5, 1.02],
    ],
    0.64,
    0.035,
  );

  const BODY_COLORS = [0x9e3b34, 0xdcd8d0, 0x2f4f63, 0x7c8288, 0x24262b, 0xc9ab52, 0x2f5c4a];

  interface Vehicle {
    group: THREE.Group;
    lane: number;
    wheels: THREE.Object3D[];
    /** Jari-jari roda dipakai menghitung putaran per satuan jarak tempuh. */
    tire: number;
    speedJitter: number;
    x: number;
    /**
     * Jarak tempuh sepanjang lintasan, 0 di mulut masuk sampai `TRACK_LEN` di
     * mulut keluar — selalu bertambah, pada kedua lajur.
     *
     * Disimpan terpisah dari `x` supaya pengurutan antrean tidak perlu tahu
     * arah tiap lajur: yang di depan selalu yang `p`-nya lebih besar.
     */
    p: number;
    /** Tronton: bersumbu banyak, bobotnya dua kali truk boks. */
    isTronton: boolean;
    /** Lajur bawaannya; konvoi memindahkan lajur, dan ini yang dikembalikan. */
    laneAsal: number;
    /** Panjang bodi; menentukan jarak aman ke kendaraan di depannya. */
    len: number;
    isTruck: boolean;
    /**
     * Nomor urut di antara sesama jenisnya.
     *
     * Dipakai memilih kendaraan mana yang ditampilkan: skenario menyebut
     * "empat belas mobil dan lima truk", dan yang tampil harus benar-benar
     * empat belas mobil dan lima truk.
     */
    kindIndex: number;
    /** Seharusnya ada di adegan menurut skenario yang sedang berjalan. */
    wanted: boolean;
    /** Ketinggian roda di atas lantai yang belum melendut. */
    baseY: number;
    /** Bobot relatif terhadap mobil penumpang; menentukan porsi lendutannya. */
    weight: number;
  }
  const vehicles: Vehicle[] = [];

  /** Setengah panjang lintasan; kendaraan berputar antara −24 dan +24. */
  const TRACK_HALF = L / 2 + APPROACH_UNITS / 2;
  const TRACK_LEN = TRACK_HALF * 2;
  /** Jarak bemper ke bemper yang dijaga saat beriringan. */
  const JARAK_AMAN = 0.55;

  /**
   * Di bawah laju ini arus dianggap macet.
   *
   * Dua hal berubah sekaligus, dan keduanya perlu: kendaraan **dipadatkan ke
   * bentang** alih-alih disebar merata sepanjang lintasan, dan majunya
   * menjadi **bergelombang** alih-alih merayap rata. Kemacetan yang
   * digambar sebagai arus lambat yang rata tidak terbaca sebagai kemacetan —
   * ia terbaca sebagai animasi yang tersendat. Yang membuat mata mengenali
   * macet adalah barisan rapat yang maju sebentar lalu berhenti, dan
   * berhentinya menjalar ke belakang.
   */
  const LAJU_MACET = 0.15;

  /*
   * Armada: 16 mobil lalu 8 truk, bukan 16 kendaraan yang jenisnya ditentukan
   * `i % 3`.
   *
   * Dengan pola `i % 3`, jenis kendaraan terikat pada nomor urutnya, sehingga
   * skenario yang meminta "satu mobil dan empat truk" mendapat tiga truk dan
   * dua mobil — susunan yang tidak pernah bisa dipenuhi karena yang dipilih
   * selalu N pertama. Dipisah per jenis, permintaan apa pun dapat dipenuhi
   * persis selama jumlahnya tidak melebihi persediaan.
   *
   * Jumlahnya naik dari 16 menjadi 24 karena lintasannya memanjang dari 30
   * menjadi 48 satuan; tanpa tambahan itu jembatan terbaca lengang pada arus
   * yang seharusnya biasa.
   */
  const MOBIL_TERSEDIA = 16;
  const TRUK_TERSEDIA = 8;
  const TRONTON_TERSEDIA = 4;

  for (let i = 0; i < MOBIL_TERSEDIA + TRUK_TERSEDIA + TRONTON_TERSEDIA; i++) {
    const isTronton = i >= MOBIL_TERSEDIA + TRUK_TERSEDIA;
    // Tronton memakai seluruh badan truk sebagai dasarnya lalu ditambah bak
    // dan sumbu belakang, jadi ia tetap "truk" bagi pembangun bentuknya.
    const isTruck = i >= MOBIL_TERSEDIA;
    const kindIndex = isTronton
      ? i - MOBIL_TERSEDIA - TRUK_TERSEDIA
      : isTruck
        ? i - MOBIL_TERSEDIA
        : i;
    // Lajur dibagi di dalam tiap jenis, bukan pada nomor urut keseluruhan —
    // kalau tidak, permintaan yang berat sebelah menumpuk di satu lajur.
    const lane = kindIndex % 2;
    const group = new THREE.Group();
    const wheels: THREE.Object3D[] = [];
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: BODY_COLORS[(isTruck ? i + 2 : i) % BODY_COLORS.length],
      metalness: 0.5,
      roughness: 0.28,
      envMapIntensity: 1.2,
    });

    const addWheel = (x: number, z: number, radius: number) => {
      const wheel = makeWheel(radius);
      wheel.position.set(x, radius, z);
      group.add(wheel);
      wheels.push(wheel);
    };

    if (isTruck) {
      const cab = new THREE.Mesh(truckCabGeometry, bodyMaterial);
      cab.castShadow = true;
      group.add(cab);

      const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.28, 0.5), glassMaterial);
      windscreen.position.set(1.105, 0.75, 0);
      group.add(windscreen);
      [-1, 1].forEach((sideZ) => {
        const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.025), glassMaterial);
        sideGlass.position.set(0.78, 0.75, sideZ * 0.328);
        group.add(sideGlass);
      });

      // Sirip pengarah angin di atas kabin — penanda siluet truk boks.
      const deflector = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.56), bodyMaterial);
      deflector.position.set(0.72, 1.06, 0);
      deflector.rotation.z = -0.3;
      deflector.castShadow = true;
      group.add(deflector);

      const grille = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, 0.62), trimMaterial);
      grille.position.set(1.1, 0.38, 0);
      group.add(grille);

      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.08, 0.42), trimMaterial);
      chassis.position.set(0, 0.29, 0);
      group.add(chassis);

      const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.7, 0.6), boxMaterial);
      cargo.position.set(-0.4, 0.68, 0);
      cargo.castShadow = true;
      group.add(cargo);
      for (let rib = 0; rib < 5; rib++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.68, 0.615), trimMaterial);
        bar.position.set(-1.0 + rib * 0.3, 0.68, 0);
        group.add(bar);
      }
      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.63), trimMaterial);
      sill.position.set(-0.4, 0.36, 0);
      group.add(sill);

      addWheel(0.86, -0.3, TRUCK_TIRE);
      addWheel(0.86, 0.3, TRUCK_TIRE);
      // Sumbu belakang beroda ganda: dua ban berdampingan di tiap sisi.
      [-0.42, -0.74].forEach((x) =>
        [-0.335, -0.245, 0.245, 0.335].forEach((z) => addWheel(x, z, TRUCK_TIRE)),
      );

      [-1, 1].forEach((sideZ) => {
        const flap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.28), trimMaterial);
        flap.position.set(-0.92, 0.11, sideZ * 0.29);
        group.add(flap);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.15), headMaterial);
        head.position.set(1.115, 0.42, sideZ * 0.22);
        group.add(head);

        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.12), tailMaterial);
        tail.position.set(isTronton ? -2.34 : -1.06, 0.46, sideZ * 0.24);
        group.add(tail);
      });
      [-0.2, 0, 0.2].forEach((z) => {
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.07), markerMaterial);
        marker.position.set(1.04, 1.01, z);
        group.add(marker);
      });

      /*
       * Tronton: badan truk yang sama, ditambah bak kedua dan dua sumbu
       * belakang.
       *
       * Yang membedakannya dari truk boks bukan warnanya melainkan
       * **panjangnya dan jumlah sumbunya** — dua hal yang dikenali orang dari
       * jauh, dan dua hal yang memang menentukan beban gandar. Bobotnya dua
       * kali truk boks, jadi cekungan yang berjalan bersamanya juga dua kali
       * lebih dalam; itulah yang sebenarnya diperagakan skenario "melebihi
       * batas gandar".
       */
      if (isTronton) {
        const rangka = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 0.42), trimMaterial);
        rangka.position.set(-1.72, 0.29, 0);
        group.add(rangka);

        const bak = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.78, 0.6), boxMaterial);
        bak.position.set(-1.74, 0.72, 0);
        bak.castShadow = true;
        group.add(bak);
        for (let rib = 0; rib < 4; rib++) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.76, 0.615), trimMaterial);
          bar.position.set(-2.28 + rib * 0.36, 0.72, 0);
          group.add(bar);
        }
        const sill2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.63), trimMaterial);
        sill2.position.set(-1.74, 0.36, 0);
        group.add(sill2);

        // Dua sumbu tambahan, keduanya beroda ganda — inilah yang membuat
        // siluetnya terbaca sebagai kendaraan bersumbu banyak.
        [-1.34, -2.02].forEach((x) =>
          [-0.335, -0.245, 0.245, 0.335].forEach((z) => addWheel(x, z, TRUCK_TIRE)),
        );

        // Lampu putar kuning di atas kabin: penanda angkutan berat yang
        // dipakai di jalan nasional, dan penanda visual yang paling cepat
        // membedakannya dari truk biasa pada pandangan jauh.
        const beacon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.05, 0.07, 8),
          markerMaterial,
        );
        beacon.position.set(0.45, 1.12, 0);
        group.add(beacon);
      }
    } else {
      const body = new THREE.Mesh(carBodyGeometry, bodyMaterial);
      body.castShadow = true;
      group.add(body);

      const glass = new THREE.Mesh(carGlassGeometry, glassMaterial);
      group.add(glass);

      [0.6, -0.595].forEach((x, end) => {
        const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.54), trimMaterial);
        bumper.position.set(x, end ? 0.185 : 0.175, 0);
        group.add(bumper);
      });

      addWheel(0.37, -0.25, CAR_TIRE);
      addWheel(0.37, 0.25, CAR_TIRE);
      addWheel(-0.37, -0.25, CAR_TIRE);
      addWheel(-0.37, 0.25, CAR_TIRE);

      [-1, 1].forEach((sideZ) => {
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.14), headMaterial);
        head.position.set(0.588, 0.248, sideZ * 0.19);
        group.add(head);

        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.11), tailMaterial);
        tail.position.set(-0.568, 0.268, sideZ * 0.19);
        group.add(tail);

        const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.07), bodyMaterial);
        mirror.position.set(0.215, 0.352, sideZ * 0.315);
        group.add(mirror);
      });
    }

    group.position.set(0, 0.12, lane ? 0.85 : -0.85);
    group.rotation.y = lane ? 0 : Math.PI;
    group.visible = false;
    scene.add(group);
    vehicles.push({
      group,
      lane,
      laneAsal: lane,
      wheels,
      tire: isTruck ? TRUCK_TIRE : CAR_TIRE,
      speedJitter: 0.9 + Math.random() * 0.2,
      x: 0,
      p: 0,
      // Panjang bodi diukur dari geometrinya, bukan dikira-kira: truk
      // membentang −1,06…1,12 dan mobil −0,6…0,6.
      len: isTronton ? 3.5 : isTruck ? 2.25 : 1.3,
      isTruck,
      isTronton,
      kindIndex,
      wanted: false,
      // Ketinggian rodanya di atas lantai yang belum melendut. Kendaraan
      // menempel pada lantai: begitu lantainya turun, ia ikut turun.
      baseY: group.position.y,
      // Truk sumbu ganda dihitung tiga kali mobil penumpang. Ini perbandingan
      // kasar untuk peraga, bukan beban gandar sungguhan — yang penting truk
      // meninggalkan cekungan yang jelas lebih dalam saat melintas.
      weight: isTronton ? 6 : isTruck ? 3 : 1,
    });
  }

  // ---------------------------------------------------- penerapan lendutan
  /*
   * Tiga cara memindahkan benda, dipilih menurut bentuknya.
   *
   *   benda pendek   digeser turun sesuai absis titik pasangnya
   *   benda membentang  simpul geometrinya digeser satu per satu
   *   batang rangka  dipasang ulang dari kedua ujungnya yang sudah turun
   *
   * Yang terakhir itu yang membuat rangkanya tidak terkoyak di buhul, dan
   * sekaligus satu-satunya yang benar secara struktur: batang baja tetap lurus,
   * yang berpindah adalah titik pertemuannya.
   */
  const bendables = bridge.children
    .filter(
      (child) =>
        child !== rivets &&
        child.userData.tag !== 'sensor' &&
        child.userData.member !== true &&
        child.userData.spanMesh !== true,
    )
    .map((obj) => ({ obj, baseY: obj.position.y, x: obj.position.x }));

  const spanMeshes = bridge.children
    .filter((child): child is THREE.Mesh => child.userData.spanMesh === true)
    .map((mesh) => ({
      mesh,
      base: Float32Array.from(
        (mesh.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array,
      ),
    }));

  // Paku keling hidup sebagai matriks contoh, jadi yang disimpan absis dan
  // ordinat bawaannya — elemen ke-12 dan ke-13 tiap matriks.
  const rivetArray = rivets.instanceMatrix.array as Float32Array;
  const rivetBaseY = new Float32Array(rivets.count);
  for (let i = 0; i < rivets.count; i++) rivetBaseY[i] = rivetArray[i * 16 + 13];

  /*
   * Benda yang melendut dikeluarkan dari pemangkasan kerucut pandang.
   *
   * Bola pembatasnya dihitung dari geometri sebelum dilenturkan, dan
   * menghitungnya ulang tiap bingkai — sementara kendaraan terus menggeser
   * cekungannya — jauh lebih mahal daripada sekadar selalu menggambarnya.
   * Pada adegan berisi satu jembatan, benda-benda ini memang selalu di layar.
   */
  spanMeshes.forEach(({ mesh }) => {
    mesh.frustumCulled = false;
  });
  rivets.frustumCulled = false;

  const sagA = new THREE.Vector3();
  const sagB = new THREE.Vector3();
  const sagDir = new THREE.Vector3();

  /** Kendaraan yang sedang tampak, disusun ulang tiap kali medan dihitung. */
  const loaded: Array<{ x: number; weight: number }> = [];

  /** Absis tengah tiap batang, untuk mencari letak kerusakan dari tagnya. */
  const memberX = new Map<string, number>();
  members.forEach((mesh) => {
    const a = mesh.userData.a as THREE.Vector3 | undefined;
    const b = mesh.userData.b as THREE.Vector3 | undefined;
    if (a && b) memberX.set(mesh.userData.tag as string, (a.x + b.x) / 2);
  });

  /** Absis batang yang sedang rusak; diisi ulang tiap medan dihitung. */
  const broken: number[] = [];

  /**
   * Hitung ulang medan lendutan dari lendutan tengah bentang dan letak
   * kendaraan. Mengembalikan `true` bila ada yang berubah — kalau tidak,
   * seluruh kerja memindahkan geometri di bawah ini dilewati.
   */
  const rebuildField = (sag: number): boolean => {
    const liveAmp = LIVE_SHARE * sag;
    const deadAmp = sag - liveAmp;

    loaded.length = 0;
    let totalWeight = 0;
    let onSpanWeight = 0;
    for (const vehicle of vehicles) {
      if (!vehicle.group.visible) continue;
      loaded.push({ x: vehicle.x, weight: vehicle.weight });
      totalWeight += vehicle.weight;
      if (Math.abs(vehicle.x) < L / 2) onSpanWeight += vehicle.weight;
    }

    /*
     * Seberapa penuh bentangnya sedang terbebani, 0..1.
     *
     * Pembandingnya beban yang wajar berada di atas bentang pada arus yang
     * merata — sebagian armada sebanding panjang bentang terhadap seluruh
     * lintasan termasuk kedua oprit. Faktor inilah yang membuat lantainya
     * bernapas: nol saat bentang kosong, satu saat seluruh armada di atasnya.
     */
    const expected = totalWeight * (L / (L + APPROACH_UNITS));
    const loadFactor = expected > 0 ? Math.min(1, onSpanWeight / expected) : 0;

    // Batang yang sedang rusak, dicari absisnya. Tag tumpuan tidak ada di
    // sini dan memang tidak perlu: tumpuan yang turun sudah diwakili
    // kemiringan seluruh lantai lewat `tiltRatio`.
    broken.length = 0;
    for (const tag of state.damaged) {
      const x = memberX.get(tag);
      if (x !== undefined) broken.push(x);
    }
    const skewShare = broken.length ? DAMAGE_SKEW : 0;

    /*
     * Bentuk beban bergerak dikumpulkan dulu, lalu dinormalkan pada
     * **puncaknya sendiri**.
     *
     * Tanpa itu, angka yang tergambar tidak pernah sampai ke angka yang
     * dijanjikan: sumbangan tiap kendaraan dibagi bobot seluruh armada,
     * sedangkan sebagian armada selalu berada di oprit, sehingga lendutan
     * tengah bentang yang tergambar hanya sekitar 0,6 kali nilai sensornya.
     * Dinormalkan pada puncak, besarnya kembali benar dan yang tetap dibawa
     * bentuknya: cekungannya berada di tempat bebannya, bukan selalu di
     * tengah.
     */
    let peak = 0;
    for (let i = 0; i < FIELD_SAMPLES; i++) {
      const x = -L / 2 + (i / (FIELD_SAMPLES - 1)) * L;
      let moving = 0;
      for (const load of loaded) moving += load.weight * influence(x, load.x);
      liveRaw[i] = moving;
      if (moving > peak) peak = moving;
    }
    const liveScale = peak > 1e-6 ? loadFactor / peak : 0;

    let changed = false;
    for (let i = 0; i < FIELD_SAMPLES; i++) {
      const x = -L / 2 + (i / (FIELD_SAMPLES - 1)) * L;

      let dead = sagShape(x);
      if (skewShare > 0) {
        let skew = 0;
        for (const xd of broken) skew += influence(x, xd) / Math.max(0.35, influence(0, xd));
        skew /= broken.length;
        // Dibatasi supaya kerusakan tepat di atas tumpuan — yang pembaginya
        // hampir nol — tidak melahirkan cekungan yang tidak masuk akal.
        dead = (1 - skewShare) * dead + skewShare * Math.min(2.2, skew);
      }

      const value = deadAmp * dead + liveAmp * liveRaw[i] * liveScale;
      fieldNext[i] = value;
      if (Math.abs(value - fieldY[i]) > 1e-5) changed = true;
    }

    if (!changed) return false;
    fieldY.set(fieldNext);
    return true;
  };

  const applyDeflection = () => {
    bendables.forEach(({ obj, baseY, x }) => {
      obj.position.y = baseY - sagAt(x);
    });

    spanMeshes.forEach(({ mesh, base }) => {
      const attribute = mesh.geometry.attributes.position as THREE.BufferAttribute;
      const array = attribute.array as Float32Array;
      for (let i = 0; i < array.length; i += 3) {
        array[i + 1] = base[i + 1] - sagAt(base[i] + mesh.position.x);
      }
      attribute.needsUpdate = true;
    });

    members.forEach((mesh) => {
      const a = mesh.userData.a as THREE.Vector3 | undefined;
      const b = mesh.userData.b as THREE.Vector3 | undefined;
      const len = mesh.userData.len as number | undefined;
      if (!a || !b || !len) return;
      sagA.set(a.x, a.y - sagAt(a.x), a.z);
      sagB.set(b.x, b.y - sagAt(b.x), b.z);
      sagDir.subVectors(sagB, sagA);
      const length = sagDir.length();
      mesh.position.copy(sagA).add(sagB).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(V(0, 1, 0), sagDir.normalize());
      // Panjangnya ikut berubah sedikit karena buhulnya bergeser. Geometrinya
      // dipakai bersama antar batang seukuran, jadi yang disetel skalanya —
      // hanya pada sumbu batang, sehingga penampangnya tidak ikut melar.
      mesh.scale.y = length / len;
    });

    for (let i = 0; i < rivets.count; i++) {
      rivetArray[i * 16 + 13] = rivetBaseY[i] - sagAt(rivetArray[i * 16 + 12]);
    }
    rivets.instanceMatrix.needsUpdate = true;

    spotMeshes.forEach((sprite) =>
      placeMarker(
        sprite.userData.sensorId as string,
        sprite.userData.spot as [number, number, number],
      ),
    );
  };

  // -------------------------------------------------- pohon bagian & seleksi
  const tagged: THREE.Object3D[] = [...bridge.children, ...bearings];
  tagged.forEach((object) => {
    const tag = object.userData.tag as string | undefined;
    const group = tag ? PART_GROUPS.find((g) => g.test.test(tag)) : undefined;
    object.userData.grp = group ? group.key : FALLBACK_GROUP.key;
  });

  const counts: Record<string, number> = {};
  tagged.forEach((object) => {
    if (object.userData.proxy) return;
    const key = object.userData.grp as string;
    counts[key] = (counts[key] ?? 0) + 1;
  });

  const hiddenGroups = new Set<string>();
  let selectedGroup: string | null = null;
  const applyVisibility = () =>
    tagged.forEach((object) => {
      object.visible = !hiddenGroups.has(object.userData.grp as string);
    });

  // ------------------------------------------------------- kamera & interaksi
  let theta = ISO_VIEW[0];
  let phi = ISO_VIEW[1];
  let radius = ISO_VIEW[2];
  let drag: { x: number; y: number } | null = null;

  const element = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const hitAt = (event: PointerEvent) => {
    const rect = element.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(
      pickProxies.filter((mesh) => mesh.visible),
      false,
    )[0];
  };

  const label = document.createElement('div');
  /*
   * Label menerima peristiwa tetikus, sedangkan sebelumnya tidak.
   *
   * Isinya kini memuat tombol, jadi ia harus dapat diklik. Ongkosnya: seretan
   * yang dimulai persis di atas label tidak memutar kamera. Itu pertukaran yang
   * benar — label hanya muncul untuk satu penanda yang memang sedang dibaca,
   * dan sisa panggungnya tetap dapat diseret dari mana saja.
   */
  label.style.cssText =
    'position:absolute;display:none;transform:translate(-50%,-112%);z-index:3;' +
    'font-family:"Plus Jakarta Sans",system-ui,sans-serif;z-index:3';
  host.appendChild(label);

  let pressed: { x: number; y: number } | null = null;
  /** Penanda yang sedang diseret; selama ini berisi, kamera tidak diputar. */
  let draggingSensor: string | null = null;

  /*
   * Menyeret penanda.
   *
   * Titik pasangnya dicari dengan menembakkan sinar ke struktur, bukan ke
   * sebuah bidang khayal di depan kamera: sensor menempel pada elemen, dan
   * penanda yang dapat dilepas melayang di udara hanya akan menghasilkan letak
   * yang tidak berarti apa-apa. Bila sinarnya tidak mengenai apa pun — misalnya
   * pengguna menyeret ke arah langit — penanda tinggal di tempat terakhirnya.
   */
  const dropTargets = [...bridge.children, ...bearings].filter(
    (object): object is THREE.Mesh =>
      (object as THREE.Mesh).isMesh === true &&
      object.userData.proxy !== true &&
      object.userData.tag !== 'sensor',
  );

  const surfaceAt = (event: PointerEvent): THREE.Vector3 | null => {
    const rect = element.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(
      dropTargets.filter((mesh) => mesh.visible),
      false,
    )[0];
    return hit ? hit.point : null;
  };

  const onPointerDown = (event: PointerEvent) => {
    pressed = { x: event.clientX, y: event.clientY };
    element.setPointerCapture(event.pointerId);

    // Menekan penanda hanya memulai pemindahan bila mode geser dinyalakan.
    // Di luar mode itu tekanan diteruskan ke orbit seperti tekanan di tempat
    // lain, dan penanda tetap terbaca lewat penyaringan klik di pointerup.
    if (state.editSpots) {
      const hit = hitAt(event);
      if (hit) {
        draggingSensor = hit.object.userData.sensorId as string;
        element.style.cursor = 'grabbing';
        return;
      }
    }

    drag = { x: event.clientX, y: event.clientY };
    element.style.cursor = 'grabbing';
  };

  const onPointerMove = (event: PointerEvent) => {
    if (draggingSensor) {
      const point = surfaceAt(event);
      if (point) {
        const local = bridge.worldToLocal(point.clone());
        // Sinar mengenai struktur yang sedang melendut, sedangkan titik pasang
        // disimpan pada jembatan yang belum melendut. Lendutan di absis itu
        // dikembalikan dulu, kalau tidak letaknya akan turun sendiri setiap
        // kali pengalinya dinaikkan.
        placeMarker(draggingSensor, [
          local.x,
          local.y + sagAt(local.x),
          local.z,
        ]);
      }
      return;
    }
    if (!drag) {
      // Bentuk kursor menyatakan apa yang akan terjadi: salib empat arah berarti
      // penanda dapat dipindahkan, telunjuk berarti hanya dapat dibaca.
      const overMarker = hitAt(event) !== null;
      element.style.cursor = overMarker ? (state.editSpots ? 'move' : 'pointer') : 'grab';
      return;
    }
    theta -= (event.clientX - drag.x) * 0.006;
    phi = Math.min(1.25, Math.max(0.06, phi + (event.clientY - drag.y) * 0.004));
    drag = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: PointerEvent) => {
    drag = null;
    element.style.cursor = 'grab';
    // Geseran kurang dari 5 piksel dihitung sebagai klik, bukan orbit maupun
    // pemindahan: menekan penanda untuk membacanya tidak boleh menggesernya.
    const isClick =
      pressed !== null &&
      Math.abs(event.clientX - pressed.x) < 5 &&
      Math.abs(event.clientY - pressed.y) < 5;

    if (draggingSensor) {
      const sensorId = draggingSensor;
      draggingSensor = null;
      pressed = null;
      if (isClick) {
        callbacks.onPick(sensorId !== state.pickedSensor ? sensorId : null);
        return;
      }
      const sprite = spotMeshes.find((mesh) => mesh.userData.sensorId === sensorId);
      const spot = sprite?.userData.spot as [number, number, number] | undefined;
      if (spot) callbacks.onSpotMove(sensorId, spot);
      return;
    }

    if (isClick) {
      const hit = hitAt(event);
      const sensorId = hit ? (hit.object.userData.sensorId as string) : null;
      callbacks.onPick(sensorId && sensorId !== state.pickedSensor ? sensorId : null);
    }
    pressed = null;
  };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    radius = Math.min(32, Math.max(7, radius + event.deltaY * 0.01));
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('wheel', onWheel, { passive: false });

  const resizeObserver = new ResizeObserver(() => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(host);

  // --------------------------------------------------------------- gelung gambar
  let frame = 0;
  /** Nilai teranimasi, dikejar perlahan menuju sasarannya di `state`. */
  let windLift = 0;
  /** Sudut mangkuk anemometer, ditumpuk per bingkai supaya tidak melompat. */
  let rotorAngle = 0;
  let floodLevel = 0;
  /** Fase gelombang sungai, ditumpuk per bingkai supaya tidak melompat. */
  let wavePhase = 0;
  let lastFrameAt = performance.now() / 1000;
  /*
   * Jumlah tiap jenis dilacak terpisah, bukan totalnya.
   *
   * Skenario dapat menukar mobil dengan truk tanpa mengubah jumlah
   * keseluruhan — "enam mobil dua truk" menjadi "empat mobil empat truk" —
   * dan susunan armadanya tetap harus ikut berubah. Yang membandingkan total
   * akan melewatkan pertukaran itu diam-diam.
   */
  let lastCars = -1;
  let lastTrucks = -1;
  let lastTronton = -1;
  /** Apakah bingkai sebelumnya sudah dalam keadaan macet. */
  let lastMacet = false;
  let lastScaleAt = -9;
  let reportedScale = -1;
  const projected = new THREE.Vector3();

  const paintMember = (mesh: THREE.Mesh, pulse: number) => {
    const material = mesh.material as THREE.MeshStandardMaterial;
    const tag = mesh.userData.tag as string;
    if (state.damaged.includes(tag)) {
      material.color.copy(hotColor);
      material.emissive.copy(hotColor);
      material.emissiveIntensity = pulse * 0.6;
      return;
    }
    if (selectedGroup && mesh.userData.grp === selectedGroup) {
      material.color.copy(selectColor);
      material.emissive.copy(selectColor);
      material.emissiveIntensity = 0.25;
      return;
    }
    material.emissiveIntensity = 0;
    material.color
      .copy((mesh.userData.tint as THREE.Color | undefined) ?? steelColor)
      .lerp(hotColor, mesh.userData.chord ? state.stressRatio * 0.85 : state.stressRatio * 0.25);
  };

  const render = () => {
    frame = requestAnimationFrame(render);
    const now = performance.now() / 1000;
    const dimintaBerubah =
      state.cars !== lastCars || state.trucks !== lastTrucks || state.tronton !== lastTronton;
    /*
     * Arus yang merayap di bawah `LAJU_MACET` diperlakukan sebagai kemacetan,
     * bukan sebagai arus biasa yang kebetulan pelan.
     */
    const macet = state.speed > 0 && state.speed < LAJU_MACET;
    const speedScale = state.paused ? 0 : 1;

    /*
     * Lalu lintas disusun sebagai **antrean**, bukan sebagai kumpulan benda
     * yang berjalan sendiri-sendiri.
     *
     * Sebelumnya tiap kendaraan maju dengan lajunya sendiri (`speedJitter`
     * 0,9–1,1) dan membungkus posisinya tanpa melihat siapa pun. Akibatnya
     * yang lebih cepat menyusul yang lebih lambat lalu **menembusnya** —
     * truk dan mobil tergambar saling tumpang tindih di lajur yang sama,
     * persis keluhan yang dilaporkan. Sebaran ulang saat jumlah berubah tidak
     * menolong: ia hanya menata ulang sekali, sedangkan tabrakannya lahir
     * dari selisih laju yang terus berjalan.
     *
     * Sekarang tiap kendaraan mengejar yang di depannya dan berhenti pada
     * jarak aman. Selisih laju tetap ada — dan justru itu yang membuat
     * arusnya hidup: iring-iringan terbentuk sendiri di belakang truk yang
     * lambat, lalu merenggang lagi setelah ia keluar.
     */
    if (dimintaBerubah) {
      lastCars = state.cars;
      lastTrucks = state.trucks;
      lastTronton = state.tronton;
      vehicles.forEach((v) => {
        v.wanted =
          v.kindIndex <
          (v.isTronton ? state.tronton : v.isTruck ? state.trucks : state.cars);
      });

      /*
       * Yang baru diminta ditaruh di **celah terlapang** pada lintasannya,
       * bukan diantre di mulut masuk.
       *
       * Mengantre di mulut memang lebih jujur, tetapi mulutnya 18 satuan dari
       * ujung jembatan: pada laju arus biasa butuh enam detik sampai kendaraan
       * pertama tiba, dan selama itu jembatan kosong. Skenario yang
       * menjanjikan kemacetan lalu memperlihatkan bentang lengang adalah
       * kebohongan yang lebih mahal daripada kendaraan yang muncul di tengah
       * oprit.
       *
       * Yang **tidak** dilakukan adalah memindahkan kendaraan yang sudah
       * berjalan. Sebelumnya seluruh armada ditata ulang tiap kali jumlahnya
       * berubah, dan arus yang sedang mengalir melompat serentak.
       */
      const tempatKosong = (lane: number, calon: Vehicle): number | null => {
        const ada = vehicles.filter((o) => o.lane === lane && o.group.visible);
        let terbaik: number | null = null;
        let terlapang = -Infinity;
        const CALON_TITIK = 24;
        for (let k = 0; k < CALON_TITIK; k++) {
          const cand = (k + 0.5) * (TRACK_LEN / CALON_TITIK);
          let sempit = Infinity;
          for (const o of ada) {
            sempit = Math.min(sempit, Math.abs(o.p - cand) - (o.len + calon.len) / 2);
          }
          if (sempit > terlapang) {
            terlapang = sempit;
            terbaik = cand;
          }
        }
        return terlapang >= JARAK_AMAN ? terbaik : null;
      };

      vehicles.forEach((v) => {
        if (!v.wanted || v.group.visible) return;
        const tempat = tempatKosong(v.lane, v);
        // Tidak ada celah? Ia menunggu di luar dan masuk lewat mulut nanti.
        if (tempat === null) return;
        v.p = tempat;
        v.group.visible = true;
      });
      /*
       * Kendaraan berat berjalan **beriringan di satu lajur**, bukan tersebar
       * di kedua lajur.
       *
       * Begitu bunyi skenarionya, dan bedanya bukan sekadar susunan: enam
       * kendaraan berat yang dibagi dua lajur dan disebar sepanjang lintasan
       * menaruh satu-dua di atas bentang pada satu saat, dan satu truk
       * melintas bukan iring-iringan. Ditaruh berurutan di satu lajur,
       * seluruh bobotnya berada di atas bentang bersamaan — dan itulah
       * keadaan yang menjadikan lendutan tengah bentang melewati ambang
       * kritis, yaitu isi skenarionya.
       *
       * Lajur aslinya disimpan supaya arus kembali memakai kedua lajur
       * begitu skenarionya berhenti.
       */
      if (state.tronton > 0) {
        let p = TRACK_HALF - L / 2;
        vehicles
          .filter((v) => v.wanted && v.isTruck)
          .forEach((v) => {
            v.lane = 1;
            v.group.position.z = 0.85;
            v.group.rotation.y = 0;
            v.p = p < 0 ? p + TRACK_LEN : p;
            v.group.visible = true;
            p -= v.len + JARAK_AMAN;
          });
      } else {
        vehicles.forEach((v) => {
          if (v.lane === v.laneAsal) return;
          v.lane = v.laneAsal;
          v.group.position.z = v.laneAsal ? 0.85 : -0.85;
          v.group.rotation.y = v.laneAsal ? 0 : Math.PI;
        });
      }

      // Yang tidak diminta lagi tidak dihilangkan seketika — ia menghabiskan
      // lintasannya lalu keluar sendiri di ujung, seperti kendaraan yang
      // memang sedang lewat.
    }

    /*
     * Begitu arus berubah menjadi macet, seluruh armada dipadatkan ke bentang.
     *
     * Ini satu-satunya tempat kendaraan yang sedang berjalan dipindahkan
     * serentak, dan alasannya justru yang membuat aturan umumnya ada:
     * memindahkan arus yang mengalir membuatnya melompat tanpa sebab, tetapi
     * **perpindahan ke keadaan macet memang sebuah sebab**. Tanpa pemadatan
     * ini, dua puluh empat kendaraan yang tersebar merata di lintasan
     * sepanjang 48 satuan hanya menaruh enam di atas bentang yang panjangnya
     * 12 — dan enam kendaraan merayap bukan gambar kemacetan.
     *
     * Barisnya disusun dari mulut keluar bentang ke belakang, rapat pada
     * jarak aman, lalu mengular ke oprit bila armadanya lebih panjang
     * daripada bentangnya. Itu pula bentuk kemacetan yang sebenarnya: ekornya
     * berada di luar jembatan.
     */
    if (macet !== lastMacet) {
      lastMacet = macet;
      if (macet) {
        [0, 1].forEach((lane) => {
          let p = TRACK_HALF + L / 2 - 0.4;
          vehicles
            .filter((v) => v.lane === lane && v.wanted)
            .forEach((v) => {
              v.p = p < 0 ? p + TRACK_LEN : p;
              v.group.visible = true;
              p -= v.len + JARAK_AMAN;
            });
        });
      }
    }

    const langkah = state.speed * speedScale * 0.05;

    [0, 1].forEach((lane) => {
      // Yang paling depan lebih dulu: jarak aman pengikutnya dihitung
      // terhadap kedudukan pemimpin yang **sudah** diperbarui bingkai ini,
      // bukan terhadap kedudukannya sebelumnya.
      const antre = vehicles
        .filter((v) => v.lane === lane && v.group.visible)
        .sort((a, b) => b.p - a.p);

      antre.forEach((v, urut) => {
        /*
         * Pada kemacetan, majunya berdenyut dan denyutnya menjalar ke
         * belakang.
         *
         * Laju rata-ratanya tidak berubah — pengali 3,2 menggantikan rata-rata
         * `max(0, sin)` yang besarnya 1/π — yang berubah bentuk geraknya:
         * kendaraan maju setengah bodi lalu berhenti, dan yang di belakangnya
         * baru bergerak sesaat kemudian. Inilah yang dikenali mata sebagai
         * macet; arus lambat yang rata hanya terbaca sebagai animasi yang
         * tersendat.
         */
        const denyut = macet ? 3.2 * Math.max(0, Math.sin(now * 1.3 - urut * 0.8)) : 1;
        let maju = langkah * v.speedJitter * denyut;
        if (urut > 0) {
          const depan = antre[urut - 1];
          const batas = depan.p - (depan.len + v.len) / 2 - JARAK_AMAN;
          maju = Math.min(maju, Math.max(0, batas - v.p));
        }
        v.p += maju;

        if (v.p > TRACK_LEN) {
          // Sampai di mulut keluar. Ia disembunyikan di sini dan menunggu
          // giliran masuk lagi — atau tidak sama sekali, bila skenarionya
          // sudah tidak memintanya.
          v.group.visible = false;
          return;
        }

        const arah = lane ? 1 : -1;
        v.x = arah * (v.p - TRACK_HALF);
        v.group.position.x = v.x;
        v.group.position.y = v.baseY - sagAt(v.x);
        // Roda berputar menurut jarak yang benar-benar ditempuh, jadi
        // kendaraan yang tertahan di belakang truk rodanya ikut berhenti.
        v.wheels.forEach((wheel) => {
          wheel.rotation.z -= (arah * maju) / v.tire;
        });
      });

      /*
       * Satu kendaraan dimasukkan per bingkai, dan hanya bila mulut
       * lintasannya lapang. Tanpa pemeriksaan itu kendaraan baru lahir tepat
       * di atas kendaraan yang belum sempat menjauh — bentuk tumpang tindih
       * yang sama dengan yang baru saja diperbaiki, hanya pindah tempat.
       */
      const menunggu = vehicles.find((v) => v.lane === lane && v.wanted && !v.group.visible);
      if (menunggu) {
        const buntut = antre[antre.length - 1];
        const lapang = !buntut || buntut.p > (buntut.len + menunggu.len) / 2 + JARAK_AMAN;
        if (lapang) {
          menunggu.p = 0;
          const arah = lane ? 1 : -1;
          menunggu.x = arah * -TRACK_HALF;
          menunggu.group.position.x = menunggu.x;
          menunggu.group.position.y = menunggu.baseY - sagAt(menunggu.x);
          menunggu.group.visible = true;
        }
      }
    });

    const pulse = 0.55 + 0.45 * Math.sin(now * 4);
    members.forEach((mesh) => paintMember(mesh, pulse));
    bearings.forEach((mesh) => paintMember(mesh, pulse));

    // Batang ukur: setengah tinggi layar dalam meter, dibulatkan ke angka yang
    // enak dibaca. Diperbarui paling cepat tiap 0,6 detik agar tidak berkedip.
    if (now - lastScaleAt > 0.6) {
      lastScaleAt = now;
      const heightPx = host.clientHeight || 1;
      const metresPerPixel = (2 * radius * Math.tan((17 * Math.PI) / 180) * 10) / heightPx;
      const raw = 120 * metresPerPixel;
      const nice = raw >= 100 ? Math.round(raw / 10) * 10 : Math.round(raw);
      if (nice !== reportedScale) {
        reportedScale = nice;
        callbacks.onScale(nice);
      }
    }

    bridge.rotation.x = -state.tiltRatio * 0.012;

    // Peredaman dihitung terhadap waktu, bukan terhadap jumlah bingkai: di tab
    // yang tersembunyi peramban menahan `requestAnimationFrame`, dan peredaman
    // per bingkai akan membuat banjir seolah tidak pernah naik.
    const dt = Math.min(0.25, Math.max(0, now - lastFrameAt));
    lastFrameAt = now;

    /*
     * Lendutan dikejar dengan **pegas teredam**, bukan dengan tarikan
     * eksponensial.
     *
     * Tarikan eksponensial mendekat tanpa pernah sampai: sisa perjalanan
     * terakhirnya merayap semakin pelan, dan gerak yang melambat tanpa
     * berhenti terbaca sebagai gambar yang tersendat, bukan sebagai benda yang
     * berpindah. Pegas punya ujung — ia sampai, sedikit melewatinya, lalu
     * diam. Dan itulah yang memang dilakukan jembatan ketika beban naik ke
     * atasnya: turun, terlewat sedikit, lalu tenang.
     *
     * Redamannya mengikuti pita ambang, tidak tetap. Di bawah ambang waspada
     * pegasnya hampir teredam kritis: lantainya turun tenang, tanpa ayunan. Di
     * atas ambang kritis redamannya tinggal sepertiga: tiap perubahan terlewat
     * jauh dan lama tenangnya. Rasio redaman yang turun memang salah satu
     * penanda kerusakan yang paling dikenal, jadi yang bertambah di sini
     * keterangan, bukan hiasan.
     */
    if (sagNow !== state.sagUnits || sagVel !== 0) {
      const { omega, zeta } = SAG_DYNAMICS[state.sagStatus];
      /*
       * Bingkai yang tertahan lama — tab di belakang, jeda pemeriksa galat —
       * dipangkas seperempat detik. Tanpa batas itu satu bingkai tersendat
       * berubah menjadi ribuan putaran integrasi sekaligus.
       */
      let remaining = Math.min(dt, 0.25);
      while (remaining > 1e-6) {
        const h = Math.min(remaining, SAG_SUBSTEP);
        sagVel += (omega * omega * (state.sagUnits - sagNow) - 2 * zeta * omega * sagVel) * h;
        sagNow += sagVel * h;
        remaining -= h;
      }
      // Sisa selisih yang tinggal sepersepuluh ribu satuan dibulatkan supaya
      // nilainya benar-benar berhenti di sasarannya.
      if (Math.abs(state.sagUnits - sagNow) < 1e-5 && Math.abs(sagVel) < 1e-4) {
        sagNow = state.sagUnits;
        sagVel = 0;
      }
    }

    /*
     * Medan lendutan dihitung ulang tiap bingkai karena kendaraannya memang
     * bergerak tiap bingkai — cekungannya berjalan bersama truk, bukan
     * naik-turun di tempat. Bila tidak ada satu pun cuplikan medan yang
     * berubah — bentang kosong, lendutan tetap, aliran data dijeda — seluruh
     * kerja memindahkan geometri di bawahnya dilewati.
     */
    if (rebuildField(sagNow)) applyDeflection();

    // Angin dikejar perlahan, tidak seketika: mangkuk anemometer punya
    // kelembaman, dan putaran yang melompat dari pelan ke cepat dalam satu
    // bingkai terbaca sebagai kesalahan gambar, bukan sebagai hembusan.
    windLift += (state.windRatio - windLift) * Math.min(1, dt * 2.4);

    /*
     * Mangkuk anemometer. Sudutnya ditumpuk per bingkai, bukan dihitung dari
     * `now` dikali laju — alasan yang sama seperti gelombang sungai: mengalikan
     * laju pada waktu mutlak membuat seluruh riwayat sudut ikut melompat setiap
     * kali anginnya berubah.
     *
     * Ada putaran dasar walau angin sedang tenang. `windRatio` bernilai nol
     * pada 14 km/jam — itu keadaan layan normal, bukan udara diam, dan
     * anemometer yang membeku di situ akan terbaca sebagai alat yang rusak.
     *
     * Hembusan ikut masuk ke laju putar, dan hanya terasa ketika anginnya
     * memang sedang kencang. Sejak kantong angin dilepas, benda inilah
     * satu-satunya yang menyatakan keadaan angin di adegan — dan putaran yang
     * rata sempurna terbaca sebagai motor listrik, bukan sebagai cuaca.
     */
    const gust = Math.sin(now * 5.2) * 0.9 + Math.sin(now * 11.7) * 0.35;
    rotorAngle += dt * (1.1 + windLift * (9 + gust));
    rotor.rotation.y = rotorAngle;

    // Sungai. Banjir naik dan surut perlahan — inilah satu-satunya bagian
    // adegan yang menyatakan keadaan lingkungan yang tidak diukur sensor.
    floodLevel += (state.floodRatio - floodLevel) * Math.min(1, dt * 0.9);
    water.position.y = WATER_LEVEL + floodLevel * 0.78;
    waterMaterial.color.copy(CALM_WATER).lerp(FLOOD_WATER, floodLevel);
    waterMaterial.roughness = 0.22 + floodLevel * 0.25;
    waterMaterial.metalness = 0.55 - floodLevel * 0.15;

    const waveGain = 1 + floodLevel * 3.6;
    const waveSpeed = 1 + floodLevel * 1.5;
    /*
     * Fase gelombang ditumpuk per bingkai, tidak dihitung sebagai `now` kali
     * laju. Perkalian membuat seluruh riwayat fase ikut berubah begitu lajunya
     * berubah: saat banjir naik, laju bergeser tiap bingkai dan gelombang
     * melompat sejauh `now` × selisih laju — beberapa radian sekaligus setelah
     * halaman terbuka satu menit. Itulah sentakan yang terlihat justru pada
     * saat air seharusnya mengalir paling mulus. Fase yang ditumpuk selalu
     * menyambung: yang berubah hanya seberapa cepat ia bertambah.
     */
    wavePhase += dt * waveSpeed;

    const ampLong = 0.05 * waveGain;
    const ampCross = 0.035 * waveGain;
    // Suku ketiga hanya hidup saat banjir: gelombang pendek yang berjalan
    // melintang sungai, yang membuat airnya terbaca mengalir deras.
    const ampFlood = floodLevel * 0.07;

    for (let c = 0; c < WATER_COLS; c++) {
      const a = waterColX[c] * 0.6 + wavePhase * 1.1;
      waveSinX[c] = Math.sin(a);
      waveCosX[c] = Math.cos(a);
    }
    for (let r = 0; r < WATER_ROWS; r++) {
      const b = waterRowZ[r] * 0.9 + wavePhase * 1.7;
      waveSinZ[r] = Math.sin(b);
      waveCosZ[r] = Math.cos(b);
      const f = waterRowZ[r] * 1.6 - wavePhase * 4.1;
      floodSinZ[r] = Math.sin(f);
      floodCosZ[r] = Math.cos(f);
    }

    /*
     * Normal dihitung dari turunan gelombangnya, bukan dari `computeVertexNormals`.
     * Perataan normal antarsegitiga menghasilkan permukaan yang bersudut pada
     * puncak riak, dan sudut itu berkedip tiap bingkai karena puncaknya bergeser
     * melewati batas segitiga — kilau airnya berkerlip walau bentuknya mulus.
     * Turunan memberi normal yang tepat di tiap titik, dan ongkosnya justru
     * lebih murah daripada memutari seluruh segitiga tiap bingkai.
     */
    const waterArray = waterPos.array as Float32Array;
    const normalArray = waterNormal.array as Float32Array;
    let i = 0;
    for (let r = 0; r < WATER_ROWS; r++) {
      const sinZ = waveSinZ[r];
      const floodSin = floodSinZ[r];
      const slopeZ = -(ampCross * 0.9 * waveCosZ[r] + ampFlood * 1.6 * floodCosZ[r]);
      const heightZ = ampCross * sinZ + ampFlood * floodSin;
      for (let c = 0; c < WATER_COLS; c++, i++) {
        waterArray[i * 3 + 1] = ampLong * waveSinX[c] + heightZ;
        const slopeX = -(ampLong * 0.6 * waveCosX[c]);
        const inv = 1 / Math.sqrt(slopeX * slopeX + slopeZ * slopeZ + 1);
        normalArray[i * 3] = slopeX * inv;
        normalArray[i * 3 + 1] = inv;
        normalArray[i * 3 + 2] = slopeZ * inv;
      }
    }
    waterPos.needsUpdate = true;
    waterNormal.needsUpdate = true;

    if (!drag && state.autoRotate) theta += 0.0012;
    camera.position.set(
      Math.sin(theta) * radius * Math.cos(phi),
      radius * Math.sin(phi) + 1.2,
      Math.cos(theta) * radius * Math.cos(phi),
    );
    camera.lookAt(0, 0.5, 0);

    const picked = state.pickedSensor;
    spotMeshes.forEach((sprite) => {
      const sensorId = sprite.userData.sensorId as string;
      sprite.material = markerMaterials[state.sensorStatus[sensorId] ?? 'AMAN'];
      const isPicked = sensorId === picked;
      const size = MARKER_SIZE * (isPicked ? 1.34 + 0.08 * Math.sin(now * 5) : 1);
      sprite.scale.set(size, size, 1);
    });

    if (picked) {
      const marker = spotMeshes.find((mesh) => mesh.userData.sensorId === picked);
      if (marker && marker.visible) {
        marker.getWorldPosition(projected).project(camera);
        const w = host.clientWidth;
        const h = host.clientHeight;
        label.style.display = 'block';
        const lw = label.offsetWidth || 160;
        const lh = label.offsetHeight || 40;
        label.style.left = `${Math.min(w - lw / 2 - 6, Math.max(lw / 2 + 6, ((projected.x + 1) / 2) * w)).toFixed(0)}px`;
        label.style.top = `${Math.min(h - 6, Math.max(lh * 1.3 + 4, ((1 - projected.y) / 2) * h)).toFixed(0)}px`;
      } else {
        label.style.display = 'none';
      }
    } else {
      label.style.display = 'none';
    }

    renderer.render(scene, camera);
  };

  applyVisibility();
  render();

  return {
    counts,
    labelHost: label,
    setState(patch) {
      Object.assign(state, patch);
    },
    toggleGroup(key) {
      if (hiddenGroups.has(key)) hiddenGroups.delete(key);
      else hiddenGroups.add(key);
      applyVisibility();
      return [...hiddenGroups];
    },
    selectGroup(key) {
      selectedGroup = selectedGroup === key ? null : key;
      return selectedGroup;
    },
    resetSpots() {
      Object.entries(SENSOR_SPOTS).forEach(([sensorId, spot]) => placeMarker(sensorId, spot));
    },
    reset() {
      theta = ISO_VIEW[0];
      phi = ISO_VIEW[1];
      radius = ISO_VIEW[2];
      hiddenGroups.clear();
      selectedGroup = null;
      applyVisibility();
    },
    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('wheel', onWheel);
      label.remove();
      renderer.dispose();
      environmentTarget.dispose();
      skyTexture.dispose();
      renderer.domElement.remove();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
    },
  };
}
