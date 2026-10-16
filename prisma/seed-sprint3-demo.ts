// Seed de DEMO del Sprint 3: datos para recorrer a mano la asistencia (HU-22), las formas de pago
// y los comprobantes adjuntos (HU-23, HU-24), la anulación de pagos (HU-42), la nota de los
// exámenes (HU-34) y la deuda vencida del alumno. NO es el seed de desarrollo (`prisma/seed.ts`,
// que corre `pnpm db:seed`): es un script aparte, para correr y volver a correr.
//
// Requiere que el seed de desarrollo ya haya corrido (`pnpm db:seed`): usa la materia
// Matemática, las aulas, las tres formas de pago y el alumno de demo con acceso al portal
// (Lucía López, ver `SEED_ALUMNO_*` en .env.example), que es quien tiene la mayoría de los datos:
// ingresando al portal con ese usuario se ven sus turnos, su historial y sus exámenes.
//
// Lo carga `CARGADOR`: una usuaria de mesa de entradas **sin cuenta** (nadie puede iniciar sesión
// con ella). Crea además un profesor de demo, **con cuenta** (`PASSWORD_DEMO`), para registrar
// asistencias desde "Mi agenda", y dos alumnos más: uno con deuda de más de 30 días y otro cuyo
// pago comparte la transferencia con uno de Lucía (el aviso de HU-42).
//
// Todo son sesiones únicas con fechas relativas a "hoy", así que los escenarios se mantienen
// aunque pasen los días:
//   - asistencias: presentes con "qué se trabajó" e indicaciones, ausentes con observación y una
//     fila de tres horas seguidas con un estado distinto por hora (presente, ausente, sin registrar);
//   - "Sin registrar" dentro del plazo de 7 días (uno que vence hoy) y vencidos (cerrados);
//   - pagos por transferencia (con comprobante adjunto reemplazado), con débito (con un adjunto
//     quitado) y anulados, uno de ellos cobrado de nuevo con otra forma de pago;
//   - exámenes con nota, con "Ausente", sin nota cargada y uno pendiente;
//   - un alumno con tres turnos dados e impagos de hace más de 30 días.
// Los comprobantes adjuntos tienen una clave de prueba: no hay archivo en el almacenamiento, así
// que su vista previa no carga.
//
// Idempotente por "limpiar y recrear": cada corrida borra únicamente lo que creó `CARGADOR` (con
// todo lo que cuelga de sus turnos y pagos: asistencias, anulaciones, adjuntos, exámenes) y lo
// vuelve a crear. Nunca toca el alumno de demo ni lo que cargaste a mano, por la API o con otros
// seeds.
//
// Cómo correrlo:
//   pnpm exec tsx prisma/seed-sprint3-demo.ts            crea (o recrea) los datos de demo
//   pnpm exec tsx prisma/seed-sprint3-demo.ts --limpiar  sólo borra, no vuelve a crear nada
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { env } from '@/config/env'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizarBusqueda } from '@/server/shared/busqueda'
import { diaSemanaISO, fechaADate, hoy, sumarDias } from '@/server/shared/fechas'
import { horaAMinutos } from '@/server/shared/zod'

/**
 * Usuaria de mesa de entradas que carga todo, sin cuenta. Se busca por DNI y no se borra nunca: lo
 * que creó es lo que se limpia.
 */
const CARGADOR = {
  nombre: 'Julieta',
  apellido: 'Navarro',
  dni: '31245678',
  email: 'julieta.navarro@gmail.com',
  telefono: '(387) 15-452-3380',
}

/** Contraseña del profesor de demo (>= 8 caracteres, como exige Better Auth). Sólo desarrollo. */
const PASSWORD_DEMO = 'demo-1234'

const PROFESOR_DEMO = {
  nombre: 'Camila',
  apellido: 'Benítez',
  dni: '27654321',
  email: 'camila.benitez@gmail.com',
  telefono: '(387) 15-478-1205',
  titulo: 'Profesora en Matemática',
  matricula: 'MP-0301',
}

