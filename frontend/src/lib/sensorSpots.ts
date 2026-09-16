import { SENSOR_SPOTS } from '../domain/sensors';

/**
 * Letak penanda sensor pada model, disimpan per jembatan.
 *
 * Titik bawaan di `domain/sensors.ts` adalah tebakan yang masuk akal, bukan
 * hasil ukur: pada aset sungguhan, orang yang memasang alatnyalah yang tahu
 * persis di buhul mana kotak itu menempel. Karena itu penanda dapat diseret di
 * model, dan letak barunya disimpan.
 *
 * Simpanannya ada di peramban ini saja — bukan di server, jadi tidak ikut
 * berpindah ke perangkat lain dan hilang bila data situs dibersihkan. Untuk
 * aset sungguhan, letak sensor semestinya menjadi bidang pada katalog jembatan
 * di sisi server; fungsi-fungsi di bawah ini yang diganti, bukan pemanggilnya.
 */

export type Spot = [number, number, number];

const key = (bridgeId: string) => `jembatan-dt:penanda:${bridgeId}`;

const isSpot = (value: unknown): value is Spot =>
  Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number' && Number.isFinite(n));

function read(bridgeId: string): Record<string, Spot> {
  try {
    const raw = window.localStorage.getItem(key(bridgeId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const saved: Record<string, Spot> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([id, value]) => {
      // Hanya kanal yang dikenal dan nilai yang benar-benar tiga angka: isi
      // penyimpanan peramban dapat berubah di luar aplikasi, dan satu nilai
      // cacat di sana tidak boleh menjatuhkan adegan 3D.
      if (id in SENSOR_SPOTS && isSpot(value)) saved[id] = value;
    });
    return saved;
  } catch {
    return {};
  }
}

/** Letak yang dipakai adegan: bawaan, ditimpa oleh yang pernah digeser. */
export function loadSpots(bridgeId: string): Record<string, Spot> {
  return { ...SENSOR_SPOTS, ...read(bridgeId) };
}

export function saveSpot(bridgeId: string, sensorId: string, spot: Spot): void {
  try {
    const saved = read(bridgeId);
    saved[sensorId] = spot;
    window.localStorage.setItem(key(bridgeId), JSON.stringify(saved));
  } catch {
    /* penyimpanan diblokir atau penuh — penanda tetap pindah untuk sesi ini */
  }
}

export function clearSpots(bridgeId: string): void {
  try {
    window.localStorage.removeItem(key(bridgeId));
  } catch {
    /* tidak ada yang bisa dihapus */
  }
}

/** Apakah ada penanda yang pernah digeser pada jembatan ini. */
export function hasCustomSpots(bridgeId: string): boolean {
  return Object.keys(read(bridgeId)).length > 0;
}
