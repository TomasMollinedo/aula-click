// Seed de DEMO de la asistencia (HU-22, HU-39): registra la asistencia de las clases ya dadas del
// centro de demo para que la pestaña "Asistencia" del tablero del gerente se vea con datos reales:
// profesores que registran todo y profesores que dejan turnos sin registrar (cerrados por el
// plazo), alumnos que casi siempre vienen y alumnos que faltan seguido de asistencia, y tablas con
// más de una página. NO es el seed de desarrollo (`prisma/seed.ts`, que corre `pnpm db:seed`): es
// un script aparte, para correr y volver a correr.
//
// Requiere que el seed de datos de demo ya haya corrido (`pnpm exec tsx prisma/seed-datos-demo.ts`):
// no crea profesores, alumnos ni turnos, sólo la asistencia de los que ese script dejó en la
// ventana de los últimos `DIAS_ATRAS` días. Si volvés a correr `seed-datos-demo.ts` se borra todo lo
// que cuelga de sus turnos, la asistencia incluida: hay que correr este script de nuevo.
//
// Cada profesor activo de demo tiene un perfil (`PERFILES`) que decide cuántas de sus clases
// registra y con cuánto atraso, y cada alumno una tasa de asistencia propia. Quedan:
//   - presentes con "qué se trabajó" e indicaciones, y ausentes con observación;
//   - "Sin registrar" dentro del plazo de 7 días (los de los últimos días) y ya cerrados;
//   - un profesor que nunca registra (0 registros y todos cerrados) y varios que dejan algunos;
//   - profesores que registran todo (sin turnos cerrados).
// Lo que no tiene fila queda "Sin registrar" (cerrado si pasaron más de 7 días de la clase). Las
// canceladas y las de hoy en adelante no se tocan.
//
// Los datos son deterministas (generador con semilla fija): dos corridas dan la misma asistencia,
// salvo el corrimiento de las fechas relativas a hoy.
//
// Idempotente por "limpiar y recrear": cada corrida borra la asistencia de los turnos de los
// profesores de demo (los que cargó `CARGADOR` de `seed-datos-demo.ts`) y la vuelve a crear. Nunca
// toca los profesores, alumnos ni turnos, ni lo que cargaste con otros seeds.
//
// Cómo correrlo:
//   pnpm exec tsx prisma/seed-asistencia-demo.ts            crea (o recrea) la asistencia de demo
//   pnpm exec tsx prisma/seed-asistencia-demo.ts --limpiar  sólo borra, no vuelve a crear nada
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { leerOcurrencias, type Ocurrencia } from '@/server/features/turnos/ocurrencias.condiciones'
import {
  filasDeMaterias,
  filasDeProfesores,
  FILAS_POR_PAGINA_ASISTENCIA,
  profesoresConTurnosPorRegistrar,
  resumenDeAsistencia,
  ventanaDeRegistro,
} from '@/server/features/tablero/tablero.reglas'
import { fechaADate, hoy, sumarDias } from '@/server/shared/fechas'

/** DNI de la usuaria de mesa que cargó los profesores de demo (`CARGADOR` de `seed-datos-demo.ts`). */
const DNI_CARGADOR_DATOS_DEMO = '30458127'

/** Ventana de clases pasadas: la misma que genera `seed-datos-demo.ts` hacia atrás. */
const DIAS_ATRAS = 28

/** Días que tiene el profesor para registrar una clase (`PLAZO_ASISTENCIA_DIAS`). */
const PLAZO_DIAS = 7

/** Semilla del generador: cambiala si querés otra asistencia igual de válida. */
const SEMILLA = 20261015

/** Desfase de Salta respecto de UTC, en horas: la hora de pared de la clase pasada a UTC. */
const HORAS_UTC_SALTA = 3

type Perfil = {
  /** Probabilidad de registrar una clase que ya venció el plazo (1 = nunca deja una sin registrar). */
  registra: number
  /** Lo mismo para una clase de los últimos 7 días, que todavía está dentro del plazo. */
  registraReciente: number
  /** Días de atraso máximos al registrar (0 = el mismo día de la clase). */
  atrasoMaximo: number
}

const PERFILES = {
  ejemplar: { registra: 1, registraReciente: 1, atrasoMaximo: 0 },
  cumplidor: { registra: 0.95, registraReciente: 0.9, atrasoMaximo: 2 },
  regular: { registra: 0.8, registraReciente: 0.6, atrasoMaximo: 4 },
  descuidado: { registra: 0.55, registraReciente: 0.4, atrasoMaximo: 6 },
  olvidadizo: { registra: 0.3, registraReciente: 0.2, atrasoMaximo: 6 },
  nunca: { registra: 0, registraReciente: 0, atrasoMaximo: 0 },
} satisfies Record<string, Perfil>

