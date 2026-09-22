jest.mock('../db', () => ({
  prepare: jest.fn(),
}));

const db = require('../db');
const ctrl = require('../controllers/citaController');

function resMock() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

function fechaFutura(hora = '14:00', minAdelante = 60) {
  const d = new Date();
  d.setUTCMinutes(d.getUTCMinutes() + minAdelante);
  return {
    fecha: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
    hora,
  };
}

function pasado(minAtras = 120) {
  const d = new Date();
  d.setUTCMinutes(d.getUTCMinutes() - minAtras);
  return {
    fecha: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
    hora: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
  };
}

function citaDb(overrides = {}) {
  return {
    id: 1, paciente_id: 1, usuario_id: 1,
    fecha: '2099-01-01', hora: '10:00',
    duracion_minutos: 30, tipo: 'consulta',
    motivo: 'Test', motivo_editado: null,
    estado: 'pendiente', notas: '',
    ...overrides,
  };
}

function mockChain(getFn, runFn) {
  return {
    get: jest.fn().mockImplementation(getFn || (() => null)),
    all: jest.fn().mockReturnValue([]),
    run: jest.fn().mockImplementation(runFn || (() => ({ lastInsertRowid: 1, changes: 1 }))),
  };
}

function setupSequentialChains(chains) {
  db.prepare.mockReset();
  chains.forEach((chain) => {
    db.prepare.mockReturnValueOnce(chain);
  });
}

// ── crear ──────────────────────────────────────────────────────────

describe('citaController — crear', () => {
  test('rechaza crear cita con fecha y hora en el pasado', async () => {
    const p = pasado(120);
    setupSequentialChains([
      mockChain(() => ({ id: 1 })),
    ]);
    const req = { body: { paciente_id: 1, fecha: p.fecha, hora: p.hora }, usuario: { id: 1 } };
    const res = resMock();

    await ctrl.crear(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('pasado') })
    );
  });

  test('acepta crear cita con fecha y hora futura', async () => {
    const f = fechaFutura('14:00', 120);
    const cita = citaDb({ fecha: f.fecha, hora: f.hora });
    setupSequentialChains([
      mockChain(() => ({ id: 1 })),                    // SELECT paciente
      mockChain(null, () => ({ lastInsertRowid: 1 })), // INSERT
      mockChain(() => cita),                            // SELECT nueva cita
    ]);
    const req = { body: { paciente_id: 1, fecha: f.fecha, hora: f.hora }, usuario: { id: 1 } };
    const res = resMock();

    await ctrl.crear(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('rechaza si paciente no existe', async () => {
    const f = fechaFutura('14:00', 120);
    setupSequentialChains([
      mockChain(() => null),  // SELECT paciente → no existe
    ]);
    const req = { body: { paciente_id: 999, fecha: f.fecha, hora: f.hora }, usuario: { id: 1 } };
    const res = resMock();

    await ctrl.crear(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ── confirmar ──────────────────────────────────────────────────────

describe('citaController — confirmar', () => {
  test('rechaza confirmar si la hora de la cita ya pasó', async () => {
    const p = pasado(120);
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'pendiente', fecha: p.fecha, hora: p.hora })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.confirmar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('pasó') })
    );
  });

  test('acepta confirmar si la hora de la cita es futura', async () => {
    const f = fechaFutura('14:00', 120);
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'pendiente', fecha: f.fecha, hora: f.hora })),
      mockChain(null, () => ({ changes: 1 })),
      mockChain(() => citaDb({ estado: 'confirmada', fecha: f.fecha, hora: f.hora })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.confirmar(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Cita confirmada' })
    );
  });

  test('rechaza si estado no es pendiente', async () => {
    const f = fechaFutura('14:00', 120);
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada', fecha: f.fecha, hora: f.hora })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.confirmar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('confirmar') })
    );
  });
});

// ── asistio ────────────────────────────────────────────────────────

