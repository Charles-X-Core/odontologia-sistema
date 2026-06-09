const isElectron = window.location.protocol === 'file:' || window.electronAPI?.isElectron;
const ELECTRON_PORT = 18234;
const API_URL = isElectron
  ? `http://localhost:${ELECTRON_PORT}/api`
  : (import.meta.env.VITE_API_URL || `http://localhost:${ELECTRON_PORT}/api`).replace(/\/+$/, '');

function getToken() {
  return localStorage.getItem('token');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${url}`, { ...options, headers });
  const data = await res.json();

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.reload();
    return;
  }

  return data;
}

async function uploadFile(url, formData) {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${url}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  return res.json();
}

export const api = {
  auth: {
    login: (email, password) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (data) =>
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request('/auth/me'),
    listarUsuarios: () => request('/auth'),
    cambiarPassword: (data) => request('/auth/password', { method: 'PUT', body: JSON.stringify(data) }),
    actualizarPerfil: (data) => request('/auth/perfil', { method: 'PUT', body: JSON.stringify(data) }),
  },

  pacientes: {
    listar: () => request('/pacientes'),
    obtener: (id) => request(`/pacientes/${id}`),
    crear: (data) => request('/pacientes', { method: 'POST', body: JSON.stringify(data) }),
    actualizar: (id, data) => request(`/pacientes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    eliminar: (id) => request(`/pacientes/${id}`, { method: 'DELETE' }),
    historial: (id) => request(`/pacientes/${id}/historial`),
    buscar: (q) => request(`/pacientes/buscar?q=${encodeURIComponent(q)}`),
  },

  historias: {
    crear: (data) => request('/historias', { method: 'POST', body: JSON.stringify(data) }),
    obtener: (pacienteId) => request(`/historias/paciente/${pacienteId}`),
    actualizar: (id, data) => request(`/historias/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  consultas: {
    crear: (data) => request('/consultas', { method: 'POST', body: JSON.stringify(data) }),
    obtener: (historiaId) => request(`/consultas/historia/${historiaId}`),
    obtenerPorId: (id) => request(`/consultas/${id}`),
    actualizar: (id, data) => request(`/consultas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    eliminar: (id) => request(`/consultas/${id}`, { method: 'DELETE' }),
  },

  odontogramas: {
    crear: (data) => request('/odontogramas', { method: 'POST', body: JSON.stringify(data) }),
    obtener: (historiaId) => request(`/odontogramas/historia/${historiaId}`),
  },

  tratamientos: {
    crear: (data) => request('/tratamientos', { method: 'POST', body: JSON.stringify(data) }),
    listar: (pacienteId) => request(`/tratamientos/paciente/${pacienteId}`),
    actualizar: (id, data) => request(`/tratamientos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    eliminar: (id) => request(`/tratamientos/${id}`, { method: 'DELETE' }),
  },

  recetas: {
    crear: (data) => request('/recetas', { method: 'POST', body: JSON.stringify(data) }),
    porPaciente: (pacienteId) => request(`/recetas/paciente/${pacienteId}`),
    porConsulta: (consultaId) => request(`/recetas/consulta/${consultaId}`),
    obtener: (id) => request(`/recetas/${id}`),
    eliminar: (id) => request(`/recetas/${id}`, { method: 'DELETE' }),
  },

  imagenes: {
    porPaciente: (pacienteId) => request(`/imagenes/paciente/${pacienteId}`),
    porConsulta: (consultaId) => request(`/imagenes/consulta/${consultaId}`),
    eliminar: (id) => request(`/imagenes/${id}`, { method: 'DELETE' }),
    subir: (formData) => uploadFile('/imagenes/upload', formData),
  },

  necesidades: {
    crear: (data) => request('/necesidades', { method: 'POST', body: JSON.stringify(data) }),
    porConsulta: (consultaId) => request(`/necesidades/consulta/${consultaId}`),
    porPaciente: (pacienteId) => request(`/necesidades/paciente/${pacienteId}`),
  },

  pagos: {
    crear: (data) => request('/pagos', { method: 'POST', body: JSON.stringify(data) }),
    listarPorPaciente: (pacienteId) => request(`/pagos/paciente/${pacienteId}`),
    resumen: (pacienteId) => request(`/pagos/resumen/${pacienteId}`),
    obtener: (id) => request(`/pagos/${id}`),
    actualizar: (id, data) => request(`/pagos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    eliminar: (id) => request(`/pagos/${id}`, { method: 'DELETE' }),
  },

  dashboard: {
    stats: () => request('/dashboard/stats'),
  },

  importacion: {
    preview: (formData) => uploadFile('/importacion/preview', formData),
    previewCompleto: (formData) => uploadFile('/importacion/preview-completo', formData),
    analisis: () => request('/importacion/analisis', { method: 'POST' }),
    pacientes: (formData) => uploadFile('/importacion/pacientes', formData),
    tratamientos: (formData) => uploadFile('/importacion/tratamientos', formData),
    consultas: (formData) => uploadFile('/importacion/consultas', formData),
    pagos: (formData) => uploadFile('/importacion/pagos', formData),
    completo: (formData) => uploadFile('/importacion/completo', formData),
    devReset: (confirmation) => request('/importacion/dev-reset', { method: 'POST', body: JSON.stringify({ confirmation }) }),
  },

  exportacion: {
    completo: (fmt = 'xlsx') => `${API_URL}/exportacion/completo?formato=${fmt}&token=${getToken()}`,
    pacientes: (fmt = 'xlsx') => `${API_URL}/exportacion/pacientes?formato=${fmt}&token=${getToken()}`,
    consultas: (fmt = 'xlsx') => `${API_URL}/exportacion/consultas?formato=${fmt}&token=${getToken()}`,
    tratamientos: (fmt = 'xlsx') => `${API_URL}/exportacion/tratamientos?formato=${fmt}&token=${getToken()}`,
    pagos: (fmt = 'xlsx') => `${API_URL}/exportacion/pagos?formato=${fmt}&token=${getToken()}`,
    recetas: (fmt = 'xlsx') => `${API_URL}/exportacion/recetas?formato=${fmt}&token=${getToken()}`,
    estadisticas: () => request('/exportacion/estadisticas'),
    backupBD: () => `${API_URL}/exportacion/backup-db?token=${getToken()}`,
    importarBD: (formData) => uploadFile('/exportacion/importar-db', formData),
  },

  pdf: {
    receta: (id) => `${API_URL}/pdf/receta/${id}?token=${getToken()}`,
    historia: (id) => `${API_URL}/pdf/historia/${id}?token=${getToken()}`,
    historiaConsulta: (pacienteId, consultaId) => `${API_URL}/pdf/historia/${pacienteId}/consulta/${consultaId}?token=${getToken()}`,
    pago: (id) => `${API_URL}/pdf/pago/${id}?token=${getToken()}`,
    tratamientos: (id) => `${API_URL}/pdf/tratamientos/${id}?token=${getToken()}`,
  },

  whatsapp: {
    enviar: (data) => request('/whatsapp/enviar', { method: 'POST', body: JSON.stringify(data) }),
    enviarSmart: (data) => request('/whatsapp/enviar-smart', { method: 'POST', body: JSON.stringify(data) }),
    enviarLote: (data) => request('/whatsapp/enviar-lote', { method: 'POST', body: JSON.stringify(data) }),
    enviarImagen: (data) => request('/whatsapp/enviar-imagen', { method: 'POST', body: JSON.stringify(data) }),
    enviarPdf: (data) => request('/whatsapp/enviar-pdf', { method: 'POST', body: JSON.stringify(data) }),
    enviarReceta: (data) => request('/whatsapp/enviar-receta', { method: 'POST', body: JSON.stringify(data) }),
    enviarPlan: (data) => request('/whatsapp/enviar-plan', { method: 'POST', body: JSON.stringify(data) }),
    enviarRecordatorio: (data) => request('/whatsapp/enviar-recordatorio', { method: 'POST', body: JSON.stringify(data) }),
    enviarProximaCita: (data) => request('/whatsapp/enviar-proxima-cita', { method: 'POST', body: JSON.stringify(data) }),
    enviarBienvenida: (data) => request('/whatsapp/enviar-bienvenida', { method: 'POST', body: JSON.stringify(data) }),
    enviarSeguimiento: (data) => request('/whatsapp/enviar-seguimiento', { method: 'POST', body: JSON.stringify(data) }),
    preview: (data) => request('/whatsapp/preview', { method: 'POST', body: JSON.stringify(data) }),
    estado: () => request('/whatsapp/estado'),
    historial: () => request('/whatsapp/historial'),
    plantillas: () => request('/whatsapp/plantillas'),
    sugerencias: (pacienteId) => request(`/whatsapp/sugerencias/${pacienteId}`),
    analytics: (params) => request(`/whatsapp/analytics${params ? '?' + new URLSearchParams(params) : ''}`),
    historialPaciente: (pacienteId) => request(`/whatsapp/analytics/${pacienteId}`),
    programar: (data) => request('/whatsapp/programar', { method: 'POST', body: JSON.stringify(data) }),
    cola: () => request('/whatsapp/cola'),
    cancelarCola: (id) => request(`/whatsapp/cola/${id}`, { method: 'DELETE' }),
    filtrarPacientes: (params) => request(`/whatsapp/filtrar-pacientes?${new URLSearchParams(params)}`),
    listarPlantillas: () => request('/whatsapp/plantillas/listar'),
    crearPlantilla: (data) => request('/whatsapp/plantillas', { method: 'POST', body: JSON.stringify(data) }),
    editarPlantilla: (id, data) => request(`/whatsapp/plantillas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    eliminarPlantilla: (id) => request(`/whatsapp/plantillas/${id}`, { method: 'DELETE' }),
    deliveryStatus: (logId) => request(`/whatsapp/delivery-status/${logId}`),
    logout: () => request('/whatsapp/logout', { method: 'POST' }),
    restart: () => request('/whatsapp/restart', { method: 'POST' }),
    getConfig: () => request('/whatsapp/config'),
    saveConfig: (data) => request('/whatsapp/config', { method: 'PUT', body: JSON.stringify(data) }),
  },
};
