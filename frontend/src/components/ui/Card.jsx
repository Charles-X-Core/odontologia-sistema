import './Card.css';

export default function Card({
  children,
  title,
  subtitle,
  actions,
  padding = true,
  hover = false,
  className = '',
  onClick,
  ...props
}) {
  const classes = [
    'ui-card',
    hover && 'ui-card-hover',
    padding && 'ui-card-padded',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick} {...props}>
      {(title || actions) && (
        <div className="ui-card-header">
          <div>
            {title && <h3 className="ui-card-title">{title}</h3>}
            {subtitle && <p className="ui-card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="ui-card-actions">{actions}</div>}
        </div>
      )}
      <div className="ui-card-body">{children}</div>
    </div>
  );
}
