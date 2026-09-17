import * as THREE from 'three';
import { SENSOR_SPOTS } from '../domain/sensors';

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
  /** Tag elemen yang sedang rusak menurut skenario aktif. */
  damaged: string[];
  cars: number;
  trucks: number;
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
  /** Isi label melayang untuk sensor yang dipilih; HTML dirakit oleh React. */
  labelFor: (sensorId: string) => string;
}

export interface TwinScene {
  counts: Record<string, number>;
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
    damaged: [],
    cars: 0,
    trucks: 0,
    speed: 0,
    sensorStatus: {},
    windRatio: 0,
    floodRatio: 0,
    paused: false,
    autoRotate: true,
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
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 16;
  skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d')!;
  const gradient = skyCtx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#2f6fb5');
  gradient.addColorStop(0.34, '#79aede');
  gradient.addColorStop(0.47, '#bcd8ee');
  gradient.addColorStop(0.52, '#dde9f0');
  gradient.addColorStop(0.58, '#93a58c');
  gradient.addColorStop(1, '#5f6c57');
  skyCtx.fillStyle = gradient;
  skyCtx.fillRect(0, 0, 16, 256);
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTexture;
  scene.environment = skyTexture;
  scene.fog = new THREE.Fog(0xc3d8ea, 45, 175);

