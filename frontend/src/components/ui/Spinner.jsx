import './Spinner.css';

export default function Spinner({ size = 'md', className = '' }) {
  return (
    <div className={`ui-spinner ui-spinner-${size} ${className}`}>
      <div className="ui-spinner-ring" />
    </div>
  );
}
