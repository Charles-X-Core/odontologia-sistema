const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
  },

  pacientes: {
    listar: () => request('/pacientes'),
    obtener: (id) => request(`/pacientes/${id}`),
    crear: (data) => request('/pacientes', { method: 'POST', body: JSON.stringify(data) }),
    actualizar: (id, data) => request(`/pacientes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    eliminar: (id) => request(`/pacientes/${id}`, { method: 'DELETE' }),
    historial: (id) => request(`/pacientes/${id}/historial`),
  },

  historias: {
    obtener: (pacienteId) => request(`/historias/paciente/${pacienteId}`),
    actualizar: (id, data) => request(`/historias/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  consultas: {
    crear: (data) => request('/consultas', { method: 'POST', body: JSON.stringify(data) }),
    obtener: (historiaId) => request(`/consultas/historia/${historiaId}`),
  },

  odontogramas: {
    crear: (data) => request('/odontogramas', { method: 'POST', body: JSON.stringify(data) }),
    obtener: (historiaId) => request(`/odontogramas/historia/${historiaId}`),
  },
};
