import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Login from '../components/Login';
import BottomTabs from './BottomTabs';
import HomeTab from './HomeTab';
import CalendarTab from './CalendarTab';
import PatientsTab from './PatientsTab';
import PatientDetail from './PatientDetail';
import AppointmentForm from './AppointmentForm';
import './MobileApp.css';

export default function MobileApp() {
  const { usuario, cargando } = useAuth();
  const [tab, setTab] = useState('home');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [appointmentForm, setAppointmentForm] = useState(null);

  if (cargando) return <div className="mobile-loading">Cargando...</div>;
  if (!usuario) return <Login />;

  const handleViewPatient = (patient) => {
    setSelectedPatient(patient);
    setTab('patient-detail');
  };

  const handleBackFromPatient = () => {
    setSelectedPatient(null);
    setTab('patients');
  };

  const handleNewAppointment = (prefill) => {
    setAppointmentForm(prefill || {});
    setTab('new-appointment');
  };

  const handleEditAppointment = (cita) => {
    setAppointmentForm({ editMode: true, cita });
    setTab('new-appointment');
  };

  const handleAppointmentDone = () => {
    setAppointmentForm(null);
    setTab('home');
  };

  const renderTab = () => {
    switch (tab) {
      case 'home':
        return <HomeTab onViewPatient={handleViewPatient} onNewAppointment={handleNewAppointment} onEditAppointment={handleEditAppointment} />;
      case 'calendar':
        return <CalendarTab onViewPatient={handleViewPatient} onNewAppointment={handleNewAppointment} onEditAppointment={handleEditAppointment} />;
      case 'patients':
        return <PatientsTab onViewPatient={handleViewPatient} onNewAppointment={handleNewAppointment} />;
      case 'patient-detail':
        return <PatientDetail patient={selectedPatient} onBack={handleBackFromPatient} onNewAppointment={(p) => handleNewAppointment({ paciente: p })} />;
      case 'new-appointment':
        return <AppointmentForm prefilled={appointmentForm} onDone={handleAppointmentDone} onBack={() => setTab(appointmentForm?.paciente ? 'patient-detail' : 'home')} />;
      default:
        return <HomeTab onViewPatient={handleViewPatient} onNewAppointment={handleNewAppointment} />;
    }
  };

  return (
    <div className="mobile-app">
      <div className="mobile-content">
        {renderTab()}
      </div>
      {tab !== 'patient-detail' && tab !== 'new-appointment' && (
        <BottomTabs active={tab} onNavigate={setTab} />
      )}
    </div>
  );
}
