import type { AlertEvent } from '../lib/types';

/**
 * Siklus hidup alarm.
 *
 * Log kejadian mencatat bahwa sesuatu terjadi. Yang tidak dicatatnya —
 * dan yang justru ditanyakan pertama kali keesokan paginya — adalah apakah
 * sudah ada yang **melihatnya**. Tanpa jawaban itu, kejadian pukul dua pagi
 * yang sudah ditangani petugas jaga tampak persis sama dengan kejadian yang
 * berkedip semalaman tanpa seorang pun membukanya.
 *
 * Empat keadaan, dan urutannya searah:
 *
 *   baru      alarm lahir dari perpindahan status kanal, belum disentuh
 *   diakui    seseorang menyatakan sudah melihatnya — jam dan namanya dicatat
 *   ditangani ada yang sedang mengerjakannya, dengan nama pemiliknya
 *   ditutup   selesai, dengan catatan tindakan yang wajib diisi
 *
 * "Diakui" bukan "selesai", dan pemisahan itu disengaja. Mengakui memerlukan
 * satu klik dan berarti "saya tahu"; menutup memerlukan kalimat dan berarti
 * "sudah saya kerjakan, dan ini yang saya kerjakan". Sistem yang hanya punya
 * satu tombol memaksa keduanya menjadi hal yang sama, dan yang menang selalu
 * yang lebih murah — semua alarm ditutup tanpa satu pun dikerjakan.
 *
 * Yang tidak ada di sini: **jejaknya tidak dapat dihapus**. Menutup alarm
 * menambah baris, membuka kembali menambah baris lagi. Riwayat yang dapat
 * disunting tidak dapat dipakai menjawab pertanyaan yang justru membuatnya
 * ditulis — siapa yang tahu, sejak kapan.
 *
 * Simpanannya di peramban, bukan di server. Itu keterbatasan yang disadari:
 * pengakuan yang dibuat di komputer ruang monitor tidak terlihat dari ponsel
 * pengawas, dan hilang bila data peramban dibersihkan. Hari layanan alarm
 * pindah ke server, modul inilah yang diganti — pemanggilnya hanya memakai
 * fungsi yang diekspor di bawah.
 */

export type AlarmStatus = 'baru' | 'diakui' | 'ditangani' | 'ditutup';

export const ALARM_LABEL: Record<AlarmStatus, string> = {
  baru: 'BELUM DIAKUI',
  diakui: 'DIAKUI',
  ditangani: 'DITANGANI',
  ditutup: 'DITUTUP',
};

export const ALARM_CLASS: Record<AlarmStatus, string> = {
  baru: 'tag tag-bahaya',
  diakui: 'tag tag-waspada',
  ditangani: 'tag tag-brand',
  ditutup: 'tag tag-neutral',
};

export interface AlarmJejak {
  at: string;
  aksi: 'akui' | 'tugaskan' | 'tutup' | 'buka';
  oleh: string;
  catatan?: string;
}

export interface AlarmState {
  status: AlarmStatus;
  /** Siapa yang sedang memegangnya, bila sudah ditugaskan. */
  pemilik?: string;
  jejak: AlarmJejak[];
}

const KUNCI = 'jdt.alarm';
const KUNCI_PETUGAS = 'jdt.petugas';

/** Kejadian bertingkat AMAN adalah kabar, bukan alarm; ia tidak perlu ditutup. */
export function perluTindakan(event: AlertEvent): boolean {
  return event.level !== 'AMAN';
}

/**
 * Pengenal sebuah kejadian.
 *
 * Log tidak membawa nomor, jadi dipakai jam pencatatan beserta kanalnya. Dua
 * kanal boleh berpindah status pada cuplikan yang sama, dan keduanya memang
 * dua alarm yang berbeda; satu kanal tidak dapat berpindah status dua kali
 * pada cuplikan yang sama.
 */
export function idAlarm(event: AlertEvent): string {
  return `${event.at}|${event.sensorId ?? 'sistem'}`;
}

let versi = 0;
const pendengar = new Set<() => void>();

function umumkan(): void {
  versi += 1;
  pendengar.forEach((f) => f());
}

/** Untuk `useSyncExternalStore`: berlangganan dan membaca nomor versinya. */
export function langganAlarm(f: () => void): () => void {
  pendengar.add(f);
  return () => {
    pendengar.delete(f);
  };
}

export function versiAlarm(): number {
  return versi;
}

function baca(): Record<string, AlarmState> {
  try {
    const mentah = localStorage.getItem(KUNCI);
    if (!mentah) return {};
    const isi = JSON.parse(mentah) as Record<string, AlarmState>;
    return isi && typeof isi === 'object' ? isi : {};
  } catch {
    // Penyimpanan dapat dilarang, atau isinya rusak. Alarm tetap tampil,
    // hanya seluruhnya kembali berstatus "belum diakui".
    return {};
  }
}

/**
 * Berapa alarm yang keadaannya disimpan.
 *
 * Pengenal alarm memuat jam kejadiannya, jadi tiap kali mesin simulasi mulai
 * ulang seluruh alarm lama menjadi yatim — tidak ada lagi barisnya di log,
 * tetapi keadaannya masih tersimpan. Batas ini yang menjaga penyimpanan
 * peramban tidak tumbuh selamanya; yang dibuang selalu yang paling tua,
 * karena pengenalnya diawali jam dan karena itu dapat diurut sebagai teks.
 */
