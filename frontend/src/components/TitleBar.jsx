const isElectron = window.location.protocol === 'file:' || window.electronAPI?.isElectron;

export default function TitleBar() {
  if (!isElectron) return null;

  const handleMinimize = () => window.electronAPI?.windowMinimize();
  const handleMaximize = () => window.electronAPI?.windowMaximize();
  const handleClose = () => window.electronAPI?.windowClose();

  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <div className="titlebar-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <span>Vita Mirabilis</span>
        </div>
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-btn titlebar-minimize" onClick={handleMinimize} title="Minimizar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
        </button>
        <button className="titlebar-btn titlebar-maximize" onClick={handleMaximize} title="Maximizar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        </button>
        <button className="titlebar-btn titlebar-close" onClick={handleClose} title="Cerrar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  );
}
