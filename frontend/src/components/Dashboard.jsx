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

function getUltimosMeses(consultas, numMeses = 6) {
  const ahora = new Date();
  const meses = [];
  for (let i = numMeses - 1; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    meses.push({
      year: fecha.getFullYear(),
      month: fecha.getMonth(),
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

function getDiasSemana(consultas) {
  const dias = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  const counts = new Array(7).fill(0);
  consultas.forEach(c => {
    const day = new Date(c.fecha).getDay();
    counts[day]++;
  });
  return { labels: dias, counts };
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
        tratamientosRealizados: 0, tratamientosPlanificados: 0, recetas: 0,
        pagos: { total_general: 0, total_pagado: 0, total_pendiente: 0 },
        ultimasConsultas: [], consultasPorDia: [],
        ingresosMensuales: [], saldosPendientes: [], metodosPago: [],
        pacientesNuevos: [], topDiagnosticos: [],
        distribucionEdad: [], porSexo: [],
        saludBucal: { cariados: 0, curados: 0, por_extraer: 0, extraidos: 0, endodoncia: 0, ortodoncia: 0, protesis: 0, destartraje: 0 },
        whatsappStats: { total: 0, enviados: 0, fallidos: 0 },
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

  const diasSemana = useMemo(() => {
    if (stats?.consultasPorDia && stats.consultasPorDia.length > 0) {
      const dias = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
      const counts = new Array(7).fill(0);
      stats.consultasPorDia.forEach(d => { counts[d.dia_num] = d.total; });
      return { labels: dias, counts };
    }
    return stats?.ultimasConsultas ? getDiasSemana(stats.ultimasConsultas) : { labels: [], counts: [] };
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
      borderRadius: 8,
      borderSkipped: false,
      barThickness: 40,
    }]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#fff',
        padding: 14, cornerRadius: 10, displayColors: false,
        titleFont: { size: 13, weight: '600' }, bodyFont: { size: 12 },
        callbacks: {
          title: (items) => ultimosMeses[items[0].dataIndex]?.fullLabel || '',
          label: (item) => `${item.raw} consulta${item.raw !== 1 ? 's' : ''}`,
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: '#9ca3af', font: { size: 11 }, callback: (val) => Number.isInteger(val) ? val : '' },
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        border: { display: false },
      },
      x: {
        ticks: { color: '#6b7280', font: { size: 12, weight: '500' } },
        grid: { display: false },
        border: { display: false },
      }
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
                return {
                  text: `${label}: ${val} (${pct}%)`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: 'transparent', pointStyle: 'circle', hidden: false, index: i,
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#fff',
        padding: 14, cornerRadius: 10, bodyFont: { size: 12 },
        callbacks: {
          label: (item) => {
            const val = item.raw;
            const pct = totalDP > 0 ? Math.round((val / totalDP) * 100) : 0;
            return `${item.label}: ${val} (${pct}%)`;
          }
        }
      }
    }
  };

  // ============================================
  // CHART: Ingresos Mensuales (línea)
  // ============================================
  const ingresosMes = stats?.ingresosMensuales || [];
  const ingresosLabels = ingresosMes.map(i => {
    const [y, m] = i.mes.split('-');
    return MONTHS_SHORT[parseInt(m) - 1];
  });
  const ingresosData = ingresosMes.map(i => i.total);

  const lineData = {
    labels: ingresosLabels,
    datasets: [{
      label: 'Ingresos (S/)',
      data: ingresosData,
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
      fill: true,
      tension: 0.4,
      borderWidth: 3,
      pointBackgroundColor: '#22c55e',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
    }]
  };

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#fff',
        padding: 14, cornerRadius: 10,
        callbacks: {
          label: (item) => `S/ ${item.raw.toLocaleString()}`,
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#9ca3af', font: { size: 11 }, callback: (val) => `S/${val}` },
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        border: { display: false },
      },
      x: {
        ticks: { color: '#6b7280', font: { size: 11, weight: '500' } },
        grid: { display: false },
        border: { display: false },
      }
    }
  };

  // ============================================
  // CHART: Pacientes Nuevos (barras verdes)
  // ============================================
  const pacNuevos = stats?.pacientesNuevos || [];
  const pacNuevosLabels = pacNuevos.map(p => {
    const [y, m] = p.mes.split('-');
    return MONTHS_SHORT[parseInt(m) - 1];
  });

  const pacNuevosData = {
    labels: pacNuevosLabels,
    datasets: [{
      label: 'Pacientes',
      data: pacNuevos.map(p => p.total),
      backgroundColor: 'rgba(16, 185, 129, 0.7)',
      borderRadius: 8,
      borderSkipped: false,
      barThickness: 32,
    }]
  };

  // ============================================
  // CHART: Métodos de Pago (doughnut)
  // ============================================
  const metodos = stats?.metodosPago || [];
  const metodosColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const metodosData = {
    labels: metodos.map(m => m.metodo),
    datasets: [{
      data: metodos.map(m => m.total),
      backgroundColor: metodos.map((_, i) => metodosColors[i % metodosColors.length]),
      borderWidth: 0, spacing: 3, borderRadius: 5,
    }]
  };

  const metodosOptions = {
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11, weight: '500' } }
      },
      tooltip: {
        backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#fff',
        padding: 12, cornerRadius: 8,
        callbacks: { label: (item) => `${item.label}: S/ ${item.raw.toLocaleString()}` }
      }
    }
  };

  // ============================================
  // CHART: Salud Bucal (doughnut)
  // ============================================
  const sb = stats?.saludBucal || {};
  const sbItems = [
    { label: 'Cariados', value: sb.cariados || 0, color: '#ef4444' },
    { label: 'Curados', value: sb.curados || 0, color: '#22c55e' },
    { label: 'Por extraer', value: sb.por_extraer || 0, color: '#f59e0b' },
    { label: 'Extraidos', value: sb.extraidos || 0, color: '#6b7280' },
  ].filter(i => i.value > 0);

  const saludData = {
    labels: sbItems.map(i => i.label),
    datasets: [{
      data: sbItems.map(i => i.value),
      backgroundColor: sbItems.map(i => i.color),
      borderWidth: 0, spacing: 3, borderRadius: 5,
    }]
  };

  // ============================================
  // CHART: Distribución por Edad (doughnut)
  // ============================================
  const edades = stats?.distribucionEdad || [];
  const edadesItems = edades.filter(e => e.total > 0);
  const edadesColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

  const edadesData = {
    labels: edadesItems.map(e => e.rango),
    datasets: [{
      data: edadesItems.map(e => e.total),
      backgroundColor: edadesItems.map((_, i) => edadesColors[i]),
      borderWidth: 0, spacing: 3, borderRadius: 5,
    }]
  };

  const edadesOptions = {
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11, weight: '500' } }
      },
      tooltip: {
        backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#fff',
        padding: 12, cornerRadius: 8,
        callbacks: { label: (item) => `${item.label}: ${item.raw} pacientes` }
      }
    }
  };

  // ============================================
  // DATA: Pacientes por Sexo
  // ============================================
  const porSexo = stats?.porSexo || [];
  const sexoM = porSexo.find(s => s.sexo === 'M')?.total || 0;
  const sexoF = porSexo.find(s => s.sexo === 'F')?.total || 0;

  // ============================================
  // DATA: Top Diagnósticos
  // ============================================
  const topDiag = stats?.topDiagnosticos || [];
  const maxDiag = topDiag.length > 0 ? topDiag[0].total : 1;

  // ============================================
  // DATA: WhatsApp Stats
  // ============================================
  const waStats = stats?.whatsappStats || { total: 0, enviados: 0, fallidos: 0 };

  if (cargando) {
    return (
      <div className="dashboard">
        <div className="dashboard-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-stats">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
              <div key={i} className="skeleton-stat-card"></div>
            ))}
          </div>
          <div className="skeleton-charts">
            <div className="skeleton-chart"></div>
            <div className="skeleton-chart"></div>
          </div>
          <div className="skeleton-card"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* HEADER */}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            Buscar Paciente
          </button>
        </div>
      </div>

      {/* WHATSAPP BANNER */}
      {waConnected && (
        <div className="wa-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
          </svg>
          WhatsApp conectado
          <span className="wa-banner-warning">
            Evite enviar mas de 20 mensajes por hora para prevenir bloqueos
          </span>
        </div>
      )}

      {/* STAT CARDS — 9 cards */}
      <div className="stats-grid stats-grid-9">
        <div className="stat-card clickable" onClick={() => onNavigate('pacientes')}>
          <div className="stat-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.pacientes || 0}</span>
            <span className="stat-label">Pacientes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.consultas || 0}</span>
            <span className="stat-label">Consultas</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.tratamientos || 0}</span>
            <span className="stat-label">Tratamientos</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">${(stats?.pagos?.total_pagado || 0).toLocaleString()}</span>
            <span className="stat-label">Cobrado</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.tratamientosPlanificados || 0}</span>
            <span className="stat-label">Planificados</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.2))', color: '#10b981'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{sexoM}</span>
            <span className="stat-label">Masculino</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(236,72,153,0.2))', color: '#ec4899'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{sexoF}</span>
            <span className="stat-label">Femenino</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.2))', color: '#f59e0b'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.recetas || 0}</span>
            <span className="stat-label">Recetas</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.2))', color: '#8b5cf6'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{waStats.enviados}</span>
            <span className="stat-label">WA Enviados</span>
          </div>
        </div>
      </div>

      {/* ROW 2: Consultas por Mes + Consultas por Día */}
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
              <div className="chart-empty"><p>No hay datos de consultas para mostrar</p></div>
            )}
          </div>
        </div>

        <div className="dashboard-chart-card">
          <div className="dashboard-chart-header">
            <h3>Consultas por Dia</h3>
            <span className="dashboard-chart-badge">
              {diasSemana.counts.some(c => c > 0) ? `${diasSemana.counts.reduce((a, b) => a + b, 0)} total` : 'Sin datos'}
            </span>
          </div>
          <div className="dashboard-chart-body">
            {diasSemana.counts.some(c => c > 0) ? (
              <Bar data={{
                labels: diasSemana.labels,
                datasets: [{
                  label: 'Consultas',
                  data: diasSemana.counts,
                  backgroundColor: [
                    'rgba(239, 68, 68, 0.7)', 'rgba(67, 97, 238, 0.7)', 'rgba(34, 197, 94, 0.7)',
                    'rgba(245, 158, 11, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(236, 72, 153, 0.7)',
                    'rgba(20, 184, 166, 0.7)',
                  ],
                  borderRadius: 8, borderSkipped: false, barThickness: 28,
                }]
              }} options={{
                ...barOptions,
                plugins: {
                  ...barOptions.plugins,
                  legend: { display: false },
                  tooltip: {
                    ...barOptions.plugins.tooltip,
                    callbacks: {
                      title: (items) => items[0].label,
                      label: (item) => `${item.raw} consulta${item.raw !== 1 ? 's' : ''}`,
                    }
                  }
                }
              }} />
            ) : (
              <div className="chart-empty"><p>No hay datos de dias para mostrar</p></div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 3: Estado Tratamientos + Ingresos Mensuales */}
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
              <div className="chart-empty"><p>No hay tratamientos registrados</p></div>
            )}
          </div>
        </div>

        <div className="dashboard-chart-card">
          <div className="dashboard-chart-header">
            <h3>Ingresos Mensuales</h3>
            <span className="dashboard-chart-badge">
              {ingresosData.length > 0 ? `S/ ${ingresosData.reduce((a, b) => a + b, 0).toLocaleString()}` : 'Sin datos'}
            </span>
          </div>
          <div className="dashboard-chart-body">
            {ingresosData.length > 0 && ingresosData.some(v => v > 0) ? (
              <Line data={lineData} options={lineOptions} />
            ) : (
              <div className="chart-empty"><p>No hay datos de ingresos para mostrar</p></div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 4: Pacientes Nuevos + Métodos de Pago */}
      <div className="dashboard-grid-2col">
        <div className="dashboard-chart-card">
          <div className="dashboard-chart-header">
            <h3>Pacientes Nuevos</h3>
            <span className="dashboard-chart-badge">
              {pacNuevos.reduce((a, b) => a + b.total, 0)} total
            </span>
          </div>
          <div className="dashboard-chart-body">
            {pacNuevos.length > 0 && pacNuevos.some(p => p.total > 0) ? (
              <Bar data={pacNuevosData} options={barOptions} />
            ) : (
              <div className="chart-empty"><p>No hay datos de pacientes nuevos</p></div>
            )}
          </div>
        </div>

        <div className="dashboard-chart-card">
          <div className="dashboard-chart-header">
            <h3>Metodos de Pago</h3>
            <span className="dashboard-chart-badge">
              {metodos.length > 0 ? `${metodos.length} tipos` : 'Sin datos'}
            </span>
          </div>
          <div className="dashboard-chart-body">
            {metodos.length > 0 ? (
              <Doughnut data={metodosData} options={metodosOptions} />
            ) : (
              <div className="chart-empty"><p>No hay datos de pagos</p></div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 5: Top Diagnósticos + Salud Bucal */}
      <div className="dashboard-grid-2col">
        <div className="dashboard-chart-card">
          <div className="dashboard-chart-header">
            <h3>Top Diagnosticos</h3>
            <span className="dashboard-chart-badge">
              {topDiag.length > 0 ? `${topDiag.length} tipos` : 'Sin datos'}
            </span>
          </div>
          <div className="dashboard-chart-body">
            {topDiag.length > 0 ? (
              <div className="top-diag-list">
                {topDiag.map((d, i) => (
                  <div key={i} className="top-diag-item">
                    <span className="top-diag-label">{d.texto}</span>
                    <div className="top-diag-bar-wrap">
                      <div className="top-diag-bar" style={{width: `${(d.total / maxDiag) * 100}%`}}></div>
                    </div>
                    <span className="top-diag-count">{d.total}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="chart-empty"><p>No hay diagnosticos registrados</p></div>
            )}
          </div>
        </div>

        <div className="dashboard-chart-card">
          <div className="dashboard-chart-header">
            <h3>Salud Bucal General</h3>
            <span className="dashboard-chart-badge">
              {sbItems.length > 0 ? `${sbItems.reduce((a, b) => a + b.value, 0)} piezas` : 'Sin datos'}
            </span>
          </div>
          <div className="dashboard-chart-body">
            {sbItems.length > 0 ? (
              <Doughnut data={saludData} options={{
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11, weight: '500' } }
                  },
                  tooltip: {
                    backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#fff',
                    padding: 12, cornerRadius: 8,
                    callbacks: { label: (item) => `${item.label}: ${item.raw} piezas` }
                  }
                }
              }} />
            ) : (
              <div className="chart-empty"><p>No hay datos de salud bucal</p></div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 6: Saldos Pendientes + Distribución por Edad */}
      <div className="dashboard-grid-2col">
        <div className="dashboard-table-card">
          <div className="dashboard-table-header">
            <h3>Saldos Pendientes</h3>
            <span className="dashboard-chart-badge">
              {stats?.saldosPendientes?.length || 0} pacientes
            </span>
          </div>
          {(!stats?.saldosPendientes || stats.saldosPendientes.length === 0) ? (
            <div className="empty-state">
              <p>No hay saldos pendientes</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>DNI</th>
                    <th style={{textAlign: 'right'}}>Pendiente</th>
                  </tr>
                </thead>
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

        <div className="dashboard-chart-card">
          <div className="dashboard-chart-header">
            <h3>Distribucion por Edad</h3>
            <span className="dashboard-chart-badge">
              {edadesItems.reduce((a, b) => a + b.total, 0)} pacientes
            </span>
          </div>
          <div className="dashboard-chart-body">
            {edadesItems.length > 0 ? (
              <Doughnut data={edadesData} options={edadesOptions} />
            ) : (
              <div className="chart-empty"><p>No hay datos de edad</p></div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 7: Últimas Consultas */}
      <div className="dashboard-content">
        <div className="dashboard-table-card">
          <div className="dashboard-table-header">
            <h3>Ultimas Consultas</h3>
            <div className="dashboard-filtros">
              {FILTROS_FECHA.map(f => (
                <button
                  key={f.value}
                  className={`filter-btn ${filtroFecha === f.value ? 'active' : ''}`}
                  onClick={() => setFiltroFecha(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {consultasFiltradas.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{color: '#d1d5db'}}>
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                </svg>
              </div>
              <p>No hay consultas en este periodo</p>
              <button className="empty-state-btn" onClick={() => onNavigate('recepcion')}>
                Crear primera consulta
              </button>
            </div>
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
