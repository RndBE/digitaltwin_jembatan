import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  GLB_VIEW_PRESETS,
  PROVENANCE_COLOR,
  type Confidence,
  type GlbViewMode,
  type PartMetadata,
  type PartsDocument,
} from './mb3dModel';

/**
 * Penampil GLB untuk model kendali bersumber.
 *
 * Tidak ada satu pun bagian berkas ini yang khusus untuk satu jembatan: model,
 * metadata, dan pembingkaian kamera semuanya datang dari berkas konfigurasi.
 * Setiap simpul bagian di dalam GLB membawa kontrak metadata pada `extras`
 * glTF, dan manifes `parts.json` memberi taksonomi serta warna kepercayaan.
 *
 * Diadaptasi dari penampil pada proyek manhattan-bridge-3d (MIT).
 */

export interface GlbViewerHandle {
  setView(mode: GlbViewMode): void;
  setHiddenSystems(systems: Set<string>): void;
  setConfidenceOverlay(on: boolean): void;
  setProvenanceOutlines(on: boolean): void;
  focus(partId: string | null): void;
  reset(): void;
}

export interface GlbViewerProps {
  modelUrl: string;
  doc: PartsDocument | null;
  selectedId: string | null;
  onSelect: (partId: string | null) => void;
  onReady: (handle: GlbViewerHandle | null) => void;
  onError: (message: string) => void;
  background?: string;
}

interface RenderablePart {
  id: string;
  root: THREE.Object3D;
  meshes: Array<THREE.Mesh | THREE.LineSegments>;
  outlines: THREE.LineSegments[];
}

const SELECTION_COLOR = new THREE.Color('#ffffff');
const SELECTION_BOX_COLOR = new THREE.Color('#ffd166');

/** Kumpulkan simpul yang membawa `part_id` beserta seluruh mesh di bawahnya. */
function collectParts(root: THREE.Object3D): RenderablePart[] {
  const parts: RenderablePart[] = [];
  root.traverse((object) => {
    const partId = (object.userData as Partial<PartMetadata>)?.part_id;
    if (!partId) return;
    const meshes: Array<THREE.Mesh | THREE.LineSegments> = [];
    object.traverse((child) => {
      const isRenderable =
        (child as THREE.Mesh).isMesh === true || (child as THREE.LineSegments).isLineSegments === true;
      if (!isRenderable) return;
      const renderable = child as THREE.Mesh | THREE.LineSegments;
      // Pengekspor menyatukan bahan yang bergaya sama, jadi digandakan dulu
      // sebelum diwarnai ulang per bagian.
      const material = renderable.material as THREE.Material | THREE.Material[];
      renderable.material = Array.isArray(material)
        ? material.map((m) => m.clone())
        : material.clone();
      const cloned = renderable.material as THREE.MeshStandardMaterial;
      renderable.userData.baseColor = cloned.color?.clone();
      meshes.push(renderable);
    });
    if (meshes.length > 0) parts.push({ id: partId, root: object, meshes, outlines: [] });
  });
  return parts;
}

