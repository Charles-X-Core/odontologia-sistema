import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');
    const err = await login(usuario, password);
    if (err) setError(err.error);
    setCargando(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="1.5">
              <path d="M12 2C8 2 5 5 5 8c0 2 1 4 2 5l-1 7c0 1 1 2 2 2h8c1 0 2-1 2-2l-1-7c1-1 2-3 2-5 0-3-3-6-7-6z"/>
              <circle cx="9" cy="8" r="1" fill="#4361ee"/>
              <circle cx="15" cy="8" r="1" fill="#4361ee"/>
            </svg>
          </div>
          <h1>Vita Mirabilis</h1>
          <p>Historias Clinicas Digitales</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label>Usuario</label>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="admin"
              required
            />
          </div>
          <div className="field">
            <label>Contrasena</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="admin"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={cargando}>
            {cargando ? 'Ingresando...' : 'Iniciar Sesion'}
          </button>
        </form>

        <div className="login-footer">
          <p>Credenciales de prueba:</p>
          <code>admin / admin &nbsp;|&nbsp; doctor / doctor</code>
        </div>
      </div>
    </div>
  );
}
