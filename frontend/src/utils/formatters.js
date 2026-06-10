export function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

export function tipoDocLabel(tipo) {
  switch (tipo) {
    case 'dni': return 'DNI';
    case 'ce': return 'CE';
    case 'pasaporte': return 'PASAPORTE';
    case 'sin_doc': return 'DOC';
    default: return 'DNI';
  }
}

export function tipoDocPlaceholder(tipo) {
  switch (tipo) {
    case 'dni': return '8 digitos';
    case 'ce': return 'Ej: A12345678';
    case 'pasaporte': return 'Ej: AB1234567';
    case 'sin_doc': return 'Sin documento';
    default: return '';
  }
}

export function validarDocumento(tipo, numero) {
  if (!numero || numero.trim() === '') return tipo === 'sin_doc' || !tipo;
  const t = numero.trim();
  switch (tipo) {
    case 'dni': return /^\d{8}$/.test(t);
    case 'ce': return /^[A-Z]{1,2}\d{1,10}$/i.test(t) || /^\d{9,12}$/.test(t);
    case 'pasaporte': return /^[A-Z0-9]{6,15}$/i.test(t);
    default: return t.length >= 4;
  }
}

export function formatFecha(fecha) {
  if (!fecha) return '-';
  const d = new Date(fecha + 'T00:00:00');
  if (isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function formatFechaNacimiento(fecha) {
  if (!fecha) return '-';
  const d = new Date(fecha + 'T00:00:00');
  if (isNaN(d.getTime())) return fecha;
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

export function calcularEdad(fechaNac) {
  if (!fechaNac) return null;
  const h = new Date();
  const n = new Date(fechaNac + 'T00:00:00');
  if (isNaN(n.getTime())) return null;
  let e = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--;
  return e;
}

export function formatMoney(monto) {
  return `$${(monto || 0).toLocaleString()}`;
}
