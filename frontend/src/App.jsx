import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Pacientes from './components/Pacientes';
import Historial from './components/Historial';
import Recepcion from './components/Recepcion';
import SesionClinica from './components/SesionClinica';
import Paciente360 from './components/Paciente360';
import Configuracion from './components/Configuracion';
import EstacionDatos from './components/EstacionDatos';
import WhatsAppPanel from './components/WhatsAppPanel';
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

  const verPaciente360 = (paciente) => {
    setPacienteSeleccionado(paciente);
    setView('paciente360');
  };

  const volverPacientes = () => {
    setPacienteSeleccionado(null);
    setView('pacientes');
  };

  const iniciarSesion = (paciente) => {
    setPacienteSeleccionado(paciente);
    setView('sesion');
  };

  const sesionCompletada = () => {
    setPacienteSeleccionado(null);
    setView('dashboard');
  };

  return (
    <div className="layout">
      <Sidebar active={view} onNavigate={setView} />
      <main className="main-content">
        {view === 'dashboard' && <Dashboard onNavigate={setView} />}
        {view === 'recepcion' && (
          <Recepcion onVolver={() => setView('dashboard')} onStartSesion={iniciarSesion} />
        )}
        {view === 'sesion' && pacienteSeleccionado && (
          <SesionClinica paciente={pacienteSeleccionado} onVolver={() => setView('recepcion')} onCompletado={sesionCompletada} />
        )}
        {view === 'pacientes' && <Pacientes onVerHistorial={verHistorial} onVer360={verPaciente360} />}
        {view === 'historial' && pacienteSeleccionado && (
          <Historial paciente={pacienteSeleccionado} onVolver={volverPacientes} onNuevaConsulta={() => iniciarSesion(pacienteSeleccionado)} />
        )}
        {view === 'paciente360' && pacienteSeleccionado && (
          <Paciente360 paciente={pacienteSeleccionado} onVolver={volverPacientes} onVerHistorial={verHistorial} />
        )}
        {view === 'configuracion' && (
          <Configuracion onVolver={() => setView('dashboard')} />
        )}
        {view === 'estacion-datos' && (
          <EstacionDatos onVolver={() => setView('dashboard')} />
        )}
        {view === 'whatsapp' && (
          <WhatsAppPanel onVolver={() => setView('dashboard')} />
        )}
      </main>
    </div>
  );
}

export default App;
