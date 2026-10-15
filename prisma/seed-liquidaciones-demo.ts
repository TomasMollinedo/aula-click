// Seed de DEMO del reparto y las liquidaciones (HU-43 a HU-47): datos para recorrer a mano las
// liquidaciones del gerente, "Mis ingresos" del profesor, la caja diaria y la sección "Finanzas"
// del tablero. NO es el seed de desarrollo (`prisma/seed.ts`, que corre `pnpm db:seed`): es un
// script aparte, para correr y volver a correr.
//
// Requiere que el seed de desarrollo ya haya corrido (`pnpm db:seed`): usa la materia Matemática,
// las aulas, las tres formas de pago, el gerente del seed (registra los pagos de las liquidaciones)
// y el historial del porcentaje del centro (12 % desde el día 1 de hace dos meses, 15 % desde el
// día 1 del mes pasado). Cada cobro guarda el porcentaje vigente en el registro de su pago.
//
// Lo carga `CARGADOR`: una usuaria de mesa de entradas **sin cuenta**. Crea dos profesores, Andrés
// Ferreyra (**con cuenta**, `PASSWORD_DEMO`, para ver "Mis ingresos") y Beatriz Aguirre (sin
// cuenta), y cuatro alumnos, todo con Matemática. M = el mes en curso; fechas relativas a "hoy".
//
// Profesor A, Ferreyra:
//   - M-2 PAGADA: clases presentes y una ausente, cobradas en M-2, transferidas a principios de M-1
//     con número de operación y un comprobante adjunto (clave de prueba: no hay archivo, así que su
//     vista previa no carga).
//   - Un pago de M-2 (2 turnos de esa liquidación) se anuló en M-1: genera el ajuste en M-1.
//   - M-1 sin cerrar, con clases dadas y cobradas en M-1 y el ajuste: queda "Pendiente de pago".
//   - En M: clases dadas y cobradas hoy, una clase dada sin cobrar, un turno cobrado sin asistencia
//     dentro del plazo de 7 días (con otro cobrado por adelantado) y uno cobrado que cerró
//     "Sin registrar" (más de 7 días sin asistencia: el importe completo queda para el centro).
// Profesor B, Aguirre:
//   - M-2 PAGADA con la transferencia de hoy (el pago a un profesor de la caja de hoy).
//   - Un pago de M-2 (3 turnos de esa liquidación) se anuló hoy, y en M-1 tiene un solo turno: el
//     ajuste deja M-1 en "Saldo a descontar el mes próximo" (y M, en curso, también negativa).
// Caja de hoy: tres cobros, la anulación del pago de Aguirre y la transferencia a Aguirre.
//
// El devengo usa el registro del pago y de la asistencia (`createdAt`), no la fecha de pago: por eso
// el script los fija en el mes de cada escenario. Las liquidaciones pagadas guardan sus turnos e
// importes congelados con la regla del reparto (`parteDelCentro`, la misma de T-120). El script no
// crea liquidaciones abiertas (se calculan al leer, T-121) ni `AjusteLiquidacion` ni `DESCONTADA`
// (aparecen al pagar una liquidación desde la app, T-124).
//
// Idempotente por "limpiar y recrear": cada corrida borra únicamente lo que creó `CARGADOR` (sus
// profesores con sus liquidaciones, sus alumnos, turnos y pagos, y todo lo que cuelga de ellos) y lo
// vuelve a crear. Nunca toca lo que cargaste a mano, por la API o con otros seeds.
//
// Cómo correrlo:
//   pnpm exec tsx prisma/seed-liquidaciones-demo.ts            crea (o recrea) los datos de demo
//   pnpm exec tsx prisma/seed-liquidaciones-demo.ts --limpiar  sólo borra, no vuelve a crear nada
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizarBusqueda } from '@/server/shared/busqueda'
import { dateAFecha, diaSemanaISO, fechaADate, hoy, sumarDias } from '@/server/shared/fechas'
import { horaAMinutos } from '@/server/shared/zod'

/**
 * Usuaria de mesa de entradas que carga todo, sin cuenta. Se busca por DNI y no se borra nunca: lo
 * que creó es lo que se limpia.
 */
