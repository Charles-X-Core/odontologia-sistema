import { useState } from 'react';

const ESTADOS = {
  sano: { fill: '#22c55e', label: 'Sano' },
  caries: { fill: '#ef4444', label: 'Caries' },
  endodoncia: { fill: '#f59e0b', label: 'Endodoncia' },
  corona: { fill: '#3b82f6', label: 'Corona' },
  restaurado: { fill: '#6b7280', label: 'Restaurado' },
  extraccion: { fill: '#ec4899', label: 'Extraccion' },
  protesis: { fill: '#a855f7', label: 'Protesis' },
  ausente: { fill: '#d1d5db', label: 'Ausente' },
};

const CUADRANTES = {
  superDer: [18, 17, 16, 15, 14, 13, 12, 11],
  superIzq: [21, 22, 23, 24, 25, 26, 27, 28],
  inferIzq: [41, 42, 43, 44, 45, 46, 47, 48],
  inferDer: [31, 32, 33, 34, 35, 36, 37, 38],
};

function DienteSVG({ numero, estado, x, y, onClick, selected, editable }) {
  const color = ESTADOS[estado]?.fill || ESTADOS.sano.fill;
  const w = 32;
  const h = 40;

  return (
    <g
      onClick={() => editable && onClick?.(numero)}
      style={{ cursor: editable ? 'pointer' : 'default' }}
      className={`diente-svg ${selected ? 'selected' : ''}`}
    >
      <rect
        x={x} y={y} width={w} height={h}
        rx={4} ry={4}
        fill={color}
        stroke={selected ? '#4361ee' : '#94a3b8'}
        strokeWidth={selected ? 2.5 : 1}
        opacity={estado === 'ausente' ? 0.4 : 1}
      />
      <line x1={x + 2} y1={y + h / 2} x2={x + w - 2} y2={y + h / 2}
        stroke="white" strokeWidth={0.5} opacity={0.4} />
      <line x1={x + w / 2} y1={y + 2} x2={x + w / 2} y2={y + h - 2}
        stroke="white" strokeWidth={0.5} opacity={0.4} />
      <text
        x={x + w / 2} y={y + h / 2 - 2}
        textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize="9" fontWeight="700"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
      >
        {numero}
      </text>
      {estado !== 'sano' && (
        <text
          x={x + w / 2} y={y + h / 2 + 10}
          textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize="6" fontWeight="600"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
        >
          {ESTADOS[estado]?.label?.slice(0, 4).toUpperCase()}
        </text>
      )}
    </g>
  );
}

export default function OdontogramaSVG({ datos = {}, editable = false, onCambio, titulo }) {
  const [seleccionado, setSeleccionado] = useState(null);
  const dientes = datos.dientes || {};

  const handleClick = (num) => {
    setSeleccionado(seleccionado === num ? null : num);
  };

  const setEstado = (estado) => {
    if (!seleccionado) return;
    const nuevos = { ...dientes, [seleccionado]: { estado, procedimientos: [] } };
    onCambio?.(nuevos);
    setSeleccionado(null);
  };

  const gapX = 36;
  const gapY = 44;
  const startX = 20;
  const startYSuper = 20;
  const startYInfer = startYSuper + gapY + 10;

  return (
    <div className="odontograma-svg-container">
      {titulo && <h4 className="odontograma-svg-title">{titulo}</h4>}

      <div className="odontograma-svg-legend">
        {Object.entries(ESTADOS).map(([key, val]) => (
          <span key={key} className="legend-item">
            <span className="legend-dot" style={{ background: val.fill }} />
            {val.label}
          </span>
        ))}
      </div>

      <div className="odontograma-svg-scroll">
        <svg viewBox="0 0 620 210" className="odontograma-svg">
          <text x="310" y="12" textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">
            MAXILAR SUPERIOR
          </text>

          {CUADRANTES.superDer.map((num, i) => (
            <DienteSVG key={num} numero={num} estado={dientes[num]?.estado || 'sano'}
              x={startX + (7 - i) * gapX} y={startYSuper}
              onClick={handleClick} selected={seleccionado === num} editable={editable} />
          ))}
          {CUADRANTES.superIzq.map((num, i) => (
            <DienteSVG key={num} numero={num} estado={dientes[num]?.estado || 'sano'}
              x={startX + (8 + i) * gapX} y={startYSuper}
              onClick={handleClick} selected={seleccionado === num} editable={editable} />
          ))}

          <line x1="306" y1={startYSuper - 5} x2="306" y2={startYInfer + 45}
            stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4" />

          {CUADRANTES.inferIzq.map((num, i) => (
            <DienteSVG key={num} numero={num} estado={dientes[num]?.estado || 'sano'}
              x={startX + (7 - i) * gapX} y={startYInfer}
              onClick={handleClick} selected={seleccionado === num} editable={editable} />
          ))}
          {CUADRANTES.inferDer.map((num, i) => (
            <DienteSVG key={num} numero={num} estado={dientes[num]?.estado || 'sano'}
              x={startX + (8 + i) * gapX} y={startYInfer}
              onClick={handleClick} selected={seleccionado === num} editable={editable} />
          ))}

          <text x="310" y={startYInfer + 55} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">
            MAXILAR INFERIOR
          </text>

          <text x={startX - 5} y={startYSuper + 20} textAnchor="end" fontSize="8" fill="#94a3b8">Der</text>
          <text x={startX + 16 * gapX + 5} y={startYSuper + 20} textAnchor="start" fontSize="8" fill="#94a3b8">Izq</text>
        </svg>
      </div>

      {editable && seleccionado && (
        <div className="estado-selector-svg">
          <span className="estado-selector-label">Diente <strong>{seleccionado}</strong> - Seleccionar estado:</span>
          <div className="estado-selector-botones">
            {Object.entries(ESTADOS).map(([key, val]) => (
              <button
                key={key}
                type="button"
                className={`btn-estado ${dientes[seleccionado]?.estado === key ? 'active' : ''}`}
                style={{ '--estado-color': val.fill }}
                onClick={() => setEstado(key)}
              >
                <span className="btn-estado-dot" style={{ background: val.fill }} />
                {val.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
