import { api } from './api';

function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

export const whatsapp = {
  enviar: async (pacienteId, tipo, customMensaje) => {
    return api.whatsapp.enviar({ paciente_id: pacienteId, tipo, mensaje: customMensaje });
  },

  enviarReceta: async (pacienteId, recetaId) => {
    return api.whatsapp.enviarReceta({ paciente_id: pacienteId, receta_id: recetaId });
  },

  enviarPlan: async (pacienteId) => {
    return api.whatsapp.enviarPlan({ paciente_id: pacienteId });
  },

  recordatorioPago: async (pacienteId, saldo) => {
    return api.whatsapp.enviarRecordatorio({ paciente_id: pacienteId, saldo });
  },

  preview: async (pacienteId, tipo) => {
    return api.whatsapp.preview({ paciente_id: pacienteId, tipo });
  },

  estado: async () => {
    return api.whatsapp.estado();
  },
};
