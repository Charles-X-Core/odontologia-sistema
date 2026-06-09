import './Badge.css';

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = ''
}) {
  const classes = [
    'ui-badge',
    `ui-badge-${variant}`,
    `ui-badge-${size}`,
    dot && 'ui-badge-dot',
    className
  ].filter(Boolean).join(' ');

  return <span className={classes}>{children}</span>;
}
