const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/importacionController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Solo se permiten archivos .xlsx, .xls, .csv'));
  }
});

router.post('/preview', upload.single('archivo'), ctrl.preview);
router.post('/preview-completo', upload.single('archivo'), ctrl.previewCompleto);
router.post('/analisis', ctrl.analisis);
router.post('/pacientes', upload.single('archivo'), ctrl.importarPacientes);
router.post('/tratamientos', upload.single('archivo'), ctrl.importarTratamientos);
router.post('/consultas', upload.single('archivo'), ctrl.importarConsultas);
router.post('/pagos', upload.single('archivo'), ctrl.importarPagos);
router.post('/completo', upload.single('archivo'), ctrl.importarCompleto);
router.post('/dev-reset', ctrl.devReset);

module.exports = router;
