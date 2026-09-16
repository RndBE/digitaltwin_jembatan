const store = require('../store/dataStore');
const { signToken } = require('../middleware/auth');

exports.register = async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Surel dan kata sandi wajib diisi' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ success: false, message: 'Kata sandi minimal 8 karakter' });
  }
  const user = await store.createUser({ email, password, name });
  if (!user) {
    return res.status(409).json({ success: false, message: 'Surel sudah terdaftar' });
  }
  res.status(201).json({ success: true, data: { user: store.publicUser(user), token: signToken(user) } });
};

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  const user = store.findUser(email);
  // Pesan galat sengaja sama untuk surel salah maupun kata sandi salah,
  // agar tidak membocorkan surel mana yang terdaftar.
  const invalid = () => res.status(401).json({ success: false, message: 'Surel atau kata sandi salah' });
  if (!user) return invalid();
  const ok = await store.verifyPassword(user, String(password || ''));
  if (!ok) return invalid();
  res.json({ success: true, data: { user: store.publicUser(user), token: signToken(user) } });
};

exports.me = (req, res) => {
  res.json({ success: true, data: req.user });
};
