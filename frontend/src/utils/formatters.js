export function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

export function formatFecha(fecha) {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleDateString('es-ES');
}

export function formatMoney(monto) {
  return `$${(monto || 0).toLocaleString()}`;
}