/** DNI del alumno de demo con portal: el mismo valor por defecto que usa `prisma/seed.ts`. */
const DNI_ALUMNO_PORTAL = env.SEED_ALUMNO_DNI ?? '45123456'

const ALUMNO_CON_DEUDA = {
  nombre: 'Matías',
  apellido: 'Ledesma',
  dni: '43876210',
  email: 'matias.ledesma@hotmail.com',
  telefono: '(387) 15-440-9127',
  fechaNacimiento: '2004-08-22',
}

const ALUMNA_TRANSFERENCIA = {
  nombre: 'Sofía',
  apellido: 'Quiroga',
  dni: '44019356',
  email: 'sofia.quiroga@gmail.com',
  telefono: '(387) 15-431-7740',
  fechaNacimiento: '2005-11-03',
}

/** Transferencia que cubre pagos de dos alumnos (hermanas): HU-42 avisa de las que se comparten. */
const TRANSFERENCIA_COMPARTIDA = {
  operacion: '0004829137',
  banco: 'Banco Macro',
  titular: 'Ricardo López',
}

type Alumno = 'lucia' | 'matias' | 'sofia'

type TurnoDemo = {
  clave: string
  alumno: Alumno
  /** Días respecto de hoy (negativo = pasado). */
  dias: number
  hora: string
  temas: string
}

// Una hora por turno, en punto. Las tres "seguidas" son 09:00, 10:00 y 11:00 del mismo día.
const TURNOS: TurnoDemo[] = [
  { clave: 'ayer', alumno: 'lucia', dias: -1, hora: '16:00', temas: 'Ecuaciones de segundo grado' },
  { clave: 'ausente', alumno: 'lucia', dias: -2, hora: '16:00', temas: 'Funciones lineales' },
  { clave: 'seguidas-1', alumno: 'lucia', dias: -3, hora: '09:00', temas: 'Funciones lineales' },
  { clave: 'seguidas-2', alumno: 'lucia', dias: -3, hora: '10:00', temas: 'Funciones lineales' },
  { clave: 'seguidas-3', alumno: 'lucia', dias: -3, hora: '11:00', temas: 'Funciones lineales' },
  { clave: 'plazo-1', alumno: 'lucia', dias: -5, hora: '16:00', temas: 'Inecuaciones' },
  { clave: 'plazo-vence-hoy', alumno: 'lucia', dias: -7, hora: '16:00', temas: 'Inecuaciones' },
  { clave: 'vencido-1', alumno: 'lucia', dias: -8, hora: '16:00', temas: 'Polinomios' },
  { clave: 'vencido-2', alumno: 'lucia', dias: -15, hora: '16:00', temas: 'Polinomios' },
  { clave: 'hoy', alumno: 'lucia', dias: 0, hora: '16:00', temas: 'Repaso para el parcial' },
  { clave: 'proximo', alumno: 'lucia', dias: 3, hora: '16:00', temas: 'Repaso para el parcial' },
  {
    clave: 'deuda-45',
    alumno: 'matias',
    dias: -45,
    hora: '17:00',
    temas: 'Sistemas de ecuaciones',
  },
  {
    clave: 'deuda-38',
    alumno: 'matias',
    dias: -38,
    hora: '17:00',
    temas: 'Sistemas de ecuaciones',
  },
  {
    clave: 'deuda-31',
    alumno: 'matias',
    dias: -31,
    hora: '17:00',
    temas: 'Sistemas de ecuaciones',
  },
  { clave: 'pagada-52', alumno: 'matias', dias: -52, hora: '17:00', temas: 'Números reales' },
  { clave: 'reciente', alumno: 'matias', dias: -10, hora: '17:00', temas: 'Matrices' },
  { clave: 'compartida', alumno: 'sofia', dias: -6, hora: '18:00', temas: 'Derivadas' },
]

type AsistenciaDemo = {
  clave: string
  estado: 'PRESENTE' | 'AUSENTE'
  trabajado?: string
  indicaciones?: string
  observacion?: string
}

