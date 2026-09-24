const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ctrl = require('../controllers/exportacionController');
const { requireBootstrapIfCloud } = require('../middleware/bootstrapGate');

const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch(e) {}
}

/**
 * C4.3 serverless: multer({ dest }) ejecuta mkdirSync en CONSTRUCCIÓN
 * (multer/storage/disk.js) y tumba el montaje de /api/exportacion en
 * /var/task read-only. Se construye por-request: el boot nunca toca FS.
 * En runtime sin FS escribible la subida falla con 500 explícito
 * (requiere UPLOAD_DIR en /tmp solo-temporal o almacenamiento externo).
 */
function buildUpload() {
  return multer({
    dest: uploadsDir,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.originalname.endsWith('.db') || file.originalname.endsWith('.sqlite') || file.originalname.endsWith('.sqlite3')) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos .db / .sqlite'));
      }
    },
  });
}

router.get('/completo', ctrl.completo);
router.get('/pacientes', ctrl.pacientes);
router.get('/consultas', ctrl.consultas);
router.get('/tratamientos', ctrl.tratamientos);
router.get('/pagos', ctrl.pagos);
router.get('/recetas', ctrl.recetas);
router.get('/estadisticas', ctrl.estadisticas);
router.get('/backup-db', ctrl.exportarBD);
// C4.2.5.1: importar .db escribe tablas clínicas locales.
// Si hay nube y bootstrap pendiente → 409 (no saltar A1/A2).
// Con bootstrap completado o solo-local → opera como siempre (admin, no es CRUD normal).
router.post('/importar-db', requireBootstrapIfCloud, (req, res, next) => {
  let single;
  try {
    single = buildUpload().single('archivo');
  } catch (e) {
    return res.status(500).json({ error: 'Almacenamiento temporal no disponible: ' + e.message });
  }
  single(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'Error al subir archivo: ' + err.message });
      }
      return res.status(400).json({ error: err.message || 'Error al subir archivo' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se envio archivo .db' });
    }
    ctrl.importarBDAnterior(req, res, next);
  });
});

module.exports = router;
