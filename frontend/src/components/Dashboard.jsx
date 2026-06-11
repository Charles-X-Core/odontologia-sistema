import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Tooltip, Legend, Filler);

const FILTROS_FECHA = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta Semana' },
  { value: 'mes', label: 'Este Mes' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'todo', label: 'Todo' },
];

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function filtrarPorFecha(items, filtro) {
  if (filtro === 'todo') return items;
  const ahora = new Date();
  const inicio = new Date();
  switch (filtro) {
    case 'hoy': inicio.setHours(0, 0, 0, 0); break;
    case 'semana': inicio.setDate(ahora.getDate() - ahora.getDay()); inicio.setHours(0, 0, 0, 0); break;
    case 'mes': inicio.setDate(1); inicio.setHours(0, 0, 0, 0); break;
    case 'trimestre': inicio.setMonth(ahora.getMonth() - 3); inicio.setHours(0, 0, 0, 0); break;
  }
  return items.filter(c => new Date(c.fecha) >= inicio);
}

function getUltimosMeses(consultas, numMeses = 6) {
  const ahora = new Date();
  const meses = [];
  for (let i = numMeses - 1; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    meses.push({
      year: fecha.getFullYear(), month: fecha.getMonth(),
      label: MONTHS_SHORT[fecha.getMonth()],
      fullLabel: `${MONTHS_SHORT[fecha.getMonth()]} ${fecha.getFullYear()}`,
      count: 0,
    });
  }
  consultas.forEach(c => {
    const fecha = new Date(c.fecha);
    const mes = meses.find(m => m.year === fecha.getFullYear() && m.month === fecha.getMonth());
    if (mes) mes.count++;
  });
  return meses;
}

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtroFecha, setFiltroFecha] = useState('todo');
  const [waConnected, setWaConnected] = useState(false);

  useEffect(() => {
    cargarDatos();
    api.whatsapp.estado().then(d => setWaConnected(!!d?.connected)).catch(() => {});
  }, []);

  const cargarDatos = async () => {
    try {
      const data = await api.dashboard.stats();
      setStats(data);
    } catch {
      setStats({
        pacientes: 0, consultas: 0, tratamientos: 0,
        tratamientosRealizados: 0, tratamientosPlanificados: 0,
        pagos: { total_general: 0, total_pagado: 0, total_pendiente: 0 },
        ultimasConsultas: [], ingresosMensuales: [], saldosPendientes: [],
      });
    }
    setCargando(false);
  };

  const consultasFiltradas = stats?.ultimasConsultas
    ? filtrarPorFecha(stats.ultimasConsultas, filtroFecha)
    : [];

  const ultimosMeses = useMemo(() => {
    return stats?.ultimasConsultas ? getUltimosMeses(stats.ultimasConsultas, 6) : [];
  }, [stats]);

  // ============================================
  // CHART: Consultas por Mes (barras)
  // ============================================
  const barData = {
    labels: ultimosMeses.map(m => m.label),
    datasets: [{
      label: 'Consultas',
      data: ultimosMeses.map(m => m.count),
      backgroundColor: (ctx) => {
        const chart = ctx.chart;
        const { ctx: canvasCtx, chartArea } = chart;
        if (!chartArea) return 'rgba(67, 97, 238, 0.8)';
        const gradient = canvasCtx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, 'rgba(67, 97, 238, 0.6)');
        gradient.addColorStop(1, 'rgba(67, 97, 238, 0.9)');
        return gradient;
      },
      borderRadius: 8, borderSkipped: false, barThickness: 40,
    }]
  };

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#fff',
        padding: 14, cornerRadius: 10, displayColors: false,
        callbacks: {
          title: (items) => ultimosMeses[items[0].dataIndex]?.fullLabel || '',
          label: (item) => `${item.raw} consulta${item.raw !== 1 ? 's' : ''}`,
        }
      }
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, color: '#9ca3af', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false } },
      x: { ticks: { color: '#6b7280', font: { size: 12, weight: '500' } }, grid: { display: false }, border: { display: false } }
    }
  };

  // ============================================
  // CHART: Ingresos Mensuales (línea)
  // ============================================
  const ingresosMes = stats?.ingresosMensuales || [];
  const lineData = {
    labels: ingresosMes.map(i => { const [, m] = i.mes.split('-'); return MONTHS_SHORT[parseInt(m) - 1]; }),
    datasets: [{
      label: 'Ingresos (S/)',
      data: ingresosMes.map(i => i.total),
      borderColor: '#22c55e',
      backgroundColor: (ctx) => {
        const chart = ctx.chart;
        const { ctx: canvasCtx, chartArea } = chart;
        if (!chartArea) return 'rgba(34,197,94,0.1)';
        const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, 'rgba(34,197,94,0.25)');
        gradient.addColorStop(1, 'rgba(34,197,94,0.02)');
        return gradient;
      },
      fill: true, tension: 0.4, borderWidth: 3,
      pointBackgroundColor: '#22c55e', pointBorderColor: '#fff', pointBorderWidth: 2,
      pointRadius: 5, pointHoverRadius: 7,
    }]
  };

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#fff',
        padding: 14, cornerRadius: 10,
        callbacks: { label: (item) => `S/ ${item.raw.toLocaleString()}` }
      }
    },
    scales: {
      y: { beginAtZero: true, ticks: { color: '#9ca3af', font: { size: 11 }, callback: (v) => `S/${v}` }, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false } },
      x: { ticks: { color: '#6b7280', font: { size: 11, weight: '500' } }, grid: { display: false }, border: { display: false } }
    }
  };

  // ============================================
  // CHART: Estado Tratamientos (doughnut)
  // ============================================
  const realizados = stats?.tratamientosRealizados || 0;
  const planificados = stats?.tratamientosPlanificados || 0;
  const totalDP = realizados + planificados;

  const doughnutData = {
    labels: ['Realizados', 'Planificados'],
    datasets: [{
      data: [realizados, planificados],
      backgroundColor: ['#22c55e', '#3b82f6'],
      borderWidth: 0, spacing: 4, borderRadius: 6,
    }]
  };

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true, pointStyle: 'circle', padding: 20,
          font: { size: 12, weight: '500' },
          generateLabels: (chart) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const val = data.datasets[0].data[i];
                const pct = totalDP > 0 ? Math.round((val / totalDP) * 100) : 0;
                return { text: `${label}: ${val} (${pct}%)`, fillStyle: data.datasets[0].backgroundColor[i], strokeStyle: 'transparent', pointStyle: 'circle', hidden: false, index: i };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#fff',
        padding: 14, cornerRadius: 10,
        callbacks: { label: (item) => { const pct = totalDP > 0 ? Math.round((item.raw / totalDP) * 100) : 0; return `${item.label}: ${item.raw} (${pct}%)`; } }
      }
    }
  };

  if (cargando) {
    return (
      <div className="dashboard">
        <div className="dashboard-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-stats">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton-stat-card"></div>)}</div>
          <div className="skeleton-charts"><div className="skeleton-chart"></div><div className="skeleton-chart"></div></div>
          <div className="skeleton-card"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h2>Dashboard</h2>
          <p className="dashboard-subtitle">Vista general del sistema</p>
        </div>
        <div className="dashboard-quick-actions">
          <button className="quick-action-btn primary" onClick={() => onNavigate('recepcion')}>
            <span className="quick-action-icon">+</span>
            Nueva Consulta
          </button>
          <button className="quick-action-btn" onClick={() => onNavigate('pacientes')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            Buscar Paciente
          </button>
        </div>
      </div>

      {waConnected && (
        <div className="wa-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72"/></svg>
          WhatsApp conectado
          <span className="wa-banner-warning">Evite enviar mas de 20 mensajes por hora</span>
        </div>
      )}

      {/* 6 STAT CARDS */}
      <div className="stats-grid">
        <div className="stat-card clickable" onClick={() => onNavigate('pacientes')}>
          <div className="stat-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.pacientes || 0}</span>
            <span className="stat-label">Pacientes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.consultas || 0}</span>
            <span className="stat-label">Consultas</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.tratamientos || 0}</span>
            <span className="stat-label">Tratamientos</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">S/ {(stats?.pagos?.total_pagado || 0).toLocaleString()}</span>
            <span className="stat-label">Cobrado</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.tratamientosPlanificados || 0}</span>
            <span className="stat-label">Planificados</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.2))', color: '#ef4444'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">S/ {(stats?.pagos?.total_pendiente || 0).toLocaleString()}</span>
            <span className="stat-label">Pendiente</span>
          </div>
        </div>
      </div>

      {/* 4 GRÁFICOS: Consultas/Mes + Ingresos/Mes + Estado Tratamientos + Saldos Pendientes */}
      <div className="dashboard-grid-2col">
        <div className="dashboard-chart-card">
          <div className="dashboard-chart-header">
            <h3>Consultas por Mes</h3>
            <span className="dashboard-chart-badge">
              {ultimosMeses.length > 0 ? `${ultimosMeses[0].label} - ${ultimosMeses[ultimosMeses.length - 1].label}` : 'Sin datos'}
            </span>
          </div>
          <div className="dashboard-chart-body">
            {ultimosMeses.length > 0 && ultimosMeses.some(m => m.count > 0) ? (
              <Bar data={barData} options={barOptions} />
            ) : (
              <div className="chart-empty"><p>No hay datos de consultas</p></div>
            )}
          </div>
        </div>

        <div className="dashboard-chart-card">
          <div className="dashboard-chart-header">
            <h3>Ingresos Mensuales</h3>
            <span className="dashboard-chart-badge">
              {ingresosMes.length > 0 ? `S/ ${ingresosMes.reduce((a, b) => a + b.total, 0).toLocaleString()}` : 'Sin datos'}
            </span>
          </div>
          <div className="dashboard-chart-body">
            {ingresosMes.length > 0 && ingresosMes.some(i => i.total > 0) ? (
              <Line data={lineData} options={lineOptions} />
            ) : (
              <div className="chart-empty"><p>No hay datos de ingresos</p></div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-grid-2col">
        <div className="dashboard-chart-card">
          <div className="dashboard-chart-header">
            <h3>Estado Tratamientos</h3>
            <span className="dashboard-chart-badge">{totalDP} total</span>
          </div>
          <div className="dashboard-chart-body">
            {totalDP > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div className="chart-empty"><p>No hay tratamientos</p></div>
            )}
          </div>
        </div>

        <div className="dashboard-table-card">
          <div className="dashboard-table-header">
            <h3>Saldos Pendientes</h3>
            <span className="dashboard-chart-badge">{stats?.saldosPendientes?.length || 0} pacientes</span>
          </div>
          {(!stats?.saldosPendientes || stats.saldosPendientes.length === 0) ? (
            <div className="empty-state"><p>No hay saldos pendientes</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead><tr><th>Paciente</th><th>DNI</th><th style={{textAlign: 'right'}}>Pendiente</th></tr></thead>
                <tbody>
                  {stats.saldosPendientes.map((p) => (
                    <tr key={p.id} className="clickable-row" onClick={() => onNavigate('pacientes')}>
                      <td><strong>{`${p.apellido_paterno} ${p.apellido_materno} ${p.nombres}`}</strong></td>
                      <td>{p.dni || '-'}</td>
                      <td style={{textAlign: 'right', color: '#ef4444', fontWeight: '600'}}>S/ {p.pendiente.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ÚLTIMAS CONSULTAS */}
      <div className="dashboard-content">
        <div className="dashboard-table-card">
          <div className="dashboard-table-header">
            <h3>Ultimas Consultas</h3>
            <div className="dashboard-filtros">
              {FILTROS_FECHA.map(f => (
                <button key={f.value} className={`filter-btn ${filtroFecha === f.value ? 'active' : ''}`} onClick={() => setFiltroFecha(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {consultasFiltradas.length === 0 ? (
            <div className="empty-state">
              <p>No hay consultas en este periodo</p>
              <button className="empty-state-btn" onClick={() => onNavigate('recepcion')}>Crear primera consulta</button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead><tr><th>Fecha</th><th>Paciente</th><th>Motivo</th><th>Diagnostico</th></tr></thead>
                <tbody>
                  {consultasFiltradas.slice(0, 10).map((c) => (
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
    </div>
  );
}