export function GlbViewer({
  modelUrl,
  doc,
  selectedId,
  onSelect,
  onReady,
  onError,
  background = '#061420',
}: GlbViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const selectedRef = useRef<string | null>(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !doc) return;

    let disposed = false;
    let animationId = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;touch-action:none';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 60000);
    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 60000);
    let activeCamera: THREE.Camera = camera;

    scene.add(new THREE.HemisphereLight(0xdce9f2, 0x2a2f36, 2.2));
    const key = new THREE.DirectionalLight(0xfff1dd, 2.4);
    key.position.set(1200, 900, 700);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fc0e0, 0.9);
    fill.position.set(-900, 400, -600);
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    /**
     * Berapa satuan dunia yang ditempati satu piksel pada kamera aktif.
     *
     * Dipakai untuk menyetel ambang penembakan sinar terhadap primitif garis.
     * Ambang tetap dalam satuan dunia tidak dapat dipakai di sini: model ini
     * berukuran dua kilometer, sehingga ambang 4 m berarti pembaca harus
     * mengklik tepat pada satu piksel. Ambang yang dihitung dari skala layar
     * memberi toleransi yang sama — beberapa piksel — pada setiap tingkat
     * pembesaran.
     */
    const worldPerPixel = () => {
      const height = host.clientHeight || 1;
      if (activeCamera === orthoCamera) return (orthoCamera.top - orthoCamera.bottom) / height;
      const distance = camera.position.distanceTo(controls.target);
      return (2 * Math.tan(((camera.fov * Math.PI) / 180) / 2) * distance) / height;
    };

    let parts: RenderablePart[] = [];
    let selectionHelper: THREE.Box3Helper | null = null;
    const metadataById = new Map(doc.parts.map((p) => [p.part_id, p]));
    const hiddenSystems = new Set<string>();
    let confidenceOverlay = false;
    let provenanceOutlines = false;

    /** Kotak pembatas model, dari kerangka Z-ke-atas ke kerangka glTF Y-ke-atas. */
    const framingBox = () => {
      const bbox = doc.measures.model_bbox_prototype_m as { min: number[]; max: number[] } | undefined;
      if (!bbox) return null;
      const corners: THREE.Vector3[] = [];
      for (const x of [bbox.min[0], bbox.max[0]]) {
        for (const y of [bbox.min[1], bbox.max[1]]) {
          for (const z of [bbox.min[2], bbox.max[2]]) {
            corners.push(new THREE.Vector3(x, z, -y));
          }
        }
      }
      const center = new THREE.Vector3(
        (bbox.min[0] + bbox.max[0]) / 2,
        (bbox.min[2] + bbox.max[2]) / 2,
        -(bbox.min[1] + bbox.max[1]) / 2,
      );
      return { center, corners };
    };

    /** Pas persis: setiap sudut kotak harus berada di dalam kedua bidang frustum. */
    const fitCamera = (direction: THREE.Vector3, orthographic: boolean, up: THREE.Vector3) => {
      const box = framingBox();
      if (!box) return;
      const dir = direction.clone().normalize();
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();
      if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
      const camUp = new THREE.Vector3().crossVectors(right, dir).normalize();

      if (orthographic) {
        let halfWidth = 0;
        let halfHeight = 0;
        const offset = new THREE.Vector3();
        box.corners.forEach((corner) => {
          offset.copy(corner).sub(box.center);
          halfWidth = Math.max(halfWidth, Math.abs(offset.dot(right)));
          halfHeight = Math.max(halfHeight, Math.abs(offset.dot(camUp)));
        });
        const aspect = (host.clientWidth || 1) / (host.clientHeight || 1);
        const padding = 1.06;
        const width = Math.max(halfWidth, halfHeight * aspect) * padding;
        const height = width / aspect;
        orthoCamera.left = -width;
        orthoCamera.right = width;
        orthoCamera.top = height;
        orthoCamera.bottom = -height;
        orthoCamera.up.copy(camUp);
        orthoCamera.position.copy(box.center).addScaledVector(dir, 6000);
        orthoCamera.lookAt(box.center);
        orthoCamera.updateProjectionMatrix();
        activeCamera = orthoCamera;
        controls.enabled = false;
        return;
      }

      const vFov = (camera.fov * Math.PI) / 180;
      const tanV = Math.tan(vFov / 2);
      const tanH = tanV * camera.aspect;
      let distance = 0;
      const offset = new THREE.Vector3();
      box.corners.forEach((corner) => {
        offset.copy(corner).sub(box.center);
        const depth = offset.dot(dir);
        distance = Math.max(
          distance,
          Math.abs(offset.dot(right)) / tanH + depth,
          Math.abs(offset.dot(camUp)) / tanV + depth,
        );
      });
      distance *= 0.78;
      camera.up.set(0, 1, 0);
      camera.position.copy(box.center).addScaledVector(dir, distance);
      camera.updateProjectionMatrix();
      controls.target.copy(box.center);
      controls.enabled = true;
      controls.update();
      activeCamera = camera;
    };

    const applyVisibility = () => {
      parts.forEach((part) => {
        const meta = metadataById.get(part.id);
        part.root.visible = !(meta && hiddenSystems.has(meta.system));
      });
    };

    const applyColours = () => {
      parts.forEach((part) => {
        const meta = metadataById.get(part.id);
        const isSelected = part.id === selectedRef.current;
        part.meshes.forEach((mesh) => {
          const material = mesh.material as THREE.MeshStandardMaterial;
          if (!material.color) return;
          if (isSelected) {
            material.color.copy(SELECTION_COLOR);
          } else if (confidenceOverlay && meta) {
            material.color.set(doc.confidence_colors[meta.confidence as Confidence] ?? '#888888');
          } else if (mesh.userData.baseColor) {
            material.color.copy(mesh.userData.baseColor as THREE.Color);
          }
        });
        part.outlines.forEach((outline) => {
          outline.visible = provenanceOutlines && part.root.visible;
        });
      });
    };

    /**
     * Garis tepi asal-usul dibangun sekali setelah model dimuat lalu hanya
     * dinyalakan atau dimatikan: `EdgesGeometry` mahal, sedangkan asal-usul
     * sebuah bagian tidak pernah berubah saat aplikasi berjalan.
     */
    const buildOutlines = () => {
      parts.forEach((part) => {
        const meta = metadataById.get(part.id);
        if (!meta) return;
        const color = PROVENANCE_COLOR[meta.geometry_provenance];
        if (!color) return;
        part.meshes.forEach((renderable) => {
          if ((renderable as THREE.Mesh).isMesh !== true) return;
          const mesh = renderable as THREE.Mesh;
          const edges = new THREE.EdgesGeometry(mesh.geometry, 25);
          const dashed = meta.geometry_provenance === 'INFERRED' || meta.geometry_provenance === 'ASSUMED';
          const material = dashed
            ? new THREE.LineDashedMaterial({
                color: new THREE.Color(color),
                dashSize: meta.geometry_provenance === 'ASSUMED' ? 1.2 : 7,
                gapSize: meta.geometry_provenance === 'ASSUMED' ? 3.2 : 4,
                transparent: true,
                opacity: 0.95,
              })
            : new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.85 });
          const outline = new THREE.LineSegments(edges, material);
          // Wajib untuk LineDashedMaterial; tanpa ini garis putus-putus tampil solid.
          outline.computeLineDistances();
          outline.visible = false;
          outline.renderOrder = 2;
          mesh.add(outline);
          part.outlines.push(outline);
        });
      });
    };

    const showSelection = () => {
      if (selectionHelper) {
        scene.remove(selectionHelper);
        selectionHelper.geometry.dispose();
        selectionHelper = null;
      }
      const part = parts.find((p) => p.id === selectedRef.current);
      if (!part) return;
      const box = new THREE.Box3().setFromObject(part.root);
      if (box.isEmpty()) return;
      selectionHelper = new THREE.Box3Helper(box, SELECTION_BOX_COLOR);
      scene.add(selectionHelper);
    };

    // ------------------------------------------------------------ interaksi
    let pressed: { x: number; y: number } | null = null;
    const element = renderer.domElement;

    const onPointerDown = (event: PointerEvent) => {
      pressed = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!pressed) return;
      const moved = Math.abs(event.clientX - pressed.x) > 5 || Math.abs(event.clientY - pressed.y) > 5;
      pressed = null;
      if (moved) return;
      const rect = element.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, activeCamera);
      // Toleransi lima piksel, diterjemahkan ke satuan dunia pada jarak kamera saat ini.
      raycaster.params.Line = { threshold: worldPerPixel() * 5 };
      const targets = parts.filter((p) => p.root.visible).flatMap((p) => p.meshes);
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (!hit) {
        selectRef.current(null);
        return;
      }
      const owner = parts.find((p) => p.meshes.includes(hit.object as THREE.Mesh));
      selectRef.current(owner ? owner.id : null);
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointerup', onPointerUp);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    // ------------------------------------------------------------ pemuatan
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) return;
        scene.add(gltf.scene);
        parts = collectParts(gltf.scene);
        buildOutlines();
        resize();
        frameView('iso');
        applyColours();

        const handle: GlbViewerHandle = {
          setView: (mode) => frameView(mode),
          setHiddenSystems: (systems) => {
            hiddenSystems.clear();
            systems.forEach((s) => hiddenSystems.add(s));
            applyVisibility();
            applyColours();
          },
          setConfidenceOverlay: (on) => {
            confidenceOverlay = on;
            applyColours();
          },
          setProvenanceOutlines: (on) => {
            provenanceOutlines = on;
            applyColours();
          },
          focus: (partId) => {
            selectedRef.current = partId;
            showSelection();
            applyColours();
          },
          reset: () => {
            hiddenSystems.clear();
            applyVisibility();
            frameView('iso');
            applyColours();
          },
        };
        onReady(handle);
      },
      undefined,
      () => {
        if (!disposed) onError('Model 3D gagal dimuat. Pastikan berkas GLB tersedia di folder public.');
      },
    );

    function frameView(mode: GlbViewMode) {
      const preset = GLB_VIEW_PRESETS[mode];
      fitCamera(
        new THREE.Vector3(...preset.direction),
        preset.orthographic,
        new THREE.Vector3(...preset.up),
      );
    }

    const render = () => {
      animationId = requestAnimationFrame(render);
      if (controls.enabled) controls.update();
      renderer.render(scene, activeCamera);
    };
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      onReady(null);
      resizeObserver.disconnect();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl, doc, background]);

  // Perubahan pilihan dari panel samping diteruskan ke adegan lewat handle,
  // yang dipegang halaman; di sini cukup menjaga ref tetap mutakhir.
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="Model kendali tiga dimensi. Seret untuk memutar, gulir untuk memperbesar, klik satu bagian untuk melihat metadatanya."
      style={{
        width: '100%',
        aspectRatio: '16 / 10',
        minHeight: 360,
        background,
        borderRadius: 'var(--radius-glass)',
        overflow: 'hidden',
        boxShadow: '0 24px 60px -22px rgb(2 8 20 / 0.72)',
        position: 'relative',
      }}
    />
  );
}
