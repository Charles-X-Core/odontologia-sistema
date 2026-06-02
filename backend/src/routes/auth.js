const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/me', auth, ctrl.me);
router.put('/perfil', auth, ctrl.actualizarPerfil);
router.put('/password', auth, ctrl.cambiarPassword);
router.get('/', auth, ctrl.listar);
router.delete('/:id', auth, ctrl.eliminar);

module.exports = router;