const CARGADOR = {
  nombre: 'Romina',
  apellido: 'Castillo',
  dni: '32718406',
  email: 'romina.castillo@gmail.com',
  telefono: '(387) 15-462-0913',
}

/** Contraseña del profesor con cuenta (>= 8 caracteres, como exige Better Auth). Sólo desarrollo. */
const PASSWORD_DEMO = 'demo-1234'

type Profe = 'A' | 'B'

const PROFESORES: Record<
  Profe,
  {
    nombre: string
    apellido: string
    dni: string
    email: string
    telefono: string
    titulo: string
    matricula: string
    conCuenta: boolean
  }
> = {
  A: {
    nombre: 'Andrés',
    apellido: 'Ferreyra',
    dni: '26105437',
    email: 'andres.ferreyra@gmail.com',
    telefono: '(387) 15-487-2251',
    titulo: 'Profesor en Matemática',
    matricula: 'MP-0411',
    conCuenta: true,
  },
  B: {
    nombre: 'Beatriz',
    apellido: 'Aguirre',
    dni: '29541872',
    email: 'beatriz.aguirre@gmail.com',
    telefono: '(387) 15-413-6648',
    titulo: 'Profesora en Matemática',
    matricula: 'MP-0412',
    conCuenta: false,
  },
}

type Alumno = 'valentina' | 'tomas' | 'ignacio' | 'martina'

const ALUMNOS: Record<
  Alumno,
  {
    nombre: string
    apellido: string
    dni: string
    telefono: string
    fechaNacimiento: string
  }
> = {
  valentina: {
    nombre: 'Valentina',
    apellido: 'Sosa',
    dni: '46055218',
    telefono: '(387) 15-420-7731',
    fechaNacimiento: '2006-04-11',
  },
  tomas: {
    nombre: 'Tomás',
    apellido: 'Cruz',
    dni: '45330964',
    telefono: '(387) 15-498-1027',
    fechaNacimiento: '2005-09-27',
  },
  ignacio: {
    nombre: 'Ignacio',
    apellido: 'Vera',
    dni: '44871503',
    telefono: '(387) 15-437-5582',
    fechaNacimiento: '2004-12-02',
  },
  martina: {
    nombre: 'Martina',
    apellido: 'Paz',
    dni: '46612087',
    telefono: '(387) 15-405-3319',
    fechaNacimiento: '2006-07-19',
  },
}

/** Un día: el `dia` del mes a `meses` del actual (0 = este mes) o `dias` respecto de hoy. */
type Cuando = { meses: number; dia: number } | { dias: number }

type TurnoDemo = { clave: string; profesor: Profe; alumno: Alumno; cuando: Cuando; hora: string }

/** Atajo para que cada turno entre en una línea. */
const turno = (
  clave: string,
  profesor: Profe,
  alumno: Alumno,
  cuando: Cuando,
  hora: string,
): TurnoDemo => ({ clave, profesor, alumno, cuando, hora })

