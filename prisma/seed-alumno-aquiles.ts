// Seed de un ALUMNO con mucha actividad y datos verosímiles: Aquiles Cancinos, estudiante de
// Ingeniería Industrial en la UNSa. Tiene clases todos los días salvo los lunes, en varios
// horarios, de tres materias (Matemática, Física y Química), con turnos recurrentes y sesiones
// únicas; paga las clases semana a semana, debe la última semana y una sesión que se le pasó,
// adelantó algunas clases y tiene exámenes cargados. Sirve para recorrer su ficha (turnos, pagos,
// deuda, exámenes), registrar un pago o un examen y ver la prioridad en las agendas.
//
// Los datos que se ven en la app (nombres, emails, teléfonos, observaciones) son verosímiles y no
// mencionan el seed: se identifican por los DNI de `ALUMNO` y `PROFESORES` para limpiarlos.
//
// Es independiente de los otros seeds de demo: crea sus propios profesores (uno por materia, con
// cuenta) y sus horarios, en aulas libres a esa hora (se leen los bloques que ya hay en la base).
// Sólo necesita el seed de desarrollo corrido antes (`pnpm db:seed`): usa su usuario de mesa de
// entradas, las materias Matemática, Física y Química (activas y con precio), las aulas y la forma
// de pago "Efectivo".
//
// Idempotente por "limpiar y recrear": cada corrida borra el alumno y los profesores con esos DNI
// (y lo que dejó una versión anterior de este script, con emails `@aquiles-demo.local`), con todo
// lo que cuelga de ellos, y los vuelve a crear con fechas relativas a hoy.
//
// Respeta las reglas de `docs/dominio.md`:
//   - lo carga mesa de entradas; cada bloque es una hora en punto en un aula libre a esa hora;
//   - la materia de cada turno está activa, con precio y asignada al profesor del bloque;
//   - las fechas caen en el día del bloque; una sesión única tiene `fechaFin = fechaInicio` y
//     "temas a trabajar"; cada alta recurrente tiene su `serieId` (la clase de dos horas del
//     sábado son dos turnos de la misma serie, T-103);
//   - el alumno no tiene dos turnos que se pisen y ninguna hora se pasa de su capacidad;
//   - cada pago es suyo, de ocurrencias que existen, no canceladas ni pagadas, al precio de su
//     materia, con fecha de pago <= hoy y monto recibido >= total; las futuras, hasta hoy + 56;
//   - deuda (HU-16): ocurrencias anteriores a hoy sin pagar; próximos turnos: de hoy al tope;
//   - exámenes (HU-17): a lo sumo uno pendiente (activo, fecha >= hoy) por materia. Química queda
//     sin examen pendiente (el que tenía se dio de baja), para poder cargarle uno nuevo; los que
//     carga un profesor son de la materia que le dicta al alumno.
//
// Cómo correrlo:
//   pnpm exec tsx prisma/seed-alumno-aquiles.ts             crea (o recrea) el alumno y sus datos
//   pnpm exec tsx prisma/seed-alumno-aquiles.ts --limpiar   sólo borra lo que creó este script
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizarBusqueda } from '@/server/shared/busqueda'
import { dateAFecha, diaSemanaISO, fechaADate, hoy } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'

/** Dominio de la versión anterior de este script: se limpia por si quedó algo. */
const DOMINIO_ANTERIOR = 'aquiles-demo.local'

/** Contraseña de los profesores (>= 8 caracteres, como exige Better Auth). Sólo desarrollo. */
const PASSWORD_PROFESORES = 'demo-1234'

/** Tope de cobro de una ocurrencia futura (decisión T-60, `DIAS_MAXIMOS_COBRO` de pagos). */
const DIAS_MAXIMOS_COBRO = 56

/** La última semana de clases todavía no la pagó: es su deuda reciente. */
const DIAS_SIN_PAGAR = 7

