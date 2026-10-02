// Seed de DATOS DE DEMO: llena la base con un centro "en funcionamiento" (profesores con cuenta,
// alumnos, materias, horarios y turnos repartidos en el tiempo), para poder recorrer todas las
// pantallas con datos que parecen reales.
//
// NO es el seed de desarrollo (`prisma/seed.ts`, el de `pnpm db:seed`, que crea los roles, los
// tres usuarios, las materias base y las aulas): este es un script aparte y **lo necesita
// corrido antes**, porque reutiliza sus roles, sus aulas y su usuario de mesa de entradas.
//
// Idempotente por "limpiar y recrear": cada corrida borra sólo lo que creó una corrida anterior
// de ESTE script (identificable por el dominio de email `@datos-demo.local`) y lo vuelve a crear
// con fechas relativas a hoy. Nunca toca los alumnos, profesores, bloques ni turnos que hayas
// cargado a mano, por la API o con los otros seeds.
//
// Todo lo que genera respeta las reglas de `docs/dominio.md`, así que la app no queda en un
// estado que los endpoints rechazarían:
//   - un profesor no tiene dos bloques a la misma hora el mismo día, y un aula tampoco
//     (se leen además los bloques que ya existen en la base, para no pisarlos);
//   - cada bloque es una fila de UNA hora en punto;
//   - la materia de un turno está activa y asignada al profesor de ese bloque;
//   - ninguna hora supera su capacidad efectiva `min(profesor.capacidad, aula.capacidad)` en
//     ninguna fecha, contando los recurrentes en todas sus ocurrencias;
//   - ningún alumno tiene dos turnos que se pisen (mismo día y hora, con fechas que se cruzan);
//   - las fechas de un turno caen en el día de la semana de su bloque, y una sesión única tiene
//     `fechaFin = fechaInicio`;
//   - los profesores inactivos y las materias inactivas no tienen turnos vigentes.
//
// El **miércoles queda libre a propósito** (`DIAS_CON_HORARIO`): ningún profesor de demo tiene
// bloques ese día, así que tampoco hay turnos. Sirve para ver una agenda vacía y para cargar un
// horario nuevo sin chocar con nada.
//
// Los datos son deterministas (generador con semilla fija): dos corridas producen el mismo
// centro, salvo el corrimiento de las fechas relativas a hoy.
//
// Cómo correrlo:
//   pnpm exec tsx prisma/seed-datos-demo.ts             crea (o recrea) los datos de demo
//   pnpm exec tsx prisma/seed-datos-demo.ts --limpiar   sólo borra lo que creó este script
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizarBusqueda } from '@/server/shared/busqueda'
import { dateAFecha, diaSemanaISO, fechaADate, hoy } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'

// ---------------------------------------------------------------------------------------------
// Parámetros del centro que se genera
// ---------------------------------------------------------------------------------------------

/** Dominio reservado: es lo que identifica (y permite limpiar) lo que crea este script. */
const DOMINIO = 'datos-demo.local'

/** Contraseña de todos los profesores de demo (>= 8 caracteres, como exige Better Auth). */
const PASSWORD_DEMO = 'demo-1234'

const CANTIDAD_PROFESORES_ACTIVOS = 14
const CANTIDAD_PROFESORES_INACTIVOS = 2
const CANTIDAD_ALUMNOS = 120
const CANTIDAD_EXAMENES = 90

/** Ventana de turnos alrededor de hoy: un mes de historia y diez semanas hacia adelante. */
const DIAS_ATRAS = 28
const DIAS_ADELANTE = 70

/** Semilla del generador: cambiala si querés otro centro igual de válido. */
const SEMILLA = 20260925

// ---------------------------------------------------------------------------------------------
// Vocabulario (nombres, materias, colegios): datos que parecen reales, del NOA
// ---------------------------------------------------------------------------------------------

const NOMBRES = [
  'Sofía',
  'Valentina',
  'Martina',
  'Catalina',
  'Julieta',
  'Camila',
  'Emilia',
  'Renata',
  'Delfina',
  'Guadalupe',
  'Malena',
  'Agustina',
  'Pilar',
  'Lucía',
  'Josefina',
  'Bautista',
  'Benicio',
  'Thiago',
  'Lorenzo',
  'Joaquín',
  'Santino',
  'Gael',
  'Facundo',
  'Ignacio',
  'Tomás',
  'Bruno',
  'Ramiro',
  'Matías',
  'Nicolás',
  'Franco',
  'Lautaro',
  'Emiliano',
]

const APELLIDOS = [
  'Gutiérrez',
  'Ríos',
  'Cabrera',
  'Villagrán',
  'Zerpa',
  'Chocobar',
  'Guaymás',
  'Colque',
  'Figueroa',
  'Saravia',
  'Cornejo',
  'Burgos',
  'Aramayo',
  'Yapura',
  'Mamaní',
  'Quiroga',
  'Vilte',
  'Sandoval',
  'Cardozo',
  'Farfán',
  'Leguizamón',
  'Ovando',
  'Tapia',
  'Nieva',
  'Alderete',
  'Bravo',
  'Carrizo',
  'Domínguez',
  'Escalante',
  'Fernández',
  'Gallo',
  'Herrera',
]

const TITULOS = [
  'Profesor/a en Matemática',
  'Licenciado/a en Física',
  'Profesor/a en Lengua y Literatura',
  'Ingeniero/a Químico/a',
  'Contador/a Público/a',
  'Profesor/a en Historia',
  'Licenciado/a en Biología',
  'Traductor/a de Inglés',
  'Profesor/a en Geografía',
  'Licenciado/a en Economía',
]

/**
 * Materias que suma este script a las del seed de desarrollo. Las dos últimas quedan INACTIVAS
 * (sin profesores asignados: una materia con profesores no se puede dar de baja). Todas llevan
 * precioHora (HU-12, T-29) salvo que se agreguen sin precio a propósito.
 */
