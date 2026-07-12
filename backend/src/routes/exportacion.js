const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ctrl = require('../controllers/exportacionController');

const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch(e) {}
}

const upload = multer({
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

router.get('/completo', ctrl.completo);
router.get('/pacientes', ctrl.pacientes);
router.get('/consultas', ctrl.consultas);
router.get('/tratamientos', ctrl.tratamientos);
router.get('/pagos', ctrl.pagos);
router.get('/recetas', ctrl.recetas);
router.get('/estadisticas', ctrl.estadisticas);
router.get('/backup-db', ctrl.exportarBD);
router.post('/importar-db', (req, res, next) => {
  upload.single('archivo')(req, res, (err) => {
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
