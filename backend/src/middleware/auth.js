const jwt = require('jsonwebtoken');
const config = require('../config');
const store = require('../store/dataStore');

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRE,
  });
}

/** Menolak permintaan tanpa token yang sah. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const user = store.findUser(payload.email);
    if (!user) return res.status(401).json({ success: false, message: 'Pengguna tidak dikenal' });
    req.user = store.publicUser(user);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token tidak sah atau kedaluwarsa' });
  }
}

module.exports = { signToken, requireAuth };
