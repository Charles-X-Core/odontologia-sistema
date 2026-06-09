const db = require('../database');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

exports.subir = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envio archivo' });
  }
  const { paciente_id, consulta_id, tipo, descripcion } = req.body;
  if (!paciente_id) {
    return res.status(400).json({ error: 'paciente_id es obligatorio' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO imagenes (paciente_id, consulta_id, archivo_nombre, archivo_original, tipo, descripcion)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(paciente_id, consulta_id || null, req.file.filename, req.file.originalname, tipo || 'foto', descripcion || '');
    res.status(201).json({ id: result.lastInsertRowid, archivo: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.porPaciente = (req, res) => {
  const imagenes = db.prepare('SELECT * FROM imagenes WHERE paciente_id = ? ORDER BY created_at DESC').all(req.params.pacienteId);
  res.json(imagenes);
};

exports.porConsulta = (req, res) => {
  const imagenes = db.prepare('SELECT * FROM imagenes WHERE consulta_id = ? ORDER BY created_at DESC').all(req.params.consultaId);
  res.json(imagenes);
};

exports.eliminar = (req, res) => {
  const img = db.prepare('SELECT * FROM imagenes WHERE id = ?').get(req.params.id);
  if (!img) return res.status(404).json({ error: 'Imagen no encontrada' });
  try {
    const filePath = path.join(UPLOAD_DIR, img.archivo_nombre);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM imagenes WHERE id = ?').run(req.params.id);
    res.json({ message: 'Imagen eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
