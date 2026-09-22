const store = require('../store/dataStore');
const { signToken } = require('../middleware/auth');

exports.register = async (req, res) => {
  const { username, password, name } = req.body || {};
  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, message: 'Nama pengguna dan kata sandi wajib diisi' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ success: false, message: 'Kata sandi minimal 8 karakter' });
  }
  const user = await store.createUser({ username, password, name });
  if (!user) {
    return res.status(409).json({ success: false, message: 'Nama pengguna sudah dipakai' });
  }
  res.status(201).json({ success: true, data: { user: store.publicUser(user), token: signToken(user) } });
};

exports.login = async (req, res) => {
  const { username, password } = req.body || {};
  const user = store.findUser(username);
  // Pesan galat sengaja sama untuk nama pengguna salah maupun kata sandi salah,
  // agar tidak membocorkan nama mana yang terdaftar.
  const invalid = () =>
    res.status(401).json({ success: false, message: 'Nama pengguna atau kata sandi salah' });
  if (!user) return invalid();
  const ok = await store.verifyPassword(user, String(password || ''));
  if (!ok) return invalid();
  res.json({ success: true, data: { user: store.publicUser(user), token: signToken(user) } });
};

exports.me = (req, res) => {
  res.json({ success: true, data: req.user });
};
