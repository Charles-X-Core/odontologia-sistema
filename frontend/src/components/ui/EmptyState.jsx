import './EmptyState.css';

export default function EmptyState({
  icon = '&#128196;',
  title = 'No hay datos',
  description,
  action,
  actionLabel,
  onAction,
  className = ''
}) {
  return (
    <div className={`ui-empty-state ${className}`}>
      <div className="ui-empty-state-icon" dangerouslySetInnerHTML={{ __html: icon }} />
      <h4 className="ui-empty-state-title">{title}</h4>
      {description && <p className="ui-empty-state-desc">{description}</p>}
      {(action || onAction) && (
        <button className="ui-empty-state-action" onClick={onAction || action}>
          {actionLabel || 'Crear'}
        </button>
      )}
    </div>
  );
}
