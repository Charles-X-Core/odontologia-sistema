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
            <img src="/logo2.png" alt="Logo" className="login-logo-img" />
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
