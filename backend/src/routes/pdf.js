const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pdfController');

router.get('/receta/:id', ctrl.receta);
router.get('/historia/:id', ctrl.historia);
router.get('/pago/:id', ctrl.pago);
router.get('/tratamientos/:id', ctrl.tratamientos);

module.exports = router;
