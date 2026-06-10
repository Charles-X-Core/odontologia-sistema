const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { rateLimitLogin } = require('../middleware/rateLimit');

router.post('/register', ctrl.register);
router.post('/login', rateLimitLogin, ctrl.login);
router.get('/me', auth, ctrl.me);
router.put('/perfil', auth, ctrl.actualizarPerfil);
router.put('/password', auth, ctrl.cambiarPassword);
router.put('/firma', auth, ctrl.subirFirma);
router.get('/firma', auth, ctrl.obtenerFirma);
router.post('/verificar-password', auth, ctrl.verificarPassword);
router.get('/', auth, ctrl.listar);
router.delete('/:id', auth, ctrl.eliminar);

module.exports = router;
