const db = require('./database');
const bcrypt = require('bcryptjs');

console.log('Insertando datos de prueba...');

try {
  const insertUsuario = db.prepare(`INSERT OR IGNORE INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)`);
  insertUsuario.run('Admin', 'admin', bcrypt.hashSync('admin', 10), 'admin');
  insertUsuario.run('Dr. Carlos Alonso', 'doctor', bcrypt.hashSync('doctor', 10), 'odontologo');
  console.log('  Usuarios OK');

  const insertPaciente = db.prepare(`INSERT OR IGNORE INTO pacientes (apellido_paterno, apellido_materno, nombres, dni, telefono, email, fecha_nacimiento, sexo, estado_civil, direccion, lugar_nacimiento, lugar_procedencia, grado_instruccion, ocupacion, nombre_acompanante, contacto_emergencia, telefono_emergencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const pacientes = [
    ['Garcia', 'Lopez', 'Maria Elena', '12345678', '555-0101', 'maria@email.com', '1985-03-15', 'F', 'Casado', 'Av. Principal 123', 'Lima', 'Lima', 'Universitario', 'Docente', '', 'Pedro Garcia', '555-9901'],
    ['Lopez', 'Martinez', 'Juan Carlos', '87654321', '555-0202', 'juan@email.com', '1990-07-22', 'M', 'Soltero', 'Jr. San Martin 456', 'Arequipa', 'Arequipa', 'Secundario', 'Contador', '', 'Rosa Martinez', '555-9902'],
    ['Martinez', 'Rodriguez', 'Ana Lucia', '11223344', '555-0303', 'ana@email.com', '1978-11-30', 'F', 'Divorciado', 'Calle Los Olivos 789', 'Cusco', 'Cusco', 'Universitario', 'Enfermera', '', 'Luis Martinez', '555-9903'],
  ];
  for (const p of pacientes) insertPaciente.run(...p);
  console.log('  Pacientes OK');

  const insertHistoria = db.prepare(`INSERT OR IGNORE INTO historias_clinicas (paciente_id, numero_historia, observaciones, alergia_medicamentos, propension_hemorragias, complicaciones_anestesia, presion_arterial_medicacion, cardiopatias_personales, cardiopatias_familiares, diabetes_personal, diabetes_familiar, hepatitis, otras_enfermedades, enfermedad_actual_medicacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  insertHistoria.run(1, '1', 'Paciente con ansiedad dental severa', 'Si: Penicilina', 'No', 'No', 'Si: Hipertension arterial, toma Losartan 50mg diario', 'No', 'Si: Padre con infarto a los 60 anios', 'No', 'Si: Madre con Diabetes tipo 2', 'No', 'No controla glucemia regularmente', 'Losartan 50mg diario');
  insertHistoria.run(2, '2', 'Primera visita, buen estado general', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No toma medicacion actual');
  insertHistoria.run(3, '3', 'Requiere control antes de procedimientos invasivos', 'Si: Sulfa', 'No', 'No', 'Si: Hipertension leve controlada', 'No', 'No', 'Si: Diabetes tipo 2 controlada', 'No', 'No', 'Control glucemico cada 3 meses', 'Metformina 850mg cada 12 horas');
  console.log('  Historias clinicas OK');

  const insertConsulta = db.prepare(`INSERT INTO consultas (historia_id, fecha, hora, motivo, tiempo_enfermedad, signos_sintomas, relato_cronologico, funciones_biologicas, signos_vitales, examen_clinico_general, evaluacion_odontoestomatologica, diagnostico_lista, plan_tratamiento, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  insertConsulta.run(1, '2026-05-10', '09:30', 'Dolor molar superior derecho', '5 dias', 'Dolor intenso al masticar, sensibilidad al frio', 'Paciente refiere que el dolor inicio hace 5 dias progresivamente, empeora con alimentos calientes', 'Sueno interrumpido por dolor. Apetito disminuido. Evacuaciones normales. Orina normal', JSON.stringify({ presion_arterial: '130/85', pulso: '78', temperatura: '36.8', frecuencia_cardiaca: '78', frecuencia_respiratoria: '16' }), 'Paciente consciente, colaborador, facies de dolor', 'Caries profunda en pieza 16 con exposicion pulpar. Dolor a la percusion. Sin fistula.', JSON.stringify([{ texto: 'Caries profunda molar 16 con pulpitis irreversible', tipo: 'clinico' }]), JSON.stringify({ descripcion: 'Endodoncia molar 16', procedimientos: ['Endodoncia molar 16', 'Corona ceramica molar 16'], secuencia: 'Primero endodoncia, luego corona en 2 semanas' }), 'Programar segunda sesion en 2 semanas');
  insertConsulta.run(1, '2026-05-20', '10:00', 'Control post-endodoncia molar 16', 'N/A', 'Sin dolor, leve molestia a la palpacion', 'Paciente acude a control post-endodoncia. Refiere mejoria significativa del dolor', 'Sueno normal. Apetito normal. Evacuaciones normales. Orina normal', JSON.stringify({ presion_arterial: '125/80', pulso: '72', temperatura: '36.5', frecuencia_cardiaca: '72', frecuencia_respiratoria: '14' }), 'Paciente sin signos de alarma. Endodoncia completa, obturada.', 'Evolucion favorable post-endodoncia molar 16. Sin dolor.', JSON.stringify([{ texto: 'Evolucion favorable post-endodoncia molar 16', tipo: 'clinico' }]), JSON.stringify({ descripcion: 'Restauracion definitiva molar 16', procedimientos: ['Corona ceramica molar 16'], secuencia: 'Proceder con corona tras cicatrizacion' }), 'Proceder con corona. Paciente informado del costo.');
  insertConsulta.run(2, '2026-05-15', '11:00', 'Revision general y limpieza', 'N/A', 'Sin molestias principales', 'Paciente acude a primera visita para revision de rutina', 'Sueno normal. Apetito normal. Evacuaciones normales. Orina normal', JSON.stringify({ presion_arterial: '120/75', pulso: '68', temperatura: '36.4', frecuencia_cardiaca: '68', frecuencia_respiratoria: '14' }), 'Paciente sano, buena salud bucal general', 'Caries incisivo inferior 41. Acumulacion de sarro. Encias inflamadas.', JSON.stringify([{ texto: 'Caries incisivo inferior 41', tipo: 'clinico' }, { texto: 'Gingivitis leve generalizada', tipo: 'clinico' }]), JSON.stringify({ descripcion: 'Restauracion + limpieza', procedimientos: ['Restauracion con resina compuesta 41', 'Destartraje y pulido'], secuencia: 'Primero restauracion, luego limpieza' }), 'Primera visita. Ensenar tecnica de cepillado correcta.');
  insertConsulta.run(3, '2026-05-18', '14:30', 'Dolor premolar inferior izquierdo', '2 semanas', 'Dolor al masticar, fractura visible', 'Paciente refiere que noto una fractura en un diente hace 2 semanas, el dolor ha sido constante', 'Sueno interrumpido. Apetito normal. Evacuaciones normales. Orina normal', JSON.stringify({ presion_arterial: '135/88', pulso: '80', temperatura: '36.7', frecuencia_cardiaca: '80', frecuencia_respiratoria: '16' }), 'Paciente con diabetes tipo 2 controlada. Facies de dolor.', 'Fractura parcial premolar 35. Caries subyacente. Dolor a la percusion.', JSON.stringify([{ texto: 'Fractura parcial premolar 35 con caries subyacente', tipo: 'clinico' }]), JSON.stringify({ descripcion: 'Extraccion y puente', procedimientos: ['Extraccion premolar 35', 'Puente fijo 34-36'], secuencia: 'Extraccion primero, luego puente tras cicatrizacion de 3 meses' }), 'Referir a cirujano maxilofacial. Control de glucemia antes de procedimiento.');
  console.log('  Consultas OK');

  const insertOdontograma = db.prepare(`INSERT INTO odontogramas (consulta_id, datos_json) VALUES (?, ?)`);
  const odontograma1 = { version: 1, dientes: { '16': { estado: 'endodoncia', procedimientos: ['endodoncia'] }, '17': { estado: 'sano', procedimientos: [] }, '26': { estado: 'caries', procedimientos: [] }, '36': { estado: 'sano', procedimientos: [] }, '46': { estado: 'restaurado', procedimientos: ['resina'] } } };
  const odontograma2 = { version: 2, dientes: { '16': { estado: 'corona', procedimientos: ['corona'] }, '17': { estado: 'sano', procedimientos: [] }, '26': { estado: 'caries', procedimientos: [] }, '36': { estado: 'sano', procedimientos: [] }, '46': { estado: 'restaurado', procedimientos: ['resina'] } } };
  insertOdontograma.run(1, JSON.stringify(odontograma1));
  insertOdontograma.run(2, JSON.stringify(odontograma2));
  insertOdontograma.run(3, JSON.stringify({ version: 1, dientes: { '41': { estado: 'caries', procedimientos: [] } } }));
  insertOdontograma.run(4, JSON.stringify({ version: 1, dientes: { '35': { estado: 'extraccion', procedimientos: ['extraccion'] } } }));
  console.log('  Odontogramas OK');

  const insertTratamiento = db.prepare(`INSERT INTO tratamientos (paciente_id, consulta_id, fecha, pieza_dental, procedimiento_realizado, costo_total, monto_a_cuenta, saldo_pendiente, estado, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  insertTratamiento.run(1, 1, '2026-05-10', '16', 'Endodoncia molar 16', 80, 40, 40, 'completado', 'Primera sesion de endodoncia');
  insertTratamiento.run(1, 2, '2026-05-20', '16', 'Corona ceramica molar 16', 150, 50, 100, 'pendiente', 'Esperar cicatrizacion post-endodoncia');
  insertTratamiento.run(1, null, '2026-05-10', null, 'Limpieza dental profesional', 30, 30, 0, 'completado', '');
  insertTratamiento.run(2, 3, '2026-05-15', '41', 'Restauracion con resina compuesta incisivo 41', 25, 0, 25, 'pendiente', '');
  insertTratamiento.run(3, 4, '2026-05-18', '35', 'Extraccion premolar 35', 50, 25, 25, 'pendiente', 'Requiere control previo de glucemia');
  insertTratamiento.run(3, 4, '2026-05-18', '34-36', 'Puente fijo 34-36 (reemplaza 35)', 450, 100, 350, 'pendiente', 'Requiere valoracion previa y extraccion');
  console.log('  Tratamientos OK');

  const insertReceta = db.prepare(`INSERT INTO recetas (consulta_id, paciente_id, medicamentos, indicaciones) VALUES (?, ?, ?, ?)`);
  insertReceta.run(1, 1, JSON.stringify([{ nombre: 'Ibuprofeno', dosis: '600mg', frecuencia: 'Cada 8 horas', duracion: '5 dias' }, { nombre: 'Amoxicilina', dosis: '500mg', frecuencia: 'Cada 8 horas', duracion: '7 dias' }]), 'Tomar con alimentos. No consumir alcohol durante el tratamiento.');
  insertReceta.run(3, 2, JSON.stringify([{ nombre: 'Paracetamol', dosis: '500mg', frecuencia: 'Cada 6 horas', duracion: '3 dias' }]), 'Solo si presenta dolor.');
  console.log('  Recetas OK');

  const insertImagen = db.prepare(`INSERT INTO imagenes (paciente_id, consulta_id, archivo_nombre, archivo_original, tipo, descripcion) VALUES (?, ?, ?, ?, ?, ?)`);
  insertImagen.run(1, 1, 'radiografia-molar16.jpg', 'radiografia-molar16.jpg', 'radiografia', 'Radiografia periapical molar 16 pre-endodoncia');
  insertImagen.run(1, 2, 'foto-post-tratamiento.jpg', 'foto-post-tratamiento.jpg', 'foto', 'Foto clinica post-endodoncia molar 16');
  console.log('  Imagenes OK');

  console.log('\nDatos de prueba insertados correctamente.');
  console.log('  Admin: admin / admin');
  console.log('  Doctor: doctor / doctor');
  console.log('  3 pacientes, 3 historias, 4 consultas, 6 tratamientos, 2 recetas, 2 imagenes');
} catch (err) {
  console.error('Error:', err.message);
  console.error(err.stack);
}
