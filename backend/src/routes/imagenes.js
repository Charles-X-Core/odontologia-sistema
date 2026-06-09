const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/imagenController');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

router.post('/upload', upload.single('archivo'), ctrl.subir);
router.post('/qr-upload', ctrl.generarQR);
router.post('/upload-movil', upload.single('archivo'), ctrl.subirMovil);
router.post('/verificar-token-movil', ctrl.verificarTokenMovil);
router.get('/paciente/:pacienteId', ctrl.porPaciente);
router.get('/consulta/:consultaId', ctrl.porConsulta);
router.get('/file/:filename(*)', ctrl.servir);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
