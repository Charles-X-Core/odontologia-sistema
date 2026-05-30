import { useState } from 'react';

const COLORES = {
  none: 'none',
  rojo: '#dc2626',
  azul: '#2563eb',
};

const ESTADOS = {
  sano: { sigla: '', label: 'Sano', color: 'none' },
  caries: { sigla: 'CA', label: 'Caries', color: 'rojo' },
  obturacion: { sigla: 'OB', label: 'Obturacion', color: 'azul' },
  amalgama: { sigla: 'AM', label: 'Amalgama', color: 'azul' },
  resina: { sigla: 'R', label: 'Resina', color: 'azul' },
  ionomero: { sigla: 'IV', label: 'Ionomero', color: 'azul' },
  incrustacion: { sigla: 'IM', label: 'Incrustacion', color: 'azul' },
  corona_completa: { sigla: 'CC', label: 'Corona Completa', color: 'azul' },
  corona_cmc: { sigla: 'CMC', label: 'Corona Metal Ceramica', color: 'azul' },
  corona_jacket: { sigla: 'CJ', label: 'Corona Jacket', color: 'azul' },
  corona_temporal: { sigla: 'CT', label: 'Corona Temporal', color: 'rojo' },
  endodoncia: { sigla: 'TC', label: 'Tratamiento Conductos', color: 'azul' },
  pulpectomia: { sigla: 'PC', label: 'Pulpectomia', color: 'azul' },
  extraccion: { sigla: 'X', label: 'Extraccion', color: 'rojo' },
  ausente: { sigla: 'X', label: 'Ausente', color: 'azul' },
  fractura: { sigla: 'FR', label: 'Fractura', color: 'rojo' },
  sellante: { sigla: 'SE', label: 'Sellante', color: 'azul' },
  protesis_fija: { sigla: 'PF', label: 'Protesis Fija', color: 'azul' },
  protesis_removible: { sigla: 'PR', label: 'Protesis Removible', color: 'azul' },
};

// Superficies: oclusal, mesial, distal, vestibular, lingual
const SUPERFICIES = ['oclusal', 'mesial', 'distal', 'vestibular', 'lingual'];