const ALUMNO = {
  nombre: 'Aquiles',
  apellido: 'Cancinos',
  dni: '43218765',
  fechaNacimiento: '2001-06-14', // 25 años: mayor de edad, con su propio email y teléfono
  telefono: '(387) 15-477-7888',
  email: 'aquiles.cancinos@gmail.com',
  nivelEscolaridad: 'UNIVERSITARIO' as const,
  grado: '2° año',
  institucionEducativa: 'Universidad Nacional de Salta',
  observaciones:
    'Cursa Ingeniería Industrial en la UNSa. Viene casi todos los días porque prepara parciales ' +
    'de las tres materias del cuatrimestre. Prefiere pagar a fin de semana, en efectivo.',
}

type NombreMateria = 'Matemática' | 'Física' | 'Química'

const PROFESORES: {
  materia: NombreMateria
  nombre: string
  apellido: string
  dni: string
  telefono: string
  email: string
  titulo: string
  matricula: string
}[] = [
  {
    materia: 'Matemática',
    nombre: 'Elena',
    apellido: 'Saravia',
    dni: '26874312',
    telefono: '(387) 15-422-1190',
    email: 'elena.saravia@gmail.com',
    titulo: 'Profesora en Matemática (UNSa)',
    matricula: 'MP-4127',
  },
  {
    materia: 'Física',
    nombre: 'Ramón',
    apellido: 'Quipildor',
    dni: '24391056',
    telefono: '(387) 15-503-8842',
    email: 'ramon.quipildor@hotmail.com',
    titulo: 'Licenciado en Física (UNT)',
    matricula: 'MP-3389',
  },
  {
    materia: 'Química',
    nombre: 'Inés',
    apellido: 'Tolaba',
    dni: '29105647',
    telefono: '(387) 15-461-3075',
    email: 'ines.tolaba@yahoo.com.ar',
    titulo: 'Ingeniera Química (UNSa)',
    matricula: 'MP-4560',
  },
]

/** Lo que suele traer a cada materia: observaciones del turno y temas de las sesiones únicas. */
const POR_MATERIA: Record<NombreMateria, { observaciones: string; temas: string[] }> = {
  Matemática: {
    observaciones: 'Apoyo para Análisis Matemático I: le cuesta la práctica de integrales.',
    temas: [
      'Límites indeterminados y regla de L’Hôpital',
      'Derivadas: regla de la cadena y derivación implícita',
      'Integrales por partes y sustitución',
      'Repaso de la guía de ejercicios para el parcial',
    ],
  },
  Física: {
    observaciones: 'Física I: viene con los problemas de la guía resueltos a medias.',
    temas: [
      'Cinemática: tiro oblicuo',
      'Dinámica: diagramas de cuerpo libre y rozamiento',
      'Trabajo y energía: problemas de la guía 4',
      'Consulta del trabajo práctico de laboratorio',
    ],
  },
  Química: {
    observaciones: 'Química General: refuerzo de estequiometría y soluciones.',
    temas: [
      'Estequiometría: reactivo limitante y rendimiento',
      'Soluciones: molaridad y diluciones',
      'Equilibrio químico: constante y principio de Le Chatelier',
    ],
  },
}

// Horario: martes (2) a domingo (7), nunca lunes. Las semanas se cuentan desde la próxima
// ocurrencia de ese día (semana 0: la de hoy en adelante, hoy incluido): -6 es hace seis semanas
// y +4, dentro de cuatro.
type Recurrente = {
  tipo: 'RECURRENTE'
  dia: number
  hora: number
  /** Horas seguidas de la misma clase (cada una es un turno de la misma serie). */
  horas?: number
  materia: NombreMateria
  desdeSemana: number
  /** `null`: sin fecha de fin (sigue indefinidamente). */
  hastaSemana: number | null
}
type SesionesUnicas = {
  tipo: 'SESION_UNICA'
  dia: number
  hora: number
  materia: NombreMateria
  /** Una sesión única (un turno) por cada semana de la lista. */
  semanas: number[]
}