// Los turnos que no figuran acá quedan "Sin registrar" (o "Agendado", si son de hoy en adelante).
const ASISTENCIAS: AsistenciaDemo[] = [
  {
    clave: 'ayer',
    estado: 'PRESENTE',
    trabajado: 'Fórmula resolvente y discriminante; ejercicios de la guía 3',
    indicaciones: 'Resolver los ejercicios 1 a 6 de la guía 3 y traer las dudas',
  },
  { clave: 'ausente', estado: 'AUSENTE', observacion: 'Avisó por mensaje que estaba con fiebre' },
  {
    clave: 'seguidas-1',
    estado: 'PRESENTE',
    trabajado: 'Pendiente y ordenada al origen',
    indicaciones: 'Graficar las funciones del ejercicio 4',
  },
  {
    clave: 'seguidas-2',
    estado: 'AUSENTE',
    observacion: 'Se retiró antes por un compromiso familiar',
  },
  { clave: 'deuda-45', estado: 'PRESENTE', trabajado: 'Método de sustitución' },
  { clave: 'deuda-38', estado: 'AUSENTE', observacion: 'No se presentó y no avisó' },
  { clave: 'deuda-31', estado: 'PRESENTE', trabajado: 'Método de igualación' },
  { clave: 'pagada-52', estado: 'PRESENTE', trabajado: 'Operaciones con radicales' },
  { clave: 'compartida', estado: 'PRESENTE', trabajado: 'Regla de la cadena' },
]

type AdjuntoDemo = { nombre: string; bytes: number; estado?: 'ACTIVO' | 'INACTIVO' }

type PagoDemo = {
  alumno: Alumno
  diasPago: number
  claves: string[]
  forma: 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO'
  anulacion?: { motivo: 'ERROR_CARGA' | 'FORMA_PAGO_EQUIVOCADA' | 'OTRO'; detalle: string }
  transferencia?: { operacion: string; banco: string; titular: string }
  debito?: { red: 'VISA_DEBITO' | 'MASTERCARD_DEBITO'; cupon: string; ultimos4: string }
  /** En orden de carga: el último activo es el que se muestra. */
  adjuntos?: AdjuntoDemo[]
}

// En orden de carga: los números de comprobante salen correlativos, como si se hubieran cobrado
// día por día. Los que no figuran quedan impagos.
const PAGOS: PagoDemo[] = [
  { alumno: 'matias', diasPago: -52, claves: ['pagada-52'], forma: 'EFECTIVO' },
  {
    // Anulado: se cobró en efectivo y la familia había transferido. Sus turnos vuelven a estar
    // pendientes y se cobran de nuevo con el pago siguiente.
    alumno: 'lucia',
    diasPago: -3,
    claves: ['seguidas-2'],
    forma: 'EFECTIVO',
    anulacion: {
      motivo: 'FORMA_PAGO_EQUIVOCADA',
      detalle: 'Se cobró en efectivo, pero la familia había pagado con la tarjeta de débito',
    },
  },
  {
    alumno: 'lucia',
    diasPago: -3,
    claves: ['seguidas-1', 'seguidas-2'],
    forma: 'DEBITO',
    debito: { red: 'VISA_DEBITO', cupon: '004512', ultimos4: '4821' },
    // Se adjuntó una foto del cupón y después se quitó: queda guardado, pero ya no se muestra.
    adjuntos: [{ nombre: 'Cupón débito.jpg', bytes: 183204, estado: 'INACTIVO' }],
  },
  {
    // Anulado y sin cobrar de nuevo: el turno "plazo-1" vuelve a aparecer como pendiente.
    alumno: 'lucia',
    diasPago: -5,
    claves: ['plazo-1'],
    forma: 'EFECTIVO',
    anulacion: { motivo: 'ERROR_CARGA', detalle: 'Se cargó el pago del alumno equivocado' },
  },
  {
    alumno: 'sofia',
    diasPago: -6,
    claves: ['compartida'],
    forma: 'TRANSFERENCIA',
    transferencia: TRANSFERENCIA_COMPARTIDA,
    adjuntos: [{ nombre: 'Transferencia Sofía.pdf', bytes: 51877 }],
  },
  {
    alumno: 'lucia',
    diasPago: -1,
    claves: ['ayer', 'ausente'],
    forma: 'TRANSFERENCIA',
    transferencia: TRANSFERENCIA_COMPARTIDA,
    // Se reemplazó el primer comprobante por otro: el que se muestra es el último.
    adjuntos: [
      { nombre: 'Transferencia borrosa.jpg', bytes: 96340 },
      { nombre: 'Transferencia 0004829137.pdf', bytes: 48213 },
    ],
  },
]

