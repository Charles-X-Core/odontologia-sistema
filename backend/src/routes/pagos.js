const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pagoController');

router.post('/', ctrl.crear);
router.get('/paciente/:pacienteId', ctrl.listarPorPaciente);
router.get('/resumen/:pacienteId', ctrl.resumenPorPaciente);
router.get('/:id', ctrl.obtenerPorId);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
