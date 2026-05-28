const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/consultaController');

router.post('/', ctrl.crear);
router.get('/historia/:historiaId', ctrl.obtenerPorHistoria);
router.get('/:id', ctrl.obtenerPorId);

module.exports = router;