describe('citaController — asistio', () => {
  test('rechaza si estado es pendiente (solo confirmada)', async () => {
    const f = fechaFutura('14:00', 30);
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'pendiente', fecha: f.fecha, hora: f.hora })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.asistio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('confirmada') })
    );
  });

  test('rechaza si la hora actual es anterior a la ventana (15 min antes)', async () => {
    const f = fechaFutura('14:00', 120);
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada', fecha: f.fecha, hora: f.hora })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.asistio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('15 minutos') })
    );
  });

  test('acepta si la hora actual está dentro de la ventana', async () => {
    const ahora = new Date();
    ahora.setUTCMinutes(ahora.getUTCMinutes() + 2);
    const fecha = `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth() + 1).padStart(2, '0')}-${String(ahora.getUTCDate()).padStart(2, '0')}`;
    const hora = `${String(ahora.getUTCHours()).padStart(2, '0')}:${String(ahora.getUTCMinutes()).padStart(2, '0')}`;

    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada', fecha, hora })),
      mockChain(null, () => ({ changes: 1 })),
      mockChain(() => citaDb({ estado: 'asistio', fecha, hora })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.asistio(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Asistencia registrada' })
    );
  });

  test('rechaza si la ventana de asistencia ya pasó', async () => {
    const p = pasado(180);
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada', fecha: p.fecha, hora: p.hora })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.asistio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('pasó') })
    );
  });
});

// ── completar ──────────────────────────────────────────────────────

describe('citaController — completar', () => {
  test('acepta completar desde estado asistio', async () => {
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'asistio', fecha: '2099-01-01', hora: '10:00' })),
      mockChain(null, () => ({ changes: 1 })),
    ]);
    const req = { params: { id: 1 }, body: { consulta_id: 42 } };
    const res = resMock();

    await ctrl.completar(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('completada') })
    );
  });

  test('rechaza completar si estado no es asistio', async () => {
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada' })),
    ]);
    const req = { params: { id: 1 }, body: { consulta_id: 42 } };
    const res = resMock();

    await ctrl.completar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ── actualizar (máquina de estados) ────────────────────────────────

describe('citaController — actualizar (máquina de estados)', () => {
  test('rechaza transición pendiente → completada', async () => {
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'pendiente' })),
    ]);
    const req = { params: { id: 1 }, body: { estado: 'completada' } };
    const res = resMock();

    await ctrl.actualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('inválida') })
    );
  });

  test('rechaza transición completada → pendiente', async () => {
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'completada' })),
    ]);
    const req = { params: { id: 1 }, body: { estado: 'pendiente' } };
    const res = resMock();

    await ctrl.actualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rechaza transición cancelada → confirmada', async () => {
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'cancelada' })),
    ]);
    const req = { params: { id: 1 }, body: { estado: 'confirmada' } };
    const res = resMock();

    await ctrl.actualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rechaza transición pendiente → asistio', async () => {
    const f = fechaFutura('14:00', 30);
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'pendiente', fecha: f.fecha, hora: f.hora })),
    ]);
    const req = { params: { id: 1 }, body: { estado: 'asistio' } };
    const res = resMock();

    await ctrl.actualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rechaza transición confirmada → completada', async () => {
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada' })),
    ]);
    const req = { params: { id: 1 }, body: { estado: 'completada' } };
    const res = resMock();

    await ctrl.actualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('permite transición pendiente → cancelada', async () => {
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'pendiente' })),
      mockChain(null, () => ({ changes: 1 })),
      mockChain(() => citaDb({ estado: 'cancelada' })),
    ]);
    const req = { params: { id: 1 }, body: { estado: 'cancelada' } };
    const res = resMock();

    await ctrl.actualizar(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('permite transición confirmada → cancelada', async () => {
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada' })),
      mockChain(null, () => ({ changes: 1 })),
      mockChain(() => citaDb({ estado: 'cancelada' })),
    ]);
    const req = { params: { id: 1 }, body: { estado: 'cancelada' } };
    const res = resMock();

    await ctrl.actualizar(req, res);

    expect(res.json).toHaveBeenCalled();
  });

  test('permite actualizar campos sin cambiar estado', async () => {
    const original = citaDb({ estado: 'pendiente' });
    setupSequentialChains([
      mockChain(() => original),
      mockChain(null, () => ({ changes: 1 })),
      mockChain(() => ({ ...original, notas: 'Nueva nota' })),
    ]);
    const req = { params: { id: 1 }, body: { notas: 'Nueva nota' } };
    const res = resMock();

    await ctrl.actualizar(req, res);

    expect(res.json).toHaveBeenCalled();
  });
});

