const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/odontogramaController');

router.post('/', ctrl.crear);
router.put('/', ctrl.actualizar);
router.get('/consulta/:consultaId', ctrl.obtenerPorConsulta);
router.get('/historia/:historiaId', ctrl.obtenerHistorial);

module.exports = router;
