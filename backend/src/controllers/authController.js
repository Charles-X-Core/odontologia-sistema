const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'clinica-odontologica-secret-2026';

exports.register = (req, res) => {
  const { nombre, email, password, rol } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y password son obligatorios' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'El password debe tener al menos 6 caracteres' });
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

exports.cambiarPassword = (req, res) => {
  const { password_actual, password_nuevo } = req.body;
  if (!password_actual || !password_nuevo) {
    return res.status(400).json({ error: 'Password actual y nuevo son obligatorios' });
  }
  if (password_nuevo.length < 6) {
    return res.status(400).json({ error: 'El password nuevo debe tener al menos 6 caracteres' });
  }
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const valid = bcrypt.compareSync(password_actual, usuario.password);
  if (!valid) return res.status(401).json({ error: 'El password actual es incorrecto' });
  try {
    const hash = bcrypt.hashSync(password_nuevo, 10);
    db.prepare('UPDATE usuarios SET password = ? WHERE id = ?').run(hash, req.usuario.id);
    res.json({ message: 'Password actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.actualizarPerfil = (req, res) => {
  const { nombre, email, titulo, cmp } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'Nombre es obligatorio' });
  }
  try {
    if (email) {
      const existente = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(email, req.usuario.id);
      if (existente) return res.status(409).json({ error: 'Ya existe otro usuario con ese email' });
    }
    const current = db.prepare('SELECT email FROM usuarios WHERE id = ?').get(req.usuario.id);
    const finalEmail = email || current.email;
    db.prepare('UPDATE usuarios SET nombre = ?, email = ?, titulo = ?, cmp = ? WHERE id = ?')
      .run(nombre, finalEmail, titulo || 'C.D Odontologia', cmp || '', req.usuario.id);
    const usuarioActualizado = db.prepare('SELECT id, nombre, email, rol, titulo, cmp FROM usuarios WHERE id = ?').get(req.usuario.id);
    res.json({ message: 'Perfil actualizado', usuario: usuarioActualizado });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.subirFirma = (req, res) => {
  const { firma_imagen } = req.body;
  if (!firma_imagen) {
    return res.status(400).json({ error: 'firma_imagen es obligatoria (base64)' });
  }
  try {
    db.prepare('UPDATE usuarios SET firma_imagen = ? WHERE id = ?').run(firma_imagen, req.usuario.id);
    res.json({ message: 'Firma guardada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerFirma = (req, res) => {
  try {
    const usuario = db.prepare('SELECT id, firma_imagen FROM usuarios WHERE id = ?').get(req.usuario.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ firma_imagen: usuario.firma_imagen || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.verificarPassword = (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password es obligatorio' });
  }
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const valid = bcrypt.compareSync(password, usuario.password);
  res.json({ valido: valid });
};