// Una hora por turno, en punto. Las fechas por día del mes son de M-2 y M-1; las de M son relativas
// a hoy, para que sigan en el pasado o en el futuro aunque pasen los días.
const TURNOS: TurnoDemo[] = [
  // Ferreyra, M-2
  turno('a-m2-1', 'A', 'valentina', { meses: -2, dia: 4 }, '16:00'),
  turno('a-m2-2', 'A', 'valentina', { meses: -2, dia: 11 }, '16:00'),
  turno('a-m2-3', 'A', 'valentina', { meses: -2, dia: 18 }, '16:00'),
  turno('a-m2-4', 'A', 'tomas', { meses: -2, dia: 22 }, '17:00'),
  turno('a-m2-5', 'A', 'tomas', { meses: -2, dia: 25 }, '17:00'),
  // Ferreyra, M-1
  turno('a-m1-1', 'A', 'valentina', { meses: -1, dia: 3 }, '16:00'),
  turno('a-m1-2', 'A', 'valentina', { meses: -1, dia: 10 }, '16:00'),
  turno('a-m1-3', 'A', 'valentina', { meses: -1, dia: 17 }, '16:00'),
  turno('a-m1-4', 'A', 'tomas', { meses: -1, dia: 24 }, '17:00'),
  // Ferreyra, M (relativos a hoy)
  turno('a-m-1', 'A', 'valentina', { dias: -2 }, '16:00'),
  turno('a-m-2', 'A', 'valentina', { dias: -1 }, '16:00'),
  turno('a-sin-cobrar', 'A', 'tomas', { dias: -4 }, '17:00'),
  turno('a-en-plazo', 'A', 'valentina', { dias: -3 }, '18:00'),
  turno('a-adelantado', 'A', 'valentina', { dias: 2 }, '18:00'),
  turno('a-sin-registrar', 'A', 'tomas', { dias: -10 }, '17:00'),
  // Aguirre, M-2
  turno('b-m2-1', 'B', 'ignacio', { meses: -2, dia: 5 }, '10:00'),
  turno('b-m2-2', 'B', 'ignacio', { meses: -2, dia: 12 }, '10:00'),
  turno('b-m2-3', 'B', 'ignacio', { meses: -2, dia: 19 }, '10:00'),
  turno('b-m2-4', 'B', 'ignacio', { meses: -2, dia: 26 }, '10:00'),
  // Aguirre, M-1 y M
  turno('b-m1-1', 'B', 'martina', { meses: -1, dia: 15 }, '11:00'),
  turno('b-m-1', 'B', 'martina', { dias: -1 }, '11:00'),
]

// Las registra el profesor el mismo día de la clase, a `hora`. Los turnos que no figuran quedan
// "Sin registrar".
const ASISTENCIAS: { clave: string; estado: 'PRESENTE' | 'AUSENTE'; hora: string }[] = [
  { clave: 'a-m2-1', estado: 'PRESENTE', hora: '18:00' },
  { clave: 'a-m2-2', estado: 'PRESENTE', hora: '18:00' },
  { clave: 'a-m2-3', estado: 'PRESENTE', hora: '18:00' },
  { clave: 'a-m2-4', estado: 'AUSENTE', hora: '19:00' },
  { clave: 'a-m2-5', estado: 'PRESENTE', hora: '19:00' },
  { clave: 'a-m1-1', estado: 'PRESENTE', hora: '18:00' },
  { clave: 'a-m1-2', estado: 'PRESENTE', hora: '18:00' },
  { clave: 'a-m1-3', estado: 'PRESENTE', hora: '18:00' },
  { clave: 'a-m1-4', estado: 'PRESENTE', hora: '19:00' },
  { clave: 'a-m-1', estado: 'PRESENTE', hora: '18:00' },
  { clave: 'a-m-2', estado: 'PRESENTE', hora: '18:00' },
  { clave: 'a-sin-cobrar', estado: 'PRESENTE', hora: '19:00' },
  { clave: 'b-m2-1', estado: 'PRESENTE', hora: '12:00' },
  { clave: 'b-m2-2', estado: 'PRESENTE', hora: '12:00' },
  { clave: 'b-m2-3', estado: 'PRESENTE', hora: '12:00' },
  { clave: 'b-m2-4', estado: 'PRESENTE', hora: '12:00' },
  { clave: 'b-m1-1', estado: 'PRESENTE', hora: '13:00' },
  { clave: 'b-m-1', estado: 'PRESENTE', hora: '13:00' },
]

type PagoDemo = {
  alumno: Alumno
  /** Fecha de pago y de registro (`createdAt`, a `hora`). */
  cuando: Cuando
  hora: string
  claves: string[]
  forma: 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO'
  anulacion?: { cuando: Cuando; hora: string; detalle: string }
}

