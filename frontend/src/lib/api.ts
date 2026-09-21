import type { AuthUser, Bridge, Scenario, Telemetry, AlertEvent } from './types';

/**
 * Klien API.
 *
 * Seluruh fungsi di sini boleh gagal: antarmuka dirancang untuk tetap berjalan
 * dengan mesin simulasi lokal bila server tidak dapat dihubungi. Karena itu
 * `request` melempar galat yang deskriptif dan pemanggilnya memutuskan sendiri
 * apakah akan beralih ke mode lokal.
 */

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'jdt.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // localStorage dapat dilarang (mode privat, kuki diblokir). Anggap belum masuk.
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* diabaikan: sesi hanya bertahan selama halaman terbuka */
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || `Permintaan gagal (${response.status})`);
  }
  return payload.data as T;
}

/**
 * Cek cepat apakah API hidup. Dipakai sekali saat aplikasi dimuat.
 *
 * Sengaja menembak /api/health, bukan /health: peladen pengembangan hanya
 * meneruskan jalur /api, sehingga /health akan dijawab halaman HTML dengan
 * status 200 dan API yang mati akan terbaca hidup. Isi jawaban ikut diperiksa
 * karena alasan yang sama.
 */
export async function ping(timeoutMs = 2500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE}/api/health`, { signal: controller.signal });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    return payload?.success === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  listBridges: () => request<Bridge[]>('/bridges'),
  getTelemetry: (bridgeId: string) => request<Telemetry>(`/bridges/${bridgeId}/telemetry`),
  getAlerts: (bridgeId: string, limit = 20) =>
    request<AlertEvent[]>(`/bridges/${bridgeId}/alerts?limit=${limit}`),
  /**
   * Riwayat deret waktu.
   *
   * Tanpa rentang: penyangga terakhir di memori server — rapat, beberapa
   * menit, untuk bagan pemantauan langsung. Dengan rentang: simpanan di disk
   * yang sudah diringkas per keranjang, untuk pertanyaan yang lebih panjang
   * daripada layar. Keduanya berbagi satu alamat karena keduanya riwayat
   * kanal yang sama; yang membedakan cuma sejauh apa ke belakang.
   */
  getHistory: (bridgeId: string, sensors?: string[]) =>
    request<{ bridgeId: string; series: Array<{ sensorId: string; values: number[]; baseline: number[] }> }>(
      `/bridges/${bridgeId}/history${sensors?.length ? `?sensors=${sensors.join(',')}` : ''}`,
    ),
  getHistoryRange: (
    bridgeId: string,
    opts: { from: number; to: number; bucket?: number; sensors?: string[] },
  ) => {
    const q = new URLSearchParams({ from: String(opts.from), to: String(opts.to) });
    if (opts.bucket) q.set('bucket', String(opts.bucket));
    if (opts.sensors?.length) q.set('sensors', opts.sensors.join(','));
    return request<{
      bridgeId: string;
      from: number;
      to: number;
      bucketMs: number;
      series: Array<{
        sensorId: string;
        name: string;
        unit: string;
        warn: number;
        crit: number;
        points: Array<{ t: number; min: number; avg: number; max: number }>;
      }>;
    }>(`/bridges/${bridgeId}/history?${q.toString()}`);
  },
  listScenarios: () => request<Scenario[]>('/scenarios'),
  setScenario: (bridgeId: string, scenario: string) =>
    request<{ scenario: string; name: string }>(`/bridges/${bridgeId}/scenario`, {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    }),
  setPaused: (bridgeId: string, paused: boolean) =>
    request<{ paused: boolean }>(`/bridges/${bridgeId}/pause`, {
      method: 'POST',
      body: JSON.stringify({ paused }),
    }),
  login: (email: string, password: string) =>
    request<{ user: AuthUser; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, name: string) =>
    request<{ user: AuthUser; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  me: () => request<AuthUser>('/auth/me'),
};
