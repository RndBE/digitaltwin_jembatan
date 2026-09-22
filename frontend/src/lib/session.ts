import type { AuthUser } from './types';
import { api, getToken, setToken, setOnUnauthorized } from './api';

/**
 * Sesi pengguna.
 *
 * Dua jalur masuk, satu bentuk sesi:
 *
 * - **Mode API** — surel dan kata sandi dikirim ke `/api/auth/login`, server
 *   yang memeriksanya, dan yang disimpan peramban adalah JWT terbitannya.
 *   Token itu pula yang dibawa tiap permintaan yang mengubah keadaan, jadi
 *   sesi di sini benar-benar menentukan apa yang boleh dilakukan.
 *
 * - **Mode peraga** — tidak ada server yang dapat ditanya, jadi pemeriksaannya
 *   terjadi di peramban terhadap satu akun contoh.
 *
 *   Ini **bukan pengamanan**: seluruh kodenya ada di peramban, dan siapa pun
 *   yang membuka alat pengembang dapat melewatinya. Gunanya cuma satu —
 *   layar masuk yang sama tetap ada di mode peraga sehingga alurnya dapat
 *   diperagakan. Data yang ditampilkannya pun data karangan. Jangan pernah
 *   memasang mode peraga di atas data sungguhan.
 */

const KUNCI_PENGGUNA = 'jdt.user';

/** Akun contoh mode peraga — sama dengan akun benih di `backend/src/config.js`. */
const AKUN_PERAGA = {
  username: 'admin',
  password: 'be_jogja',
  user: {
    id: 'usr-demo',
    username: 'admin',
    name: 'Administrator',
    role: 'admin',
  } as AuthUser,
};

let pengguna: AuthUser | null = bacaPengguna();
const pendengar = new Set<() => void>();

function umumkan(): void {
  pendengar.forEach((fn) => fn());
}

function bacaPengguna(): AuthUser | null {
  try {
    const mentah = localStorage.getItem(KUNCI_PENGGUNA);
    if (!mentah) return null;
    const isi = JSON.parse(mentah) as AuthUser;
    return isi && typeof isi.username === 'string' ? isi : null;
  } catch {
    // Penyimpanan dilarang atau isinya rusak: anggap belum masuk.
    return null;
  }
}

function tulisPengguna(isi: AuthUser | null): void {
  try {
    if (isi) localStorage.setItem(KUNCI_PENGGUNA, JSON.stringify(isi));
    else localStorage.removeItem(KUNCI_PENGGUNA);
  } catch {
    /* diabaikan: sesi hanya bertahan selama halaman terbuka */
  }
}

export function langganSesi(fn: () => void): () => void {
  pendengar.add(fn);
  return () => {
    pendengar.delete(fn);
  };
}

export function sesiKini(): AuthUser | null {
  return pengguna;
}

function pasangSesi(isi: AuthUser | null, token: string | null): void {
  pengguna = isi;
  tulisPengguna(isi);
  setToken(token);
  umumkan();
}

/**
 * Memulihkan sesi saat halaman dimuat.
 *
 * Di mode API, token yang tersimpan tidak dipercaya begitu saja: ia ditanyakan
 * ke `/auth/me`, karena token dapat kedaluwarsa atau penggunanya dihapus
 * sementara halaman ditutup. Yang ditolak server dibuang di sini, bukan nanti
 * ketika pengguna menekan tombol yang membutuhkannya.
 */
export async function pulihkanSesi(modePeraga: boolean): Promise<AuthUser | null> {
  if (modePeraga) return pengguna;

  const token = getToken();
  if (!token) {
    if (pengguna) pasangSesi(null, null);
    return null;
  }
  try {
    const profil = await api.me();
    pasangSesi(profil, token);
    return profil;
  } catch {
    pasangSesi(null, null);
    return null;
  }
}

export async function masuk(
  username: string,
  password: string,
  modePeraga: boolean,
): Promise<AuthUser> {
  const nama = username.trim().toLowerCase();

  if (modePeraga) {
    // ponytail: pemeriksaan di peramban, hanya untuk peragaan — lihat catatan
    // di kepala berkas. Mode API yang memeriksanya sungguhan.
    if (nama !== AKUN_PERAGA.username || password !== AKUN_PERAGA.password) {
      throw new Error('Nama pengguna atau kata sandi salah');
    }
    pasangSesi(AKUN_PERAGA.user, null);
    return AKUN_PERAGA.user;
  }

  const { user, token } = await api.login(nama, password);
  pasangSesi(user, token);
  return user;
}

export function keluar(): void {
  pasangSesi(null, null);
}

// Token yang ditolak server berarti sesinya sudah habis: dibuang di satu
// tempat, bukan di tiap pemanggil yang kebetulan menerima 401.
setOnUnauthorized(() => {
  if (pengguna) pasangSesi(null, null);
});
