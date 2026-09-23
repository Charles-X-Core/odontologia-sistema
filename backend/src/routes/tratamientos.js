const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tratamientoController');
const { withBootstrapGate } = require('../middleware/bootstrapGate');

router.post('/', ctrl.crear);
router.get('/paciente/:pacienteId', ctrl.listarPorPaciente);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = withBootstrapGate(router);
