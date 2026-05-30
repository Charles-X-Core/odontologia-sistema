import { useState } from 'react';

const ESTADOS_FDI = {
  sano: { color: 'none', sigla: '', label: 'Sano' },
  caries: { color: '#ef4444', sigla: 'CA', label: 'Caries' },
  amalgama: { color: '#2563eb', sigla: 'AM', label: 'Amalgama' },
  resina: { color: '#2563eb', sigla: 'R', label: 'Resina' },
  ionomero: { color: '#2563eb', sigla: 'IV', label: 'Ionomero' },
  incrustacion_m: { color: '#2563eb', sigla: 'IM', label: 'Incrustacion Metalica' },
  incrustacion_e: { color: '#2563eb', sigla: 'IE', label: 'Incrustacion Estetica' },
  corona_completa: { color: '#2563eb', sigla: 'CC', label: 'Corona Completa' },
  corona_cmc: { color: '#2563eb', sigla: 'CMC', label: 'Corona Metal Ceramica' },
  corona_jacket: { color: '#2563eb', sigla: 'CJ', label: 'Corona Jacket' },
  corona_temporal: { color: '#ef4444', sigla: 'CT', label: 'Corona Temporal' },
  endodoncia: { color: '#2563eb', sigla: 'TC', label: 'Tratamiento Conductos' },
  pulpectomia: { color: '#2563eb', sigla: 'PC', label: 'Pulpectomia' },
  extraccion: { color: '#ef4444', sigla: 'X', label: 'Extraccion' },
  ausente: { color: '#2563eb', sigla: 'X', label: 'Ausente' },
  fractura: { color: '#ef4444', sigla: 'FR', label: 'Fractura' },
  protesis_fija: { color: '#2563eb', sigla: 'PF', label: 'Protesis Fija' },
  protesis_removible: { color: '#2563eb', sigla: 'PR', label: 'Protesis Removible' },
  sellante: { color: '#2563eb', sigla: 'SE', label: 'Sellante' },
  desgaste: { color: '#ef4444', sigla: 'DES', label: 'Desgaste' },
  supernumerario: { color: '#2563eb', sigla: 'S', label: 'Supernumerario' },
  impactado: { color: '#2563eb', sigla: 'IM', label: 'Impactado' },
};

const PERMANENTES = {
  supDer: [18, 17, 16, 15, 14, 13, 12, 11],
  supIzq: [21, 22, 23, 24, 25, 26, 27, 28],
  infIzq: [31, 32, 33, 34, 35, 36, 37, 38],
  infDer: [41, 42, 43, 44, 45, 46, 47, 48],
};

const TEMPORALES = {
  supDer: [55, 54, 53, 52, 51],
  supIzq: [61, 62, 63, 64, 65],
  infIzq: [71, 72, 73, 74, 75],
  infDer: [81, 82, 83, 84, 85],
};

