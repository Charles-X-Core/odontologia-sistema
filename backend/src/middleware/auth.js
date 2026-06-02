const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'clinica-odontologica-secret-2026';

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  const tokenFromQuery = req.query.token;

  if ((!header || !header.startsWith('Bearer ')) && !tokenFromQuery) {
    return res.status(401).json({ error: 'Token de autenticacion requerido' });
  }

  const token = header ? header.split(' ')[1] : tokenFromQuery;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta accion' });
    }
    next();
  };
};

module.exports = { auth, requireRole };
