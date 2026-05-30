import { useState } from 'react';
import OdontogramaExp from './OdontogramaExp';
import './OdontogramaExp.css';

export default function TestOdontograma() {
  const [datos, setDatos] = useState({ dientes: {} });

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>Test Odontograma FDI</h1>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
        Odontograma experimental con 5 superficies individuales por diente.
        Selecciona un diente y luego una superficie para marcarla.
      </p>

      <OdontogramaExp
        datos={datos}
        editable={true}
        onCambio={setDatos}
        titulo="Odontograma del Paciente"
      />

      <div style={{ marginTop: '20px', padding: '12px', background: '#f1f5f9', borderRadius: '8px' }}>
        <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>JSON del odontograma:</h4>
        <pre style={{ fontSize: '11px', color: '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {JSON.stringify({ dientes: datos.dientes }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
