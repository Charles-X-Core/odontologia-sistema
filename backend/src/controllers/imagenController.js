const db = require('../db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const os = require('os');

const BASE_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
const JWT_SECRET = process.env.JWT_SECRET || 'clinica-odontologica-secret-2026';

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

/**
 * C4.3 serverless: el mkdir de arranque NUNCA debe tumbar el require.
 * En Vercel (/var/task read-only) este mkdir lanzaba ENOENT y dejaba
 * /api/imagenes sin montar. Los handlers siguen fallando en runtime si el
 * FS no es escribible (requiere UPLOAD_DIR en /tmp solo-temporal o
 * almacenamiento externo — decisión fuera de C4.3, sin cambio clínico).
 */
if (!fs.existsSync(BASE_DIR)) {
  try {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  } catch {
    /* boot serverless: sin FS escribible; se reporta en runtime por handler */
  }
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

exports.subir = async (req, res) => {
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

    const result = await db.prepare(`
      INSERT INTO imagenes (paciente_id, consulta_id, archivo_nombre, archivo_original, tipo, descripcion, hash_sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(paciente_id, consulta_id || null, archivoNombre, req.file.originalname, tipoStr, descripcion || '', hash);

    res.status(201).json({ id: result.lastInsertRowid, archivo: archivoNombre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.porPaciente = async (req, res) => {
  const imagenes = await db.prepare('SELECT * FROM imagenes WHERE paciente_id = ? ORDER BY created_at DESC').all(req.params.pacienteId);
  res.json(imagenes);
};

exports.porConsulta = async (req, res) => {
  const imagenes = await db.prepare('SELECT * FROM imagenes WHERE consulta_id = ? ORDER BY created_at DESC').all(req.params.consultaId);
  res.json(imagenes);
};

exports.eliminar = async (req, res) => {
  const img = await db.prepare('SELECT * FROM imagenes WHERE id = ?').get(req.params.id);
  if (!img) return res.status(404).json({ error: 'Imagen no encontrada' });
  try {
    const filePath = path.join(BASE_DIR, img.archivo_nombre);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.prepare('DELETE FROM imagenes WHERE id = ?').run(req.params.id);
    res.json({ message: 'Imagen eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.servir = async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(BASE_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Imagen no encontrada' });
  res.sendFile(filePath);
};

exports.verificarTokenMovil = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token es obligatorio' });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'upload_movil') {
      return res.status(401).json({ error: 'Token invalido' });
    }
    if (decoded.used) {
      return res.status(401).json({ error: 'Token ya utilizado. Solicite uno nuevo.' });
    }

    const paciente = await db.prepare('SELECT id, nombres, apellido_paterno, apellido_materno FROM pacientes WHERE id = ?').get(decoded.paciente_id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const nombre = `${paciente.apellido_paterno || ''} ${paciente.apellido_materno || ''} ${paciente.nombres || ''}`.trim();
    res.json({ ok: true, paciente: nombre });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado. Solicite uno nuevo.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalido' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.generarQR = async (req, res) => {
  try {
    const { paciente_id } = req.body;
    if (!paciente_id) return res.status(400).json({ error: 'paciente_id es obligatorio' });

    const paciente = await db.prepare('SELECT id, nombres, apellido_paterno, apellido_materno FROM pacientes WHERE id = ?').get(paciente_id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const token = jwt.sign(
      { type: 'upload_movil', paciente_id: parseInt(paciente_id), used: false },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const localIP = getLocalIP();
    const uploadUrl = `http://${localIP}:18234/upload?token=${token}`;

    const qrDataUrl = await QRCode.toDataURL(uploadUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });

    res.json({
      qr: qrDataUrl,
      url: uploadUrl,
      paciente: `${paciente.apellido_paterno || ''} ${paciente.apellido_materno || ''} ${paciente.nombres || ''}`.trim(),
      expira_en: '15 minutos'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.subirMovil = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envio archivo' });

  const { token, tipo, descripcion } = req.body;
  if (!token) return res.status(400).json({ error: 'token es obligatorio' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'upload_movil' || decoded.used) {
      return res.status(401).json({ error: 'Token invalido o ya utilizado' });
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
    const secStr = String(now.getSeconds()).padStart(2, '0');
    const msStr = String(now.getMilliseconds()).padStart(3, '0');
    const tipoStr = tipo || 'foto';
    const ext = path.extname(req.file.originalname);
    const readableName = `${dateStr}_${timeStr}-${secStr}-${msStr}_${tipoStr}${ext}`;

    const pacienteDir = path.join(BASE_DIR, 'evidencias', String(decoded.paciente_id));
    const consultaDir = path.join(pacienteDir, 'general');
    if (!fs.existsSync(consultaDir)) fs.mkdirSync(consultaDir, { recursive: true });
    const finalPath = path.join(consultaDir, readableName);

    fs.writeFileSync(finalPath, req.file.buffer);

    const hash = computeHash(finalPath);
    const archivoNombre = path.relative(BASE_DIR, finalPath).replace(/\\/g, '/');

    const result = await db.prepare(`
      INSERT INTO imagenes (paciente_id, consulta_id, archivo_nombre, archivo_original, tipo, descripcion, hash_sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(decoded.paciente_id, null, archivoNombre, req.file.originalname, tipoStr, descripcion || '', hash);

    jwt.sign(
      { type: 'upload_movil', paciente_id: decoded.paciente_id, used: true },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      archivo: archivoNombre,
      mensaje: 'Imagen subida correctamente'
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado. Solicite uno nuevo.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalido' });
    }
    res.status(500).json({ error: err.message });
  }
};