const MAKS_SIMPANAN = 500;

function tulis(isi: Record<string, AlarmState>): void {
  try {
    const kunci = Object.keys(isi);
    if (kunci.length > MAKS_SIMPANAN) {
      kunci
        .sort()
        .slice(0, kunci.length - MAKS_SIMPANAN)
        .forEach((k) => delete isi[k]);
    }
    localStorage.setItem(KUNCI, JSON.stringify(isi));
  } catch {
    /* diabaikan: pengakuan hanya bertahan selama halaman terbuka */
  }
}

/**
 * Nama petugas yang sedang bertugas.
 *
 * Sampai ada layar masuk, nama ini diketik sendiri dan disimpan di peramban.
 * Ia **bukan identitas terverifikasi**, dan layar yang menampilkannya harus
 * mengatakan begitu — sebuah nama yang dapat diketik siapa saja tidak boleh
 * dibaca sebagai bukti siapa yang mengakui. Begitu autentikasi ada, fungsi
 * inilah yang membaca pengguna yang masuk.
 */
export function petugas(): string {
  try {
    return localStorage.getItem(KUNCI_PETUGAS) || 'Operator';
  } catch {
    return 'Operator';
  }
}

export function setPetugas(nama: string): void {
  try {
    localStorage.setItem(KUNCI_PETUGAS, nama.trim() || 'Operator');
  } catch {
    /* diabaikan */
  }
  umumkan();
}

const BARU: AlarmState = { status: 'baru', jejak: [] };

/** Keadaan sebuah alarm; kejadian yang belum pernah disentuh berstatus baru. */
export function keadaanAlarm(event: AlertEvent): AlarmState {
  return baca()[idAlarm(event)] ?? BARU;
}

function catat(event: AlertEvent, jejak: AlarmJejak, status: AlarmStatus, pemilik?: string): void {
  const semua = baca();
  const id = idAlarm(event);
  const sebelumnya = semua[id] ?? BARU;
  semua[id] = {
    status,
    pemilik: pemilik ?? sebelumnya.pemilik,
    jejak: [...sebelumnya.jejak, jejak],
  };
  tulis(semua);
  umumkan();
}

export function akui(event: AlertEvent, oleh = petugas()): void {
  if (keadaanAlarm(event).status !== 'baru') return;
  catat(event, { at: new Date().toISOString(), aksi: 'akui', oleh }, 'diakui');
}

export function tugaskan(event: AlertEvent, kepada: string, oleh = petugas()): void {
  const nama = kepada.trim();
  if (!nama) return;
  catat(
    event,
    { at: new Date().toISOString(), aksi: 'tugaskan', oleh, catatan: nama },
    'ditangani',
    nama,
  );
}

/**
 * Tutup alarm. Catatan tindakan wajib.
 *
 * Alarm yang ditutup tanpa keterangan tidak meninggalkan apa pun untuk
 * dibaca tiga bulan kemudian, dan tiga bulan kemudian itulah satu-satunya
 * saat orang membuka riwayat alarm.
 */
export function tutup(event: AlertEvent, catatan: string, oleh = petugas()): boolean {
  const isi = catatan.trim();
  if (!isi) return false;
  catat(event, { at: new Date().toISOString(), aksi: 'tutup', oleh, catatan: isi }, 'ditutup');
  return true;
}

export function bukaKembali(event: AlertEvent, alasan: string, oleh = petugas()): void {
  catat(
    event,
    { at: new Date().toISOString(), aksi: 'buka', oleh, catatan: alasan.trim() || undefined },
    'diakui',
  );
}

export interface AlarmRingkas {
  /** Alarm yang belum diakui siapa pun. */
  baru: number;
  /** Sudah diakui atau sedang ditangani, tetapi belum ditutup. */
  terbuka: number;
  ditutup: number;
  /** Alarm tingkat kritis yang belum ditutup. */
  kritisTerbuka: number;
}

export function ringkasAlarm(events: AlertEvent[]): AlarmRingkas {
  const simpanan = baca();
  const hasil: AlarmRingkas = { baru: 0, terbuka: 0, ditutup: 0, kritisTerbuka: 0 };
  events.filter(perluTindakan).forEach((e) => {
    const status = (simpanan[idAlarm(e)] ?? BARU).status;
    if (status === 'baru') hasil.baru += 1;
    else if (status === 'ditutup') hasil.ditutup += 1;
    else hasil.terbuka += 1;
    if (status !== 'ditutup' && e.level === 'KRITIS') hasil.kritisTerbuka += 1;
  });
  return hasil;
}

/** Jam saja, untuk baris jejak. */
export function jamJejak(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tanggal = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  const jam = d
    .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    .replace('.', ':');
  return `${tanggal} ${jam}`;
}

export const JEJAK_KATA: Record<AlarmJejak['aksi'], string> = {
  akui: 'diakui',
  tugaskan: 'ditugaskan kepada',
  tutup: 'ditutup',
  buka: 'dibuka kembali',
};
