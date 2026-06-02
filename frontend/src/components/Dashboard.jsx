import { useState, useEffect } from 'react';
import { api } from '../services/api';

const FILTROS_FECHA = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta Semana' },
  { value: 'mes', label: 'Este Mes' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'todo', label: 'Todo' },
];

function filtrarPorFecha(items, filtro) {
  if (filtro === 'todo') return items;
  const ahora = new Date();
  const inicio = new Date();
  switch (filtro) {
    case 'hoy':
      inicio.setHours(0, 0, 0, 0);
      break;
    case 'semana':
      inicio.setDate(ahora.getDate() - ahora.getDay());
      inicio.setHours(0, 0, 0, 0);
      break;
    case 'mes':
      inicio.setDate(1);
      inicio.setHours(0, 0, 0, 0);
      break;
    case 'trimestre':
      inicio.setMonth(ahora.getMonth() - 3);
      inicio.setHours(0, 0, 0, 0);
      break;
  }
  return items.filter(c => new Date(c.fecha) >= inicio);
}

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtroFecha, setFiltroFecha] = useState('todo');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const data = await api.dashboard.stats();
      setStats(data);
    } catch {
      setStats({ pacientes: 0, consultas: 0, tratamientos: 0, tratamientosPendientes: 0, tratamientosEnProceso: 0, recetas: 0, pagos: { total_general: 0, total_pagado: 0, total_pendiente: 0 }, ultimasConsultas: [] });
    }
    setCargando(false);
  };

  const consultasFiltradas = stats?.ultimasConsultas ? filtrarPorFecha(stats.ultimasConsultas, filtroFecha) : [];

  if (cargando) return <div className="loading">Cargando...</div>;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Vista general del sistema</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card" onClick={() => onNavigate('pacientes')}>
          <div className="stat-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.pacientes || 0}</span>
            <span className="stat-label">Pacientes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 14l2 2 4-4"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.consultas || 0}</span>
            <span className="stat-label">Consultas</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#92400e' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.tratamientos || 0}</span>
            <span className="stat-label">Tratamientos</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fce7f3', color: '#9d174d' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">${(stats?.pagos?.total_pagado || 0).toLocaleString()}</span>
            <span className="stat-label">Cobrado</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#991b1b' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.tratamientosPendientes || 0}</span>
            <span className="stat-label">Pendientes</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Ultimas Consultas</h3>
          <div className="dashboard-filtros">
            {FILTROS_FECHA.map(f => (
              <button key={f.value} className={`btn btn-sm ${filtroFecha === f.value ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFiltroFecha(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {consultasFiltradas.length === 0 ? (
          <p className="empty">No hay consultas en este periodo</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Motivo</th>
                  <th>Diagnostico</th>
                </tr>
              </thead>
              <tbody>
                {consultasFiltradas.map((c) => (
                  <tr key={c.id}>
                    <td>{new Date(c.fecha).toLocaleDateString()}</td>
                    <td><strong>{c.paciente_nombre}</strong></td>
                    <td>{c.motivo}</td>
                    <td>{c.diagnostico}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
