require('dotenv').config();

const path = require('path');

const config = {
  PORT: Number(process.env.PORT) || 5175,
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PREFIX: '/api',

  // Daftar origin yang diizinkan. Kosong berarti "izinkan semua" (mode pengembangan).
  ALLOWED_ORIGINS: (process.env.FRONTEND_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  JWT_SECRET: process.env.JWT_SECRET || 'rahasia-pengembangan-jangan-dipakai-di-produksi',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',

  SEED_USER_EMAIL: process.env.SEED_USER_EMAIL || 'operator@jembatan.id',
  SEED_USER_PASSWORD: process.env.SEED_USER_PASSWORD || 'jembatan123',

  // Mesin simulasi memajukan waktu setiap TICK_INTERVAL_MS milidetik.
  TICK_INTERVAL_MS: Number(process.env.TICK_INTERVAL_MS) || 200,

  // Panjang riwayat deret waktu yang disimpan per sensor di dalam memori.
  HISTORY_LENGTH: 180,

  /*
   * Riwayat yang bertahan di disk.
   *
   * `HISTORY_SAMPLE_MS` menentukan jarak antar cuplikan yang disimpan, bukan
   * jarak antar detak simulasi: satu menit menghasilkan 1.440 baris sehari per
   * jembatan — sekitar 200 kB sebulan — sementara menyimpan tiap detak
   * menghasilkan setengah juta baris sehari untuk menjawab pertanyaan yang
   * tidak pernah ditanyakan.
   */
  HISTORY_DIR: process.env.HISTORY_DIR || path.join(__dirname, '..', 'data', 'history'),
  HISTORY_SAMPLE_MS: Number(process.env.HISTORY_SAMPLE_MS) || 60_000,
  HISTORY_RETENTION_DAYS: Number(process.env.HISTORY_RETENTION_DAYS) || 90,
};

if (config.NODE_ENV === 'production' && config.JWT_SECRET.startsWith('rahasia-pengembangan')) {
  console.warn('[peringatan] JWT_SECRET masih memakai nilai bawaan. Setel JWT_SECRET sebelum dipakai di produksi.');
}

module.exports = config;
