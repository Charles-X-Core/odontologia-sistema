import { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';

export default function ConfirmarPassword({ onConfirm, onCancelar, titulo = 'Confirmar accion' }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [verificando, setVerificando] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) { setError('Ingrese su password'); return; }
    setVerificando(true);
    setError('');
    try {
      const res = await api.auth.verificarPassword(password);
      if (res?.valido) {
        onConfirm();
      } else {
        setError('Password incorrecto');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch (err) {
      setError('Error al verificar password');
    }
    setVerificando(false);
  };

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--gray-800)' }}>{titulo}</h3>
          <button className="modal-close" onClick={onCancelar}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '12px', marginTop: 0 }}>
            Ingrese su password para continuar
          </p>
          <div className="field">
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Password"
              className="input-full"
              autoComplete="current-password"
            />
          </div>
          {error && <div className="alert alert-error" style={{ marginBottom: '8px' }}>{error}</div>}
          <div className="form-actions-inline">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCancelar}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={verificando}>
              {verificando ? 'Verificando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
