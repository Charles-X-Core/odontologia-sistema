const db = require('./database');
const bcrypt = require('bcryptjs');

console.log('Insertando datos de prueba...');

const insertUsuario = db.prepare(`INSERT OR IGNORE INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)`);
const insertPaciente = db.prepare(`INSERT OR IGNORE INTO pacientes (nombre, dni, telefono, email, fecha_nacimiento, sexo) VALUES (?, ?, ?, ?, ?, ?)`);
const insertHistoria = db.prepare(`INSERT OR IGNORE INTO historias_clinicas (paciente_id, antecedentes, alergias, observaciones) VALUES (?, ?, ?, ?)`);
const insertConsulta = db.prepare(`INSERT INTO consultas (historia_id, motivo, diagnostico, tratamiento, notas) VALUES (?, ?, ?, ?, ?)`);
const insertOdontograma = db.prepare(`INSERT INTO odontogramas (consulta_id, datos_json) VALUES (?, ?)`);
const insertTratamiento = db.prepare(`INSERT INTO tratamientos (paciente_id, descripcion, estado, costo, diente_numero, notas) VALUES (?, ?, ?, ?, ?, ?)`);
const insertReceta = db.prepare(`INSERT INTO recetas (consulta_id, paciente_id, medicamentos, indicaciones) VALUES (?, ?, ?, ?)`);
const insertImagen = db.prepare(`INSERT INTO imagenes (paciente_id, consulta_id, archivo_nombre, archivo_original, tipo, descripcion) VALUES (?, ?, ?, ?, ?, ?)`);

db.exec('BEGIN');

try {
  const adminHash = bcrypt.hashSync('admin', 10);
  insertUsuario.run('Admin', 'admin', adminHash, 'admin');
  insertUsuario.run('Dr. Carlos Lopez', 'doctor', bcrypt.hashSync('doctor', 10), 'odontologo');

  const pacientes = [
    ['Maria Garcia', '12345678', '555-0101', 'maria@email.com', '1985-03-15', 'F'],
    ['Juan Lopez', '87654321', '555-0202', 'juan@email.com', '1990-07-22', 'M'],
    ['Ana Martinez', '11223344', '555-0303', 'ana@email.com', '1978-11-30', 'F'],
  ];
  for (const p of pacientes) insertPaciente.run(...p);

  insertHistoria.run(1, 'Hipertension arterial controlada, toma medicacion diaria', 'Penicilina', 'Paciente con ansiedad dental severa');
  insertHistoria.run(2, 'Ninguno conocido', 'Ninguna', '');
  insertHistoria.run(3, 'Diabetes tipo 2, control glucemico cada 3 meses', 'Sulfa', 'Requiere control antes de procedimientos invasivos');

  insertConsulta.run(1, 'Dolor molar superior derecho', 'Caries profunda molar 16 con pulpa expuesta', 'Endodoncia molar 16', 'Programar segunda sesion en 2 semanas');
  insertConsulta.run(1, 'Control post-endodoncia molar 16', 'Evolucion favorable, sin dolor', 'Restauracion definitiva molar 16', 'Proceder con corona');
  insertConsulta.run(2, 'Revision general y limpieza', 'Caries incisivo inferior 41', 'Restauracion con resina compuesta', 'Primera visita, buen estado general');
  insertConsulta.run(3, 'Dolor premolar inferior izquierdo', 'Fractura parcial premolar 35', 'Extraccion premolar 35 y puente fijo', 'Referir a cirujano maxilofacial');

  const odontograma1 = { version: 1, dientes: { '16': { estado: 'endodoncia', procedimientos: ['endodoncia'] }, '17': { estado: 'sano', procedimientos: [] }, '26': { estado: 'caries', procedimientos: [] }, '36': { estado: 'sano', procedimientos: [] }, '46': { estado: 'restaurado', procedimientos: ['resina'] } } };
  const odontograma2 = { version: 2, dientes: { '16': { estado: 'corona', procedimientos: ['corona'] }, '17': { estado: 'sano', procedimientos: [] }, '26': { estado: 'caries', procedimientos: [] }, '36': { estado: 'sano', procedimientos: [] }, '46': { estado: 'restaurado', procedimientos: ['resina'] } } };
  insertOdontograma.run(1, JSON.stringify(odontograma1));
  insertOdontograma.run(2, JSON.stringify(odontograma2));
  insertOdontograma.run(3, JSON.stringify({ version: 1, dientes: { '41': { estado: 'caries', procedimientos: [] } } }));
  insertOdontograma.run(4, JSON.stringify({ version: 1, dientes: { '35': { estado: 'extraccion', procedimientos: ['extraccion'] } } }));

  insertTratamiento.run(1, 'Corona ceramica molar 16', 'en_proceso', 150, 16, 'Esperar cicatrizacion post-endodoncia');
  insertTratamiento.run(1, 'Limpieza dental profesional', 'completado', 30, null, '');
  insertTratamiento.run(2, 'Restauracion resina incisivo 41', 'pendiente', 25, 41, '');
  insertTratamiento.run(3, 'Puente fijo 34-36 (reemplaza 35)', 'pendiente', 450, 35, 'Requiere valoracion previa');

  insertReceta.run(1, 1, JSON.stringify([
    { nombre: 'Ibuprofeno', dosis: '600mg', frecuencia: 'Cada 8 horas', duracion: '5 dias' },
    { nombre: 'Amoxicilina', dosis: '500mg', frecuencia: 'Cada 8 horas', duracion: '7 dias' }
  ]), 'Tomar con alimentos. No consumir alcohol durante el tratamiento.');
  insertReceta.run(3, 2, JSON.stringify([
    { nombre: 'Paracetamol', dosis: '500mg', frecuencia: 'Cada 6 horas', duracion: '3 dias' }
  ]), 'Solo si presenta dolor.');

  insertImagen.run(1, 1, 'radiografia-molar16.jpg', 'radiografia-molar16.jpg', 'radiografia', 'Radiografia periapical molar 16 pre-endodoncia');
  insertImagen.run(1, 2, 'foto-post-tratamiento.jpg', 'foto-post-tratamiento.jpg', 'foto', 'Foto clinica post-endodoncia molar 16');

  db.exec('COMMIT');
  console.log('Datos de prueba insertados correctamente.');
  console.log('  Admin: admin / admin');
  console.log('  Doctor: doctor / doctor');
  console.log('  3 pacientes, 4 consultas, 4 tratamientos, 2 recetas, 2 imagenes');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Error:', err.message);
}
