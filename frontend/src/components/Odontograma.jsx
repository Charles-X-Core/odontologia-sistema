import { useState } from 'react';
import {
  CheckCircle, AlertTriangle, Circle, CircleDot,
  Crown, X, CircleOff, Triangle, Pin, Minus
} from 'lucide-react';

const ESTADOS = {
  sano:        { label: 'Sano',        color: '#22c55e', icon: CheckCircle,  letra: '' },
  caries:      { label: 'Caries',      color: '#991b1b', icon: AlertTriangle, letra: 'C' },
  obturado:    { label: 'Obturado',    color: '#3b82f6', icon: Circle,        letra: 'O' },
  endodoncia:  { label: 'Endodoncia',  color: '#8b5cf6', icon: CircleDot,     letra: 'E' },
  corona:      { label: 'Corona',      color: '#f59e0b', icon: Crown,         letra: 'CR' },
  extraccion:  { label: 'Por Extraer',  color: '#ef4444', icon: X,             letra: 'X' },
  ausente:     { label: 'Extraido',     color: '#2563eb', icon: X,              letra: 'X' },
  provisional: { label: 'Provisional', color: '#06b6d4', icon: Triangle,      letra: 'P' },
  implante:    { label: 'Implante',    color: '#14b8a6', icon: Pin,            letra: 'I' },
  puente:      { label: 'Puente',      color: '#a855f7', icon: Minus,         letra: 'PU' },
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

function Diente({ numero, estado, onClick, esTemporal, sinColor }) {
  const config = ESTADOS[estado] || ESTADOS.sano;
  const Icon = config.icon;
  const isActive = estado && estado !== 'sano';
  const iconColor = sinColor ? '#000' : config.color;

  return (
    <div className={`diente-container ${esTemporal ? 'diente-temporal' : ''}`} onClick={() => onClick(numero)}>
      <div className={`diente-label-top ${esTemporal ? 'diente-label-temporal' : ''}`}>{numero}</div>
      <div
        className={`diente-box ${esTemporal ? 'diente-box-temporal' : ''} ${isActive ? 'diente-activo' : ''}`}
        style={{ borderColor: sinColor ? (isActive ? '#000' : '#aaa') : config.color }}
      >
        <DienteSVG numero={numero} />
        {isActive && (
          <div
            className="diente-estado-overlay"
            style={{
              backgroundColor: sinColor ? '#000' : config.color,
              color: '#fff',
            }}
          >
            <Icon size={esTemporal ? 10 : 14} strokeWidth={2.5} style={{ opacity: estado === 'ausente' ? 0.4 : 1 }} />
          </div>
        )}
      </div>
    </div>
  );
}

function DientesRow({ dientes, estados, onClick, invertido, esTemporal, sinColor }) {
  const lista = invertido ? [...dientes].reverse() : dientes;
  return (
    <div className={`dientes-row ${esTemporal ? 'dientes-row-temporal' : ''}`}>
      {lista.map(num => (
        <Diente
          key={num}
          numero={num}
          estado={estados[num]}
          onClick={onClick}
          esTemporal={esTemporal}
          sinColor={sinColor}
        />
      ))}
    </div>
  );
}

export default function Odontograma({ datos = {}, onGuardar, consultaId, soloLectura = false }) {
  const datosInit = datos?.dientes || datos;
  const [estados, setEstados] = useState(datosInit);
  const [herramienta, setHerramienta] = useState('caries');
  const [mostrarTemporales, setMostrarTemporales] = useState(true);
  const [sinColor, setSinColor] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const handleClick = (num) => {
    if (soloLectura || !onGuardar) return;
    setEstados(prev => {
      const current = prev[num];
      const next = current === herramienta ? 'sano' : herramienta;
      const nuevos = { ...prev, [num]: next };
      onGuardar(nuevos);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 1500);
      return nuevos;
    });
  };

  const handleGuardar = () => {
    if (!onGuardar) return;
    onGuardar(estados);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1500);
  };

  return (
    <div className="odontograma-container">
      {!soloLectura && (
        <div className="odontograma-toolbar">
          <h3>Odontograma</h3>
          <div className="odontograma-herramientas">
            {Object.entries(ESTADOS).map(([key, val]) => {
              const Icon = val.icon;
              return (
                <button
                  key={key}
                  className={`tool-btn ${herramienta === key ? 'active' : ''}`}
                  style={{
                    borderColor: herramienta === key ? (sinColor ? '#000' : val.color) : 'transparent',
                    backgroundColor: herramienta === key ? (sinColor ? '#0002' : val.color + '20') : undefined,
                  }}
                  onClick={() => setHerramienta(key)}
                >
                  <Icon
                    size={16}
                    style={{ color: sinColor ? '#000' : val.color }}
                    strokeWidth={2}
                  />
                  <span className="tool-label">{val.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="odontograma-grid">
        <div className="odontograma-seccion">
          <div className="seccion-label">Denticion Permanente Superior</div>
          <div className="arcada-superior">
            <DientesRow dientes={DIENTES_PERMANENTES.superior[0]} estados={estados} onClick={handleClick} invertido={false} sinColor={sinColor} />
            <div className="separador-vertical" />
            <DientesRow dientes={DIENTES_PERMANENTES.superior[1]} estados={estados} onClick={handleClick} invertido={false} sinColor={sinColor} />
          </div>
        </div>

        {!soloLectura && mostrarTemporales && (
          <>
            <div className="odontograma-temporales">
              <div className="seccion-label">Denticion Temporal Superior</div>
              <div className="arcada-temporal">
                <DientesRow dientes={DIENTES_TEMPORALES.superior[0]} estados={estados} onClick={handleClick} invertido={false} esTemporal={true} sinColor={sinColor} />
                <div className="separador-vertical" />
                <DientesRow dientes={DIENTES_TEMPORALES.superior[1]} estados={estados} onClick={handleClick} invertido={false} esTemporal={true} sinColor={sinColor} />
              </div>
            </div>
            <div className="odontograma-temporales">
              <div className="seccion-label">Denticion Temporal Inferior</div>
              <div className="arcada-temporal">
                <DientesRow dientes={DIENTES_TEMPORALES.inferior[0]} estados={estados} onClick={handleClick} invertido={false} esTemporal={true} sinColor={sinColor} />
                <div className="separador-vertical" />
                <DientesRow dientes={DIENTES_TEMPORALES.inferior[1]} estados={estados} onClick={handleClick} invertido={false} esTemporal={true} sinColor={sinColor} />
              </div>
            </div>
          </>
        )}

        <div className="odontograma-seccion">
          <div className="seccion-label">Denticion Permanente Inferior</div>
          <div className="arcada-inferior">
            <DientesRow dientes={DIENTES_PERMANENTES.inferior[0]} estados={estados} onClick={handleClick} invertido={false} sinColor={sinColor} />
            <div className="separador-vertical" />
            <DientesRow dientes={DIENTES_PERMANENTES.inferior[1]} estados={estados} onClick={handleClick} invertido={false} sinColor={sinColor} />
          </div>
        </div>
      </div>

      {!soloLectura && (
        <div className="odontograma-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setMostrarTemporales(!mostrarTemporales)}>
            {mostrarTemporales ? 'Ocultar Temporales' : 'Mostrar Temporales'}
          </button>
          <button
            className={`btn btn-sm ${sinColor ? 'btn-secondary' : 'btn-outline'}`}
            onClick={() => setSinColor(!sinColor)}
          >
            {sinColor ? 'Modo Color' : 'Sin Color'}
          </button>
          <button className="btn btn-primary" onClick={handleGuardar}>
            {guardado ? 'Guardado' : 'Guardar Odontograma'}
          </button>
        </div>
      )}
    </div>
  );
}
