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
 * (sin profesores asignados: una materia con profesores no se puede dar de baja).
 */
const MATERIAS_DEMO = [
  { nombre: 'Biología', descripcion: 'Apoyo para secundario y CBC' },
  { nombre: 'Historia', descripcion: 'Historia argentina y americana' },
  { nombre: 'Geografía', descripcion: 'Geografía física y humana' },
  { nombre: 'Álgebra', descripcion: 'Álgebra para primer año de facultad' },
  { nombre: 'Análisis Matemático', descripcion: 'Límites, derivadas e integrales' },
  { nombre: 'Economía', descripcion: 'Introducción a la economía' },
  { nombre: 'Programación', descripcion: 'Lógica y primeros lenguajes' },
  { nombre: 'Estadística', descripcion: 'Probabilidad y estadística descriptiva' },
  { nombre: 'Latín', descripcion: 'Materia sin demanda: queda inactiva' },
  { nombre: 'Filosofía', descripcion: 'Materia sin demanda: queda inactiva' },
]

const MATERIAS_INACTIVAS = ['Latín', 'Filosofía']

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

const NIVELES = ['SECUNDARIO', 'SECUNDARIO', 'SECUNDARIO', 'TERCIARIO', 'UNIVERSITARIO'] as const

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

  // Orden que respeta las FK (todas son onDelete: Restrict): primero lo que cuelga.
  await prisma.examenMateria.deleteMany({ where: { alumnoId: { in: alumnoIds } } })
  await prisma.turno.deleteMany({
    where: {
      OR: [{ bloqueAgenda: { profesorId: { in: profesorIds } } }, { alumnoId: { in: alumnoIds } }],
    },
  })
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

/** Lo que tiene que existir de antes (`pnpm db:seed`): el actor de la auditoría y las aulas. */
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

  if (!actor || !rolProfesor || aulas.length === 0) {
    throw new Error(
      'Faltan datos del seed de desarrollo (roles, usuario de mesa de entradas o aulas). ' +
        'Corré primero `pnpm db:seed` y volvé a intentar.',
    )
  }
  return { actorId: actor.id, aulas }
}

async function crear(azar: Azar) {
  const { actorId, aulas } = await requisitos()
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
        estado: MATERIAS_INACTIVAS.includes(materia.nombre) ? 'INACTIVO' : 'ACTIVO',
        ...auditoria,
      },
      update: {},
    })
  }
  const materiasActivas = await prisma.materia.findMany({
    where: { estado: 'ACTIVO' },
    select: { id: true, nombre: true },
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
    const dias = azar.mezclar([1, 2, 3, 4, 5, 6]).slice(0, azar.entero(2, 3))
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
    motivoConsulta: string | null
    estado: 'ACTIVO' | 'CANCELADO'
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
        motivoConsulta: azar.de(MOTIVOS),
        estado: cancelado ? 'CANCELADO' : 'ACTIVO',
      })
    }
  }
  await prisma.turno.createMany({ data: turnosData.map((t) => ({ ...t, ...auditoria })) })

  // --- Fechas de examen (de ellas depende la prioridad del turno, que llega en el Sprint 2) ---
  const examenes = new Map<string, { alumnoId: number; materiaId: number; fecha: Date }>()
  while (examenes.size < CANTIDAD_EXAMENES) {
    const alumnoId = (azar.de(alumnos) as (typeof alumnos)[number]).id
    const materiaId = (azar.de(materiasActivas) as (typeof materiasActivas)[number]).id
    const fecha = sumarDias(fechaHoy, azar.entero(-10, 45))
    examenes.set(`${alumnoId}|${materiaId}|${fecha}`, {
      alumnoId,
      materiaId,
      fecha: fechaADate(fecha),
    })
  }
  await prisma.examenMateria.createMany({
    data: [...examenes.values()].map((e) => ({ ...e, ...auditoria })),
  })

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
  console.log('')
  console.log(`Los profesores entran con su email @${DOMINIO} y la contraseña "${PASSWORD_DEMO}".`)
  const ejemplo = usuariosData[0]
  if (ejemplo) console.log(`  por ejemplo: ${ejemplo.email}`)
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
