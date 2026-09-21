import type { Assessment, Reading } from '../lib/types';
import type { BridgeDossier, NodeInventory } from './demoData';
import { jarakWaktu, pekerjaanBerikutnya, pekerjaanBerjalan, tanggalPendek } from './demoData';
import type { EnvironmentState } from './environment';
import { SENSOR_BY_ID } from './sensors';

/**
 * Papan pengumuman.
 *
 * Log peristiwa mencatat **apa yang berubah**; papan ini menyatakan **apa yang
 * sedang berlaku**. Keduanya tidak dapat saling menggantikan: "regangan S12
 * melewati ambang pukul 14:06" adalah kejadian yang sudah lewat, sedangkan
 * "beban dibatasi 30 ton selama status siaga" adalah keadaan yang masih
 * mengikat petugas di lapangan sampai seseorang mencabutnya.
 *
 * Isinya tidak dikarang terpisah — tiap butir diturunkan dari sesuatu yang
 * sudah ada di aplikasi: penilaian risiko, jadwal pekerjaan pada berkas aset,
 * pembacaan lingkungan, dan inventaris simpul. Papan pengumuman yang isinya
 * tidak tertaut ke data mana pun hanya akan berumur sampai orang pertama
 * memeriksanya.
 */

export type NoticeKind = 'PEMBATASAN' | 'PEKERJAAN' | 'CUACA' | 'JARINGAN';

export interface Notice {
  kind: NoticeKind;
  /** Kapan pengumuman ini mulai berlaku, ditulis sependek mungkin. */
  when: string;
  text: string;
}

export const NOTICE_CLASS: Record<NoticeKind, string> = {
  PEMBATASAN: 'tag tag-bahaya',
  PEKERJAAN: 'tag tag-brand',
  CUACA: 'tag tag-waspada',
  JARINGAN: 'tag tag-neutral',
};

export interface NoticeInput {
  assessment: Assessment;
  dossier: BridgeDossier | null;
  env: EnvironmentState;
  readings: Reading[];
  nodes: NodeInventory;
}

/** Jam saja, untuk pengumuman yang lahir dari cuplikan hari ini. */
const jam = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
};

export function pengumuman({ assessment, dossier, env, readings, nodes }: NoticeInput): Notice[] {
  const list: Notice[] = [];

  /*
   * Pembatasan hanya muncul ketika memang ada yang dibatasi.
   *
   * Papan yang selalu memuat satu baris pembatasan mengajari pembacanya
   * mengabaikan baris itu, dan baris yang diabaikan sama saja dengan baris
   * yang tidak ada — justru pada hari ketika pembatasannya sungguh berlaku.
   */
  if (assessment.status !== 'AMAN') {
    list.push({
      kind: 'PEMBATASAN',
      when: `prioritas ${assessment.maintenance.priority} · ${assessment.maintenance.timeline}`,
      text: assessment.maintenance.recommendation,
    });
  }

  const berjalan = dossier ? pekerjaanBerjalan(dossier) : null;
  const berikutnya = dossier ? pekerjaanBerikutnya(dossier) : null;
  if (berjalan) {
    list.push({
      kind: 'PEKERJAAN',
      when: `mulai ${tanggalPendek(berjalan.date)}`,
      text: `${berjalan.work} sedang berjalan di ${berjalan.element.toLowerCase()}.`,
    });
  } else if (berikutnya) {
    list.push({
      kind: 'PEKERJAAN',
      when: `${tanggalPendek(berikutnya.date)} · ${jarakWaktu(berikutnya.date)}`,
      text: `${berikutnya.work} dijadwalkan pada ${berikutnya.element.toLowerCase()}.`,
    });
  }

  // Cuaca: hujan dan angin dibaca bersama, karena keduanyalah yang menentukan
  // apakah pekerjaan di ketinggian boleh diteruskan sore ini.
  const angin = readings.find((r) => r.id === 'wind');
  const anginSpec = SENSOR_BY_ID.wind;
  const anginKencang = angin && anginSpec ? angin.value >= anginSpec.warn * 0.7 : false;
  if (env.rain >= 2 || anginKencang || env.flood > 0) {
    const bagian: string[] = [];
    if (env.rain >= 2) bagian.push(`hujan ${env.rain.toFixed(1)} mm/jam, ${env.rain3h} mm dalam 3 jam terakhir`);
    if (anginKencang && angin) bagian.push(`angin ${angin.value.toFixed(0)} ${angin.unit}`);
    if (env.flood > 0) bagian.push(`muka air ${env.water.toFixed(2)} m`);
    list.push({
      kind: 'CUACA',
      when: 'berlaku sekarang',
      text: `${bagian.join(' · ')}. Pantau muka air tiap jam dan tunda pekerjaan di ketinggian.`,
    });
  }

  if (nodes.offline.length > 0) {
    const node = nodes.offline[0];
    list.push({
      kind: 'JARINGAN',
      when: `sejak ${tanggalPendek(node.since)} ${jam(node.since)}`,
      text:
        nodes.offline.length === 1
          ? `${node.id} (${node.place}) tidak melapor. ${node.reason}.`
          : `${nodes.offline.length} simpul tidak melapor, termasuk ${node.id} di ${node.place.toLowerCase()}.`,
    });
  }

  if (nodes.lowBattery.length > 0) {
    list.push({
      kind: 'JARINGAN',
      when: 'jadwal kunjungan berikutnya',
      text: `Baterai menipis pada ${nodes.lowBattery
        .map((unit) => `${unit.id} (${unit.battery} %)`)
        .join(', ')}. Bawa penggantinya pada kunjungan berikutnya.`,
    });
  }

  return list;
}