const HORARIO: (Recurrente | SesionesUnicas)[] = [
  // Martes
  {
    tipo: 'RECURRENTE',
    dia: 2,
    hora: 9,
    materia: 'Matemática',
    desdeSemana: -6,
    hastaSemana: null,
  },
  { tipo: 'SESION_UNICA', dia: 2, hora: 17, materia: 'Física', semanas: [-3, -1, 1, 2] },
  // Miércoles
  { tipo: 'RECURRENTE', dia: 3, hora: 10, materia: 'Química', desdeSemana: -5, hastaSemana: 8 },
  { tipo: 'SESION_UNICA', dia: 3, hora: 18, materia: 'Matemática', semanas: [-2, 1] },
  // Jueves
  { tipo: 'RECURRENTE', dia: 4, hora: 9, materia: 'Física', desdeSemana: -6, hastaSemana: null },
  { tipo: 'SESION_UNICA', dia: 4, hora: 14, materia: 'Química', semanas: [-4, -1, 2] },
  { tipo: 'RECURRENTE', dia: 4, hora: 19, materia: 'Matemática', desdeSemana: -3, hastaSemana: 6 },
  // Viernes (el de las 16 terminó cuando aprobó el primer parcial de Química)
  {
    tipo: 'RECURRENTE',
    dia: 5,
    hora: 11,
    materia: 'Matemática',
    desdeSemana: -4,
    hastaSemana: null,
  },
  { tipo: 'RECURRENTE', dia: 5, hora: 16, materia: 'Química', desdeSemana: -6, hastaSemana: -1 },
  // Sábado (una clase de dos horas, de 9 a 11)
  {
    tipo: 'RECURRENTE',
    dia: 6,
    hora: 9,
    horas: 2,
    materia: 'Física',
    desdeSemana: -5,
    hastaSemana: 10,
  },
  { tipo: 'SESION_UNICA', dia: 6, hora: 14, materia: 'Química', semanas: [-1, 3] },
  // Domingo
  { tipo: 'SESION_UNICA', dia: 7, hora: 10, materia: 'Matemática', semanas: [-3, 1, 4] },
  { tipo: 'RECURRENTE', dia: 7, hora: 12, materia: 'Física', desdeSemana: -2, hastaSemana: null },
]

type TipoExamen = 'PARCIAL' | 'FINAL' | 'RECUPERATORIO' | 'TRABAJO_PRACTICO' | 'OTRO'

/**
 * Exámenes, en días desde hoy. Un solo pendiente (activo y con fecha >= hoy) por materia (HU-17).
 * Matemática y Física tienen uno pendiente (dan prioridad Alta y Media a sus turnos cercanos);
 * Química no: el recuperatorio ya pasó y el final que se había cargado se dio de baja, así que se
 * le puede cargar uno nuevo. `cargadoPor`: el profesor de esa materia o mesa de entradas.
 */
const EXAMENES: {
  materia: NombreMateria
  dias: number
  tipo: TipoExamen
  observaciones: string
  estado: 'ACTIVO' | 'INACTIVO'
  cargadoPor: 'profesor' | 'mesa'
}[] = [
  {
    materia: 'Matemática',
    dias: -24,
    tipo: 'PARCIAL',
    observaciones: 'Primer parcial de Análisis Matemático I. Aprobó con 7.',
    estado: 'ACTIVO',
    cargadoPor: 'profesor',
  },
  {
    materia: 'Matemática',
    dias: 6,
    tipo: 'PARCIAL',
    observaciones: 'Segundo parcial: integrales y aplicaciones.',
    estado: 'ACTIVO',
    cargadoPor: 'profesor',
  },
  {
    materia: 'Física',
    dias: -11,
    tipo: 'TRABAJO_PRACTICO',
    observaciones: 'Entrega del informe de laboratorio de cinemática.',
    estado: 'ACTIVO',
    cargadoPor: 'mesa',
  },
  {
    materia: 'Física',
    dias: 16,
    tipo: 'PARCIAL',
    observaciones: 'Primer parcial de Física I: dinámica y energía.',
    estado: 'ACTIVO',
    cargadoPor: 'profesor',
  },
  {
    materia: 'Química',
    dias: -20,
    tipo: 'PARCIAL',
    observaciones: 'Primer parcial de Química General. Desaprobó con 4.',
    estado: 'ACTIVO',
    cargadoPor: 'profesor',
  },
  {
    materia: 'Química',
    dias: -6,
    tipo: 'RECUPERATORIO',
    observaciones: 'Recuperatorio del primer parcial. Aprobó con 6.',
    estado: 'ACTIVO',
    cargadoPor: 'mesa',
  },
  {
    materia: 'Química',
    dias: 25,
    tipo: 'FINAL',
    observaciones: 'Se cargó por error: la fecha de la mesa de final todavía no salió.',
    estado: 'INACTIVO',
    cargadoPor: 'mesa',
  },
]

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

