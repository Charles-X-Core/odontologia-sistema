import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Pacientes from './components/Pacientes';
import Historial from './components/Historial';
import './App.css';

function App() {
  const { usuario, cargando } = useAuth();

  if (cargando) return <div className="loading-full">Cargando...</div>;
  if (!usuario) return <Login />;

  return <LayoutAuth />;
}

function LayoutAuth() {
  const [view, setView] = useState('dashboard');
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);

  const verHistorial = (paciente) => {
    setPacienteSeleccionado(paciente);
    setView('historial');
  };

  const volverPacientes = () => {
    setPacienteSeleccionado(null);
    setView('pacientes');
  };

  return (
    <div className="layout">
      <Sidebar active={view} onNavigate={setView} />
      <main className="main-content">
        {view === 'dashboard' && <Dashboard onNavigate={setView} />}
        {view === 'pacientes' && <Pacientes onVerHistorial={verHistorial} />}
        {view === 'historial' && pacienteSeleccionado && (
          <Historial paciente={pacienteSeleccionado} onVolver={volverPacientes} />
        )}
      </main>
    </div>
  );
}

export default App;