/** Perfil de cada profesor activo de demo, por orden de alta. Si hay más profesores, se repite. */
const PERFIL_POR_PROFESOR: (keyof typeof PERFILES)[] = [
  'ejemplar',
  'cumplidor',
  'regular',
  'descuidado',
  'cumplidor',
  'olvidadizo',
  'ejemplar',
  'regular',
  'nunca',
  'descuidado',
  'cumplidor',
  'olvidadizo',
  'regular',
  'ejemplar',
]

/** Qué se trabajó en una clase a la que el alumno vino. */
const TRABAJADO = [
  'Repaso de la unidad y ejercicios de la guía',
  'Resolución de problemas de aplicación',
  'Dudas puntuales de la última clase del colegio',
  'Práctica para el próximo examen',
  'Trabajo práctico pendiente, primera parte',
  'Corrección de la tarea y ejercicios nuevos',
  'Teoría de la unidad y ejemplos resueltos',
  null,
]

const INDICACIONES = [
  'Terminar los ejercicios de la guía y traer las dudas',
  'Repasar los apuntes antes de la próxima clase',
  'Resolver los problemas 3 a 8 del práctico',
  'Preparar un resumen de la unidad',
  null,
  null,
]

const OBSERVACIONES_AUSENCIA = [
  'Avisó por mensaje que no podía venir',
  'No se presentó y no avisó',
  'Faltó por un examen en el colegio',
  'Estaba con fiebre',
  'Se retiró antes por un compromiso familiar',
  null,
  null,
]

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

/** Generador determinista (mulberry32): la misma semilla da siempre la misma asistencia. */
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
  }
}

type Azar = ReturnType<typeof crearAzar>

/**
 * La tasa de asistencia de un alumno: la mayoría casi siempre viene, unos cuantos vienen a veces y
 * unos pocos faltan seguido.
 */
function tasaDeAsistencia(azar: Azar): number {
  const sorteo = azar.decimal()
  if (sorteo < 0.18) return 0.35 + azar.decimal() * 0.3
  if (sorteo < 0.4) return 0.7 + azar.decimal() * 0.15
  return 0.88 + azar.decimal() * 0.12
}

/** El instante en que se registró: la hora de fin de la clase (hora de Salta) más el atraso. */
function instanteDeRegistro(ocurrencia: Ocurrencia, atrasoDias: number, ahora: Date): Date {
  const medianoche = fechaADate(sumarDias(ocurrencia.fecha, atrasoDias)).getTime()
  const instante = medianoche + (HORAS_UTC_SALTA * 60 + ocurrencia.horaFin + 5) * 60 * 1000
  return new Date(Math.min(instante, ahora.getTime()))
}

// ---------------------------------------------------------------------------------------------
// Datos de partida
// ---------------------------------------------------------------------------------------------

/** Los profesores activos que cargó `seed-datos-demo.ts`, por orden de alta. */
async function profesoresDeDemo() {
  const cargador = await prisma.usuario.findUnique({ where: { dni: DNI_CARGADOR_DATOS_DEMO } })
  if (!cargador) return []
  return prisma.profesor.findMany({
    where: { usuario: { createdById: cargador.id, role: 'PROFESOR' } },
    select: { id: true, usuarioId: true, usuario: { select: { estado: true } } },
    orderBy: { id: 'asc' },
  })
}

// ---------------------------------------------------------------------------------------------
// Limpieza de una corrida anterior
// ---------------------------------------------------------------------------------------------

async function limpiar() {
  const profesores = await profesoresDeDemo()
  const { count } = await prisma.asistenciaTurno.deleteMany({
    where: { turno: { bloqueAgenda: { profesorId: { in: profesores.map((p) => p.id) } } } },
  })
  console.log(`Limpieza: ${count} asistencias de ${profesores.length} profesores de demo.`)
}

// ---------------------------------------------------------------------------------------------
// Creación
// ---------------------------------------------------------------------------------------------

