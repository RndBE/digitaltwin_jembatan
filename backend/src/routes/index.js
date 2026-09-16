const express = require('express');
const bridge = require('../controllers/bridgeController');
const auth = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// --- kesehatan proses -----------------------------------------------------
// Ada juga di /health di luar prefiks API. Salinan di bawah prefiks inilah
// yang dipakai klien untuk mendeteksi keberadaan server, karena hanya jalur
// /api yang diteruskan oleh proxy peladen pengembangan — memeriksa /health
// lewat proxy akan mengembalikan halaman HTML dan dianggap berhasil meski
// API sebenarnya mati.
router.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', uptimeSeconds: Math.round(process.uptime()) } });
});

// --- katalog ---------------------------------------------------------------
router.get('/bridges', bridge.listBridges);
router.get('/bridges/:bridgeId', bridge.getBridge);
router.get('/sensors', bridge.getSensorCatalog);
router.get('/scenarios', bridge.listScenarios);

// --- telemetri -------------------------------------------------------------
router.get('/bridges/:bridgeId/telemetry', bridge.getTelemetry);
router.get('/bridges/:bridgeId/history', bridge.getHistory);
router.get('/bridges/:bridgeId/alerts', bridge.getAlerts);

// --- kendali simulasi (butuh autentikasi) ----------------------------------
router.post('/bridges/:bridgeId/scenario', requireAuth, bridge.setScenario);
router.post('/bridges/:bridgeId/pause', requireAuth, bridge.setPaused);
router.post('/bridges/:bridgeId/repair', requireAuth, bridge.recordRepair);

// --- autentikasi -----------------------------------------------------------
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', requireAuth, auth.me);

module.exports = router;
