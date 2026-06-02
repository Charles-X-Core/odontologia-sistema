const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/consultaController');

router.post('/', ctrl.crear);
router.get('/historia/:historiaId', ctrl.obtenerPorHistoria);
router.get('/:id', ctrl.obtenerPorId);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
