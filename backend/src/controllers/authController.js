const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'clinica-odontologica-secret-2026';

exports.register = (req, res) => {
  const { nombre, email, password, rol } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y password son obligatorios' });
  }

  const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (existente) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
  }

  const hash = bcrypt.hashSync(password, 10);

  try {
    const result = db.prepare(`
      INSERT INTO usuarios (nombre, email, password, rol)
      VALUES (?, ?, ?, ?)
    `).run(nombre, email, hash, rol || 'odontologo');

    const token = jwt.sign(
      { id: result.lastInsertRowid, nombre, email, rol: rol || 'odontologo' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      usuario: { id: result.lastInsertRowid, nombre, email, rol: rol || 'odontologo' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Usuario y password son obligatorios' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? OR nombre = ?').get(email, email);
  if (!usuario) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }

  const valid = bcrypt.compareSync(password, usuario.password);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }

  const token = jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
  });
};

exports.me = (req, res) => {
  res.json({ usuario: req.usuario });
};

exports.listar = (req, res) => {
  const usuarios = db.prepare('SELECT id, nombre, email, rol, created_at FROM usuarios ORDER BY created_at DESC').all();
  res.json(usuarios);
};

exports.eliminar = (req, res) => {
  try {
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