function DienteFDI({ numero, datos, x, y, onClick, selected, esTemporal, escala = 1 }) {
  const esSuperior = numero < 50;
  const estado = datos?.estado || 'sano';
  const info = ESTADOS_FDI[estado] || ESTADOS_FDI.sano;
  const w = (esTemporal ? 28 : 34) * escala;
  const h = (esTemporal ? 32 : 50) * escala;
  const raizH = h * 0.55;
  const coronaH = h - raizH;

  const colorRelleno = info.color === 'none' ? '#f8fafc' : info.color;
  const opacity = estado === 'ausente' ? 0.3 : 1;

  return (
    <g
      onClick={() => onClick?.(numero)}
      style={{ cursor: 'pointer' }}
      opacity={opacity}
    >
      {/* Corona */}
      <rect
        x={x} y={esSuperior ? y + raizH : y}
        width={w} height={coronaH}
        rx={2} ry={2}
        fill={colorRelleno}
        stroke={selected ? '#f59e0b' : '#64748b'}
        strokeWidth={selected ? 2 : 0.8}
      />

      {/* Raiz */}
      {estado !== 'ausente' && (
        <path
          d={esSuperior
            ? `M${x + 3},${y + raizH} L${x + w / 2},${y} L${x + w - 3},${y + raizH}`
            : `M${x + 3},${y + coronaH} L${x + w / 2},${y + h} L${x + w - 3},${y + coronaH}`
          }
          fill="none"
          stroke="#64748b"
          strokeWidth={0.8}
        />
      )}

      {/* Numero FDI */}
      <text
        x={x + w / 2}
        y={esSuperior ? y + raizH + coronaH / 2 : y + coronaH / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={info.color === 'none' ? '#1e293b' : 'white'}
        fontSize={esTemporal ? 7 : 8}
        fontWeight="600"
      >
        {numero}
      </text>

      {/* Sigla del estado */}
      {info.sigla && (
        <text
          x={x + w / 2}
          y={esSuperior ? y + raizH + coronaH / 2 + 9 : y + coronaH / 2 + 9}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={info.color === 'none' ? '#64748b' : 'white'}
          fontSize={esTemporal ? 5 : 6}
          fontWeight="700"
        >
          {info.sigla}
        </text>
      )}

      {/* X para extraccion/ausente */}
      {(estado === 'extraccion' || estado === 'ausente') && (
        <>
          <line x1={x + 2} y1={esSuperior ? y + raizH + 2 : y + 2}
                x2={x + w - 2} y2={esSuperior ? y + raizH + coronaH - 2 : y + coronaH - 2}
                stroke={info.color} strokeWidth={1.5} />
          <line x1={x + w - 2} y1={esSuperior ? y + raizH + 2 : y + 2}
                x2={x + 2} y2={esSuperior ? y + raizH + coronaH - 2 : y + coronaH - 2}
                stroke={info.color} strokeWidth={1.5} />
        </>
      )}
    </g>
  );
}

export default function OdontogramaSVG({ datos = {}, editable = false, onCambio, titulo, mostrarTemporales = false }) {
  const [seleccionado, setSeleccionado] = useState(null);
  const dientes = datos.dientes || {};

  const handleClick = (num) => {
    if (!editable) return;
    setSeleccionado(seleccionado === num ? null : num);
  };

  const setEstado = (estado) => {
    if (!seleccionado) return;
    const nuevos = { ...dientes };
    if (estado === 'sano') {
      delete nuevos[seleccionado];
    } else {
      nuevos[seleccionado] = {
        estado,
        color: ESTADOS_FDI[estado]?.color === '#ef4444' ? 'rojo' : 'azul',
        siglas: ESTADOS_FDI[estado]?.sigla || '',
        material: null,
        tipo_corona: null,
        superficies: [],
      };
    }
    onCambio?.(nuevos);
    setSeleccionado(null);
  };

  const toothW = 36;
  const gap = 4;
  const rowH = 58;
  const tempRowH = 42;
  const margin = 15;

  const totalW = (toothW + gap) * 8 + gap + 20;
  const totalH = margin + rowH + (mostrarTemporales ? tempRowH + 10 : 0) + 10 + (mostrarTemporales ? tempRowH + 10 : 0) + rowH + margin;

  const cx = totalW / 2;

  return (
    <div className="odontograma-fdi-container">
      {titulo && <h4 className="odontograma-fdi-title">{titulo}</h4>}

      <div className="odontograma-fdi-legend">
        <span className="legend-fdi"><span className="legend-dot-fdi" style={{ background: '#ef4444' }} /> Rojo = Patologico/Pendiente</span>
        <span className="legend-fdi"><span className="legend-dot-fdi" style={{ background: '#2563eb' }} /> Azul = Tratado/Buen estado</span>
      </div>

      <div className="odontograma-fdi-scroll">
        <svg viewBox={`0 0 ${totalW} ${totalH}`} className="odontograma-fdi-svg">
          {/* Eje central */}
          <line x1={cx} y1={5} x2={cx} y2={totalH - 5} stroke="#1e293b" strokeWidth={2} />

          {/* Dientes Permanentes Superiores */}
          <text x={cx} y={margin - 2} textAnchor="middle" fontSize="7" fill="#64748b" fontWeight="600">PERMANENTES SUPERIORES</text>
          {PERMANENTES.supDer.map((num, i) => (
            <DienteFDI key={num} numero={num} datos={dientes[num]}
              x={margin + (7 - i) * (toothW + gap)} y={margin + 8}
              onClick={handleClick} selected={seleccionado === num} escala={1} />
          ))}
          {PERMANENTES.supIzq.map((num, i) => (
            <DienteFDI key={num} numero={num} datos={dientes[num]}
              x={cx + 10 + i * (toothW + gap)} y={margin + 8}
              onClick={handleClick} selected={seleccionado === num} escala={1} />
          ))}

          {/* Dientes Temporales Superiores */}
          {mostrarTemporales && (
            <>
              <text x={cx} y={margin + rowH + 6} textAnchor="middle" fontSize="6" fill="#94a3b8" fontWeight="600">TEMPORALES SUPERIORES</text>
              {TEMPORALES.supDer.map((num, i) => (
                <DienteFDI key={num} numero={num} datos={dientes[num]}
                  x={cx - 5 - (4 - i) * (28 + gap)} y={margin + rowH + 12}
                  onClick={handleClick} selected={seleccionado === num} esTemporal escala={0.85} />
              ))}
              {TEMPORALES.supIzq.map((num, i) => (
                <DienteFDI key={num} numero={num} datos={dientes[num]}
                  x={cx + 5 + i * (28 + gap)} y={margin + rowH + 12}
                  onClick={handleClick} selected={seleccionado === num} esTemporal escala={0.85} />
              ))}
            </>
          )}

          {/* Linea horizontal media */}
          <line x1={margin} y1={totalH / 2} x2={totalW - margin} y2={totalH / 2} stroke="#1e293b" strokeWidth={1.5} />

          {/* Dientes Temporales Inferiores */}
          {mostrarTemporales && (
            <>
              <text x={cx} y={totalH / 2 + 8} textAnchor="middle" fontSize="6" fill="#94a3b8" fontWeight="600">TEMPORALES INFERIORES</text>
              {TEMPORALES.infDer.map((num, i) => (
                <DienteFDI key={num} numero={num} datos={dientes[num]}
                  x={cx - 5 - (4 - i) * (28 + gap)} y={totalH / 2 + 14}
                  onClick={handleClick} selected={seleccionado === num} esTemporal escala={0.85} />
              ))}
              {TEMPORALES.infIzq.map((num, i) => (
                <DienteFDI key={num} numero={num} datos={dientes[num]}
                  x={cx + 5 + i * (28 + gap)} y={totalH / 2 + 14}
                  onClick={handleClick} selected={seleccionado === num} esTemporal escala={0.85} />
              ))}
            </>
          )}

          {/* Dientes Permanentes Inferiores */}
          <text x={cx} y={totalH - margin - rowH + 2} textAnchor="middle" fontSize="7" fill="#64748b" fontWeight="600">PERMANENTES INFERIORES</text>
          {PERMANENTES.infDer.map((num, i) => (
            <DienteFDI key={num} numero={num} datos={dientes[num]}
              x={margin + (7 - i) * (toothW + gap)} y={totalH - margin - rowH + 8}
              onClick={handleClick} selected={seleccionado === num} escala={1} />
          ))}
          {PERMANENTES.infIzq.map((num, i) => (
            <DienteFDI key={num} numero={num} datos={dientes[num]}
              x={cx + 10 + i * (toothW + gap)} y={totalH - margin - rowH + 8}
              onClick={handleClick} selected={seleccionado === num} escala={1} />
          ))}

          {/* Labels cuadrantes */}
          <text x={margin + 2} y={margin + rowH / 2 + 8} fontSize="6" fill="#94a3b8">Der</text>
          <text x={totalW - margin - 8} y={margin + rowH / 2 + 8} fontSize="6" fill="#94a3b8">Izq</text>
        </svg>
      </div>

      {editable && seleccionado && (
        <div className="estado-selector-fdi">
          <span className="estado-selector-label-fdi">
            Diente <strong>{seleccionado}</strong> - Seleccionar hallazgo:
          </span>
          <div className="estado-selector-botones-fdi">
            <div className="estado-group">
              <span className="estado-group-label">Sano</span>
              <button type="button" className="btn-estado-fdi" onClick={() => setEstado('sano')}>
                <span className="btn-estado-dot-fdi" style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }} />
                Sano
              </button>
            </div>

            <div className="estado-group">
              <span className="estado-group-label" style={{ color: '#ef4444' }}>Patologico (Rojo)</span>
              {['caries', 'fractura', 'desgaste', 'extraccion'].map(key => (
                <button key={key} type="button" className="btn-estado-fdi"
                  onClick={() => setEstado(key)}>
                  <span className="btn-estado-dot-fdi" style={{ background: ESTADOS_FDI[key].color }} />
                  {ESTADOS_FDI[key].sigla} - {ESTADOS_FDI[key].label}
                </button>
              ))}
            </div>

            <div className="estado-group">
              <span className="estado-group-label" style={{ color: '#2563eb' }}>Tratamiento (Azul)</span>
              {['amalgama', 'resina', 'ionomero', 'incrustacion_m', 'incrustacion_e'].map(key => (
                <button key={key} type="button" className="btn-estado-fdi"
                  onClick={() => setEstado(key)}>
                  <span className="btn-estado-dot-fdi" style={{ background: ESTADOS_FDI[key].color }} />
                  {ESTADOS_FDI[key].sigla} - {ESTADOS_FDI[key].label}
                </button>
              ))}
            </div>

            <div className="estado-group">
              <span className="estado-group-label" style={{ color: '#2563eb' }}>Coronas</span>
              {['corona_completa', 'corona_cmc', 'corona_jacket', 'corona_temporal'].map(key => (
                <button key={key} type="button" className="btn-estado-fdi"
                  onClick={() => setEstado(key)}>
                  <span className="btn-estado-dot-fdi" style={{ background: ESTADOS_FDI[key].color }} />
                  {ESTADOS_FDI[key].sigla} - {ESTADOS_FDI[key].label}
                </button>
              ))}
            </div>

            <div className="estado-group">
              <span className="estado-group-label" style={{ color: '#2563eb' }}>Tratamiento Pulpal</span>
              {['endodoncia', 'pulpectomia'].map(key => (
                <button key={key} type="button" className="btn-estado-fdi"
                  onClick={() => setEstado(key)}>
                  <span className="btn-estado-dot-fdi" style={{ background: ESTADOS_FDI[key].color }} />
                  {ESTADOS_FDI[key].sigla} - {ESTADOS_FDI[key].label}
                </button>
              ))}
            </div>

            <div className="estado-group">
              <span className="estado-group-label" style={{ color: '#2563eb' }}>Otros</span>
              {['protesis_fija', 'protesis_removible', 'sellante', 'ausente'].map(key => (
                <button key={key} type="button" className="btn-estado-fdi"
                  onClick={() => setEstado(key)}>
                  <span className="btn-estado-dot-fdi" style={{ background: ESTADOS_FDI[key].color }} />
                  {ESTADOS_FDI[key].sigla} - {ESTADOS_FDI[key].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
