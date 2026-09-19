const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/citaController');

router.get('/hoy', ctrl.hoy);
router.get('/proximas', ctrl.proximas);
router.get('/pendientes-procesar', ctrl.pendientesProcesar);
router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', ctrl.crear);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);
router.put('/:id/confirmar', ctrl.confirmar);
router.post('/:id/asistio', ctrl.asistio);
router.get('/:id/preparar-sesion', ctrl.prepararSesion);
router.post('/:id/completar', ctrl.completar);

module.exports = router;