type ExamenDemo = {
  dias: number
  /** `null` = "Sin nota". */
  resultado: 'CON_NOTA' | 'AUSENTE' | null
  nota?: string
  observaciones?: string
}

// Todos de Matemática, la materia de los turnos de Lucía. Un solo examen pendiente (HU-17).
const EXAMENES: ExamenDemo[] = [
  { dias: -27, resultado: 'CON_NOTA', nota: '4.00' },
  { dias: -20, resultado: 'CON_NOTA', nota: '8.50' },
  { dias: -9, resultado: 'AUSENTE' },
  { dias: -4, resultado: null, observaciones: 'Rindió, falta cargar la nota' },
  { dias: 14, resultado: null },
]

/** Importe en centavos → texto con dos decimales para el `Decimal`. */
function aImporte(centavos: number): string {
  return (centavos / 100).toFixed(2)
}

// ---------------------------------------------------------------------------------------------
// Limpieza de una corrida anterior
// ---------------------------------------------------------------------------------------------

/**
 * Borra únicamente lo que creó `CARGADOR`, con todo lo que cuelga de sus turnos y pagos. Las FK son
 * `onDelete: Restrict`: si registraste una asistencia o anulaste un pago desde la app, sin esto la
 * limpieza fallaría.
 */
async function limpiar() {
  const cargador = await prisma.usuario.findUnique({ where: { dni: CARGADOR.dni } })
  if (!cargador) {
    console.log('Limpieza: no hay nada que borrar.')
    return
  }

  const usuarioIds = (
    await prisma.usuario.findMany({
      where: { createdById: cargador.id, role: 'PROFESOR' },
      select: { id: true },
    })
  ).map((u) => u.id)
  const profesorIds = (
    await prisma.profesor.findMany({
      where: { usuarioId: { in: usuarioIds } },
      select: { id: true },
    })
  ).map((p) => p.id)
  const alumnoIds = (
    await prisma.alumno.findMany({ where: { createdById: cargador.id }, select: { id: true } })
  ).map((a) => a.id)
  const turnoIds = (
    await prisma.turno.findMany({
      where: {
        OR: [{ createdById: cargador.id }, { bloqueAgenda: { profesorId: { in: profesorIds } } }],
      },
      select: { id: true },
    })
  ).map((t) => t.id)
  const pagoIds = (
    await prisma.pago.findMany({
      where: {
        OR: [{ createdById: cargador.id }, { turnos: { some: { turnoId: { in: turnoIds } } } }],
      },
      select: { id: true },
    })
  ).map((p) => p.id)

  // Orden que respeta las FK: lo que cuelga de un turno o de un pago, el turno y el pago, y
  // después asignaciones, bloques, profesor, cuenta y alumnos.
  await prisma.examen.deleteMany({ where: { createdById: cargador.id } })
  await prisma.asistenciaTurno.deleteMany({ where: { turnoId: { in: turnoIds } } })
  await prisma.anulacionPago.deleteMany({ where: { pagoId: { in: pagoIds } } })
  await prisma.comprobanteAdjunto.deleteMany({ where: { pagoId: { in: pagoIds } } })
  await prisma.pagoTurno.deleteMany({
    where: { OR: [{ turnoId: { in: turnoIds } }, { pagoId: { in: pagoIds } }] },
  })
  await prisma.pago.deleteMany({ where: { id: { in: pagoIds } } })
  await prisma.cancelacionTurno.deleteMany({ where: { turnoId: { in: turnoIds } } })
  await prisma.finalizacionRecurrencia.deleteMany({ where: { turnoId: { in: turnoIds } } })
  await prisma.turno.deleteMany({ where: { id: { in: turnoIds } } })
  await prisma.asignacionMateria.deleteMany({ where: { profesorId: { in: profesorIds } } })
  await prisma.bloqueAgenda.deleteMany({ where: { profesorId: { in: profesorIds } } })
  await prisma.profesor.deleteMany({ where: { id: { in: profesorIds } } })
  await prisma.session.deleteMany({ where: { userId: { in: usuarioIds } } })
  await prisma.account.deleteMany({ where: { userId: { in: usuarioIds } } })
  await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } })
  await prisma.alumno.deleteMany({ where: { id: { in: alumnoIds } } })

  console.log(
    `Limpieza: ${profesorIds.length} profesor, ${alumnoIds.length} alumnos, ${turnoIds.length} ` +
      `turnos y ${pagoIds.length} pagos.`,
  )
}

