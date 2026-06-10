const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pacienteController');

router.post('/', ctrl.crear);
router.get('/', ctrl.listar);
router.get('/buscar', ctrl.buscar);
router.get('/:id', ctrl.obtenerPorId);
router.get('/:id/historial', ctrl.obtenerHistorial);
router.patch('/:id/dni', ctrl.actualizarDni);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