function Diente({ numero, datos, x, y, w, h, onClick, selected, esSuperior }) {
  const raizH = h * 0.5;
  const coronaH = h - raizH;

  const getEstado = (sup) => datos?.superficies?.[sup] || 'sano';
  const getColor = (sup) => {
    const estado = getEstado(sup);
    return COLORES[ESTADOS[estado]?.color] || 'none';
  };

  const colorOclusal = getColor('oclusal');
  const colorMesial = getColor('mesial');
  const colorDistal = getColor('distal');
  const colorVestibular = getColor('vestibular');
  const colorLingual = getColor('lingual');

  const anyPathology = SUPERFICIES.some(s => getColor(s) === COLORES.rojo);
  const anyTreatment = SUPERFICIES.some(s => getColor(s) === COLORES.azul);

  const crownY = esSuperior ? y + raizH : y;
  const rootStartY = esSuperior ? y + raizH : y + coronaH;

  return (
    <g onClick={() => onClick?.(numero)} style={{ cursor: 'pointer' }}>
      {/* Raiz */}
      <path
        d={esSuperior
          ? `M${x + w * 0.15},${rootStartY} L${x + w * 0.5},${y} L${x + w * 0.85},${rootStartY}`
          : `M${x + w * 0.15},${crownY + coronaH} L${x + w * 0.5},${y + h} L${x + w * 0.85},${crownY + coronaH}`
        }
        fill="none"
        stroke={selected ? '#f59e0b' : '#475569'}
        strokeWidth={selected ? 1.5 : 1}
      />

      {/* Corona - 5 superficies */}
      {/* Oclusal (arriba para inferiores, abajo para superiores) */}
      <path
        d={esSuperior
          ? `M${x},${rootStartY} L${x + w * 0.1},${crownY + coronaH * 0.15} L${x + w * 0.9},${crownY + coronaH * 0.15} L${x + w},${rootStartY} Z`
          : `M${x},${crownY} L${x + w * 0.1},${crownY + coronaH * 0.85} L${x + w * 0.9},${crownY + coronaH * 0.85} L${x + w},${crownY} Z`
        }
        fill={colorOclusal === 'none' ? '#f1f5f9' : colorOclusal}
        stroke={selected ? '#f59e0b' : '#94a3b8'}
        strokeWidth={0.5}
      />

      {/* Mesial (lado izquierdo) */}
      <path
        d={esSuperior
          ? `M${x},${rootStartY} L${x + w * 0.1},${crownY + coronaH * 0.15} L${x + w * 0.1},${crownY + coronaH * 0.7} L${x},${rootStartY - coronaH * 0.5} Z`
          : `M${x},${crownY} L${x + w * 0.1},${crownY + coronaH * 0.85} L${x + w * 0.1},${crownY + coronaH * 0.3} L${x},${crownY + coronaH * 0.5} Z`
        }
        fill={colorMesial === 'none' ? '#e2e8f0' : colorMesial}
        stroke={selected ? '#f59e0b' : '#94a3b8'}
        strokeWidth={0.5}
      />

      {/* Distal (lado derecho) */}
      <path
        d={esSuperior
          ? `M${x + w},${rootStartY} L${x + w * 0.9},${crownY + coronaH * 0.15} L${x + w * 0.9},${crownY + coronaH * 0.7} L${x + w},${rootStartY - coronaH * 0.5} Z`
          : `M${x + w},${crownY} L${x + w * 0.9},${crownY + coronaH * 0.85} L${x + w * 0.9},${crownY + coronaH * 0.3} L${x + w},${crownY + coronaH * 0.5} Z`
        }
        fill={colorDistal === 'none' ? '#e2e8f0' : colorDistal}
        stroke={selected ? '#f59e0b' : '#94a3b8'}
        strokeWidth={0.5}
      />

      {/* Vestibular (centro) */}
      <rect
        x={x + w * 0.1}
        y={esSuperior ? crownY + coronaH * 0.15 : crownY + coronaH * 0.3}
        width={w * 0.8}
        height={coronaH * 0.55}
        fill={colorVestibular === 'none' ? '#f8fafc' : colorVestibular}
        stroke={selected ? '#f59e0b' : '#94a3b8'}
        strokeWidth={0.5}
      />

      {/* Lingual (centro, detrás de vestibular) */}
      <rect
        x={x + w * 0.15}
        y={esSuperior ? crownY + coronaH * 0.3 : crownY + coronaH * 0.45}
        width={w * 0.7}
        height={coronaH * 0.25}
        fill={colorLingual === 'none' ? '#f8fafc' : colorLingual}
        stroke={selected ? '#f59e0b' : '#94a3b8'}
        strokeWidth={0.3}
        opacity={0.7}
      />

      {/* Numero FDI */}
      <text
        x={x + w / 2}
        y={esSuperior ? rootStartY + coronaH * 0.55 : crownY + coronaH * 0.55}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#1e293b"
        fontSize={7}
        fontWeight="600"
      >
        {numero}
      </text>

      {/* X para extraccion/ausente */}
      {(getEstado('oclusal') === 'extraccion' || getEstado('oclusal') === 'ausente') && (
        <>
          <line x1={x + 2} y1={crownY + 2} x2={x + w - 2} y2={crownY + coronaH - 2}
            stroke={COLORES[ESTADOS[getEstado('oclusal')]?.color]} strokeWidth={2} />
          <line x1={x + w - 2} y1={crownY + 2} x2={x + 2} y2={crownY + coronaH - 2}
            stroke={COLORES[ESTADOS[getEstado('oclusal')]?.color]} strokeWidth={2} />
        </>
      )}

      {/* Indicador de seleccion */}
      {selected && (
        <rect x={x - 1} y={y - 1} width={w + 2} height={h + 2}
          fill="none" stroke="#f59e0b" strokeWidth={2} rx={3} />
      )}
    </g>
  );
}

