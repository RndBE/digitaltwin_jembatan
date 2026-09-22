import * as THREE from 'three';

/** Detail ilustratif, bukan ukuran fabrikasi atau hasil survei aset. */
export interface StructuralPart {
  id: string;
  name: string;
  group: string;
  location: string;
  description: string;
  details: string[];
  checks: string;
}

export type InspectionView = 'overview' | 'side' | 'deck' | 'under';
export const INSPECTION_VIEWS: { key: InspectionView; label: string }[] = [
  { key: 'overview', label: 'Keseluruhan' },
  { key: 'side', label: 'Sisi rangka' },
  { key: 'deck', label: 'Lantai' },
  { key: 'under', label: 'Bawah lantai' },
];

export type ConnectionProfile = 'lower' | 'upper' | 'upper-start' | 'upper-end';

/** Pelat atas rata dengan sayap atas; pelat ujung dipotong mengikuti batang miring. */
export function createConnectionGeometry(profile: ConnectionProfile = 'lower') {
  const shape = new THREE.Shape();
  let points: number[][];
  let boltPoints: number[][];
  if (profile === 'lower') {
    points = [[-.23, -.20], [.23, -.20], [.29, -.12], [.29, .12], [.17, .26], [-.17, .26], [-.29, .12], [-.29, -.12]];
    boltPoints = [-.20, -.125, .125, .20].flatMap((x) => [-.13, -.045, .045, .13].map((y) => [x, y]));
  } else if (profile === 'upper') {
    points = [[-.27, .068], [.27, .068], [.27, -.065], [.13, -.24], [-.13, -.24], [-.27, -.065]];
    boltPoints = [
      [-.20, .016], [-.12, .016], [.12, .016], [.20, .016],
      [-.17, -.095], [.17, -.095],
      [-.05, -.07], [.05, -.07], [-.05, -.135], [.05, -.135], [-.05, -.20], [.05, -.20],
    ];
  } else {
    // Profil kiri dan kanan dicerminkan, bukan diputar: tepi atas tetap mendatar.
    const mirror = profile === 'upper-end' ? -1 : 1;
    points = [[-.06, .068], [.27, .068], [.27, -.065], [.10, -.24], [-.20, -.24], [-.25, -.20]];
    boltPoints = [
      [.12, .02], [.21, .02], [.12, -.06], [.20, -.06],
      [-.07, -.07], [-.12, -.14], [-.17, -.205],
      [.03, -.07], [.03, -.14], [.03, -.205],
    ];
    points = points.map(([x, y]) => [x * mirror, y]);
    boltPoints = boltPoints.map(([x, y]) => [x * mirror, y]);
  }
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const plate = new THREE.ExtrudeGeometry(shape, {
    depth: .024, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 1, steps: 1,
  });
  plate.translate(0, 0, -.012);
  const bolt = new THREE.CylinderGeometry(.017, .017, .022, 6);
  bolt.rotateX(Math.PI / 2);
  const washer = new THREE.CylinderGeometry(.024, .024, .006, 16);
  washer.rotateX(Math.PI / 2);
  return { plate, bolt, washer, boltPoints, profile };
}

export function createConnection(
  geometry: ReturnType<typeof createConnectionGeometry>,
  material: THREE.MeshStandardMaterial,
  id: string,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.tag = id;
  const plateMaterial = material.clone();
  const fastenerMaterial = material.clone();
  fastenerMaterial.color.set(0x8295a4);
  fastenerMaterial.metalness = .7;
  fastenerMaterial.roughness = .34;
  const fastenerCount = geometry.boltPoints.length * 2;
  const bolts = new THREE.InstancedMesh(geometry.bolt, fastenerMaterial, fastenerCount);
  const washers = new THREE.InstancedMesh(geometry.washer, fastenerMaterial, fastenerCount);
  const matrix = new THREE.Matrix4();
  let index = 0;
  [-1, 1].forEach((face) => {
    const plate = new THREE.Mesh(geometry.plate, plateMaterial);
    plate.position.z = face * .095;
    plate.castShadow = plate.receiveShadow = true;
    group.add(plate);
    geometry.boltPoints.forEach(([x, y]) => {
      matrix.makeTranslation(x, y, face * .111);
      washers.setMatrixAt(index, matrix);
      matrix.makeTranslation(x, y, face * .125);
      bolts.setMatrixAt(index++, matrix);
    });
  });
  [bolts, washers].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    group.add(mesh);
  });
  return group;
}
