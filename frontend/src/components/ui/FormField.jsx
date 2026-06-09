import './FormField.css';

export default function FormField({
  label,
  error,
  hint,
  required = false,
  children,
  className = ''
}) {
  return (
    <div className={`ui-form-field ${error ? 'ui-form-field-error' : ''} ${className}`}>
      {label && (
        <label className="ui-form-label">
          {label}
          {required && <span className="ui-form-required">*</span>}
        </label>
      )}
      {children}
      {error && <p className="ui-form-error">{error}</p>}
      {hint && !error && <p className="ui-form-hint">{hint}</p>}
    </div>
  );
}