const MATERIAS_DEMO = [
  { nombre: 'Biología', descripcion: 'Apoyo para secundario y CBC', precioHora: '7500.00' },
  { nombre: 'Historia', descripcion: 'Historia argentina y americana', precioHora: '7000.00' },
  { nombre: 'Geografía', descripcion: 'Geografía física y humana', precioHora: '7000.00' },
  {
    nombre: 'Álgebra',
    descripcion: 'Álgebra para primer año de facultad',
    precioHora: '9000.00',
  },
  {
    nombre: 'Análisis Matemático',
    descripcion: 'Límites, derivadas e integrales',
    precioHora: '9000.00',
  },
  { nombre: 'Economía', descripcion: 'Introducción a la economía', precioHora: '8000.00' },
  { nombre: 'Programación', descripcion: 'Lógica y primeros lenguajes', precioHora: '9500.00' },
  {
    nombre: 'Estadística',
    descripcion: 'Probabilidad y estadística descriptiva',
    precioHora: '8500.00',
  },
  { nombre: 'Latín', descripcion: 'Materia sin demanda: queda inactiva', precioHora: '6000.00' },
  {
    nombre: 'Filosofía',
    descripcion: 'Materia sin demanda: queda inactiva',
    precioHora: '6000.00',
  },
]

const MATERIAS_INACTIVAS = ['Latín', 'Filosofía']

const TIPOS_EXAMEN = ['PARCIAL', 'FINAL', 'RECUPERATORIO', 'TRABAJO_PRACTICO', 'OTRO'] as const

const COLEGIOS = [
  'Colegio Nacional Dr. Manuel Belgrano',
  'Escuela Normal Gral. Manuel Belgrano',
  'Colegio Santa Rosa de Viterbo',
  'Instituto Jesús Sacramentado',
  'Colegio del Huerto',
  'Escuela de Comercio Alejandro Aguado',
  'Colegio San Alberto Magno',
  'Universidad Nacional de Salta',
  'Universidad Católica de Salta',
]

const MOTIVOS = [
  'Prepara el parcial de la semana que viene',
  'Refuerzo de los temas que le quedaron pendientes',
  'Trae dudas de la última clase del colegio',
  'Recuperatorio a fin de mes',
  'Apoyo semanal para no atrasarse',
  'Le cuesta la resolución de problemas',
  'Prepara la mesa de diciembre',
  'Repaso general antes del trimestral',
  null,
  null,
]

/** "Temas a trabajar" (HU-08): obligatorio en sesión única. */
const TEMAS = [
  'Ecuaciones de segundo grado',
  'Repaso general de la unidad',
  'Resolución de problemas de aplicación',
  'Dudas puntuales de la última clase',
  'Preparación del próximo examen',
  'Trabajo práctico pendiente',
]

const NIVELES = ['SECUNDARIO', 'SECUNDARIO', 'SECUNDARIO', 'TERCIARIO', 'UNIVERSITARIO'] as const

/**
 * Días en los que el centro arma horario (ISO: 1 = lunes … 7 = domingo). **El miércoles (3) queda
 * libre a propósito**: ningún profesor de demo tiene bloques ese día, así que tampoco hay turnos.
 * Sirve para ver una agenda vacía, para cargar un bloque nuevo sin chocar con nada y para probar
 * el alta de turnos sobre un día limpio.
 */
const DIAS_CON_HORARIO = [1, 2, 4, 5, 6]

/** Franjas horarias típicas del centro: hora de inicio y cuántas horas seguidas atiende. */
const FRANJAS = [
  { desde: 8, horas: 4 },
  { desde: 9, horas: 3 },
  { desde: 10, horas: 3 },
  { desde: 14, horas: 4 },
  { desde: 15, horas: 3 },
  { desde: 16, horas: 4 },
  { desde: 18, horas: 3 },
]

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

