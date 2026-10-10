import type { Reading } from '../lib/types';
import { dossierFor } from './demoData';
import { susunJadwal, type StatusJadwal } from './jadwal';
import { nilaiTemuan } from './pedoman';
import { daftarTemuan } from './temuan';
import { susunUsulan } from './usulan';

/**
 * Apa yang perlu dilihat dari halaman Pemeriksaan rutin, dalam satu keputusan.
 *
 * Dipakai rel navigasi untuk menyalakan titik penanda. Tiga tingkat, dan
 * urutannya menentukan: usulan tindakan darurat mengalahkan jadwal, karena
 * yang pertama berarti ada yang mungkin tidak aman sekarang sedangkan yang
 * kedua berarti ada pekerjaan administratif yang menunggu.
 *
 *   darurat   ada kanal struktural kritis atau temuan bernilai kondisi ≥ 4
 *   jadwal    pemeriksaan Rutin atau Detail terlambat, atau masuk kriteria
 *             wajib Bab 7.1.1
 *
 * "Mendekati" sengaja tidak menyalakan apa pun: titik yang menyala berbulan-
 * bulan sebelum tenggat mengajari orang untuk mengabaikannya.
 */
export type PenandaRutin =
  | { tingkat: 'darurat'; judul: string }
  | { tingkat: 'jadwal'; judul: string }
  | null;

const MENDESAK: StatusJadwal[] = ['terlambat', 'wajib'];

export function penandaRutin(
  bridgeId: string,
  readings: Reading[] | null,
  hariIni: string = new Date().toISOString().slice(0, 10),
): PenandaRutin {
  const usulan = susunUsulan(readings, nilaiTemuan(daftarTemuan(bridgeId)));
  if (usulan.daruratDisarankan) {
    const elemen = [...new Set(usulan.darurat.map((u) => u.kode))].join(', ');
    return { tingkat: 'darurat', judul: `tindakan darurat disarankan: ${elemen}` };
  }

  const dossier = dossierFor(bridgeId);
  if (!dossier) return null;
  const mendesak = susunJadwal(dossier.inspections, hariIni).filter((b) => MENDESAK.includes(b.status));
  if (mendesak.length === 0) return null;
  return {
    tingkat: 'jadwal',
    judul: `pemeriksaan ${mendesak.map((b) => `${b.jenis} ${b.status === 'terlambat' ? 'terlambat' : 'wajib dijadwalkan'}`).join(', ')}`,
  };
}