// En orden de registro: los números de comprobante salen correlativos.
const PAGOS: PagoDemo[] = [
  {
    alumno: 'ignacio',
    cuando: { meses: -2, dia: 5 },
    hora: '12:30',
    claves: ['b-m2-1'],
    forma: 'EFECTIVO',
  },
  {
    alumno: 'valentina',
    cuando: { meses: -2, dia: 18 },
    hora: '19:00',
    claves: ['a-m2-1', 'a-m2-2', 'a-m2-3'],
    forma: 'TRANSFERENCIA',
  },
  {
    // Se anula en M-1, después de pagada la liquidación de M-2 de Ferreyra: ajuste en M-1.
    alumno: 'tomas',
    cuando: { meses: -2, dia: 25 },
    hora: '19:30',
    claves: ['a-m2-4', 'a-m2-5'],
    forma: 'EFECTIVO',
    anulacion: {
      cuando: { meses: -1, dia: 10 },
      hora: '11:00',
      detalle: 'Se cargó dos veces el mismo cobro',
    },
  },
  {
    // Se anula hoy, después de pagada la liquidación de M-2 de Aguirre: ajuste en M-1.
    alumno: 'ignacio',
    cuando: { meses: -2, dia: 26 },
    hora: '12:30',
    claves: ['b-m2-2', 'b-m2-3', 'b-m2-4'],
    forma: 'EFECTIVO',
    anulacion: { cuando: { dias: 0 }, hora: '12:00', detalle: 'Se cobró al alumno equivocado' },
  },
  {
    alumno: 'martina',
    cuando: { meses: -1, dia: 15 },
    hora: '13:30',
    claves: ['b-m1-1'],
    forma: 'DEBITO',
  },
  {
    alumno: 'valentina',
    cuando: { meses: -1, dia: 17 },
    hora: '19:00',
    claves: ['a-m1-1', 'a-m1-2', 'a-m1-3'],
    forma: 'TRANSFERENCIA',
  },
  {
    alumno: 'tomas',
    cuando: { meses: -1, dia: 24 },
    hora: '19:30',
    claves: ['a-m1-4'],
    forma: 'DEBITO',
  },
  // Cobrado sin asistencia: a los 7 días cierra "Sin registrar" y no se le debe al profesor.
  {
    alumno: 'tomas',
    cuando: { dias: -10 },
    hora: '17:30',
    claves: ['a-sin-registrar'],
    forma: 'EFECTIVO',
  },
  // Cobros de hoy.
  {
    alumno: 'valentina',
    cuando: { dias: 0 },
    hora: '09:30',
    claves: ['a-m-1', 'a-m-2'],
    forma: 'EFECTIVO',
  },
  {
    alumno: 'valentina',
    cuando: { dias: 0 },
    hora: '10:15',
    claves: ['a-en-plazo', 'a-adelantado'],
    forma: 'TRANSFERENCIA',
  },
  { alumno: 'martina', cuando: { dias: 0 }, hora: '11:00', claves: ['b-m-1'], forma: 'EFECTIVO' },
]

type LiquidacionDemo = {
  profesor: Profe
  meses: number
  /** Fecha de la transferencia y del registro del pago (`createdAt`, a `hora`). */
  transferencia: { cuando: Cuando; hora: string; numeroOperacion: string; observaciones?: string }
  adjunto?: { nombre: string; bytes: number }
}

const LIQUIDACIONES: LiquidacionDemo[] = [
  {
    profesor: 'A',
    meses: -2,
    transferencia: {
      cuando: { meses: -1, dia: 5 },
      hora: '10:00',
      numeroOperacion: '0007315520',
      observaciones: 'Transferencia a la cuenta del Banco Macro del profesor',
    },
    adjunto: { nombre: 'Transferencia Ferreyra.pdf', bytes: 46120 },
  },
  {
    profesor: 'B',
    meses: -2,
    transferencia: { cuando: { dias: 0 }, hora: '10:00', numeroOperacion: '0007402288' },
  },
]

/** Importe en centavos → texto con dos decimales para el `Decimal`. */
function aImporte(centavos: number): string {
  return (centavos / 100).toFixed(2)
}

/**
 * Parte del centro de un importe (regla del reparto, `sprint-3.md` → Vocabulario de la
 * ampliación): importe × porcentaje en centavos enteros, redondeada mitad hacia arriba. La parte
 * del profesor es el importe menos esta. `porcentajeCentesimos`: 15 % = 1500.
 */
function parteDelCentro(importeCentavos: number, porcentajeCentesimos: number): number {
  return Math.floor((importeCentavos * porcentajeCentesimos + 5000) / 10000)
}

