const db = require('./database');
const bcrypt = require('bcryptjs');

console.log('Insertando datos de prueba...');

const insertUsuario = db.prepare(`
  INSERT OR IGNORE INTO usuarios (nombre, email, password, rol)
  VALUES (?, ?, ?, ?)
`);

const insertPaciente = db.prepare(`
  INSERT OR IGNORE INTO pacientes (nombre, dni, telefono, email, fecha_nacimiento, sexo)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertHistoria = db.prepare(`
  INSERT OR IGNORE INTO historias_clinicas (paciente_id, antecedentes, alergias, observaciones)
  VALUES (?, ?, ?, ?)
`);

const insertConsulta = db.prepare(`
  INSERT INTO consultas (historia_id, motivo, diagnostico, tratamiento, notas)
  VALUES (?, ?, ?, ?, ?)
`);

const insertOdontograma = db.prepare(`
  INSERT INTO odontogramas (consulta_id, datos_json)
  VALUES (?, ?)
`);

const pacientes = [
  ['Maria Garcia', '12345678', '555-0101', 'maria@email.com', '1985-03-15', 'F'],
  ['Juan Lopez', '87654321', '555-0202', 'juan@email.com', '1990-07-22', 'M'],
  ['Ana Martinez', '11223344', '555-0303', 'ana@email.com', '1978-11-30', 'F'],
];

db.exec('BEGIN');

try {
  const adminHash = bcrypt.hashSync('admin', 10);
  insertUsuario.run('Admin', 'admin', adminHash, 'admin');
  insertUsuario.run('Dr. Carlos Lopez', 'doctor', bcrypt.hashSync('doctor', 10), 'odontologo');

  for (const p of pacientes) {
    insertPaciente.run(...p);
  }

  insertHistoria.run(1, 'Hipertension arterial controlada', 'Penicilina', 'Paciente con ansiedad dental');
  insertHistoria.run(2, 'Ninguno conocido', 'Ninguna', '');
  insertHistoria.run(3, 'Diabetes tipo 2', 'Sulfa', 'Control glucemico cada 3 meses');

  insertConsulta.run(1, 'Dolor molar superior derecho', 'Caries profunda molar 16', 'Endodoncia y corona', 'Programar segunda sesion en 2 semanas');
  insertConsulta.run(1, 'Control post-endodoncia', 'Evolucion favorable', 'Proceder con restauracion definitiva', 'Sin dolor referido');
  insertConsulta.run(2, 'Revision general', 'Caries incisivo inferior', 'Restauracion con resina', 'Primera visita');
  insertConsulta.run(3, 'Dolor premolar', 'Fractura parcial premolar 35', 'Extraccion y puente', 'Referir a especialista');

  const odontograma1 = {
    version: 1,
    dientes: {
      '16': { estado: 'endodoncia', procedimientos: ['endodoncia'] },
      '17': { estado: 'sano', procedimientos: [] },
      '26': { estado: 'caries', procedimientos: [] },
      '36': { estado: 'sano', procedimientos: [] },
      '46': { estado: 'restaurado', procedimientos: ['resina'] }
    }
  };

  const odontograma2 = {
    version: 2,
    dientes: {
      '16': { estado: 'corona', procedimientos: ['corona'] },
      '17': { estado: 'sano', procedimientos: [] },
      '26': { estado: 'caries', procedimientos: [] },
      '36': { estado: 'sano', procedimientos: [] },
      '46': { estado: 'restaurado', procedimientos: ['resina'] }
    }
  };

  insertOdontograma.run(1, JSON.stringify(odontograma1));
  insertOdontograma.run(2, JSON.stringify(odontograma2));
  insertOdontograma.run(3, JSON.stringify({
    version: 1,
    dientes: { '41': { estado: 'caries', procedimientos: [] } }
  }));

  db.exec('COMMIT');
  console.log('Datos de prueba insertados correctamente.');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Error:', err.message);
}
