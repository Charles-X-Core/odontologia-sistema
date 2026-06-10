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
      <div className="login-bg-pattern"></div>
      <button
        className="login-close-btn"
        onClick={() => window.electronAPI?.windowClose()}
        title="Cerrar aplicacion"
      >
        &times;
      </button>
      <div className="login-container">
        <div className="login-branding">
          <div className="login-branding-content">
            <img src="/logo2.png" alt="Vita Mirabilis" className="login-branding-logo" />
            <div className="login-divider"></div>
            <div className="login-features">
              <div className="login-feature">
                <div className="login-feature-dot"></div>
                <span>Historias clinicas digitales</span>
              </div>
              <div className="login-feature">
                <div className="login-feature-dot"></div>
                <span>Odontograma interactivo</span>
              </div>
              <div className="login-feature">
                <div className="login-feature-dot"></div>
                <span>Envio por WhatsApp</span>
              </div>
              <div className="login-feature">
                <div className="login-feature-dot"></div>
                <span>100% portable</span>
              </div>
            </div>
          </div>
          <div className="login-branding-footer">
            <p>Vita Mirabilis v1.0</p>
          </div>
        </div>

        <div className="login-form-section">
          <div className="login-form-card">
            <div className="login-form-header">
              <h2>Bienvenido</h2>
              <p>Ingresa tus credenciales para acceder al sistema</p>
            </div>

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field">
                <label htmlFor="usuario">Usuario</label>
                <div className="login-input-wrapper">
                  <input
                    id="usuario"
                    type="text"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    placeholder="Nombre de usuario"
                    required
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="password">Contrasena</label>
                <div className="login-input-wrapper">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contrasena"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="login-btn"
                disabled={cargando || !usuario || !password}
              >
                {cargando ? (
                  <span className="login-btn-loading">
                    <span className="login-spinner"></span>
                    Ingresando...
                  </span>
                ) : (
                  'Iniciar Sesion'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
