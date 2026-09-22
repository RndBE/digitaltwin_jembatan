/**
 * API Digital Twin Jembatan.
 *
 * Menyediakan katalog jembatan, telemetri sensor yang dibangkitkan mesin
 * simulasi, riwayat deret waktu, log peringatan, kendali skenario pembebanan,
 * dan autentikasi berbasis JWT.
 */
const express = require('express');
const config = require('./config');
const corsMiddleware = require('./middleware/cors');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const store = require('./store/dataStore');
const routes = require('./routes');

const app = express();

app.use(corsMiddleware);
app.use(express.json());
app.use(logger);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    tickIntervalMs: config.TICK_INTERVAL_MS,
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'Digital Twin Jembatan API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      bridges: 'GET /api/bridges',
      bridge: 'GET /api/bridges/:bridgeId',
      telemetry: 'GET /api/bridges/:bridgeId/telemetry',
      history: 'GET /api/bridges/:bridgeId/history?sensors=vib,strain',
      alerts: 'GET /api/bridges/:bridgeId/alerts?limit=20',
      sensors: 'GET /api/sensors',
      scenarios: 'GET /api/scenarios',
      setScenario: 'POST /api/bridges/:bridgeId/scenario  { "scenario": "overload" }  (perlu token)',
      setPaused: 'POST /api/bridges/:bridgeId/pause  { "paused": true }  (perlu token)',
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      me: 'GET /api/auth/me (perlu token)',
    },
  });
});

app.use(config.API_PREFIX, routes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Rute tidak ditemukan: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

store
  .init()
  .then(() => {
    app.listen(config.PORT, () => {
      console.log(`API Digital Twin Jembatan berjalan di http://localhost:${config.PORT}`);
      console.log(`Akun demo: ${config.SEED_USER_NAME}`);
    });
  })
  .catch((err) => {
    console.error('Gagal menyiapkan penyimpanan:', err);
    process.exit(1);
  });

process.on('SIGINT', () => {
  store.stopTicker();
  process.exit(0);
});

module.exports = app;