  // Matahari tinggi: bayangannya pendek dan tegas, dan seluruh permukaan
  // mendatar — lantai jalan, oprit, air — ikut terang.
  const sun = new THREE.DirectionalLight(0xfff3df, 3.1);
  sun.position.set(12, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
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

  /** Menambahkan satu batang antara dua titik; panjang dan arahnya dihitung dari vektornya. */
  const addMember = (a: THREE.Vector3, b: THREE.Vector3, tag: string, radius = 0.075) => {
    const direction = new THREE.Vector3().subVectors(b, a);
    const length = direction.length();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(radius, length, radius), steel.clone());
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(V(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.tag = tag;
    // Batang tepi (chord) memikul gaya aksial terbesar, jadi diwarnai lebih kuat
    // saat regangan naik daripada batang sekunder.
    mesh.userData.chord = /^(bc|d)/.test(tag);
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
  for (let i = 0; i <= P; i++) {
    [-W, W].forEach((z) =>
      [0, H].forEach((y) => {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.03), gussetMaterial);
        plate.position.set(-L / 2 + i * panelLength, y, z + Math.sign(z) * 0.07);
        plate.castShadow = true;
        bridge.add(plate);
      }),
    );
  }

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
  const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 0.12, W * 2 - 0.5), asphalt);
  deck.position.y = 0.06;
  deck.castShadow = true;
  deck.receiveShadow = true;
  bridge.add(deck);

  const paint = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.7 });
  const dashCount = Math.round(L * 2.2);
  for (let i = 0; i < dashCount; i++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.05), paint);
    dash.position.set(-L / 2 + 0.25 + i * (L / dashCount), 0.121, 0);
    bridge.add(dash);
  }
  [-1, 1].forEach((side) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(L, 0.004, 0.05), paint);
    edge.position.set(0, 0.121, side * (W - 0.62));
    bridge.add(edge);
  });

  const curbMaterial = new THREE.MeshStandardMaterial({
    color: 0xa8a39c,
    roughness: 0.92,
    map: noiseTexture(128, 200, 45, 8),
  });
  [-1, 1].forEach((side) => {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(L, 0.18, 0.32), curbMaterial);
    curb.position.set(0, 0.13, side * (W - 0.4));
    curb.castShadow = true;
    curb.receiveShadow = true;
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
      const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, 0.04), railMaterial);
      rail.position.set(0, y, z);
      rail.castShadow = true;
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
    color: 0x5b6f44,
    roughness: 1,
    map: noiseTexture(256, 180, 80, 14),
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
  const APPROACH_LENGTH = 17;
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

    // Marka meneruskan marka di atas bentang supaya jalannya terbaca menerus.
    const approachDashes = Math.round(APPROACH_LENGTH * 2.2);
    for (let i = 0; i < approachDashes; i++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.05), paint);
      dash.position.set(
        side * (approachStart + 0.25 + i * (APPROACH_LENGTH / approachDashes)),
        0.121,
        0,
      );
      scene.add(dash);
    }

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

      // Pagar pengaman meneruskan sandaran jembatan sejauh delapan unit lalu
      // berhenti: sandaran yang putus persis di ujung lantai membuat jembatan
      // seolah terpotong di udara.
      const guardZ = wing * (W + 0.06);
      for (let i = 0; i <= 10; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.46, 6), railMaterial);
        post.position.set(side * (approachStart + i * 0.8), 0.13, guardZ);
        post.castShadow = true;
        scene.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 0.11, 0.05), railMaterial);
      beam.position.set(side * (approachStart + 4), 0.27, guardZ);
      beam.castShadow = true;
      scene.add(beam);
    });
  });

  // Tebing sungai: permukaan berumput bergelombang di atas satu blok pejal.
  // Tanpa blok itu tanahnya hanya selembar bidang tipis yang, dilihat dari sudut
  // rendah, menggantung dua setengah unit di atas air.
  // Dibuat panjang ke arah hulu dan hilir supaya tepinya jatuh di luar jarak
  // kabut — tanah yang berujung tegak lurus di tengah pandangan merusak ilusi.
  const bankGeometry = new THREE.PlaneGeometry(32, 80, 40, 64);
  bankGeometry.rotateX(-Math.PI / 2);
  const bankPos = bankGeometry.attributes.position;
  for (let i = 0; i < bankPos.count; i++) {
    bankPos.setY(
      i,
      Math.sin(bankPos.getX(i) * 0.5) * 0.045 + Math.cos(bankPos.getZ(i) * 0.4) * 0.06 + Math.random() * 0.025,
    );
  }
  bankGeometry.computeVertexNormals();
  [-1, 1].forEach((side) => {
    const bank = new THREE.Mesh(bankGeometry.clone(), grass);
    bank.position.set(side * (L / 2 + 16.5), -0.55, 0);
    bank.receiveShadow = true;
    scene.add(bank);

    const bankBody = new THREE.Mesh(new THREE.BoxGeometry(31.6, 2.6, 79.6), soil);
    bankBody.position.set(side * (L / 2 + 16.5), -1.98, 0); // puncak -0,68, di bawah rumput
    bankBody.receiveShadow = true;
    scene.add(bankBody);
  });

  /*
   * Kerapatan petak air ditentukan gelombang terpendek yang digambar, bukan
   * selera. Gelombang banjir melintang punya panjang gelombang 2π/1,6 ≈ 3,9
   * satuan; dengan 80 petak arah aliran jaraknya 0,8 satuan, jadi satu
   * gelombang disusun hampir lima titik. Di bawah dua titik per gelombang
   * bentuknya tidak terwakili sama sekali — yang tampil bukan riak yang
   * berjalan, melainkan kedip yang berpindah acak tiap bingkai.
   */
  const WATER_SEG_X = 96;
  const WATER_SEG_Z = 80;
  const waterGeometry = new THREE.PlaneGeometry(130, 64, WATER_SEG_X, WATER_SEG_Z);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e6d97,
    metalness: 0.55,
    roughness: 0.22,
    envMapIntensity: 1.5,
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
    spotMeshes[index].position.set(spot[0], spot[1] + MARKER_LIFT, spot[2]);
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
  }
  const vehicles: Vehicle[] = [];

  for (let i = 0; i < 16; i++) {
    const isTruck = i % 3 === 0;
    const lane = i % 2;
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
        tail.position.set(-1.06, 0.46, sideZ * 0.24);
        group.add(tail);
      });
      [-0.2, 0, 0.2].forEach((z) => {
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.07), markerMaterial);
        marker.position.set(1.04, 1.01, z);
        group.add(marker);
      });
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
      wheels,
      tire: isTruck ? TRUCK_TIRE : CAR_TIRE,
      speedJitter: 0.9 + Math.random() * 0.2,
      x: 0,
    });
  }

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
  label.style.cssText =
    'position:absolute;pointer-events:none;display:none;transform:translate(-50%,-125%);' +
    'background:rgba(10,24,38,0.86);color:#e4eefb;padding:7px 11px;border-radius:14px;' +
    'box-shadow:inset 0 0 0 1px rgba(255,255,255,0.12),0 12px 28px -14px rgba(2,8,20,0.9);' +
    'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);' +
    'font-family:"Plus Jakarta Sans",system-ui,sans-serif;font-weight:600;' +
    'font-size:12px;line-height:1.45;white-space:nowrap;z-index:3';
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
        placeMarker(draggingSensor, [local.x, local.y, local.z]);
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
  let lastVehicleCount = -1;
  let lastScaleAt = -9;
  let lastLabelAt = -9;
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
      .copy(steelColor)
      .lerp(hotColor, mesh.userData.chord ? state.stressRatio * 0.85 : state.stressRatio * 0.25);
  };

  const render = () => {
    frame = requestAnimationFrame(render);
    const now = performance.now() / 1000;
    const visibleCount = state.cars + state.trucks;
    const speedScale = state.paused ? 0 : 1;

    // Susun ulang posisi awal hanya saat jumlah kendaraan berubah, supaya arus
    // tetap merata dan tidak menumpuk di satu titik.
    if (visibleCount !== lastVehicleCount) {
      lastVehicleCount = visibleCount;
      const perLane = [0, 0];
      vehicles.forEach((v, i) => {
        if (i < visibleCount) perLane[v.lane] += 1;
      });
      const index = [0, 0];
      vehicles.forEach((v, i) => {
        if (i < visibleCount) {
          const slot = index[v.lane]++;
          // Sebaran dibuat lebih panjang daripada bentang supaya kendaraan yang
          // kini sepanjang 1,2–2,2 unit tidak tumpang tindih saat arus disusun.
          v.x = -L / 2 - 3 + (slot + Math.random() * 0.25) * ((L + 6) / Math.max(1, perLane[v.lane]));
        }
      });
    }

    vehicles.forEach((v, i) => {
      v.group.visible = i < visibleCount;
      if (!v.group.visible) return;
      const dx = (v.lane ? 1 : -1) * state.speed * speedScale * v.speedJitter * 0.05;
      v.x += dx;
      if (v.x > L / 2 + 9) v.x = -L / 2 - 9;
      if (v.x < -L / 2 - 9) v.x = L / 2 + 9;
      v.group.position.x = v.x;
      v.wheels.forEach((wheel) => {
        wheel.rotation.z -= dx / v.tire;
      });
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
        if (now - lastLabelAt > 0.25) {
          lastLabelAt = now;
          label.innerHTML = callbacks.labelFor(picked);
        }
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