// ---------------------------------------------------------------------------------------------
// Creación
// ---------------------------------------------------------------------------------------------

/** Lo que tiene que existir de antes (`pnpm db:seed`). Falla con un mensaje claro si falta algo. */
async function requisitos() {
  const materia = await prisma.materia.findFirst({
    where: {
      busqueda: normalizarBusqueda('Matemática'),
      estado: 'ACTIVO',
      precioHora: { not: null },
    },
  })
  const aulas = await prisma.aula.findMany({ where: { estado: 'ACTIVO' }, orderBy: { id: 'asc' } })
  const formas = await prisma.formaPago.findMany({
    where: { tipoFormaPago: { not: null }, estado: 'ACTIVO' },
  })
  const alumnoPortal = await prisma.alumno.findUnique({ where: { dni: DNI_ALUMNO_PORTAL } })

  const formaPorTipo = new Map(formas.map((f) => [f.tipoFormaPago, f.id]))
  const faltan =
    !materia ||
    aulas.length === 0 ||
    !alumnoPortal ||
    !(['EFECTIVO', 'TRANSFERENCIA', 'DEBITO'] as const).every((t) => formaPorTipo.has(t))
  if (faltan) {
    throw new Error(
      'Faltan datos del seed de desarrollo (la materia Matemática con precio, las aulas, las tres ' +
        'formas de pago o el alumno de demo con acceso al portal). Corré primero ' +
        '`pnpm db:seed` y volvé a intentar.',
    )
  }
  return { materia, aulas, formaPorTipo, alumnoPortal }
}