async function crear(azar: Azar) {
  const profesores = (await profesoresDeDemo()).filter((p) => p.usuario.estado === 'ACTIVO')
  if (profesores.length === 0) {
    throw new Error(
      'No hay profesores de demo. Corré primero `pnpm db:seed` y ' +
        '`pnpm exec tsx prisma/seed-datos-demo.ts`, y volvé a intentar.',
    )
  }

  const fechaHoy = hoy()
  const desde = sumarDias(fechaHoy, -DIAS_ATRAS)
  const hasta = sumarDias(fechaHoy, -1)
  const ahora = new Date()
  const tasaPorAlumno = new Map<number, number>()

  const filas: {
    turnoId: number
    fechaOcurrencia: Date
    estado: 'PRESENTE' | 'AUSENTE'
    trabajado: string | null
    indicaciones: string | null
    observacion: string | null
    createdById: string
    updatedById: string
    createdAt: Date
    updatedAt: Date
  }[] = []
  const perfilDe = new Map<number, keyof typeof PERFILES>()

  for (const [posicion, profesor] of profesores.entries()) {
    const perfil = PERFIL_POR_PROFESOR[
      posicion % PERFIL_POR_PROFESOR.length
    ] as keyof typeof PERFILES
    perfilDe.set(profesor.id, perfil)
    const { registra, registraReciente, atrasoMaximo } = PERFILES[perfil]

    const ocurrencias = await leerOcurrencias(prisma, { desde, hasta, profesorId: profesor.id })
    for (const ocurrencia of ocurrencias) {
      if (ocurrencia.estado === 'CANCELADO' || ocurrencia.asistencia !== null) continue

      // Las de los últimos días todavía están dentro del plazo: aunque el profesor sea cumplidor,
      // algunas siguen sin registrar.
      const dentroDelPlazo = ocurrencia.fecha >= sumarDias(fechaHoy, -PLAZO_DIAS)
      const probabilidad = dentroDelPlazo ? registraReciente : registra
      if (!azar.chance(probabilidad)) continue

      let tasa = tasaPorAlumno.get(ocurrencia.alumnoId)
      if (tasa === undefined) {
        tasa = tasaDeAsistencia(azar)
        tasaPorAlumno.set(ocurrencia.alumnoId, tasa)
      }
      const vino = azar.chance(tasa)
      // Una clase reciente no se puede haber registrado con más atraso que los días que pasaron.
      const diasTranscurridos = Math.round(
        (fechaADate(fechaHoy).getTime() - fechaADate(ocurrencia.fecha).getTime()) / 86_400_000,
      )
      const atraso = Math.min(azar.entero(0, atrasoMaximo), Math.max(diasTranscurridos - 1, 0))
      const instante = instanteDeRegistro(ocurrencia, atraso, ahora)

      filas.push({
        turnoId: ocurrencia.turnoId,
        fechaOcurrencia: fechaADate(ocurrencia.fecha),
        estado: vino ? 'PRESENTE' : 'AUSENTE',
        trabajado: vino ? azar.de(TRABAJADO) : null,
        indicaciones: vino ? azar.de(INDICACIONES) : null,
        observacion: vino ? null : azar.de(OBSERVACIONES_AUSENCIA),
        createdById: profesor.usuarioId,
        updatedById: profesor.usuarioId,
        createdAt: instante,
        updatedAt: instante,
      })
    }
  }

  await prisma.asistenciaTurno.createMany({ data: filas })

  // --- Resumen: lo que va a mostrar la pestaña "Asistencia" con el período de la ventana ---
  const periodo = (
    await Promise.all(
      profesores.map((p) => leerOcurrencias(prisma, { desde, hasta: fechaHoy, profesorId: p.id })),
    )
  ).flat()
  const resumen = resumenDeAsistencia(periodo)
  const ventana = (
    await Promise.all(
      profesores.map((p) =>
        leerOcurrencias(prisma, { ...ventanaDeRegistro(fechaHoy), profesorId: p.id }),
      ),
    )
  ).flat()
  const filasProfesores = filasDeProfesores(periodo)
  const filasMaterias = filasDeMaterias(periodo)
  const presentes = filas.filter((f) => f.estado === 'PRESENTE').length

  console.log(`Asistencia de demo lista (hoy = ${fechaHoy}, clases del ${desde} al ${hasta}):`)
  console.log(
    `  ${filas.length} registradas por ${profesores.length} profesores ` +
      `(${presentes} presentes, ${filas.length - presentes} ausentes)`,
  )
  console.log(
    `  tablero (${desde} a ${fechaHoy}): ${resumen.presentes.porcentaje} % presentes, ` +
      `${resumen.ausentes.porcentaje} % ausentes, ${resumen.sinRegistrar.cantidad} sin registrar ` +
      `(dentro del plazo), ${resumen.cerrados.cantidad} cerrados por el sistema`,
  )
  console.log(
    `  profesores con clases de los últimos 7 días sin registrar: ` +
      `${profesoresConTurnosPorRegistrar(ventana)}`,
  )
  console.log(
    `  tablas: ${filasProfesores.length} profesores y ${filasMaterias.length} materias ` +
      `(${FILAS_POR_PAGINA_ASISTENCIA} filas por página)`,
  )
  console.log('  perfiles: ' + [...new Set(perfilDe.values())].join(', '))
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
