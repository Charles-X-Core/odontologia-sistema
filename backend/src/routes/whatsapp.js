const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/whatsappController');

// Enviar
router.post('/enviar', ctrl.enviar);
router.post('/enviar-smart', ctrl.enviarSmart);
router.post('/enviar-lote', ctrl.enviarLote);
router.post('/enviar-imagen', ctrl.enviarImagen);
router.post('/enviar-pdf', ctrl.enviarPdf);
router.post('/enviar-receta', ctrl.enviarReceta);
router.post('/enviar-plan', ctrl.enviarPlan);
router.post('/enviar-recordatorio', ctrl.enviarRecordatorioPago);
router.post('/enviar-proxima-cita', ctrl.enviarProximaCita);
router.post('/enviar-bienvenida', ctrl.enviarBienvenida);
router.post('/enviar-seguimiento', ctrl.enviarSeguimiento);

// Preview
router.post('/preview', ctrl.preview);

// Smart
router.get('/sugerencias/:paciente_id', ctrl.sugerencias);

// Analytics
router.get('/analytics', ctrl.analytics);
router.get('/analytics/:paciente_id', ctrl.historialPaciente);

// Cola
router.post('/programar', ctrl.programarEnvio);
router.get('/cola', ctrl.cola);
router.delete('/cola/:id', ctrl.cancelarCola);

// Plantillas CRUD
router.get('/plantillas', ctrl.plantillas);
router.get('/plantillas/listar', ctrl.listarPlantillas);
router.post('/plantillas', ctrl.crearPlantilla);
router.put('/plantillas/:id', ctrl.editarPlantilla);
router.delete('/plantillas/:id', ctrl.eliminarPlantilla);

// Batch
router.get('/filtrar-pacientes', ctrl.filtrarPacientes);

// Estado e historial
router.get('/estado', ctrl.estado);
router.get('/historial', ctrl.historial);
router.post('/logout', ctrl.logout);
router.post('/restart', ctrl.restart);

// Configuracion
router.get('/config', ctrl.getConfig);
router.put('/config', ctrl.saveConfig);

// Delivery status
router.post('/ack', ctrl.ack);
router.get('/delivery-status/:logId', ctrl.deliveryStatus);

module.exports = router;
