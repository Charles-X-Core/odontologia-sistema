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
// C4.2.5.1 decisión: operación ADMINISTRATIVA (C3), NO bootstrapGate.
// No escribe tablas clínicas locales; solo lee el .db temporal.
router.post('/preview-db', auth, upload.single('database'), backupCtrl.previewDb);

// Importar .db viejo a Turso (directo a nube, DEV + auth — C3 requireDevOrReject)
// C4.2.5.1 decisión: ADMIN fuera de bootstrapGate (no toca last_sync_at ni CRUD local).
router.post('/import-db', auth, upload.single('database'), backupCtrl.importDb);

// Exportar backup completo desde Turso (solo lectura)
router.get('/export', auth, backupCtrl.exportBackup);

// Borrar todos los datos en Turso (peligroso) — DEV + URL segura (C3)
// C4.2.5.1 decisión: ADMIN fuera de bootstrapGate (borra remoto, no valida cursor local).
router.post('/clean', auth, backupCtrl.cleanAll);

module.exports = router;
