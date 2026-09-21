const store = require('../store/dataStore');
const { assess } = require('../domain/risk');
const { SENSORS } = require('../domain/sensors');
const { SCENARIOS, SCENARIO_ORDER, SPEED_LABEL } = require('../domain/scenarios');

/** Ambil simulasi jembatan atau balas 404 dengan pesan yang jelas. */
function resolve(req, res) {
  const bridge = store.BRIDGE_BY_ID[req.params.bridgeId];
  if (!bridge) {
    res.status(404).json({ success: false, message: `Jembatan "${req.params.bridgeId}" tidak ditemukan` });
    return null;
  }
  const sim = store.getSimulation(bridge.id);
  if (!sim) {
    res.status(409).json({
      success: false,
      message: `Jembatan "${bridge.id}" adalah model acuan dan tidak memiliki telemetri`,
    });
    return null;
  }
  return { bridge, sim };
}

exports.listBridges = (req, res) => {
  const data = store.BRIDGES.map((bridge) => {
    const sim = store.getSimulation(bridge.id);
    if (!sim) return { ...bridge, telemetry: null };
    const snapshot = sim.snapshot();
    return { ...bridge, telemetry: { status: assess(snapshot.readings).status, scenario: snapshot.scenario } };
  });
  res.json({ success: true, data });
};

exports.getBridge = (req, res) => {
  const bridge = store.BRIDGE_BY_ID[req.params.bridgeId];
  if (!bridge) return res.status(404).json({ success: false, message: 'Jembatan tidak ditemukan' });
  res.json({ success: true, data: bridge });
};

exports.getTelemetry = (req, res) => {
  const ctx = resolve(req, res);
  if (!ctx) return;
  const snapshot = ctx.sim.snapshot();
  res.json({
    success: true,
    data: {
      ...snapshot,
      assessment: assess(snapshot.readings),
      trafficLabel: {
        count: snapshot.scenario === 'idle' ? '—' : `${snapshot.traffic.cars} mobil, ${snapshot.traffic.trucks} truk`,
        speed: SPEED_LABEL[snapshot.traffic.speedFactor] ?? '—',
      },
    },
  });
};

/**
 * Riwayat deret waktu.
 *
 * Dua bentuk, dipilih oleh ada-tidaknya rentang waktu pada permintaan:
 *
 *   tanpa `from`/`to`  penyangga terakhir di memori — beberapa menit, rapat,
 *                      untuk bagan pemantauan langsung
 *   dengan rentang     simpanan di disk, diringkas per keranjang, untuk
 *                      pertanyaan yang lebih panjang daripada layar
 *
 * Bentuk pertama dipertahankan apa adanya supaya pemanggil lama tidak perlu
 * ikut berubah, dan karena keduanya memang menjawab pertanyaan yang berbeda:
 * yang satu "sedang bagaimana", yang lain "sepanjang bulan ini bagaimana".
 */
exports.getHistory = (req, res) => {
  const ctx = resolve(req, res);
  if (!ctx) return;
  const ids = req.query.sensors
    ? String(req.query.sensors)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : SENSORS.map((s) => s.id);

  if (req.query.from || req.query.to) {
    const from = Number(req.query.from);
    const to = Number(req.query.to);
    if ((req.query.from && !Number.isFinite(from)) || (req.query.to && !Number.isFinite(to))) {
      return res.status(400).json({
        success: false,
        message: '`from` dan `to` harus berupa waktu epoch dalam milidetik',
      });
    }
    const data = store.history.query(ctx.bridge.id, {
      from,
      to,
      bucketMs: Number(req.query.bucket) || 0,
      sensorIds: ids,
    });
    if (!data.series.length) {
      return res.status(400).json({ success: false, message: 'Tidak ada kanal sensor yang cocok' });
    }
    return res.json({ success: true, data });
  }

  const series = ids.map((id) => ctx.sim.history(id)).filter(Boolean);
  if (!series.length) {
    return res.status(400).json({ success: false, message: 'Tidak ada kanal sensor yang cocok' });
  }
  res.json({ success: true, data: { bridgeId: ctx.bridge.id, series } });
};

exports.getAlerts = (req, res) => {
  const ctx = resolve(req, res);
  if (!ctx) return;
  const limit = Math.min(Number(req.query.limit) || 20, 200);
  res.json({ success: true, data: store.getAlerts(ctx.bridge.id, limit) });
};

exports.listScenarios = (req, res) => {
  res.json({
    success: true,
    data: SCENARIO_ORDER.map((key) => SCENARIOS[key]),
  });
};

exports.setScenario = (req, res) => {
  const ctx = resolve(req, res);
  if (!ctx) return;
  const key = req.body?.scenario;
  if (!key || !SCENARIOS[key]) {
    return res.status(400).json({
      success: false,
      message: `Skenario tidak dikenal. Pilihan: idle, ${SCENARIO_ORDER.join(', ')}`,
    });
  }
  ctx.sim.setScenario(key);
  store.recordScenarioChange(ctx.bridge.id, key, SCENARIOS[key].name);
  res.json({ success: true, data: { scenario: key, name: SCENARIOS[key].name } });
};

exports.setPaused = (req, res) => {
  const ctx = resolve(req, res);
  if (!ctx) return;
  const paused = ctx.sim.setPaused(req.body?.paused);
  res.json({ success: true, data: { paused } });
};

exports.recordRepair = (req, res) => {
  const ctx = resolve(req, res);
  if (!ctx) return;
  ctx.sim.recordRepair();
  ctx.sim.setScenario('idle');
  store.pushAlerts(ctx.bridge.id, [
    {
      at: new Date().toISOString(),
      sensorId: null,
      level: 'AMAN',
      text: 'Perbaikan dicatat · sisa kerusakan dibersihkan, struktur kembali ke kondisi layan',
    },
  ]);
  res.json({ success: true, data: { repaired: true } });
};

exports.getSensorCatalog = (req, res) => {
  res.json({ success: true, data: SENSORS });
};
