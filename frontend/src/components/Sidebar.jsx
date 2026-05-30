import { useAuth } from '../context/AuthContext';

const menuItems = [
  { key: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { key: 'pacientes', label: 'Pacientes', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { key: 'test-odontograma', label: 'Test Odontograma', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
];

export default function Sidebar({ active, onNavigate }) {
  const { usuario, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
          <path d="M12 2C8 2 5 5 5 8c0 2 1 4 2 5l-1 7c0 1 1 2 2 2h8c1 0 2-1 2-2l-1-7c1-1 2-3 2-5 0-3-3-6-7-6z"/>
          <circle cx="9" cy="8" r="1" fill="white"/>
          <circle cx="15" cy="8" r="1" fill="white"/>
        </svg>
        <span>Vita Mirabilis</span>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.key}
            className={`sidebar-item ${active === item.key ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon}/>
            </svg>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar">{usuario?.nombre?.charAt(0)}</div>
          <div className="user-info">
            <span className="user-name">{usuario?.nombre}</span>
            <span className="user-role">{usuario?.rol === 'admin' ? 'Administrador' : 'Odontologo'}</span>
          </div>
        </div>
        <button className="btn-logout" onClick={logout} title="Cerrar sesion">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
