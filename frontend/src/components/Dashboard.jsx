import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState({ pacientes: 0, consultas: 0 });
  const [ultimasConsultas, setUltimasConsultas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const pacientes = await api.pacientes.listar();
    setStats({ pacientes: pacientes.length, consultas: 0 });

    const todas = [];
    for (const p of pacientes.slice(0, 5)) {
      try {
        const h = await api.pacientes.historial(p.id);
        if (h.consultas) {
          h.consultas.forEach(c => {
            todas.push({ ...c, paciente_nombre: p.nombre });
          });
        }
      } catch {}
    }
    todas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    setUltimasConsultas(todas.slice(0, 5));
    setStats(prev => ({ ...prev, consultas: todas.length }));
    setCargando(false);
  };

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
            <span className="stat-value">{stats.pacientes}</span>
            <span className="stat-label">Pacientes Registrados</span>
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
            <span className="stat-value">{stats.consultas}</span>
            <span className="stat-label">Consultas Realizadas</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Ultimas Consultas</h3>
        </div>
        {ultimasConsultas.length === 0 ? (
          <p className="empty">No hay consultas registradas</p>
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
                {ultimasConsultas.map((c) => (
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
