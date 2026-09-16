import type { Assessment, Maintenance, Reading, RiskLevel, Status } from '../lib/types';
import { SENSORS, SENSOR_BY_ID, STRUCTURAL_IDS, excessRatio, worstStatus } from './sensors';

/**
 * Penilaian kondisi struktur.
 *
 * Perhitungannya digandakan dari `backend/src/domain/risk.js` supaya antarmuka
 * tetap dapat menilai kondisi ketika API tidak tersedia dan mesin simulasi
 * berjalan di peramban. Seluruhnya bertumpu pada `excessRatio` — sejauh mana
 * sebuah kanal naik di atas kondisi layan normalnya menuju ambang kritis —
 * bukan pada rasio mentah terhadap ambang kritis.
 */

/** Indeks kesehatan 0..100 — 100 berarti seluruh kanal struktural berada di kondisi layan normal. */
export function healthIndex(readings: Reading[]): number {
  const structural = readings.filter((r) => STRUCTURAL_IDS.includes(r.id));
  if (structural.length === 0) return 100;
  const ratios = structural.map((r) => excessRatio(SENSOR_BY_ID[r.id], r.value));
  const worst = Math.max(...ratios);
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  // Kanal terburuk diberi bobot lebih besar: satu elemen yang mendekati ambang
  // sudah cukup menurunkan kondisi keseluruhan walau rata-ratanya masih baik.
  return Math.round(Math.max(0, Math.min(100, (1 - (worst * 0.6 + mean * 0.4)) * 100)));
}

/**
 * Skor risiko 0..100.
 *
 * Suku pertama adalah rata-rata berbobot seluruh kanal — gambaran menyeluruh.
 * Suku kedua adalah kanal struktural terburuk, karena satu batang yang hampir
 * gagal tetap berbahaya walau seluruh kanal lain tenang.
 */
export function riskScore(readings: Reading[]): number {
  let weighted = 0;
  let totalWeight = 0;
  let worst = 0;

  readings.forEach((r) => {
    const sensor = SENSOR_BY_ID[r.id];
    if (!sensor) return;
    const ratio = excessRatio(sensor, r.value);
    if (sensor.weight) {
      weighted += ratio * sensor.weight;
      totalWeight += sensor.weight;
    }
    if (STRUCTURAL_IDS.includes(r.id)) worst = Math.max(worst, ratio);
  });

  const mean = totalWeight > 0 ? weighted / totalWeight : 0;
  return Math.round(Math.max(0, Math.min(100, (mean * 0.55 + worst * 0.45) * 100)));
}

export function riskLevel(score: number): RiskLevel {
  if (score > 75) return 'KRITIS';
  if (score > 50) return 'TINGGI';
  if (score > 25) return 'SEDANG';
  return 'RENDAH';
}

export function maintenanceRecommendation(score: number): Maintenance {
  if (score < 40) {
    return {
      priority: 'RENDAH',
      recommendation: 'Continue routine monitoring',
      timeline: 'Next scheduled inspection: 30 days',
      dueDays: 30,
      items: [
        'Keep to the routine monitoring schedule',
        'Review the weekly data log',
        'No immediate action required',
      ],
    };
  }
  if (score < 75) {
    return {
      priority: 'SEDANG',
      recommendation: 'Schedule a structural inspection within 7 days',
      timeline: 'Action required within: 7 days',
      dueDays: 7,
      items: [
        'Schedule a field inspection within 7 days',
        'Raise the monitoring frequency to daily',
        'Document the sensor anomalies',
        'Notify the maintenance team',
      ],
    };
  }
  return {
    priority: 'KRITIS',
    recommendation: 'Immediate load restriction & emergency inspection',
    timeline: 'Action required: IMMEDIATELY (within 24 hours)',
    dueDays: 1,
    items: [
      'IMMEDIATELY: restrict the load of crossing vehicles',
      'Put emergency traffic management in place',
      'Emergency structural inspection by a specialist team',
      'Report to the responsible authority',
      'Divert heavy traffic if necessary',
    ],
  };
}

/**
 * Batas bawah skor yang dipakai untuk memilih rekomendasi.
 *
 * Satu kanal yang sudah melewati ambang kritis menuntut tindakan segera,
 * berapa pun skor gabungannya: rata-rata berbobot dapat tetap sedang ketika
 * hanya satu kanal yang gagal, dan itu justru keadaan yang tidak boleh
 * diturunkan derajatnya.
 */
function priorityFloor(status: Status): number {
  if (status === 'KRITIS') return 76;
  if (status === 'WASPADA') return 40;
  return 0;
}

/** Rincian kontribusi tiga kanal struktural utama terhadap skor risiko. */
export function riskBreakdown(readings: Reading[]) {
  return ['vib', 'strain', 'defl']
    .map((id) => {
      const reading = readings.find((r) => r.id === id);
      const sensor = SENSOR_BY_ID[id];
      if (!reading || !sensor) return null;
      return {
        id,
        name: sensor.name,
        value: reading.value,
        unit: sensor.unit,
        pct: Number((excessRatio(sensor, reading.value) * 100).toFixed(1)),
        status: reading.status as Status,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export function assess(readings: Reading[]): Assessment {
  const score = riskScore(readings);
  const status = worstStatus(readings);
  return {
    health: healthIndex(readings),
    risk: { score, level: riskLevel(score) },
    status,
    maintenance: maintenanceRecommendation(Math.max(score, priorityFloor(status))),
    breakdown: riskBreakdown(readings),
    sensorCount: SENSORS.length,
  };
}

/** Kelas label untuk tingkat prioritas pemeliharaan. */
export const PRIORITY_CLASS: Record<string, string> = {
  RENDAH: 'tag tag-normal',
  SEDANG: 'tag tag-waspada',
  KRITIS: 'tag tag-bahaya',
};
