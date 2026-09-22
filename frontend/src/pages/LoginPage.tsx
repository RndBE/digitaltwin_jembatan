import { useState, type FormEvent } from 'react';
import { masuk } from '../lib/session';

/**
 * Layar masuk.
 *
 * Satu kartu di tengah layar, dua isian, satu tombol. Tidak ada tautan daftar
 * akun: akun operator dibuat oleh pengelola sistem, bukan oleh siapa pun yang
 * membuka alamatnya — titik akhir `/auth/register` tetap ada di server untuk
 * keperluan itu.
 *
 * Pesan galatnya sengaja tidak membedakan surel yang tidak terdaftar dari kata
 * sandi yang salah, sama seperti jawaban server, supaya layar ini tidak dapat
 * dipakai menebak surel mana yang ada.
 */

export interface LoginPageProps {
  /** Tidak ada server: pemeriksaan terjadi di peramban terhadap akun contoh. */
  modePeraga: boolean;
}

export function LoginPage({ modePeraga }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function kirim(event: FormEvent) {
    event.preventDefault();
    if (sibuk) return;
    setGalat(null);
    setSibuk(true);
    try {
      await masuk(username, password, modePeraga);
      // Tidak ada yang perlu dikerjakan di sini: kerangka aplikasi mendengarkan
      // sesi dan menggantikan layar ini begitu penggunanya terisi.
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Tidak dapat masuk');
      setSibuk(false);
    }
  }

  return (
    <main className="login-layar">
      <form className="glass card login-kartu" onSubmit={kirim}>
        <img src="/logo_beacon.png" alt="Beacon Engineering" className="login-logo" />

        <div className="stack" style={{ gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#fff' }}>Masuk</h1>
          <p className="text-muted" style={{ margin: 0, fontSize: 12.5 }}>
            Pemantauan Struktur Jembatan
          </p>
        </div>

        <div className="field">
          <label htmlFor="masuk-nama">Nama pengguna</label>
          <input
            id="masuk-nama"
            className="input"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={sibuk}
          />
        </div>

        <div className="field">
          <label htmlFor="masuk-sandi">Kata sandi</label>
          <input
            id="masuk-sandi"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={sibuk}
          />
        </div>

        {galat ? (
          <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--state-bahaya)' }}>
            {galat}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={sibuk}>
          {sibuk ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}