async function crear() {
  const { materia, aulas, formaPorTipo, alumnoPortal } = await requisitos()
  const precioCentavos = Math.round(materia.precioHora!.toNumber() * 100)

  const mesa = await prisma.usuario.upsert({
    where: { dni: CARGADOR.dni },
    create: {
      id: randomUUID(),
      ...CARGADOR,
      busqueda: normalizarBusqueda(`${CARGADOR.apellido} ${CARGADOR.nombre} ${CARGADOR.dni}`),
      emailVerified: true,
      role: 'MESA_ENTRADAS',
    },
    update: {},
  })
  const auditoria = { createdById: mesa.id, updatedById: mesa.id }

  // --- Profesor de demo, con su cuenta (entra a "Mi agenda") y Matemática asignada ---
  const usuarioProfesor = await prisma.usuario.create({
    data: {
      id: randomUUID(),
      nombre: PROFESOR_DEMO.nombre,
      apellido: PROFESOR_DEMO.apellido,
      dni: PROFESOR_DEMO.dni,
      busqueda: normalizarBusqueda(
        `${PROFESOR_DEMO.apellido} ${PROFESOR_DEMO.nombre} ${PROFESOR_DEMO.dni}`,
      ),
      telefono: PROFESOR_DEMO.telefono,
      email: PROFESOR_DEMO.email,
      emailVerified: true,
      role: 'PROFESOR',
      // Lo da de alta mesa de entradas: es lo que identifica qué limpiar.
      ...auditoria,
    },
  })
  await prisma.account.create({
    data: {
      id: randomUUID(),
      providerId: 'credential',
      accountId: usuarioProfesor.id,
      userId: usuarioProfesor.id,
      password: await hashPassword(PASSWORD_DEMO),
    },
  })
  const profesor = await prisma.profesor.create({
    data: {
      usuarioId: usuarioProfesor.id,
      titulo: PROFESOR_DEMO.titulo,
      matricula: PROFESOR_DEMO.matricula,
      capacidad: 5,
    },
  })
  await prisma.asignacionMateria.create({
    data: { profesorId: profesor.id, materiaId: materia.id, ...auditoria },
  })

  // --- Alumnos: Lucía ya existe (la crea `pnpm db:seed`); los otros dos los crea este script ---
  async function crearAlumno(datos: typeof ALUMNO_CON_DEUDA) {
    return prisma.alumno.create({
      data: {
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        busqueda: normalizarBusqueda(`${datos.apellido} ${datos.nombre} ${datos.dni}`),
        fechaNacimiento: fechaADate(datos.fechaNacimiento),
        telefono: datos.telefono,
        email: datos.email,
        nivelEscolaridad: 'UNIVERSITARIO',
        ...auditoria,
      },
    })
  }
  const alumnoIds: Record<Alumno, number> = {
    lucia: alumnoPortal.id,
    matias: (await crearAlumno(ALUMNO_CON_DEUDA)).id,
    sofia: (await crearAlumno(ALUMNA_TRANSFERENCIA)).id,
  }

  // --- Bloques (una hora en punto cada uno) en un aula libre a esa hora, con el día de la semana
  // de la fecha del turno (dominio.md → Bloques). Un bloque se reutiliza entre fechas. ---
  const aulaOcupada = new Set(
    (
      await prisma.bloqueAgenda.findMany({
        where: { estado: 'ACTIVO' },
        select: { aulaId: true, diaSemana: true, horaInicio: true },
      })
    ).map((b) => `${b.aulaId}|${b.diaSemana}|${b.horaInicio}`),
  )
  const bloques = new Map<string, number>()
  async function bloqueDe(diaSemana: number, hora: string): Promise<number> {
    const clave = `${diaSemana}|${hora}`
    const existente = bloques.get(clave)
    if (existente !== undefined) return existente

    const inicio = horaAMinutos(hora)
    const aula = aulas.find((a) => !aulaOcupada.has(`${a.id}|${diaSemana}|${inicio}`))
    if (!aula) throw new Error(`No hay ningún aula libre el día ${diaSemana} a las ${hora}.`)
    aulaOcupada.add(`${aula.id}|${diaSemana}|${inicio}`)
    const bloque = await prisma.bloqueAgenda.create({
      data: {
        profesorId: profesor.id,
        aulaId: aula.id,
        diaSemana,
        horaInicio: inicio,
        horaFin: inicio + 60,
        ...auditoria,
      },
    })
    bloques.set(clave, bloque.id)
    return bloque.id
  }

  // --- Turnos: sesiones únicas, una por escenario ---
  const fechaHoy = hoy()
  const turnos = new Map<string, { id: number; fecha: string }>()
  for (const datos of TURNOS) {
    const fecha = sumarDias(fechaHoy, datos.dias)
    const turno = await prisma.turno.create({
      data: {
        bloqueAgendaId: await bloqueDe(diaSemanaISO(fecha), datos.hora),
        alumnoId: alumnoIds[datos.alumno],
        materiaId: materia.id,
        tipo: 'SESION_UNICA',
        fechaInicio: fechaADate(fecha),
        fechaFin: fechaADate(fecha),
        temas: datos.temas,
        ...auditoria,
      },
    })
    turnos.set(datos.clave, { id: turno.id, fecha })
  }
  const turnoDe = (clave: string) => {
    const turno = turnos.get(clave)
    if (!turno) throw new Error(`Turno de demo inexistente: ${clave}`)
    return turno
  }

  // --- Asistencias: las registra el profesor ---
  for (const datos of ASISTENCIAS) {
    const turno = turnoDe(datos.clave)
    await prisma.asistenciaTurno.create({
      data: {
        turnoId: turno.id,
        fechaOcurrencia: fechaADate(turno.fecha),
        estado: datos.estado,
        trabajado: datos.trabajado ?? null,
        indicaciones: datos.indicaciones ?? null,
        observacion: datos.observacion ?? null,
        createdById: usuarioProfesor.id,
        updatedById: usuarioProfesor.id,
      },
    })
  }

  // --- Pagos: cada ocurrencia, al precio vigente de Matemática ---
  for (const datos of PAGOS) {
    const anulado = datos.anulacion !== undefined
    const total = precioCentavos * datos.claves.length
    const pago = await prisma.pago.create({
      data: {
        alumnoId: alumnoIds[datos.alumno],
        formaPagoId: formaPorTipo.get(datos.forma)!,
        importeTotal: aImporte(total),
        fechaPago: fechaADate(sumarDias(fechaHoy, datos.diasPago)),
        // En efectivo se anota lo recibido (el vuelto no se guarda).
        montoRecibido: datos.forma === 'EFECTIVO' ? aImporte(total) : null,
        transferenciaOperacion: datos.transferencia?.operacion ?? null,
        transferenciaBanco: datos.transferencia?.banco ?? null,
        transferenciaTitular: datos.transferencia?.titular ?? null,
        debitoRed: datos.debito?.red ?? null,
        debitoCupon: datos.debito?.cupon ?? null,
        debitoUltimos4: datos.debito?.ultimos4 ?? null,
        estado: anulado ? 'ANULADO' : 'VIGENTE',
        ...auditoria,
        turnos: {
          create: datos.claves.map((clave) => ({
            turnoId: turnoDe(clave).id,
            fechaOcurrencia: fechaADate(turnoDe(clave).fecha),
            importeAplicado: aImporte(precioCentavos),
            porcentajeCentro: 15,
            // Un pago anulado deja `vigente` en null: la ocurrencia puede cobrarse de nuevo.
            vigente: anulado ? null : true,
          })),
        },
        anulacion: datos.anulacion
          ? { create: { ...datos.anulacion, createdById: mesa.id } }
          : undefined,
      },
      select: { id: true },
    })
    // Los adjuntos se cargan de a uno, en orden: el último activo es el que se muestra.
    for (const [i, adjunto] of (datos.adjuntos ?? []).entries()) {
      await prisma.comprobanteAdjunto.create({
        data: {
          pagoId: pago.id,
          archivoKey: `adjuntos/seed-sprint3-${pago.id}-${i + 1}.${adjunto.nombre.endsWith('.pdf') ? 'pdf' : 'jpg'}`,
          mimeType: adjunto.nombre.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          nombreArchivo: adjunto.nombre,
          bytes: adjunto.bytes,
          estado: adjunto.estado ?? 'ACTIVO',
          ...auditoria,
        },
      })
    }
  }

  // --- Exámenes de Lucía: la nota la carga el profesor ---
  for (const datos of EXAMENES) {
    const conResultado = datos.resultado !== null
    await prisma.examen.create({
      data: {
        alumnoId: alumnoIds.lucia,
        materiaId: materia.id,
        fecha: fechaADate(sumarDias(fechaHoy, datos.dias)),
        observaciones: datos.observaciones ?? null,
        resultado: datos.resultado,
        nota: datos.nota ?? null,
        notaCreatedById: conResultado ? usuarioProfesor.id : null,
        notaCreatedAt: conResultado ? fechaADate(sumarDias(fechaHoy, datos.dias + 1)) : null,
        ...auditoria,
      },
    })
  }

  console.log(`Datos de demo del Sprint 3 listos (hoy = ${fechaHoy}):`)
  console.log(
    `  profesor ${PROFESOR_DEMO.email} / ${PASSWORD_DEMO}: ${TURNOS.length} turnos, ` +
      `${ASISTENCIAS.length} asistencias registradas`,
  )
  console.log(
    `  ${PAGOS.length} pagos (con anulados, transferencia y débito) y ${EXAMENES.length} exámenes`,
  )
  console.log(
    `  alumno con deuda de más de 30 días: ${ALUMNO_CON_DEUDA.apellido}, ${ALUMNO_CON_DEUDA.nombre} ` +
      `(DNI ${ALUMNO_CON_DEUDA.dni})`,
  )
}

async function main() {
  await limpiar()
  if (!process.argv.includes('--limpiar')) await crear()
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
