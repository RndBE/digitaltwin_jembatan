import { SCREEN_TITLES, type ScreenKey } from '../components/Sidebar';

/**
 * Alamat tiap layar.
 *
 * Sampai sekarang layar yang sedang dibuka hanya hidup di dalam ingatan
 * aplikasi, dan alamatnya tetap `/` di layar mana pun. Akibatnya tiga hal yang
 * sudah diharapkan orang dari sebuah halaman tidak berlaku: tombol kembali
 * peramban keluar dari aplikasi alih-alih kembali ke layar sebelumnya, tautan
 * yang dikirim ke rekan selalu mendarat di dashboard, dan menyegarkan halaman
 * membuang tempat berdiri yang tadi.
 *
 * Alamatnya **diturunkan dari nama layarnya**, bukan diketik ulang di sini.
 * Yang tertulis di rel navigasi dan yang tertulis di bilah alamat karena itu
 * tidak dapat berselisih — "Digital Twin" selalu menjadi `/digital-twin`, dan
 * hari sebuah layar berganti nama, alamatnya ikut berganti tanpa ada yang
 * perlu diingat. Harganya dibayar di tempat lain: tautan lama ke layar yang
 * namanya berubah tidak lagi dikenali, dan yang membukanya mendarat di
 * dashboard. Untuk aplikasi pemantauan satu aset, nama layar jauh lebih jarang
 * berubah daripada tautan yang salah ketik.
 */

/** Nama layar jadi penggal alamat: huruf kecil, spasi jadi tanda hubung. */
function slug(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const SCREEN_PATHS = Object.fromEntries(
  (Object.keys(SCREEN_TITLES) as ScreenKey[]).map((key) => [key, slug(SCREEN_TITLES[key])]),
) as Record<ScreenKey, string>;

const SCREEN_BY_PATH = Object.fromEntries(
  (Object.keys(SCREEN_PATHS) as ScreenKey[]).map((key) => [SCREEN_PATHS[key], key]),
) as Record<string, ScreenKey>;

/** Layar yang dibuka ketika alamatnya kosong atau tidak dikenali. */
export const DEFAULT_SCREEN: ScreenKey = 'dash';

/**
 * Awalan tempat aplikasi dipasang.
 *
 * Bila kelak dipasang di bawah sub-jalur — `/twin/` di belakang proksi, bukan
 * akar domain — seluruh alamat harus ikut bergeser. Vite sudah menyimpan
 * awalannya, jadi dibaca dari sana alih-alih ditulis ulang.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Alamat penuh sebuah layar, siap dipakai `history.pushState` atau `href`. */
export function pathForScreen(screen: ScreenKey): string {
  return `${BASE}/${SCREEN_PATHS[screen]}`;
}

/** Layar yang ditunjuk sebuah alamat, atau `null` bila tidak ada yang cocok. */
export function screenFromPath(pathname: string): ScreenKey | null {
  const trimmed = pathname.slice(BASE.length).replace(/^\/+|\/+$/g, '');
  return SCREEN_BY_PATH[trimmed] ?? null;
}
