/** Penangan galat terakhir: selalu membalas JSON dengan bentuk yang sama. */
module.exports = function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error('[galat]', err);
  res.status(status).json({
    success: false,
    message: err.expose || status < 500 ? err.message : 'Terjadi kesalahan pada server',
  });
};
