require('dotenv').config();

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

  // Panjang riwayat deret waktu yang disimpan per sensor.
  HISTORY_LENGTH: 180,
};

if (config.NODE_ENV === 'production' && config.JWT_SECRET.startsWith('rahasia-pengembangan')) {
  console.warn('[peringatan] JWT_SECRET masih memakai nilai bawaan. Setel JWT_SECRET sebelum dipakai di produksi.');
}

module.exports = config;
