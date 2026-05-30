const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/necesidadController');

router.post('/', ctrl.crear);
router.get('/consulta/:consultaId', ctrl.obtenerPorConsulta);
router.get('/paciente/:pacienteId', ctrl.obtenerPorPaciente);

module.exports = router;
