import './Table.css';

export default function Table({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No hay datos',
  className = ''
}) {
  return (
    <div className={`ui-table-container ${className}`}>
      <table className="ui-table">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                style={col.width ? { width: col.width } : undefined}
                className={col.align === 'right' ? 'ui-table-th-right' : ''}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="ui-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={row.id || rowIdx}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'ui-table-clickable' : ''}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={col.align === 'right' ? 'ui-table-td-right' : ''}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
