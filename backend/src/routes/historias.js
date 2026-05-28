const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/historiaController');

router.post('/', ctrl.crear);
router.get('/paciente/:pacienteId', ctrl.obtenerPorPaciente);
router.put('/:id', ctrl.actualizar);

module.exports = router;
