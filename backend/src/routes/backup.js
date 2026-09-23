const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth } = require('../middleware/auth');
const backupCtrl = require('../controllers/backupController');

// Configurar multer para archivos .db
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, require('path').join(__dirname, '../../uploads/temp'));
  },
  filename: (req, file, cb) => {
    cb(null, `backup-${Date.now()}.db`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.db') || file.mimetype === 'application/x-sqlite3') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos .db (SQLite)'));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB máximo
});

// Preview del .db viejo (muestra tablas y conteos)
router.post('/preview-db', auth, upload.single('database'), backupCtrl.previewDb);

// Importar .db viejo a Turso
router.post('/import-db', auth, upload.single('database'), backupCtrl.importDb);

// Exportar backup completo desde Turso
router.get('/export', auth, backupCtrl.exportBackup);

// Borrar todos los datos (peligroso)
router.post('/clean', auth, backupCtrl.cleanAll);

module.exports = router;