const UN_DIA_MS = 24 * 60 * 60 * 1000

/** `YYYY-MM-DD` + `dias` (puede ser negativo). */
function sumarDias(fecha: string, dias: number): string {
  return dateAFecha(new Date(fechaADate(fecha).getTime() + dias * UN_DIA_MS))
}

/** Primera fecha >= `desde` que cae en `diaSemana` (ISO 1..7). */
function primeraFechaDelDia(diaSemana: number, desde: string): string {
  return sumarDias(desde, (diaSemana - diaSemanaISO(desde) + 7) % 7)
}

const minimo = (a: string, b: string) => (a < b ? a : b)

/** `YYYY-MM-DD` → `DD/MM`, para los textos que se ven en la app. */
const diaMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`

/** Importe de la base (`Decimal`, "8000.00") a centavos, para sumar sin errores de redondeo. */
const aCentavos = (importe: { toString(): string }) => Math.round(Number(importe.toString()) * 100)
const aImporte = (centavos: number) => (centavos / 100).toFixed(2)
const pesos = (centavos: number) =>
  `$${(centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

// ---------------------------------------------------------------------------------------------
// Limpieza de una corrida anterior
// ---------------------------------------------------------------------------------------------

async function limpiar() {
  const usuarioIds = (
    await prisma.usuario.findMany({
      where: {
        OR: [
          { dni: { in: PROFESORES.map((p) => p.dni) }, role: 'PROFESOR' },
          { email: { endsWith: `@${DOMINIO_ANTERIOR}` } },
        ],
      },
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
    await prisma.alumno.findMany({
      where: { OR: [{ dni: ALUMNO.dni }, { email: { endsWith: `@${DOMINIO_ANTERIOR}` } }] },
      select: { id: true },
    })
  ).map((a) => a.id)
  const turnoIds = (
    await prisma.turno.findMany({
      where: {
        OR: [
          { bloqueAgenda: { profesorId: { in: profesorIds } } },
          { alumnoId: { in: alumnoIds } },
        ],
      },
      select: { id: true },
    })
  ).map((t) => t.id)
  const pagoIds = (
    await prisma.pago.findMany({ where: { alumnoId: { in: alumnoIds } }, select: { id: true } })
  ).map((p) => p.id)

  // Orden que respeta las FK (todas son onDelete: Restrict). Los exámenes que cargaron estos
  // profesores son de este alumno, así que se van con él.
  await prisma.examen.deleteMany({ where: { alumnoId: { in: alumnoIds } } })
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
    `Limpieza: ${alumnoIds.length} alumno, ${profesorIds.length} profesores, ` +
      `${turnoIds.length} turnos y ${pagoIds.length} pagos.`,
  )
}

// ---------------------------------------------------------------------------------------------
// Creación
// ---------------------------------------------------------------------------------------------

async function requisitos() {
  const mesa = await prisma.usuario.findFirst({
    where: { role: 'MESA_ENTRADAS', estado: 'ACTIVO', email: { endsWith: '@aulaclick.local' } },
  })
  const materias = await prisma.materia.findMany({
    where: {
      busqueda: { in: PROFESORES.map((p) => normalizarBusqueda(p.materia)) },
      estado: 'ACTIVO',
      precioHora: { not: null },
    },
    select: { id: true, nombre: true, busqueda: true, precioHora: true },
  })
  const aulas = await prisma.aula.findMany({ where: { estado: 'ACTIVO' }, orderBy: { id: 'asc' } })
  const formaPago = await prisma.formaPago.findUnique({ where: { nombre: 'Efectivo' } })

  if (!mesa || materias.length < PROFESORES.length || aulas.length === 0 || !formaPago) {
    throw new Error(
      'Faltan datos del seed de desarrollo (usuario de mesa de entradas, Matemática, Física y ' +
        'Química activas y con precio, aulas o forma de pago "Efectivo"). Corré primero ' +
        '`pnpm db:seed` y volvé a intentar.',
    )
  }
  // Email y matrícula son únicos: si ya los usa otra cuenta, no se pisa (la limpieza sólo borra
  // por DNI).
  const choques = await prisma.usuario.count({
    where: { email: { in: [...PROFESORES.map((p) => p.email)] } },
  })
  const matriculas = await prisma.profesor.count({
    where: { matricula: { in: PROFESORES.map((p) => p.matricula) } },
  })
  if (choques > 0 || matriculas > 0) {
    throw new Error('Algún email o matrícula de los profesores ya lo usa otra cuenta de la base.')
  }
  return {
    mesa,
    materiaPorNombre: new Map(materias.map((m) => [m.busqueda, m])),
    aulas,
    formaPagoId: formaPago.id,
  }
}

type TurnoCreado = {
  id: number
  materia: NombreMateria
  tipo: 'RECURRENTE' | 'SESION_UNICA'
  dia: number
  hora: number
  inicio: string
  fin: string | null
}

async function crear() {
  const { mesa, materiaPorNombre, aulas, formaPagoId } = await requisitos()
  const auditoria = { createdById: mesa.id, updatedById: mesa.id }
  const fechaHoy = hoy()
  const hash = await hashPassword(PASSWORD_PROFESORES)
  const materiaDe = (nombre: NombreMateria) => materiaPorNombre.get(normalizarBusqueda(nombre))!

  // --- Profesores, con cuenta y su materia asignada (HU-05: la asigna mesa de entradas) ---
  const profesorDe = new Map<NombreMateria, { id: number; usuarioId: string }>()
  for (const datos of PROFESORES) {
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
      },
    })
    await prisma.account.create({
      data: {
        id: randomUUID(),
        providerId: 'credential',
        accountId: usuario.id,
        userId: usuario.id,
        password: hash,
      },
    })
    const profesor = await prisma.profesor.create({
      data: {
        usuarioId: usuario.id,
        titulo: datos.titulo,
        matricula: datos.matricula,
        capacidad: 5,
      },
    })
    await prisma.asignacionMateria.create({
      data: { profesorId: profesor.id, materiaId: materiaDe(datos.materia).id, ...auditoria },
    })
    profesorDe.set(datos.materia, { id: profesor.id, usuarioId: usuario.id })
  }

  // --- Alumno ---
  const alumno = await prisma.alumno.create({
    data: {
      nombre: ALUMNO.nombre,
      apellido: ALUMNO.apellido,
      dni: ALUMNO.dni,
      busqueda: normalizarBusqueda(`${ALUMNO.apellido} ${ALUMNO.nombre} ${ALUMNO.dni}`),
      fechaNacimiento: fechaADate(ALUMNO.fechaNacimiento),
      telefono: ALUMNO.telefono,
      email: ALUMNO.email,
      nivelEscolaridad: ALUMNO.nivelEscolaridad,
      grado: ALUMNO.grado,
      institucionEducativa: ALUMNO.institucionEducativa,
      observaciones: ALUMNO.observaciones,
      ...auditoria,
    },
  })

  // --- Bloques: una hora en punto en un aula libre a esa hora (dominio.md → Bloques) ---
  const aulaOcupada = new Set(
    (
      await prisma.bloqueAgenda.findMany({
        where: { estado: 'ACTIVO' },
        select: { aulaId: true, diaSemana: true, horaInicio: true },
      })
    ).map((b) => `${b.aulaId}|${b.diaSemana}|${b.horaInicio}`),
  )
  async function crearBloque(materia: NombreMateria, dia: number, hora: number) {
    const inicio = hora * 60
    const aula = aulas.find((a) => !aulaOcupada.has(`${a.id}|${dia}|${inicio}`))
    if (!aula) throw new Error(`No hay ningún aula libre el día ${dia} a las ${hora}:00.`)
    aulaOcupada.add(`${aula.id}|${dia}|${inicio}`)
    return prisma.bloqueAgenda.create({
      data: {
        profesorId: profesorDe.get(materia)!.id,
        aulaId: aula.id,
        diaSemana: dia,
        horaInicio: inicio,
        horaFin: inicio + 60,
        ...auditoria,
      },
    })
  }

  // --- Turnos ---
  const turnos: TurnoCreado[] = []
  const temasUsados: Record<NombreMateria, number> = { Matemática: 0, Física: 0, Química: 0 }
  for (const clase of HORARIO) {
    const semana0 = primeraFechaDelDia(clase.dia, fechaHoy)
    const enSemana = (n: number) => sumarDias(semana0, 7 * n)
    const materia = materiaDe(clase.materia)
    const { observaciones, temas } = POR_MATERIA[clase.materia]

    if (clase.tipo === 'RECURRENTE') {
      const inicio = enSemana(clase.desdeSemana)
      const fin = clase.hastaSemana === null ? null : enSemana(clase.hastaSemana)
      const serieId = randomUUID() // todas las horas de la clase son la misma serie (T-103)
      for (let h = 0; h < (clase.horas ?? 1); h++) {
        const bloque = await crearBloque(clase.materia, clase.dia, clase.hora + h)
        const turno = await prisma.turno.create({
          data: {
            bloqueAgendaId: bloque.id,
            alumnoId: alumno.id,
            materiaId: materia.id,
            tipo: 'RECURRENTE',
            fechaInicio: fechaADate(inicio),
            fechaFin: fin === null ? null : fechaADate(fin),
            observaciones,
            temas: null, // opcional en un recurrente
            serieId,
            ...auditoria,
          },
        })
        turnos.push({
          id: turno.id,
          materia: clase.materia,
          tipo: 'RECURRENTE',
          dia: clase.dia,
          hora: clase.hora + h,
          inicio,
          fin,
        })
      }
    } else {
      const bloque = await crearBloque(clase.materia, clase.dia, clase.hora)
      for (const semana of clase.semanas) {
        const fecha = enSemana(semana)
        const turno = await prisma.turno.create({
          data: {
            bloqueAgendaId: bloque.id,
            alumnoId: alumno.id,
            materiaId: materia.id,
            tipo: 'SESION_UNICA',
            fechaInicio: fechaADate(fecha),
            fechaFin: fechaADate(fecha), // en una sesión única, fin = inicio
            observaciones: 'Clase de consulta antes del examen.',
            // "Temas a trabajar": obligatorio en una sesión única (HU-08).
            temas: temas[temasUsados[clase.materia]++ % temas.length]!,
            serieId: null,
            ...auditoria,
          },
        })
        turnos.push({
          id: turno.id,
          materia: clase.materia,
          tipo: 'SESION_UNICA',
          dia: clase.dia,
          hora: clase.hora,
          inicio: fecha,
          fin: fecha,
        })
      }
    }
  }

  // --- Exámenes (HU-17) ---
  for (const examen of EXAMENES) {
    const autor =
      examen.cargadoPor === 'profesor' ? profesorDe.get(examen.materia)!.usuarioId : mesa.id
    await prisma.examen.create({
      data: {
        alumnoId: alumno.id,
        materiaId: materiaDe(examen.materia).id,
        fecha: fechaADate(sumarDias(fechaHoy, examen.dias)),
        tipo: examen.tipo,
        observaciones: examen.observaciones,
        estado: examen.estado,
        createdById: autor,
        updatedById: autor,
      },
    })
  }

  // --- Ocurrencias: todas las pasadas (la deuda no tiene tope hacia atrás) y las futuras hasta
  //     el tope de cobro (más allá todavía no se pueden pagar ni aparecen en "Próximos turnos") ---
  const tope = sumarDias(fechaHoy, DIAS_MAXIMOS_COBRO)
  type Ocurrencia = { turno: TurnoCreado; fecha: string; centavos: number }
  const ocurrencias: Ocurrencia[] = []
  for (const turno of turnos) {
    const centavos = aCentavos(materiaDe(turno.materia).precioHora!)
    const ultima = minimo(turno.fin ?? tope, tope)
    for (let fecha = turno.inicio; fecha <= ultima; fecha = sumarDias(fecha, 7)) {
      ocurrencias.push({ turno, fecha, centavos })
    }
  }
  ocurrencias.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.turno.hora - b.turno.hora)

  // --- Pagos ---
  // Paga cada semana el último día que viene, en efectivo. La última semana todavía no la pagó, y
  // se le pasó una consulta de Química de hace un mes (las dos cosas son su deuda). Además adelantó
  // hoy las dos próximas clases del martes de Matemática y la próxima consulta de Física.
  const pasadas = ocurrencias.filter((o) => o.fecha < fechaHoy)
  const desdeSinPagar = sumarDias(fechaHoy, -DIAS_SIN_PAGAR)
  const olvidada = pasadas.find(
    (o) => o.turno.tipo === 'SESION_UNICA' && o.turno.materia === 'Química',
  )
  const aCobrar = pasadas.filter((o) => o.fecha < desdeSinPagar && o !== olvidada)

  const porSemana = new Map<string, Ocurrencia[]>()
  for (const o of aCobrar) {
    const lunes = sumarDias(o.fecha, 1 - diaSemanaISO(o.fecha)) // agrupa martes a domingo
    porSemana.set(lunes, [...(porSemana.get(lunes) ?? []), o])
  }

  const futuras = ocurrencias.filter((o) => o.fecha >= fechaHoy)
  const martesMatematica = futuras
    .filter((o) => o.turno.dia === 2 && o.turno.hora === 9 && o.turno.tipo === 'RECURRENTE')
    .slice(0, 2)
  const consultaFisica = futuras
    .filter((o) => o.turno.materia === 'Física' && o.turno.tipo === 'SESION_UNICA')
    .slice(0, 1)
  const adelantadas = [...martesMatematica, ...consultaFisica]

  type PagoNuevo = {
    fechaPago: string
    items: Ocurrencia[]
    recibido: 'justo' | 'redondo' | 'sin informar'
    observaciones: string | null
  }
  const formasDeEntregar = ['redondo', 'justo', 'sin informar'] as const
  const pagos: PagoNuevo[] = [...porSemana.entries()].map(([lunes, items], i) => ({
    fechaPago: items.at(-1)!.fecha, // el último día de clase de esa semana (ya pasó)
    items,
    recibido: formasDeEntregar[i % formasDeEntregar.length]!,
    observaciones: `Clases de la semana del ${diaMes(sumarDias(lunes, 1))}.`,
  }))
  if (adelantadas.length > 0) {
    pagos.push({
      fechaPago: fechaHoy,
      items: adelantadas,
      recibido: 'redondo',
      observaciones:
        `Adelanta las clases de Matemática del martes ` +
        `${martesMatematica.map((o) => diaMes(o.fecha)).join(' y ')}` +
        (consultaFisica[0]
          ? ` y la consulta de Física del ${diaMes(consultaFisica[0].fecha)}.`
          : '.'),
    })
  }

  for (const pago of pagos) {
    const total = pago.items.reduce((acc, o) => acc + o.centavos, 0)
    const recibido =
      pago.recibido === 'sin informar'
        ? null
        : pago.recibido === 'justo'
          ? total
          : Math.ceil((total + 1) / 1000000) * 1000000 // con un billete redondo: deja vuelto
    await prisma.pago.create({
      data: {
        alumnoId: alumno.id,
        formaPagoId,
        importeTotal: aImporte(total),
        fechaPago: fechaADate(pago.fechaPago),
        montoRecibido: recibido === null ? null : aImporte(recibido),
        observaciones: pago.observaciones,
        ...auditoria,
        turnos: {
          create: pago.items.map((o) => ({
            turnoId: o.turno.id,
            fechaOcurrencia: fechaADate(o.fecha),
            importeAplicado: aImporte(o.centavos),
          })),
        },
      },
    })
  }

  // --- Resumen: con la misma regla que la cuenta del alumno (HU-16) ---
  const cobradas = new Set(pagos.flatMap((p) => p.items))
  const suma = (lista: Ocurrencia[]) => lista.reduce((acc, o) => acc + o.centavos, 0)
  const adeudadas = pasadas.filter((o) => !cobradas.has(o)) // anteriores a hoy, sin pagar
  const proximas = futuras.filter((o) => !cobradas.has(o)) // de hoy al tope, sin pagar
  const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
  const materias: NombreMateria[] = ['Matemática', 'Física', 'Química']

  console.log(`Alumno listo (hoy = ${fechaHoy}):`)
  console.log(`  ${ALUMNO.apellido}, ${ALUMNO.nombre} — DNI ${ALUMNO.dni} — ${ALUMNO.email}`)
  console.log(`  ${turnos.length} turnos (martes a domingo):`)
  for (const t of [...turnos].sort((a, b) => a.dia - b.dia || a.hora - b.hora || a.id - b.id)) {
    const rango =
      t.tipo === 'SESION_UNICA'
        ? diaMes(t.inicio)
        : `${diaMes(t.inicio)} → ${t.fin ? diaMes(t.fin) : 'sin fin'}${t.fin !== null && t.fin < fechaHoy ? ' (terminado)' : ''}`
    console.log(
      `    ${DIAS[t.dia]!.padEnd(10)} ${minutosAHora(t.hora * 60)}  ${t.materia.padEnd(11)} ` +
        `${t.tipo === 'RECURRENTE' ? 'recurrente  ' : 'sesión única'} ${rango}`,
    )
  }
  console.log('  Cuenta (como la muestra la ficha del alumno):')
  console.log(
    `    pagado:    ${pesos(suma([...cobradas]))} en ${pagos.length} pagos ` +
      `(${cobradas.size} clases; ${adelantadas.length} adelantadas)`,
  )
  console.log(
    `    adeudado:  ${pesos(suma(adeudadas))} (${adeudadas.length} clases anteriores a hoy)`,
  )
  for (const materia of materias) {
    const deMateria = adeudadas.filter((o) => o.turno.materia === materia)
    if (deMateria.length > 0) {
      console.log(
        `      ${materia.padEnd(11)} ${deMateria.length} clases, ${pesos(suma(deMateria))}`,
      )
    }
  }
  console.log(
    `    próximos:  ${pesos(suma(proximas))} (${proximas.length} clases de hoy al ${diaMes(tope)}, ` +
      'se pueden cobrar por adelantado; no son deuda)',
  )
  console.log('  Exámenes:')
  for (const e of EXAMENES) {
    const fecha = sumarDias(fechaHoy, e.dias)
    const estado =
      e.estado === 'INACTIVO' ? 'dado de baja' : fecha >= fechaHoy ? 'PENDIENTE' : 'pasado'
    console.log(`    ${diaMes(fecha)}  ${e.materia.padEnd(11)} ${e.tipo.padEnd(16)} ${estado}`)
  }
  console.log('    Química no tiene examen pendiente: se le puede cargar uno nuevo.')
  console.log(`  Profesores: ${PROFESORES.map((p) => p.email).join(', ')}`)
  console.log(`    contraseña "${PASSWORD_PROFESORES}"`)
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
