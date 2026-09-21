/**
 * Penyimpanan dalam memori.
 *
 * Aplikasi ini dirancang agar dapat dijalankan tanpa basis data: satu proses
 * API memegang simulasi tiap jembatan, riwayat peristiwa, dan akun pengguna.
 * Ganti modul ini dengan lapisan basis data bila data perlu bertahan antar
 * proses — seluruh pemanggilnya hanya memakai fungsi yang diekspor di bawah.
 */
const bcrypt = require('bcryptjs');
const config = require('../config');
const { BRIDGES, BRIDGE_BY_ID } = require('../data/bridges');
const { BridgeSimulation } = require('../domain/simulationEngine');
const history = require('./historyStore');

const MAX_ALERTS = 200;

/** @type {Map<string, BridgeSimulation>} */
const simulations = new Map();
/** @type {Map<string, Array>} peringatan per jembatan, terbaru di depan */
const alerts = new Map();
/** @type {Map<string, object>} pengguna, dikunci alamat surel */
const users = new Map();

let ticker = null;

function initSimulations() {
  BRIDGES.filter((b) => !b.reference).forEach((bridge) => {
    simulations.set(bridge.id, new BridgeSimulation(bridge));
    alerts.set(bridge.id, [
      {
        at: new Date().toISOString(),
        sensorId: null,
        level: 'AMAN',
        text: `Sistem pemantauan aktif · ${bridge.sensorCount} sensor daring, sinkron dengan model`,
      },
    ]);
  });
}

function getSimulation(bridgeId) {
  return simulations.get(bridgeId) || null;
}

function pushAlerts(bridgeId, events) {
  if (!events.length) return;
  const list = alerts.get(bridgeId) || [];
  list.unshift(...events);
  alerts.set(bridgeId, list.slice(0, MAX_ALERTS));
}

function getAlerts(bridgeId, limit = 20) {
  return (alerts.get(bridgeId) || []).slice(0, limit);
}

function recordScenarioChange(bridgeId, scenarioKey, scenarioName) {
  pushAlerts(bridgeId, [
    {
      at: new Date().toISOString(),
      sensorId: null,
      level: scenarioKey === 'idle' ? 'AMAN' : 'WASPADA',
      text:
        scenarioKey === 'idle'
          ? 'Simulasi dihentikan · kembali ke pemantauan langsung'
          : `Skenario "${scenarioName}" dijalankan`,
    },
  ]);
}

/** Satu pengatur waktu memajukan seluruh simulasi bersamaan. */
function startTicker() {
  if (ticker) return;
  ticker = setInterval(() => {
    simulations.forEach((sim, bridgeId) => {
      pushAlerts(bridgeId, sim.tick());
      // Cuplikan disimpan ke disk dari sini, bukan dari pengendali: yang
      // menentukan isi riwayat adalah jalannya simulasi, bukan ada-tidaknya
      // orang yang sedang membuka layar.
      history.record(bridgeId, sim.snapshot());
    });
  }, config.TICK_INTERVAL_MS);
  // Pengatur waktu tidak boleh menahan proses tetap hidup saat proses hendak keluar.
  if (typeof ticker.unref === 'function') ticker.unref();
}

function stopTicker() {
  if (!ticker) return;
  clearInterval(ticker);
  ticker = null;
}

// ----------------------------------------------------------------- pengguna

async function createUser({ email, password, name, role = 'operator' }) {
  const key = email.toLowerCase();
  if (users.has(key)) return null;
  const user = {
    id: `usr-${users.size + 1}`,
    email: key,
    name: name || key.split('@')[0],
    role,
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString(),
  };
  users.set(key, user);
  return user;
}

function findUser(email) {
  return users.get(String(email || '').toLowerCase()) || null;
}

function verifyPassword(user, password) {
  return bcrypt.compare(password, user.passwordHash);
}

/** Bentuk pengguna yang aman dikirim ke klien. */
function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function seedDemoUser() {
  if (findUser(config.SEED_USER_EMAIL)) return;
  await createUser({
    email: config.SEED_USER_EMAIL,
    password: config.SEED_USER_PASSWORD,
    name: 'Operator Jembatan',
    role: 'operator',
  });
}

async function init() {
  initSimulations();
  await seedDemoUser();
  const dibuang = history.prune();
  if (dibuang) console.log(`[riwayat] ${dibuang} berkas melewati masa simpan, dibuang`);
  startTicker();
}

module.exports = {
  init,
  stopTicker,
  history,
  getSimulation,
  getAlerts,
  pushAlerts,
  recordScenarioChange,
  createUser,
  findUser,
  verifyPassword,
  publicUser,
  BRIDGES,
  BRIDGE_BY_ID,
};