/** `YYYY-MM-DD` del día `dia` del mes a `meses` del de `fechaHoy`. */
function enMes(fechaHoy: string, meses: number, dia: number): string {
  const [anio, mes] = fechaHoy.split('-').map(Number) as [number, number]
  return dateAFecha(new Date(Date.UTC(anio, mes - 1 + meses, dia)))
}

/** Instante de `fecha` a `hora` en Salta (UTC-3, sin horario de verano). */
function instante(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00-03:00`)
}

// ---------------------------------------------------------------------------------------------
// Limpieza de una corrida anterior
// ---------------------------------------------------------------------------------------------

/**
 * Borra únicamente lo que creó `CARGADOR`, con todo lo que cuelga de sus profesores, turnos y
 * pagos (también lo que se haya registrado desde la app, como un pago de liquidación). Las FK son
 * `onDelete: Restrict`: el orden respeta las FK.
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
  const liquidacionIds = (
    await prisma.liquidacion.findMany({
      where: { profesorId: { in: profesorIds } },
      select: { id: true },
    })
  ).map((l) => l.id)

  // Orden que respeta las FK: adjuntos y ajustes, turnos liquidados y liquidaciones; después lo que
  // cuelga de un turno o de un pago, el turno y el pago, y por último asignaciones, bloques,
  // profesores, cuentas y alumnos.
  await prisma.comprobanteAdjunto.deleteMany({
    where: { OR: [{ pagoId: { in: pagoIds } }, { liquidacionId: { in: liquidacionIds } }] },
  })
  await prisma.ajusteLiquidacion.deleteMany({
    where: {
      OR: [
        { liquidacionId: { in: liquidacionIds } },
        { liquidacionOrigenId: { in: liquidacionIds } },
        { liquidacionTurno: { liquidacionId: { in: liquidacionIds } } },
      ],
    },
  })
  await prisma.liquidacionTurno.deleteMany({
    where: {
      OR: [{ liquidacionId: { in: liquidacionIds } }, { pagoTurno: { pagoId: { in: pagoIds } } }],
    },
  })
  // La autorreferencia (`descontadaEn`) se suelta antes de borrar.
  await prisma.liquidacion.updateMany({
    where: { id: { in: liquidacionIds } },
    data: { descontadaEnId: null },
  })
  await prisma.liquidacion.deleteMany({ where: { id: { in: liquidacionIds } } })
  await prisma.asistenciaTurno.deleteMany({ where: { turnoId: { in: turnoIds } } })
  await prisma.anulacionPago.deleteMany({ where: { pagoId: { in: pagoIds } } })
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
    `Limpieza: ${profesorIds.length} profesores, ${alumnoIds.length} alumnos, ${turnoIds.length} ` +
      `turnos, ${pagoIds.length} pagos y ${liquidacionIds.length} liquidaciones.`,
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
  const gerente = await prisma.usuario.findFirst({
    where: { role: 'GERENTE', estado: 'ACTIVO', accounts: { some: {} } },
    orderBy: { createdAt: 'asc' },
  })
  const porcentajes = await prisma.porcentajeCentro.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  const formaPorTipo = new Map(formas.map((f) => [f.tipoFormaPago, f.id]))
  const faltan =
    !materia ||
    !gerente ||
    aulas.length === 0 ||
    porcentajes.length === 0 ||
    !(['EFECTIVO', 'TRANSFERENCIA', 'DEBITO'] as const).every((t) => formaPorTipo.has(t))
  if (faltan) {
    throw new Error(
      'Faltan datos del seed de desarrollo (la materia Matemática con precio, las aulas, las tres ' +
        'formas de pago, el gerente o el porcentaje del centro). Corré primero `pnpm db:seed` y ' +
        'volvé a intentar.',
    )
  }
  return { materia, aulas, formaPorTipo, gerente, porcentajes }
}

async function crear() {
  const { materia, aulas, formaPorTipo, gerente, porcentajes } = await requisitos()
  const precioCentavos = Math.round(materia.precioHora!.toNumber() * 100)
  const fechaHoy = hoy()
  const fechaDe = (cuando: Cuando) =>
    'dias' in cuando ? sumarDias(fechaHoy, cuando.dias) : enMes(fechaHoy, cuando.meses, cuando.dia)

  /** El porcentaje vigente en un instante, en centésimos (15 % = 1500): el último registrado antes. */
  function porcentajeEn(momento: Date): number {
    const vigente = porcentajes.filter((p) => p.createdAt <= momento).at(-1)
    if (!vigente) {
      throw new Error(
        `No hay porcentaje del centro vigente el ${momento.toISOString()}: el historial de ` +
          '`pnpm db:seed` empieza el día 1 de hace dos meses. Revisá la tabla porcentaje_centro.',
      )
    }
    return Math.round(vigente.porcentaje.toNumber() * 100)
  }

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

  // --- Profesores, con Matemática asignada; sólo Ferreyra con cuenta ("Mis ingresos") ---
  const profesores = {} as Record<Profe, { id: number; usuarioId: string }>
  for (const clave of ['A', 'B'] as const) {
    const datos = PROFESORES[clave]
    const usuario = await prisma.usuario.create({
      data: {
        id: randomUUID(),
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        busqueda: normalizarBusqueda(`${datos.apellido} ${datos.nombre} ${datos.dni}`),
        telefono: datos.telefono,
        email: datos.email,
        emailVerified: true,
        role: 'PROFESOR',
        // Lo da de alta mesa de entradas: es lo que identifica qué limpiar.
        ...auditoria,
      },
    })
    if (datos.conCuenta) {
      await prisma.account.create({
        data: {
          id: randomUUID(),
          providerId: 'credential',
          accountId: usuario.id,
          userId: usuario.id,
          password: await hashPassword(PASSWORD_DEMO),
        },
      })
    }
    const profesor = await prisma.profesor.create({
      data: {
        usuarioId: usuario.id,
        titulo: datos.titulo,
        matricula: datos.matricula,
        capacidad: 5,
      },
    })
    await prisma.asignacionMateria.create({
      data: { profesorId: profesor.id, materiaId: materia.id, ...auditoria },
    })
    profesores[clave] = { id: profesor.id, usuarioId: usuario.id }
  }

  // --- Alumnos ---
  const alumnoIds = {} as Record<Alumno, number>
  for (const [clave, datos] of Object.entries(ALUMNOS) as [Alumno, (typeof ALUMNOS)[Alumno]][]) {
    const alumno = await prisma.alumno.create({
      data: {
        ...datos,
        busqueda: normalizarBusqueda(`${datos.apellido} ${datos.nombre} ${datos.dni}`),
        fechaNacimiento: fechaADate(datos.fechaNacimiento),
        nivelEscolaridad: 'SECUNDARIO',
        ...auditoria,
      },
    })
    alumnoIds[clave] = alumno.id
  }

  // --- Bloques (una hora en punto) en un aula libre a esa hora, con el día de la semana de la
  // fecha del turno. Un bloque se reutiliza entre fechas. ---
  const aulaOcupada = new Set(
    (
      await prisma.bloqueAgenda.findMany({
        where: { estado: 'ACTIVO' },
        select: { aulaId: true, diaSemana: true, horaInicio: true },
      })
    ).map((b) => `${b.aulaId}|${b.diaSemana}|${b.horaInicio}`),
  )
  const bloques = new Map<string, number>()
  async function bloqueDe(profesor: Profe, diaSemana: number, hora: string): Promise<number> {
    const clave = `${profesor}|${diaSemana}|${hora}`
    const existente = bloques.get(clave)
    if (existente !== undefined) return existente

    const inicio = horaAMinutos(hora)
    const aula = aulas.find((a) => !aulaOcupada.has(`${a.id}|${diaSemana}|${inicio}`))
    if (!aula) throw new Error(`No hay ningún aula libre el día ${diaSemana} a las ${hora}.`)
    aulaOcupada.add(`${aula.id}|${diaSemana}|${inicio}`)
    const bloque = await prisma.bloqueAgenda.create({
      data: {
        profesorId: profesores[profesor].id,
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

  // --- Turnos: sesiones únicas, una por clase ---
  const turnos = new Map<string, { id: number; fecha: string; profesor: Profe }>()
  for (const datos of TURNOS) {
    const fecha = fechaDe(datos.cuando)
    const turno = await prisma.turno.create({
      data: {
        bloqueAgendaId: await bloqueDe(datos.profesor, diaSemanaISO(fecha), datos.hora),
        alumnoId: alumnoIds[datos.alumno],
        materiaId: materia.id,
        tipo: 'SESION_UNICA',
        fechaInicio: fechaADate(fecha),
        fechaFin: fechaADate(fecha),
        temas: 'Trigonometría',
        ...auditoria,
      },
    })
    turnos.set(datos.clave, { id: turno.id, fecha, profesor: datos.profesor })
  }
  const turnoDe = (clave: string) => {
    const turno = turnos.get(clave)
    if (!turno) throw new Error(`Turno de demo inexistente: ${clave}`)
    return turno
  }

  // --- Asistencias: las registra el profesor, con su `createdAt` el día de la clase ---
  const asistenciaRegistrada = new Map<string, Date>()
  for (const datos of ASISTENCIAS) {
    const turno = turnoDe(datos.clave)
    const registro = instante(turno.fecha, datos.hora)
    const usuarioProfesor = profesores[turno.profesor].usuarioId
    await prisma.asistenciaTurno.create({
      data: {
        turnoId: turno.id,
        fechaOcurrencia: fechaADate(turno.fecha),
        estado: datos.estado,
        trabajado: datos.estado === 'PRESENTE' ? 'Identidades trigonométricas' : null,
        observacion: datos.estado === 'AUSENTE' ? 'No se presentó y no avisó' : null,
        createdById: usuarioProfesor,
        updatedById: usuarioProfesor,
        createdAt: registro,
      },
    })
    asistenciaRegistrada.set(datos.clave, registro)
  }

  // --- Pagos: al precio de Matemática, con el porcentaje vigente en su registro ---
  const cobros = new Map<string, { pagoTurnoId: number; registro: Date; porcentaje: number }>()
  for (const [i, datos] of PAGOS.entries()) {
    const anulado = datos.anulacion !== undefined
    const fechaPago = fechaDe(datos.cuando)
    const registro = instante(fechaPago, datos.hora)
    const porcentaje = porcentajeEn(registro)
    const total = precioCentavos * datos.claves.length
    const pago = await prisma.pago.create({
      data: {
        alumnoId: alumnoIds[datos.alumno],
        formaPagoId: formaPorTipo.get(datos.forma)!,
        importeTotal: aImporte(total),
        fechaPago: fechaADate(fechaPago),
        montoRecibido: datos.forma === 'EFECTIVO' ? aImporte(total) : null,
        transferenciaOperacion:
          datos.forma === 'TRANSFERENCIA' ? `000681${String(i).padStart(4, '0')}` : null,
        transferenciaBanco: datos.forma === 'TRANSFERENCIA' ? 'Banco Nación' : null,
        transferenciaTitular:
          datos.forma === 'TRANSFERENCIA'
            ? `${ALUMNOS[datos.alumno].nombre} ${ALUMNOS[datos.alumno].apellido}`
            : null,
        debitoRed: datos.forma === 'DEBITO' ? 'VISA_DEBITO' : null,
        debitoCupon: datos.forma === 'DEBITO' ? '003127' : null,
        debitoUltimos4: datos.forma === 'DEBITO' ? '5530' : null,
        estado: anulado ? 'ANULADO' : 'VIGENTE',
        ...auditoria,
        createdAt: registro,
        turnos: {
          create: datos.claves.map((clave) => ({
            turnoId: turnoDe(clave).id,
            fechaOcurrencia: fechaADate(turnoDe(clave).fecha),
            importeAplicado: aImporte(precioCentavos),
            porcentajeCentro: aImporte(porcentaje),
            // Un pago anulado deja `vigente` en null: la ocurrencia puede cobrarse de nuevo.
            vigente: anulado ? null : true,
          })),
        },
        anulacion: datos.anulacion
          ? {
              create: {
                motivo: 'ERROR_CARGA',
                detalle: datos.anulacion.detalle,
                createdById: mesa.id,
                createdAt: instante(fechaDe(datos.anulacion.cuando), datos.anulacion.hora),
              },
            }
          : undefined,
      },
      select: { turnos: { select: { id: true, turnoId: true } } },
    })
    for (const clave of datos.claves) {
      const pagoTurno = pago.turnos.find((pt) => pt.turnoId === turnoDe(clave).id)!
      cobros.set(clave, { pagoTurnoId: pagoTurno.id, registro, porcentaje })
    }
  }

  console.log(`Datos de demo de liquidaciones listos (hoy = ${fechaHoy}):`)

  // --- Liquidaciones pagadas, con los turnos devengados en su mes e importes congelados. Todos sus
  // pagos estaban vigentes al pagarlas: las anulaciones son posteriores. ---
  for (const datos of LIQUIDACIONES) {
    const mes = enMes(fechaHoy, datos.meses, 1)
    const lineas: {
      pagoTurnoId: number
      porcentaje: number
      fechaDevengo: string
      parteCentro: number
      parteProfesor: number
    }[] = []
    for (const [clave, cobro] of cobros) {
      const asistencia = asistenciaRegistrada.get(clave)
      if (turnoDe(clave).profesor !== datos.profesor || !asistencia) continue
      // Fecha de devengo: el registro más tardío entre el pago y la asistencia, en Salta.
      const devengo = asistencia > cobro.registro ? asistencia : cobro.registro
      const fechaDevengo = dateAFecha(new Date(devengo.getTime() - 3 * 60 * 60 * 1000))
      if (fechaDevengo.slice(0, 7) !== mes.slice(0, 7)) continue
      const parteCentro = parteDelCentro(precioCentavos, cobro.porcentaje)
      lineas.push({
        ...cobro,
        fechaDevengo,
        parteCentro,
        parteProfesor: precioCentavos - parteCentro,
      })
    }
    const suma = (f: (l: (typeof lineas)[number]) => number) => lineas.reduce((t, l) => t + f(l), 0)
    const parteProfesor = suma((l) => l.parteProfesor)
    const fechaTransferencia = fechaDe(datos.transferencia.cuando)

    const liquidacion = await prisma.liquidacion.create({
      data: {
        profesorId: profesores[datos.profesor].id,
        mes: fechaADate(mes),
        estado: 'PAGADA',
        totalCobrado: aImporte(precioCentavos * lineas.length),
        parteCentro: aImporte(suma((l) => l.parteCentro)),
        parteProfesor: aImporte(parteProfesor),
        totalAjustes: aImporte(0),
        total: aImporte(parteProfesor),
        fechaTransferencia: fechaADate(fechaTransferencia),
        numeroOperacion: datos.transferencia.numeroOperacion,
        observaciones: datos.transferencia.observaciones ?? null,
        createdById: gerente.id,
        createdAt: instante(fechaTransferencia, datos.transferencia.hora),
        turnos: {
          create: lineas.map((l) => ({
            pagoTurnoId: l.pagoTurnoId,
            fechaDevengo: fechaADate(l.fechaDevengo),
            importe: aImporte(precioCentavos),
            porcentajeCentro: aImporte(l.porcentaje),
            parteProfesor: aImporte(l.parteProfesor),
          })),
        },
      },
    })
    if (datos.adjunto) {
      await prisma.comprobanteAdjunto.create({
        data: {
          liquidacionId: liquidacion.id,
          archivoKey: `adjuntos/seed-liquidaciones-${liquidacion.id}.pdf`,
          mimeType: 'application/pdf',
          nombreArchivo: datos.adjunto.nombre,
          bytes: datos.adjunto.bytes,
          createdById: gerente.id,
          updatedById: gerente.id,
          createdAt: instante(fechaTransferencia, datos.transferencia.hora),
        },
      })
    }
    console.log(
      `  liquidación de ${mes.slice(0, 7)} de ${PROFESORES[datos.profesor].apellido}: ` +
        `${lineas.length} turnos, $ ${aImporte(parteProfesor)} transferidos el ${fechaTransferencia}`,
    )
  }

  console.log(
    `  profesor ${PROFESORES.A.email} / ${PASSWORD_DEMO} ("Mis ingresos"); ` +
      `${PROFESORES.B.apellido}, ${PROFESORES.B.nombre} sin cuenta`,
  )
  console.log(
    `  ${TURNOS.length} turnos, ${ASISTENCIAS.length} asistencias y ${PAGOS.length} pagos`,
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
