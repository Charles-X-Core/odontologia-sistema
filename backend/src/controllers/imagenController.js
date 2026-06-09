const db = require('../database');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const BASE_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}

function computeHash(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    return '';
  }
}

function buildImagePath(pacienteId, consultaId, filename) {
  const parts = ['evidencias', String(pacienteId)];
  if (consultaId) parts.push(String(consultaId));
  return path.join(BASE_DIR, ...parts, filename);
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
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
    const secStr = String(now.getSeconds()).padStart(2, '0');
    const msStr = String(now.getMilliseconds()).padStart(3, '0');
    const tipoStr = tipo || 'foto';
    const ext = path.extname(req.file.originalname);
    const readableName = `${dateStr}_${timeStr}-${secStr}-${msStr}_${tipoStr}${ext}`;

    const pacienteDir = path.join(BASE_DIR, 'evidencias', String(paciente_id));
    const consultaDir = path.join(pacienteDir, String(consulta_id || 'general'));
    if (!fs.existsSync(consultaDir)) fs.mkdirSync(consultaDir, { recursive: true });
    const finalPath = path.join(consultaDir, readableName);

    fs.writeFileSync(finalPath, req.file.buffer);

    const hash = computeHash(finalPath);
    const archivoNombre = path.relative(BASE_DIR, finalPath).replace(/\\/g, '/');

    const result = db.prepare(`
      INSERT INTO imagenes (paciente_id, consulta_id, archivo_nombre, archivo_original, tipo, descripcion, hash_sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(paciente_id, consulta_id || null, archivoNombre, req.file.originalname, tipoStr, descripcion || '', hash);

    res.status(201).json({ id: result.lastInsertRowid, archivo: archivoNombre });
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
    const filePath = path.join(BASE_DIR, img.archivo_nombre);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM imagenes WHERE id = ?').run(req.params.id);
    res.json({ message: 'Imagen eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.servir = (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(BASE_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Imagen no encontrada' });
  res.sendFile(filePath);
};
