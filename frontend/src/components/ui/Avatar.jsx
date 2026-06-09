import './Avatar.css';

export default function Avatar({
  name = '',
  src,
  size = 'md',
  className = ''
}) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colors = ['#4361ee', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const colorIndex = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={`ui-avatar ui-avatar-${size} ${className}`}
      style={!src ? { background: colors[colorIndex] } : undefined}
    >
      {src ? (
        <img src={src} alt={name} className="ui-avatar-img" />
      ) : (
        <span className="ui-avatar-initials">{initials}</span>
      )}
    </div>
  );
}
