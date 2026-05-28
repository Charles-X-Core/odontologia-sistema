import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const saved = localStorage.getItem('usuario');
    if (token && saved) {
      setUsuario(JSON.parse(saved));
    }
    setCargando(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.auth.login(email, password);
    if (res.error) return res;
    localStorage.setItem('token', res.token);
    localStorage.setItem('usuario', JSON.stringify(res.usuario));
    setUsuario(res.usuario);
    return null;
  };

  const register = async (data) => {
    const res = await api.auth.register(data);
    if (res.error) return res;
    localStorage.setItem('token', res.token);
    localStorage.setItem('usuario', JSON.stringify(res.usuario));
    setUsuario(res.usuario);
    return null;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, login, register, logout, cargando }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
