import { useState } from 'react';

const ESTADOS = {
  sano: { label: 'Sano', color: '#22c55e', symbol: '' },
  caries: { label: 'Caries', color: '#ef4444', symbol: '■' },
  obturado: { label: 'Obturado', color: '#3b82f6', symbol: '◆' },
  endodoncia: { label: 'Endodoncia', color: '#8b5cf6', symbol: '●' },
  corona: { label: 'Corona', color: '#f59e0b', symbol: '▲' },
  extraccion: { label: 'Extraccion', color: '#6b7280', symbol: '✕' },
  ausente: { label: 'Ausente', color: '#d1d5db', symbol: '' },
  provisional: { label: 'Provisional', color: '#06b6d4', symbol: '△' },
  implante: { label: 'Implante', color: '#14b8a6', symbol: '◆' },
  puente: { label: 'Puente', color: '#a855f7', symbol: '══' },
};

const DIENTES_PERMANENTES = {
  superior: [
    [18, 17, 16, 15, 14, 13, 12, 11],
    [21, 22, 23, 24, 25, 26, 27, 28],
  ],
  inferior: [
    [48, 47, 46, 45, 44, 43, 42, 41],
    [31, 32, 33, 34, 35, 36, 37, 38],
  ],
};

const DIENTES_TEMPORALES = {
  superior: [
    [55, 54, 53, 52, 51],
    [61, 62, 63, 64, 65],
  ],
  inferior: [
    [85, 84, 83, 82, 81],
    [71, 72, 73, 74, 75],
  ],
};

function DienteSVG({ numero }) {
  return (
    <img
      src={`/odontograma-svg/${numero}.svg`}
      alt={`Diente ${numero}`}
      className="diente-svg"
      draggable={false}
    />
  );
}

function Diente({ numero, estado, onClick, esTemporal }) {
  const config = ESTADOS[estado] || ESTADOS.sano;
  return (
    <div className={`diente-container ${esTemporal ? 'diente-temporal' : ''}`} onClick={() => onClick(numero)}>
      <div className={`diente-label-top ${esTemporal ? 'diente-label-temporal' : ''}`}>{numero}</div>
      <div className={`diente-box ${esTemporal ? 'diente-box-temporal' : ''}`} style={{ borderColor: config.color }}>
        <DienteSVG numero={numero} />
        {estado && estado !== 'sano' && (
          <div className="diente-estado" style={{ backgroundColor: config.color }}>
            {config.symbol}
          </div>
        )}
      </div>
    </div>
  );
}

function DientesRow({ dientes, estados, onClick, invertido, esTemporal }) {
  const lista = invertido ? [...dientes].reverse() : dientes;
  return (
    <div className={`dientes-row ${esTemporal ? 'dientes-row-temporal' : ''}`}>
      {lista.map(num => (
        <Diente key={num} numero={num} estado={estados[num]} onClick={onClick} esTemporal={esTemporal} />
      ))}
    </div>
  );
}

export default function Odontograma({ datos = {}, onGuardar, consultaId }) {
  const datosInit = datos?.dientes || datos;
  const [estados, setEstados] = useState(datosInit);
  const [herramienta, setHerramienta] = useState('caries');
  const [mostrarTemporales, setMostrarTemporales] = useState(true);

  const handleClick = (num) => {
    setEstados(prev => {
      const current = prev[num];
      const next = current === herramienta ? 'sano' : herramienta;
      return { ...prev, [num]: next };
    });
  };

  const handleGuardar = () => {
    if (onGuardar) onGuardar(estados);
  };

  return (
    <div className="odontograma-container">
      <div className="odontograma-toolbar">
        <h3>Odontograma</h3>
        <div className="odontograma-herramientas">
          {Object.entries(ESTADOS).map(([key, val]) => (
            <button
              key={key}
              className={`tool-btn ${herramienta === key ? 'active' : ''}`}
              style={{ borderColor: herramienta === key ? val.color : 'transparent', backgroundColor: herramienta === key ? val.color + '20' : undefined }}
              onClick={() => setHerramienta(key)}
            >
              <span className="tool-symbol" style={{ color: val.color }}>{val.symbol || '○'}</span>
              <span className="tool-label">{val.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="odontograma-grid">
        <div className="odontograma-seccion">
          <div className="seccion-label">Dentición Permanente Superior</div>
          <div className="arcada-superior">
            <DientesRow dientes={DIENTES_PERMANENTES.superior[0]} estados={estados} onClick={handleClick} invertido={false} />
            <div className="separador-vertical" />
            <DientesRow dientes={DIENTES_PERMANENTES.superior[1]} estados={estados} onClick={handleClick} invertido={false} />
          </div>
        </div>

        {mostrarTemporales && (
          <>
            <div className="odontograma-temporales">
              <div className="seccion-label">Dentición Temporal Superior</div>
              <div className="arcada-temporal">
                <DientesRow dientes={DIENTES_TEMPORALES.superior[0]} estados={estados} onClick={handleClick} invertido={false} esTemporal={true} />
                <div className="separador-vertical" />
                <DientesRow dientes={DIENTES_TEMPORALES.superior[1]} estados={estados} onClick={handleClick} invertido={false} esTemporal={true} />
              </div>
            </div>
            <div className="odontograma-temporales">
              <div className="seccion-label">Dentición Temporal Inferior</div>
              <div className="arcada-temporal">
                <DientesRow dientes={DIENTES_TEMPORALES.inferior[0]} estados={estados} onClick={handleClick} invertido={false} esTemporal={true} />
                <div className="separador-vertical" />
                <DientesRow dientes={DIENTES_TEMPORALES.inferior[1]} estados={estados} onClick={handleClick} invertido={false} esTemporal={true} />
              </div>
            </div>
          </>
        )}

        <div className="odontograma-seccion">
          <div className="seccion-label">Dentición Permanente Inferior</div>
          <div className="arcada-inferior">
            <DientesRow dientes={DIENTES_PERMANENTES.inferior[0]} estados={estados} onClick={handleClick} invertido={false} />
            <div className="separador-vertical" />
            <DientesRow dientes={DIENTES_PERMANENTES.inferior[1]} estados={estados} onClick={handleClick} invertido={false} />
          </div>
        </div>
      </div>

      <div className="odontograma-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => setMostrarTemporales(!mostrarTemporales)}>
          {mostrarTemporales ? 'Ocultar Temporales' : 'Mostrar Temporales'}
        </button>
        <button className="btn btn-primary" onClick={handleGuardar}>Guardar Odontograma</button>
      </div>
    </div>
  );
}
