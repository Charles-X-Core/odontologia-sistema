const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/recetaController');

router.post('/', ctrl.crear);
router.get('/consulta/:consultaId', ctrl.porConsulta);
router.get('/paciente/:pacienteId', ctrl.porPaciente);
router.get('/:id', ctrl.obtener);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