// ── noAsistio ──────────────────────────────────────────────────────

describe('citaController — noAsistio', () => {
  test('rechaza si la ventana de asistencia aún no pasó', async () => {
    const f = fechaFutura('14:00', 60);
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada', fecha: f.fecha, hora: f.hora })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.noAsistio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('ventana') })
    );
  });

  test('rechaza si estado es completada', async () => {
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'completada' })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.noAsistio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rechaza si estado es cancelada', async () => {
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'cancelada' })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.noAsistio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('acepta si la ventana ya pasó y estado es pendiente', async () => {
    const p = pasado(180);
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'pendiente', fecha: p.fecha, hora: p.hora })),
      mockChain(null, () => ({ changes: 1 })),
      mockChain(() => citaDb({ estado: 'no_asistio', fecha: p.fecha, hora: p.hora })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.noAsistio(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Marcada como no asistió' })
    );
  });

  test('acepta si la ventana ya pasó y estado es confirmada', async () => {
    const p = pasado(180);
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada', fecha: p.fecha, hora: p.hora })),
      mockChain(null, () => ({ changes: 1 })),
      mockChain(() => citaDb({ estado: 'no_asistio', fecha: p.fecha, hora: p.hora })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.noAsistio(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Marcada como no asistió' })
    );
  });
});

// ── actualizar (no_asistio temporal vía PUT) ───────────────────────

describe('citaController — actualizar (no_asistio temporal)', () => {
  test('rechaza marcar no_asistio si la ventana aún no pasó', async () => {
    const f = fechaFutura('14:00', 60);
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'pendiente', fecha: f.fecha, hora: f.hora })),
    ]);
    const req = { params: { id: 1 }, body: { estado: 'no_asistio' } };
    const res = resMock();

    await ctrl.actualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('ventana') })
    );
  });

  test('permite marcar no_asistio si la ventana ya pasó', async () => {
    const p = pasado(180);
    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'pendiente', fecha: p.fecha, hora: p.hora })),
      mockChain(null, () => ({ changes: 1 })),
      mockChain(() => citaDb({ estado: 'no_asistio', fecha: p.fecha, hora: p.hora })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.actualizar(req, res);

    expect(res.json).toHaveBeenCalled();
  });
});

// ── límites exactos de ventana de asistencia ──────────────────────

