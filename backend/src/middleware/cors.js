const cors = require('cors');
const config = require('../config');

/**
 * Bila FRONTEND_URL tidak disetel, seluruh origin diizinkan — nyaman untuk
 * pengembangan lokal. Setel FRONTEND_URL di produksi agar daftarnya mengikat.
 */
module.exports = cors({
  origin: config.ALLOWED_ORIGINS.length ? config.ALLOWED_ORIGINS : true,
  credentials: true,
});