/** Generador determinista (mulberry32): la misma semilla da siempre el mismo centro. */
function crearAzar(semilla: number) {
  let estado = semilla >>> 0
  return {
    /** Decimal en [0, 1). */
    decimal(): number {
      estado = (estado + 0x6d2b79f5) >>> 0
      let t = estado
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    /** Entero en [min, max], extremos incluidos. */
    entero(min: number, max: number): number {
      return min + Math.floor(this.decimal() * (max - min + 1))
    },
    /** Un elemento de la lista. */
    de<T>(lista: readonly T[]): T {
      return lista[this.entero(0, lista.length - 1)] as T
    },
    /** `true` con probabilidad `p`. */
    chance(p: number): boolean {
      return this.decimal() < p
    },
    /** Copia mezclada de la lista (Fisher-Yates). */
    mezclar<T>(lista: readonly T[]): T[] {
      const copia = [...lista]
      for (let i = copia.length - 1; i > 0; i--) {
        const j = this.entero(0, i)
        ;[copia[i], copia[j]] = [copia[j] as T, copia[i] as T]
      }
      return copia
    },
  }
}

type Azar = ReturnType<typeof crearAzar>

const UN_DIA_MS = 24 * 60 * 60 * 1000

/** `YYYY-MM-DD` + `dias` (puede ser negativo). */
function sumarDias(fecha: string, dias: number): string {
  return dateAFecha(new Date(fechaADate(fecha).getTime() + dias * UN_DIA_MS))
}

/** Primera fecha >= `desde` que cae en `diaSemana` (ISO 1..7). */
function primeraFechaDelDia(diaSemana: number, desde: string): string {
  return sumarDias(desde, (diaSemana - diaSemanaISO(desde) + 7) % 7)
}

/** Teléfono válido para la API: sólo dígitos (código de Salta + 7 dígitos). */
function telefono(azar: Azar): string {
  return `387${String(azar.entero(4000000, 5999999))}`
}

function emailDe(nombre: string, apellido: string, n: number): string {
  const limpio = (texto: string) => normalizarBusqueda(texto).replace(/ /g, '')
  return `${limpio(nombre)}.${limpio(apellido)}${n}@${DOMINIO}`
}

function busquedaDe(nombre: string, apellido: string, dni: string): string {
  return normalizarBusqueda(`${apellido} ${nombre} ${dni}`)
}

// ---------------------------------------------------------------------------------------------
// Limpieza de una corrida anterior
// ---------------------------------------------------------------------------------------------

async function limpiar() {
  const usuarios = await prisma.usuario.findMany({
    where: { email: { endsWith: `@${DOMINIO}` } },
    select: { id: true },
  })
  const usuarioIds = usuarios.map((u) => u.id)
  const profesores = await prisma.profesor.findMany({
    where: { usuarioId: { in: usuarioIds } },
    select: { id: true },
  })
  const profesorIds = profesores.map((p) => p.id)
  const alumnos = await prisma.alumno.findMany({
    where: { email: { endsWith: `@${DOMINIO}` } },
    select: { id: true },
  })
  const alumnoIds = alumnos.map((a) => a.id)
  const turnos = await prisma.turno.findMany({
    where: {
      OR: [{ bloqueAgenda: { profesorId: { in: profesorIds } } }, { alumnoId: { in: alumnoIds } }],
    },
    select: { id: true },
  })
  const turnoIds = turnos.map((t) => t.id)
  const pagos = await prisma.pago.findMany({
    where: { alumnoId: { in: alumnoIds } },
    select: { id: true },
  })
  const pagoIds = pagos.map((p) => p.id)

  // Orden que respeta las FK (todas son onDelete: Restrict): primero lo que cuelga de un turno o
  // de un pago, después el turno y el pago, y recién ahí profesores/bloques/alumnos.
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

  // Las materias de demo sólo se borran si quedaron sin usar (si les cargaste un turno o se las
  // asignaste a un profesor tuyo, se dejan donde están).
  const materias = await prisma.materia.findMany({
    where: { busqueda: { in: MATERIAS_DEMO.map((m) => normalizarBusqueda(m.nombre)) } },
    select: { id: true, _count: { select: { turnos: true, asignaciones: true, examenes: true } } },
  })
  const borrables = materias
    .filter((m) => m._count.turnos === 0 && m._count.asignaciones === 0 && m._count.examenes === 0)
    .map((m) => m.id)
  await prisma.materia.deleteMany({ where: { id: { in: borrables } } })

  console.log(
    `Limpieza: ${profesorIds.length} profesores, ${alumnoIds.length} alumnos, ` +
      `${borrables.length} materias y todo lo que colgaba de ellos.`,
  )
}

// ---------------------------------------------------------------------------------------------
// Creación
// ---------------------------------------------------------------------------------------------

/** Lo que tiene que existir de antes (`pnpm db:seed`): actor, aulas y forma de pago. */
async function requisitos() {
  const actor =
    (await prisma.usuario.findFirst({ where: { role: 'MESA_ENTRADAS' } })) ??
    (await prisma.usuario.findFirst({ where: { role: 'GERENTE' } }))
  const aulas = await prisma.aula.findMany({
    where: { estado: 'ACTIVO' },
    select: { id: true, nombre: true, capacidad: true },
    orderBy: { id: 'asc' },
  })
  const rolProfesor = await prisma.rol.findUnique({ where: { id: 'PROFESOR' } })
  const formaPago = await prisma.formaPago.findUnique({ where: { nombre: 'Efectivo' } })

  if (!actor || !rolProfesor || aulas.length === 0 || !formaPago) {
    throw new Error(
      'Faltan datos del seed de desarrollo (roles, usuario de mesa de entradas, aulas o forma ' +
        'de pago "Efectivo"). Corré primero `pnpm db:seed` y volvé a intentar.',
    )
  }
  return { actorId: actor.id, aulas, formaPagoId: formaPago.id }
}

async function crear(azar: Azar) {
  const { actorId, aulas, formaPagoId } = await requisitos()
  const fechaHoy = hoy()
  const desde = sumarDias(fechaHoy, -DIAS_ATRAS)
  const hasta = sumarDias(fechaHoy, DIAS_ADELANTE)
  const auditoria = { createdById: actorId, updatedById: actorId }

  // --- Materias: las del seed de desarrollo más las de este script ---
  for (const materia of MATERIAS_DEMO) {
    const busqueda = normalizarBusqueda(materia.nombre)
    await prisma.materia.upsert({
      where: { busqueda },
      create: {
        nombre: materia.nombre,
        busqueda,
        descripcion: materia.descripcion,
        precioHora: materia.precioHora,
        estado: MATERIAS_INACTIVAS.includes(materia.nombre) ? 'INACTIVO' : 'ACTIVO',
        ...auditoria,
      },
      update: {},
    })
  }
  const materiasActivas = await prisma.materia.findMany({
    where: { estado: 'ACTIVO' },
    select: { id: true, nombre: true, precioHora: true },
    orderBy: { id: 'asc' },
  })

  // --- Profesores (con cuenta, así pueden entrar a "Mi agenda") ---
  const totalProfesores = CANTIDAD_PROFESORES_ACTIVOS + CANTIDAD_PROFESORES_INACTIVOS
  const usados = new Set<string>()
  const personas: { nombre: string; apellido: string }[] = []
  while (personas.length < totalProfesores + CANTIDAD_ALUMNOS) {
    const nombre = azar.de(NOMBRES)
    const apellido = azar.de(APELLIDOS)
    const clave = `${nombre}|${apellido}`
    if (usados.has(clave)) continue
    usados.add(clave)
    personas.push({ nombre, apellido })
  }

  const hash = await hashPassword(PASSWORD_DEMO)
  const usuariosData = personas.slice(0, totalProfesores).map((persona, i) => {
    const dni = String(24000000 + i * 137 + azar.entero(0, 90))
    return {
      id: randomUUID(),
      nombre: persona.nombre,
      apellido: persona.apellido,
      dni,
      busqueda: busquedaDe(persona.nombre, persona.apellido, dni),
      telefono: telefono(azar),
      email: emailDe(persona.nombre, persona.apellido, i + 1),
      emailVerified: true,
      role: 'PROFESOR',
      estado: i < CANTIDAD_PROFESORES_ACTIVOS ? ('ACTIVO' as const) : ('INACTIVO' as const),
    }
  })
  await prisma.usuario.createMany({ data: usuariosData })
  await prisma.account.createMany({
    data: usuariosData.map((usuario) => ({
      id: randomUUID(),
      providerId: 'credential',
      accountId: usuario.id,
      userId: usuario.id,
      password: hash,
    })),
  })

  const profesores = await prisma.profesor.createManyAndReturn({
    data: usuariosData.map((usuario, i) => ({
      usuarioId: usuario.id,
      titulo: azar.de(TITULOS),
      matricula: `MP-D${String(1000 + i)}`,
      // Cuántos alumnos atiende a la vez en una hora (T-27): entre 3 y 7.
      capacidad: azar.entero(3, 7),
    })),
    select: { id: true, usuarioId: true, capacidad: true },
  })

  // --- Materias asignadas: cada profesor dicta 1 a 3 materias ---
  const materiasPorProfesor = new Map<number, number[]>()
  const asignaciones: { profesorId: number; materiaId: number }[] = []
  for (const profesor of profesores) {
    const elegidas = azar.mezclar(materiasActivas).slice(0, azar.entero(1, 3))
    materiasPorProfesor.set(
      profesor.id,
      elegidas.map((m) => m.id),
    )
    for (const materia of elegidas) {
      asignaciones.push({ profesorId: profesor.id, materiaId: materia.id })
    }
  }
  await prisma.asignacionMateria.createMany({
    data: asignaciones.map((a) => ({ ...a, ...auditoria })),
  })

  // --- Alumnos ---
  const alumnosData = personas.slice(totalProfesores).map((persona, i) => {
    const esMenor = azar.chance(0.3)
    // Los menores nacieron hace 13 a 17 años; los mayores, hace 18 a 30.
    const edad = esMenor ? azar.entero(13, 17) : azar.entero(18, 30)
    const fechaNacimiento = sumarDias(fechaHoy, -(edad * 365 + azar.entero(1, 360)))
    // DNI coherente con la edad: los más chicos tienen números más altos.
    const dni = String((esMenor ? 52000000 : 36000000) + i * 971 + azar.entero(0, 900))
    const tutor = personas[azar.entero(0, personas.length - 1)] as (typeof personas)[number]

    return {
      nombre: persona.nombre,
      apellido: persona.apellido,
      dni,
      busqueda: busquedaDe(persona.nombre, persona.apellido, dni),
      fechaNacimiento: fechaADate(fechaNacimiento),
      telefono: telefono(azar),
      email: emailDe(persona.nombre, persona.apellido, totalProfesores + i + 1),
      // Datos del tutor: obligatorios para los menores (dominio.md → Alumnos).
      tutorNombre: esMenor ? tutor.nombre : null,
      tutorApellido: esMenor ? persona.apellido : null,
      tutorDni: esMenor ? String(28000000 + i * 613 + azar.entero(0, 500)) : null,
      tutorTelefono: esMenor ? telefono(azar) : null,
      tutorEmail: esMenor ? emailDe(tutor.nombre, persona.apellido, 900 + i) : null,
      nivelEscolaridad: azar.de(NIVELES),
      grado: azar.chance(0.8) ? `${azar.entero(1, 6)}° año` : null,
      institucionEducativa: azar.chance(0.85) ? azar.de(COLEGIOS) : null,
      observaciones: azar.chance(0.25)
        ? azar.de([
            'Viene acompañado por su madre los martes.',
            'Prefiere turnos por la tarde.',
            'Necesita refuerzo en resolución de problemas.',
            'Se reincorporó después de un tiempo sin venir.',
          ])
        : null,
      ...auditoria,
    }
  })
  const alumnos = await prisma.alumno.createManyAndReturn({
    data: alumnosData,
    select: { id: true },
  })

  // --- Bloques de horario ---
  // Ocupación que ya existe en la base (bloques activos de cualquier profesor): así lo que se
  // genera no se superpone con lo que ya estaba cargado.
  const bloquesExistentes = await prisma.bloqueAgenda.findMany({
    where: { estado: 'ACTIVO' },
    select: { profesorId: true, aulaId: true, diaSemana: true, horaInicio: true },
  })
  const aulaOcupada = new Set(
    bloquesExistentes.map((b) => `${b.aulaId}|${b.diaSemana}|${b.horaInicio}`),
  )
  const profesorOcupado = new Set(
    bloquesExistentes.map((b) => `${b.profesorId}|${b.diaSemana}|${b.horaInicio}`),
  )

  type BloqueNuevo = {
    profesorId: number
    aulaId: number
    diaSemana: number
    horaInicio: number
    horaFin: number
  }
  const bloquesData: BloqueNuevo[] = []
  // Sólo los profesores activos reciben horario: uno inactivo no recibe bloques ni turnos nuevos.
  for (const profesor of profesores.slice(0, CANTIDAD_PROFESORES_ACTIVOS)) {
    const dias = azar.mezclar(DIAS_CON_HORARIO).slice(0, azar.entero(2, 3))
    for (const diaSemana of dias) {
      const franja = azar.de(FRANJAS)
      const horas = Array.from({ length: franja.horas }, (_, i) => (franja.desde + i) * 60)
      if (horas.some((hora) => profesorOcupado.has(`${profesor.id}|${diaSemana}|${hora}`))) continue

      // Un aula que esté libre en todas las horas del tramo: así el bloque queda "entero", como
      // lo muestra la UI (mismo profesor, día y aula, horas contiguas).
      const aula = azar
        .mezclar(aulas)
        .find((candidata) =>
          horas.every((hora) => !aulaOcupada.has(`${candidata.id}|${diaSemana}|${hora}`)),
        )
      if (!aula) continue

      for (const horaInicio of horas) {
        aulaOcupada.add(`${aula.id}|${diaSemana}|${horaInicio}`)
        profesorOcupado.add(`${profesor.id}|${diaSemana}|${horaInicio}`)
        bloquesData.push({
          profesorId: profesor.id,
          aulaId: aula.id,
          diaSemana,
          horaInicio,
          horaFin: horaInicio + 60,
        })
      }
    }
  }
  const bloques = await prisma.bloqueAgenda.createManyAndReturn({
    data: bloquesData.map((b) => ({ ...b, ...auditoria })),
    select: { id: true, profesorId: true, aulaId: true, diaSemana: true, horaInicio: true },
  })

  // --- Turnos ---
  const capacidadProfesor = new Map(profesores.map((p) => [p.id, p.capacidad]))
  const capacidadAula = new Map(aulas.map((a) => [a.id, a.capacidad]))

  /** Turnos que ocupan lugar en cada fila y fecha: nunca se pasa de la capacidad efectiva. */
  const ocupacion = new Map<string, number>()
  /** Día, hora y fecha ya tomados por un alumno: no puede tener dos turnos que se pisen. */
  const alumnoOcupado = new Set<string>()

  type TurnoNuevo = {
    bloqueAgendaId: number
    alumnoId: number
    materiaId: number
    tipo: 'RECURRENTE' | 'SESION_UNICA'
    fechaInicio: Date
    fechaFin: Date | null
    observaciones: string | null
    temas: string | null
    estado: 'ACTIVO' | 'CANCELADO'
    // La serie del alta (decisión T-103): la comparten las horas y los tramos de un recurrente.
    serieId: string | null
  }
  const turnosData: TurnoNuevo[] = []

  for (const bloque of bloques) {
    const capacidad = Math.min(
      capacidadProfesor.get(bloque.profesorId) ?? 1,
      capacidadAula.get(bloque.aulaId) ?? 1,
    )
    const materias = materiasPorProfesor.get(bloque.profesorId) ?? []
    if (materias.length === 0) continue

    // Cuántos turnos se intentan en esta hora: entre la mitad y el total de su capacidad, así
    // hay horas con lugar, horas casi llenas y alguna completa.
    const intentos = azar.entero(Math.ceil(capacidad / 2), capacidad + 1)
    for (let i = 0; i < intentos; i++) {
      const alumnoId = (azar.de(alumnos) as (typeof alumnos)[number]).id
      const materiaId = azar.de(materias)
      const cancelado = azar.chance(0.06)

      // Fecha de inicio: una ocurrencia del día del bloque dentro de la ventana.
      const inicio = primeraFechaDelDia(bloque.diaSemana, sumarDias(desde, azar.entero(0, 60)))
      if (inicio > hasta) continue

      let tipo: TurnoNuevo['tipo'] = 'SESION_UNICA'
      let fin: string | null = inicio
      if (azar.chance(0.7)) {
        tipo = 'RECURRENTE'
        // Uno de cada cuatro recurrentes no tiene fecha de fin (sigue indefinidamente).
        fin = azar.chance(0.25) ? null : sumarDias(inicio, 7 * azar.entero(3, 10))
      }

      // Ocurrencias dentro de la ventana: es donde se controla capacidad y superposición. Un
      // recurrente sin fin se evalúa hasta el final de la ventana (después no se crea nada más).
      const ocurrencias: string[] = []
      for (
        let fecha = inicio;
        fecha <= (fin ?? hasta) && fecha <= hasta;
        fecha = sumarDias(fecha, 7)
      ) {
        ocurrencias.push(fecha)
        if (tipo === 'SESION_UNICA') break
      }
      if (ocurrencias.length === 0) continue

      const claveOcupacion = (fecha: string) => `${bloque.id}|${fecha}`
      const claveAlumno = (fecha: string) =>
        `${alumnoId}|${bloque.diaSemana}|${bloque.horaInicio}|${fecha}`

      // Un turno cancelado no ocupa lugar ni bloquea al alumno (dominio.md → Turnos), pero
      // tampoco se duplica sobre una fecha que ese alumno ya tiene tomada.
      const chocaAlumno = ocurrencias.some((fecha) => alumnoOcupado.has(claveAlumno(fecha)))
      if (chocaAlumno) continue
      if (!cancelado) {
        const sinLugar = ocurrencias.some(
          (fecha) => (ocupacion.get(claveOcupacion(fecha)) ?? 0) >= capacidad,
        )
        if (sinLugar) continue
        for (const fecha of ocurrencias) {
          ocupacion.set(claveOcupacion(fecha), (ocupacion.get(claveOcupacion(fecha)) ?? 0) + 1)
          alumnoOcupado.add(claveAlumno(fecha))
        }
      }

      turnosData.push({
        bloqueAgendaId: bloque.id,
        alumnoId,
        materiaId,
        tipo,
        fechaInicio: fechaADate(inicio),
        // En una sesión única, fechaFin = fechaInicio (lo exige el CHECK de la tabla).
        fechaFin:
          tipo === 'SESION_UNICA'
            ? fechaADate(inicio)
            : // Un recurrente sin fecha de fin sigue indefinidamente: `fechaFin` queda en null.
              (fin && fechaADate(fin)) || null,
        observaciones: azar.de(MOTIVOS),
        // "Temas a trabajar" (HU-08): obligatorio en sesión única, opcional en recurrente.
        temas: tipo === 'SESION_UNICA' ? azar.de(TEMAS) : azar.chance(0.4) ? azar.de(TEMAS) : null,
        estado: cancelado ? 'CANCELADO' : 'ACTIVO',
        // Cada recurrente es su propia serie (el seed crea clases de una sola hora).
        serieId: tipo === 'RECURRENTE' ? randomUUID() : null,
      })
    }
  }
  // Un recurrente guardado en "tramos" (T-37/T-29): un segundo Turno RECURRENTE del mismo
  // alumno y bloque, dos semanas después de que termina el primero, como si "Asignar igual"
  // hubiera saltado un tramo de fechas llenas en el medio (HU-08). Comparte el `serieId` del
  // primero: son la misma serie, y finalizar esa hora actúa sobre los dos (decisión T-104).
  const primerTramo = turnosData.find(
    (t) => t.tipo === 'RECURRENTE' && t.fechaFin !== null && t.estado === 'ACTIVO',
  )
  let segundoTramoAgregado = false
  if (primerTramo) {
    const bloqueDelTramo = bloques.find((b) => b.id === primerTramo.bloqueAgendaId)
    if (bloqueDelTramo) {
      const capacidad = Math.min(
        capacidadProfesor.get(bloqueDelTramo.profesorId) ?? 1,
        capacidadAula.get(bloqueDelTramo.aulaId) ?? 1,
      )
      const desdeSegundoTramo = sumarDias(dateAFecha(primerTramo.fechaFin as Date), 14)
      const ocurrenciasSegundoTramo: string[] = []
      for (let fecha = desdeSegundoTramo; fecha <= hasta; fecha = sumarDias(fecha, 7)) {
        ocurrenciasSegundoTramo.push(fecha)
      }
      const claveOcupacion = (fecha: string) => `${bloqueDelTramo.id}|${fecha}`
      const claveAlumno = (fecha: string) =>
        `${primerTramo.alumnoId}|${bloqueDelTramo.diaSemana}|${bloqueDelTramo.horaInicio}|${fecha}`
      const libre =
        ocurrenciasSegundoTramo.length > 0 &&
        ocurrenciasSegundoTramo.every(
          (fecha) =>
            (ocupacion.get(claveOcupacion(fecha)) ?? 0) < capacidad &&
            !alumnoOcupado.has(claveAlumno(fecha)),
        )
      if (libre) {
        for (const fecha of ocurrenciasSegundoTramo) {
          ocupacion.set(claveOcupacion(fecha), (ocupacion.get(claveOcupacion(fecha)) ?? 0) + 1)
          alumnoOcupado.add(claveAlumno(fecha))
        }
        turnosData.push({
          bloqueAgendaId: bloqueDelTramo.id,
          alumnoId: primerTramo.alumnoId,
          materiaId: primerTramo.materiaId,
          tipo: 'RECURRENTE',
          fechaInicio: fechaADate(desdeSegundoTramo),
          fechaFin: null,
          observaciones: 'Segundo tramo del mismo recurrente (dato de demo, T-29).',
          temas: azar.chance(0.4) ? azar.de(TEMAS) : null,
          estado: 'ACTIVO',
          serieId: primerTramo.serieId,
        })
        segundoTramoAgregado = true
      }
    }
  }

  const turnosCreados = await prisma.turno.createManyAndReturn({
    data: turnosData.map((t) => ({ ...t, ...auditoria })),
    select: {
      id: true,
      alumnoId: true,
      materiaId: true,
      bloqueAgendaId: true,
      tipo: true,
      fechaInicio: true,
      fechaFin: true,
      observaciones: true,
      temas: true,
      estado: true,
      serieId: true,
    },
  })
  const activosOrdenados = turnosCreados
    .filter((t) => t.estado === 'ACTIVO')
    .sort((a, b) => a.id - b.id)
  const fechaStr = (d: Date) => dateAFecha(d)
  const futuros = activosOrdenados.filter((t) => fechaStr(t.fechaInicio) >= fechaHoy)

  // --- Fechas de examen (de ellas depende la prioridad del turno, HU-18) ---
  const examenes = new Map<
    string,
    { alumnoId: number; materiaId: number; fecha: Date; tipo: (typeof TIPOS_EXAMEN)[number] }
  >()
  while (examenes.size < CANTIDAD_EXAMENES) {
    const alumnoId = (azar.de(alumnos) as (typeof alumnos)[number]).id
    const materiaId = (azar.de(materiasActivas) as (typeof materiasActivas)[number]).id
    const fecha = sumarDias(fechaHoy, azar.entero(-10, 45))
    examenes.set(`${alumnoId}|${materiaId}|${fecha}`, {
      alumnoId,
      materiaId,
      fecha: fechaADate(fecha),
      tipo: azar.de(TIPOS_EXAMEN),
    })
  }
  // Tres ejemplos deterministas sobre turnos futuros ya creados, uno por franja de prioridad
  // (HU-18): Alta (0 a 10 días), Media (11 a 20) y Baja (más de 20), para verlas sin buscarlas.
  const OFFSETS_PRIORIDAD = [5, 15, 30] as const
  futuros.slice(0, OFFSETS_PRIORIDAD.length).forEach((turno, i) => {
    const fecha = sumarDias(fechaStr(turno.fechaInicio), OFFSETS_PRIORIDAD[i] as number)
    examenes.set(`${turno.alumnoId}|${turno.materiaId}|${fecha}`, {
      alumnoId: turno.alumnoId,
      materiaId: turno.materiaId,
      fecha: fechaADate(fecha),
      tipo: 'PARCIAL',
    })
  })
  await prisma.examen.createMany({
    data: [...examenes.values()].map((e) => ({ ...e, estado: 'ACTIVO' as const, ...auditoria })),
  })

  // --- Escenarios fijos para recorrer a mano lo nuevo del Sprint 2 (T-29) ---
  // 1. Cancelación de una ocurrencia futura (la serie sigue agendada en sus demás fechas).
  const paraCancelar = futuros[0]
  if (paraCancelar) {
    await prisma.cancelacionTurno.create({
      data: {
        turnoId: paraCancelar.id,
        fechaOcurrencia: paraCancelar.fechaInicio,
        motivo: 'CANCELACION_ALUMNO',
        detalle: 'Cancelado a pedido del alumno (dato de demo, T-29).',
        createdById: actorId,
      },
    })
  }

  // 2. Reprogramaciones (HU-20), aplicando a mano lo que hará la API (T-49): se edita el turno,
  //    sin tabla propia, y quién lo movió queda en su auditoría de modificación. Las hace otro
  //    usuario de mesa de entradas, para que se vea distinto del creador.
  const modificador = await prisma.usuario.create({
    data: {
      id: randomUUID(),
      nombre: 'Sofía',
      apellido: 'Demo',
      dni: '31999001',
      busqueda: busquedaDe('Sofía', 'Demo', '31999001'),
      telefono: telefono(azar),
      email: `mesa.demo@${DOMINIO}`,
      emailVerified: true,
      role: 'MESA_ENTRADAS',
    },
  })
  await prisma.account.create({
    data: {
      id: randomUUID(),
      providerId: 'credential',
      accountId: modificador.id,
      userId: modificador.id,
      password: hash,
    },
  })
  const auditoriaModificador = { createdById: modificador.id, updatedById: modificador.id }
  // Los turnos de la cancelación y de los ejemplos de prioridad no se mueven: siguen como están.
  const reservados = new Set(futuros.slice(0, OFFSETS_PRIORIDAD.length).map((t) => t.id))

  /** Una hora y una fecha libres (> `despuesDe`) de otro bloque para mover una ocurrencia. */
  const buscarDestino = (turno: (typeof futuros)[number], despuesDe: string) => {
    for (const bloque of bloques) {
      if (bloque.id === turno.bloqueAgendaId) continue
      if (!(materiasPorProfesor.get(bloque.profesorId) ?? []).includes(turno.materiaId)) continue
      const fecha = primeraFechaDelDia(bloque.diaSemana, sumarDias(despuesDe, 1))
      if (fecha > hasta) continue
      const capacidad = Math.min(
        capacidadProfesor.get(bloque.profesorId) ?? 1,
        capacidadAula.get(bloque.aulaId) ?? 1,
      )
      const claveAlumno = `${turno.alumnoId}|${bloque.diaSemana}|${bloque.horaInicio}|${fecha}`
      if ((ocupacion.get(`${bloque.id}|${fecha}`) ?? 0) >= capacidad) continue
      if (alumnoOcupado.has(claveAlumno)) continue
      return { bloque, fecha }
    }
    return null
  }
  /** Mueve la ocupación de una fecha de un bloque a otra (lo que ya no ocupa y lo que pasa a ocupar). */
  const moverOcupacion = (
    turno: (typeof futuros)[number],
    origen: string,
    destino: { bloque: (typeof bloques)[number]; fecha: string },
  ) => {
    const bloqueOrigen = bloques.find((b) => b.id === turno.bloqueAgendaId)
    const claveOrigen = `${turno.bloqueAgendaId}|${origen}`
    ocupacion.set(claveOrigen, Math.max(0, (ocupacion.get(claveOrigen) ?? 0) - 1))
    if (bloqueOrigen) {
      alumnoOcupado.delete(
        `${turno.alumnoId}|${bloqueOrigen.diaSemana}|${bloqueOrigen.horaInicio}|${origen}`,
      )
    }
    const claveDestino = `${destino.bloque.id}|${destino.fecha}`
    ocupacion.set(claveDestino, (ocupacion.get(claveDestino) ?? 0) + 1)
    alumnoOcupado.add(
      `${turno.alumnoId}|${destino.bloque.diaSemana}|${destino.bloque.horaInicio}|${destino.fecha}`,
    )
  }

  // 2a. Sesión única reprogramada: el mismo turno pasa a otra fecha y otro bloque.
  let sesionReprogramada = false
  const sesion = futuros.find((t) => t.tipo === 'SESION_UNICA' && !reservados.has(t.id))
  if (sesion) {
    const origen = fechaStr(sesion.fechaInicio)
    const destino = buscarDestino(sesion, origen)
    if (destino) {
      await prisma.turno.update({
        where: { id: sesion.id },
        data: {
          bloqueAgendaId: destino.bloque.id,
          fechaInicio: fechaADate(destino.fecha),
          fechaFin: fechaADate(destino.fecha),
          updatedById: modificador.id,
        },
      })
      moverOcupacion(sesion, origen, destino)
      sesionReprogramada = true
    }
  }

  // 2b. Recurrente reprogramado en una fecha: la serie se parte en tramos. El original termina en
  //     la ocurrencia anterior, un tramo nuevo sigue desde la siguiente y la fecha movida pasa a
  //     ser una SESION_UNICA en el destino. No hay cancelaciones ni pagos que volver a apuntar:
  //     se elige un turno futuro sin ninguno. El tramo nuevo hereda el `serieId` del original y
  //     la sesión única queda fuera de la serie (decisión T-103).
  let recurrenteReprogramado = false
  const recurrente = futuros.find(
    (t) =>
      t.tipo === 'RECURRENTE' &&
      !reservados.has(t.id) &&
      (t.fechaFin === null || fechaStr(t.fechaFin) >= sumarDias(fechaStr(t.fechaInicio), 21)),
  )
  if (recurrente) {
    // Se mueve la tercera ocurrencia: el original conserva dos y el tramo nuevo, el resto.
    const movida = sumarDias(fechaStr(recurrente.fechaInicio), 14)
    const destino = movida <= hasta ? buscarDestino(recurrente, movida) : null
    if (destino) {
      const copia = {
        alumnoId: recurrente.alumnoId,
        materiaId: recurrente.materiaId,
        observaciones: recurrente.observaciones,
        temas: recurrente.temas,
      }
      await prisma.turno.update({
        where: { id: recurrente.id },
        data: { fechaFin: fechaADate(sumarDias(movida, -7)), updatedById: modificador.id },
      })
      await prisma.turno.create({
        data: {
          ...copia,
          bloqueAgendaId: recurrente.bloqueAgendaId,
          tipo: 'RECURRENTE',
          serieId: recurrente.serieId,
          fechaInicio: fechaADate(sumarDias(movida, 7)),
          fechaFin: recurrente.fechaFin,
          ...auditoriaModificador,
        },
      })
      await prisma.turno.create({
        data: {
          ...copia,
          bloqueAgendaId: destino.bloque.id,
          tipo: 'SESION_UNICA',
          serieId: null,
          fechaInicio: fechaADate(destino.fecha),
          fechaFin: fechaADate(destino.fecha),
          // "Temas a trabajar" es obligatorio en una sesión única (HU-08).
          temas: copia.temas ?? azar.de(TEMAS),
          ...auditoriaModificador,
        },
      })
      moverOcupacion(recurrente, movida, destino)
      recurrenteReprogramado = true
    }
  }

  // 3. Pago con dos ocurrencias pasadas de un mismo alumno (HU-15); el resto de los turnos
  //    pasados quedan impagos a propósito, para probar la deuda (HU-16).
  const pasadosPorAlumno = new Map<number, typeof activosOrdenados>()
  for (const turno of activosOrdenados) {
    if (fechaStr(turno.fechaInicio) >= fechaHoy) continue
    const lista = pasadosPorAlumno.get(turno.alumnoId) ?? []
    lista.push(turno)
    pasadosPorAlumno.set(turno.alumnoId, lista)
  }
  const conDeuda = [...pasadosPorAlumno.entries()].find(([, lista]) => lista.length >= 2)
  if (conDeuda) {
    const [alumnoId, turnosDelAlumno] = conDeuda
    const materiaPorId = new Map(materiasActivas.map((m) => [m.id, m]))
    const elegidos = turnosDelAlumno.slice(0, 2)
    const importes = elegidos.map(
      (t) => materiaPorId.get(t.materiaId)?.precioHora?.toString() ?? '0',
    )
    const total = importes.reduce((acc, importe) => acc + Number(importe), 0).toFixed(2)
    const pago = await prisma.pago.create({
      data: {
        alumnoId,
        formaPagoId,
        importeTotal: total,
        fechaPago: fechaADate(fechaHoy),
        // Paga con un monto redondo mayor al total, para ver el vuelto (se calcula, no se guarda).
        montoRecibido: (Math.ceil((Number(total) + 1) / 5000) * 5000).toFixed(2),
        observaciones: 'Pago de demo con dos ocurrencias (T-29).',
        ...auditoria,
      },
    })
    await prisma.pagoTurno.createMany({
      data: elegidos.map((t, i) => ({
        pagoId: pago.id,
        turnoId: t.id,
        fechaOcurrencia: t.fechaInicio,
        importeAplicado: importes[i] ?? '0',
      })),
    })
  }

  // --- Resumen ---
  const activos = turnosData.filter((t) => t.estado === 'ACTIVO').length
  const franjas = new Set(bloques.map((b) => `${b.profesorId}|${b.diaSemana}`)).size
  console.log(`Datos de demo listos (hoy = ${fechaHoy}):`)
  console.log(
    `  ${profesores.length} profesores (${CANTIDAD_PROFESORES_INACTIVOS} inactivos) con cuenta`,
  )
  console.log(`  ${alumnos.length} alumnos, ${asignaciones.length} materias asignadas`)
  console.log(`  ${bloques.length} horas de horario en ${franjas} franjas`)
  console.log(`  ${turnosData.length} turnos (${activos} activos) del ${desde} al ${hasta}`)
  console.log(`  ${examenes.size} fechas de examen`)
  console.log(
    `  escenarios T-29: ${paraCancelar ? '1' : '0'} cancelación, ` +
      `${sesionReprogramada ? '1' : '0'} sesión única reprogramada, ` +
      `${recurrenteReprogramado ? '1' : '0'} recurrente reprogramado en tramos, ` +
      `${conDeuda ? '1' : '0'} pago con dos ocurrencias, ${segundoTramoAgregado ? '1' : '0'} tramo extra`,
  )
  console.log('')
  console.log(`Los profesores entran con su email @${DOMINIO} y la contraseña "${PASSWORD_DEMO}".`)
  const ejemplo = usuariosData[0]
  if (ejemplo) console.log(`  por ejemplo: ${ejemplo.email}`)
  console.log(`  mesa de entradas de demo (hizo las reprogramaciones): ${modificador.email}`)
  const conHorario = bloques[0]
  if (conHorario) {
    console.log(
      `  primer bloque: día ${conHorario.diaSemana}, ${minutosAHora(conHorario.horaInicio)}`,
    )
  }
}

async function main() {
  await limpiar()
  if (!process.argv.includes('--limpiar')) await crear(crearAzar(SEMILLA))
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