describe('asistio — límites exactos de ventana', () => {
  test('exactamente 15 minutos antes de la cita → PERMITIDO', async () => {
    const ahora = new Date();
    const referencia = new Date(ahora.getTime());
    const y = referencia.getUTCFullYear();
    const mo = String(referencia.getUTCMonth() + 1).padStart(2, '0');
    const d = String(referencia.getUTCDate()).padStart(2, '0');
    const hh = String(referencia.getUTCHours()).padStart(2, '0');
    const mm = String(referencia.getUTCMinutes()).padStart(2, '0');

    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada', fecha: `${y}-${mo}-${d}`, hora: `${hh}:${mm}` })),
      mockChain(null, () => ({ changes: 1 })),
      mockChain(() => citaDb({ estado: 'asistio', fecha: `${y}-${mo}-${d}`, hora: `${hh}:${mm}` })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.asistio(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Asistencia registrada' })
    );
  });

  test('exactamente 16 minutos antes de la cita → RECHAZADO', async () => {
    const ahora = new Date();
    const ref = new Date(ahora.getTime());
    ref.setUTCMinutes(ref.getUTCMinutes() + 16);
    const y = ref.getUTCFullYear();
    const mo = String(ref.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ref.getUTCDate()).padStart(2, '0');
    const hh = String(ref.getUTCHours()).padStart(2, '0');
    const mm = String(ref.getUTCMinutes()).padStart(2, '0');

    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada', fecha: `${y}-${mo}-${d}`, hora: `${hh}:${mm}` })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.asistio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('15 minutos') })
    );
  });

  test('exactamente al límite final de la ventana (hora_fin + 30 min) → PERMITIDO', async () => {
    const ahora = new Date();
    const ref = new Date(ahora.getTime());
    ref.setUTCMinutes(ref.getUTCMinutes() - 44);
    const y = ref.getUTCFullYear();
    const mo = String(ref.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ref.getUTCDate()).padStart(2, '0');
    const hh = String(ref.getUTCHours()).padStart(2, '0');
    const mm = String(ref.getUTCMinutes()).padStart(2, '0');

    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada', fecha: `${y}-${mo}-${d}`, hora: `${hh}:${mm}` })),
      mockChain(null, () => ({ changes: 1 })),
      mockChain(() => citaDb({ estado: 'asistio', fecha: `${y}-${mo}-${d}`, hora: `${hh}:${mm}` })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.asistio(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Asistencia registrada' })
    );
  });

  test('1 minuto después del límite final → RECHAZADO', async () => {
    const ahora = new Date();
    const ref = new Date(ahora.getTime());
    ref.setUTCMinutes(ref.getUTCMinutes() - 61);
    const y = ref.getUTCFullYear();
    const mo = String(ref.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ref.getUTCDate()).padStart(2, '0');
    const hh = String(ref.getUTCHours()).padStart(2, '0');
    const mm = String(ref.getUTCMinutes()).padStart(2, '0');

    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'confirmada', fecha: `${y}-${mo}-${d}`, hora: `${hh}:${mm}` })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.asistio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('pasó') })
    );
  });
});

// ── límite exacto de confirmar ───────────────────────────────────

describe('confirmar — límite exacto de hora_fin', () => {
  test('exactamente en hora_fin de la cita → PERMITIDO (controller usa >, no >=)', async () => {
    const ahora = new Date();
    const ref = new Date(ahora.getTime());
    const y = ref.getUTCFullYear();
    const mo = String(ref.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ref.getUTCDate()).padStart(2, '0');
    const hh = String(ref.getUTCHours()).padStart(2, '0');
    const mm = String(ref.getUTCMinutes()).padStart(2, '0');

    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'pendiente', fecha: `${y}-${mo}-${d}`, hora: `${hh}:${mm}` })),
      mockChain(null, () => ({ changes: 1 })),
      mockChain(() => citaDb({ estado: 'confirmada', fecha: `${y}-${mo}-${d}`, hora: `${hh}:${mm}` })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.confirmar(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Cita confirmada' })
    );
  });

  test('1 minuto después de hora_fin → RECHAZADO', async () => {
    const ahora = new Date();
    const ref = new Date(ahora.getTime());
    ref.setUTCMinutes(ref.getUTCMinutes() - 31);
    const y = ref.getUTCFullYear();
    const mo = String(ref.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ref.getUTCDate()).padStart(2, '0');
    const hh = String(ref.getUTCHours()).padStart(2, '0');
    const mm = String(ref.getUTCMinutes()).padStart(2, '0');

    setupSequentialChains([
      mockChain(() => citaDb({ estado: 'pendiente', fecha: `${y}-${mo}-${d}`, hora: `${hh}:${mm}` })),
    ]);
    const req = { params: { id: 1 }, body: {} };
    const res = resMock();

    await ctrl.confirmar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('pasó') })
    );
  });
});