export default function OdontogramaExperimental({ datos = {}, editable = false, onCambio, titulo }) {
  const [seleccionado, setSeleccionado] = useState(null);
  const [superficieActiva, setSuperficieActiva] = useState('oclusal');
  const dientes = datos.dientes || {};

  const CUADRANTES = {
    supDer: [18, 17, 16, 15, 14, 13, 12, 11],
    supIzq: [21, 22, 23, 24, 25, 26, 27, 28],
    infIzq: [31, 32, 33, 34, 35, 36, 37, 38],
    infDer: [41, 42, 43, 44, 45, 46, 47, 48],
  };

  const tw = 38;
  const th = 58;
  const gap = 3;
  const margin = 15;
  const cx = margin * 2 + tw * 8 + gap * 7;

  const totalH = margin + th + 12 + th + margin;

  const handleClick = (num) => {
    if (!editable) return;
    setSeleccionado(seleccionado === num ? null : num);
  };

  const setSuperficie = (estado) => {
    if (!seleccionado) return;
    const actuales = dientes[seleccionado]?.superficies || {};
    const nuevos = { ...actuales, [superficieActiva]: estado };

    if (estado === 'sano') delete nuevos[superficieActiva];

    const todosSanos = SUPERFICIES.every(s => !nuevos[s] || nuevos[s] === 'sano');

    const nuevoDiente = {
      ...dientes[seleccionado],
      superficies: todosSanos ? {} : nuevos,
    };

    if (todosSanos) {
      const sinDiente = { ...dientes };
      delete sinDiente[seleccionado];
      onCambio?.(sinDiente);
    } else {
      onCambio?.({ ...dientes, [seleccionado]: nuevoDiente });
    }
    setSeleccionado(null);
  };

  return (
    <div className="odontograma-exp-container">
      {titulo && <h4>{titulo}</h4>}

      <div className="odontograma-exp-legend">
        <span><span className="dot" style={{ background: '#dc2626' }} /> Rojo = Patologico</span>
        <span><span className="dot" style={{ background: '#2563eb' }} /> Azul = Tratado</span>
        <span><span className="dot" style={{ background: '#f1f5f9', border: '1px solid #94a3b8' }} /> Sin hallazgo</span>
      </div>

      <div className="odontograma-exp-scroll">
        <svg viewBox={`0 0 ${cx} ${totalH}`} style={{ width: '100%', maxWidth: '800px', display: 'block', margin: '0 auto' }}>
          {/* Eje central */}
          <line x1={cx / 2} y1={5} x2={cx / 2} y2={totalH - 5} stroke="#1e293b" strokeWidth={2} />

          {/* Label superior */}
          <text x={cx / 2} y={margin - 3} textAnchor="middle" fontSize="7" fill="#64748b" fontWeight="600">MAXILAR SUPERIOR</text>

          {/* Permanentes Superiores - Cuadrante 1 (Der) */}
          {CUADRANTES.supDer.map((num, i) => (
            <Diente key={num} numero={num} datos={dientes[num]}
              x={margin + (7 - i) * (tw + gap)} y={margin + 5}
              w={tw} h={th} onClick={handleClick} selected={seleccionado === num} esSuperior={true} />
          ))}

          {/* Permanentes Superiores - Cuadrante 2 (Izq) */}
          {CUADRANTES.supIzq.map((num, i) => (
            <Diente key={num} numero={num} datos={dientes[num]}
              x={cx / 2 + gap + i * (tw + gap)} y={margin + 5}
              w={tw} h={th} onClick={handleClick} selected={seleccionado === num} esSuperior={true} />
          ))}

          {/* Linea horizontal media */}
          <line x1={margin} y1={totalH / 2} x2={cx - margin} y2={totalH / 2} stroke="#1e293b" strokeWidth={1.5} />

          {/* Label inferior */}
          <text x={cx / 2} y={totalH - margin + 3} textAnchor="middle" fontSize="7" fill="#64748b" fontWeight="600">MAXILAR INFERIOR</text>

          {/* Permanentes Inferiores - Cuadrante 4 (Der) */}
          {CUADRANTES.infDer.map((num, i) => (
            <Diente key={num} numero={num} datos={dientes[num]}
              x={margin + (7 - i) * (tw + gap)} y={totalH / 2 + margin - 10}
              w={tw} h={th} onClick={handleClick} selected={seleccionado === num} esSuperior={false} />
          ))}

          {/* Permanentes Inferiores - Cuadrante 3 (Izq) */}
          {CUADRANTES.infIzq.map((num, i) => (
            <Diente key={num} numero={num} datos={dientes[num]}
              x={cx / 2 + gap + i * (tw + gap)} y={totalH / 2 + margin - 10}
              w={tw} h={th} onClick={handleClick} selected={seleccionado === num} esSuperior={false} />
          ))}

          {/* Labels cuadrantes */}
          <text x={margin} y={margin + th / 2 + 5} fontSize="5" fill="#94a3b8">18-11</text>
          <text x={cx - margin - 15} y={margin + th / 2 + 5} fontSize="5" fill="#94a3b8">21-28</text>
          <text x={margin} y={totalH / 2 + th / 2 + 5} fontSize="5" fill="#94a3b8">48-41</text>
          <text x={cx - margin - 15} y={totalH / 2 + th / 2 + 5} fontSize="5" fill="#94a3b8">31-38</text>
        </svg>
      </div>

      {editable && seleccionado && (
        <div className="exp-panel-edicion">
          <div className="exp-panel-header">
            <strong>Diente {seleccionado}</strong>
            <span>Seleccionar superficie y hallazgo:</span>
          </div>

          <div className="exp-superficies">
            {SUPERFICIES.map(sup => (
              <button key={sup}
                className={`exp-superficie-btn ${superficieActiva === sup ? 'active' : ''}`}
                onClick={() => setSuperficieActiva(sup)}>
                {sup.charAt(0).toUpperCase() + sup.slice(1)}
              </button>
            ))}
          </div>

          <div className="exp-estados">
            <div className="exp-estado-grupo">
              <span className="exp-grupo-label">Sano</span>
              <button className="exp-estado-btn" onClick={() => setSuperficie('sano')}>
                <span className="exp-dot" style={{ background: '#f1f5f9', border: '1px solid #94a3b8' }} />
                Sano
              </button>
            </div>

            <div className="exp-estado-grupo">
              <span className="exp-grupo-label" style={{ color: '#dc2626' }}>Patologico (Rojo)</span>
              {['caries', 'fractura', 'extraccion'].map(key => (
                <button key={key} className="exp-estado-btn" onClick={() => setSuperficie(key)}>
                  <span className="exp-dot" style={{ background: COLORES.rojo }} />
                  {ESTADOS[key].sigla} - {ESTADOS[key].label}
                </button>
              ))}
            </div>

            <div className="exp-estado-grupo">
              <span className="exp-grupo-label" style={{ color: '#2563eb' }}>Restauracion (Azul)</span>
              {['amalgama', 'resina', 'ionomero', 'incrustacion', 'sellante'].map(key => (
                <button key={key} className="exp-estado-btn" onClick={() => setSuperficie(key)}>
                  <span className="exp-dot" style={{ background: COLORES.azul }} />
                  {ESTADOS[key].sigla} - {ESTADOS[key].label}
                </button>
              ))}
            </div>

            <div className="exp-estado-grupo">
              <span className="exp-grupo-label" style={{ color: '#2563eb' }}>Coronas</span>
              {['corona_completa', 'corona_cmc', 'corona_jacket', 'corona_temporal'].map(key => (
                <button key={key} className="exp-estado-btn" onClick={() => setSuperficie(key)}>
                  <span className="exp-dot" style={{ background: COLORES[ESTADOS[key].color] }} />
                  {ESTADOS[key].sigla} - {ESTADOS[key].label}
                </button>
              ))}
            </div>

            <div className="exp-estado-grupo">
              <span className="exp-grupo-label" style={{ color: '#2563eb' }}>Tratamiento Pulpal</span>
              {['endodoncia', 'pulpectomia'].map(key => (
                <button key={key} className="exp-estado-btn" onClick={() => setSuperficie(key)}>
                  <span className="exp-dot" style={{ background: COLORES.azul }} />
                  {ESTADOS[key].sigla} - {ESTADOS[key].label}
                </button>
              ))}
            </div>

            <div className="exp-estado-grupo">
              <span className="exp-grupo-label" style={{ color: '#2563eb' }}>Otros</span>
              {['protesis_fija', 'protesis_removible', 'ausente'].map(key => (
                <button key={key} className="exp-estado-btn" onClick={() => setSuperficie(key)}>
                  <span className="exp-dot" style={{ background: COLORES[ESTADOS[key].color] }} />
                  {ESTADOS[key].sigla} - {ESTADOS[key].label}
                </button>
              ))}
            </div>
          </div>

          <div className="exp-resumen">
            <strong>Diente {seleccionado}:</strong>
            {SUPERFICIES.map(sup => {
              const estado = dientes[seleccionado]?.superficies?.[sup] || 'sano';
              if (estado === 'sano') return null;
              return (
                <span key={sup} className="exp-resumen-badge"
                  style={{ background: COLORES[ESTADOS[estado]?.color] === COLORES.rojo ? '#fecaca' : '#dbeafe' }}>
                  {sup}: {ESTADOS[estado]?.sigla}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
