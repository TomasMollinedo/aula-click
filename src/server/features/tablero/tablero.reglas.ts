import type {
  CobroConReparto,
  ProfesorRef,
} from '@/server/features/liquidaciones/liquidaciones.condiciones'
import { sumarImportes } from '@/server/features/pagos/pagos.condiciones'
import { sumarReparto, type TotalReparto } from '@/server/features/reparto/reparto.condiciones'
import {
  PLAZO_ASISTENCIA_DIAS,
  type Ocurrencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import { ZONA_HORARIA, fechaADate, sumarDias } from '@/server/shared/fechas'
import { mesAnterior, mesDe } from '@/server/shared/zod'

// Reglas puras del tablero del gerente (HU-21, T-61): el período que se puede pedir, los
// porcentajes, los turnos por estado, las clases y la ocupación, el top de materias y los instantes
// de un período en la zona del negocio. Sin Prisma y sin `hoy()` adentro: "hoy" lo pasa el service.
// No reimplementan nada del motor: parten de las `Ocurrencia` que devuelve `leerOcurrencias`.

/** Días que puede abarcar el período, extremos incluidos: la expansión es en memoria. */
export const MAX_DIAS_TABLERO = 366

/** Cuántas materias trae "Materias con más demanda" (HU-21). */
export const MAX_MATERIAS_TABLERO = 5

/** Cuántos profesores trae "Profesores con más turnos" (HU-21). */
export const MAX_PROFESORES_TABLERO = 5

// El mismo texto que `MENSAJE_RANGO_INVERTIDO` de `cuentas.validation.ts`. No se importa: de otra
// feature solo se importan `*.repository` y `*.condiciones` (lo hace cumplir ESLint).
export const MENSAJE_RANGO_INVERTIDO = 'La fecha hasta no puede ser anterior a la fecha desde'
export const MENSAJE_RANGO_MAXIMO = `El período no puede superar los ${MAX_DIAS_TABLERO} días`

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Lo que las reglas miran de una ocurrencia (una `Ocurrencia` del motor lo cumple). */
export type OcurrenciaTablero = Pick<Ocurrencia, 'fecha' | 'estado' | 'bloqueAgendaId'> & {
  materia: Pick<Ocurrencia['materia'], 'id' | 'nombre'>
  profesor: Pick<Ocurrencia['profesor'], 'id' | 'nombre' | 'apellido'>
}

export type Conteo = { cantidad: number; porcentaje: number }

/**
 * Por qué no se puede pedir `[desde, hasta]` (fechas `YYYY-MM-DD` válidas, extremos incluidos), o
 * `null` si se puede: `hasta` anterior a `desde`, o más de `MAX_DIAS_TABLERO` días.
 */
export function problemaDelPeriodo(desde: string, hasta: string): string | null {
  if (hasta < desde) return MENSAJE_RANGO_INVERTIDO
  const dias = (fechaADate(hasta).getTime() - fechaADate(desde).getTime()) / MS_POR_DIA + 1
  return dias > MAX_DIAS_TABLERO ? MENSAJE_RANGO_MAXIMO : null
}

/**
 * `parte / base` como número de 0 a 100 redondeado a un decimal (1 de 3 → 33.3); 0 si la base es
 * 0. No se recorta a 100 ni se ajusta para que varios porcentajes sumen 100.
 */
export function porcentaje(parte: number, base: number): number {
  return base === 0 ? 0 : Math.round((parte / base) * 1000) / 10
}

/**
 * Turnos del período por estado (definición F: sólo `CANCELADO`, `SIN_REGISTRAR` y `AGENDADO`).
 * `total` son todas las ocurrencias, incluidas las canceladas, y cada porcentaje es sobre `total`.
 * `agendados` es `null` si el período no incluye fechas futuras (`hasta < hoy`); hoy cuenta como
 * incluida: el estado de las de hoy lo decidió el motor.
 */
export function turnosPorEstado(
  ocurrencias: readonly OcurrenciaTablero[],
  { hasta, hoy }: { hasta: string; hoy: string },
): { total: number; cancelados: Conteo; sinRegistrar: Conteo; agendados: Conteo | null } {
  const total = ocurrencias.length
  const conteo = (estado: OcurrenciaTablero['estado']): Conteo => {
    const cantidad = ocurrencias.filter((o) => o.estado === estado).length
    return { cantidad, porcentaje: porcentaje(cantidad, total) }
  }
  return {
    total,
    cancelados: conteo('CANCELADO'),
    sinRegistrar: conteo('SIN_REGISTRAR'),
    agendados: hasta < hoy ? null : conteo('AGENDADO'),
  }
}

/** Una clase: una hora de un bloque en una fecha (la definición de HU-19). */
export type Clase = { bloqueAgendaId: number; fecha: string }

/**
 * Las clases del período: cada `(bloqueAgendaId, fecha)` con **al menos una ocurrencia no
 * cancelada**, sin repetir y en el orden en que aparecen. Una hora sin turnos, o con todos
 * cancelados, no es una clase.
 */
export function clasesDelPeriodo(ocurrencias: readonly OcurrenciaTablero[]): Clase[] {
  const clases = new Map<string, Clase>()
  for (const { bloqueAgendaId, fecha, estado } of ocurrencias) {
    if (estado === 'CANCELADO') continue
    const clave = `${bloqueAgendaId}|${fecha}`
    if (!clases.has(clave)) clases.set(clave, { bloqueAgendaId, fecha })
  }
  return [...clases.values()]
}

/**
 * Ocupación del período: `turnos` (ocurrencias no canceladas) sobre `capacidad` (la suma de la
 * capacidad efectiva de cada clase; un bloque que no está en `capacidades` suma 0). La capacidad de
 * una hora cuenta una vez por clase, tenga uno o varios alumnos. Sin clases, todo en 0. El
 * porcentaje **no se recorta a 100**: si a un aula le bajaron la capacidad, da el valor real.
 */
export function ocupacion(
  ocurrencias: readonly OcurrenciaTablero[],
  capacidades: ReadonlyMap<number, number>,
): { turnos: number; capacidad: number; porcentaje: number } {
  const turnos = ocurrencias.filter((o) => o.estado !== 'CANCELADO').length
  const capacidad = clasesDelPeriodo(ocurrencias).reduce(
    (suma, clase) => suma + (capacidades.get(clase.bloqueAgendaId) ?? 0),
    0,
  )
  return { turnos, capacidad, porcentaje: porcentaje(turnos, capacidad) }
}

export type MateriaConDemanda = { materia: { id: number; nombre: string }; cantidad: number }

/**
 * Las `MAX_MATERIAS_TABLERO` materias con más ocurrencias **no canceladas** del período. Orden:
 * cantidad descendente; en empate, nombre ascendente (`localeCompare` con `'es'`) y después `id`.
 */
export function materiasConMasDemanda(
  ocurrencias: readonly OcurrenciaTablero[],
): MateriaConDemanda[] {
  const porMateria = new Map<number, MateriaConDemanda>()
  for (const { materia, estado } of ocurrencias) {
    if (estado === 'CANCELADO') continue
    const item = porMateria.get(materia.id)
    if (item) item.cantidad += 1
    else
      porMateria.set(materia.id, {
        materia: { id: materia.id, nombre: materia.nombre },
        cantidad: 1,
      })
  }
  return [...porMateria.values()]
    .sort(
      (a, b) =>
        b.cantidad - a.cantidad ||
        a.materia.nombre.localeCompare(b.materia.nombre, 'es') ||
        a.materia.id - b.materia.id,
    )
    .slice(0, MAX_MATERIAS_TABLERO)
}

export type ProfesorConMasTurnos = {
  profesor: { id: number; nombre: string; apellido: string }
  cantidad: number
}

/**
 * Los `MAX_PROFESORES_TABLERO` profesores con más ocurrencias **no canceladas** del período: cada
 * una es un alumno con un turno en una hora del profesor. Orden: cantidad descendente; en empate,
 * apellido y nombre ascendentes (`localeCompare` con `'es'`) y después `id`.
 */
export function profesoresConMasTurnos(
  ocurrencias: readonly OcurrenciaTablero[],
): ProfesorConMasTurnos[] {
  const porProfesor = new Map<number, ProfesorConMasTurnos>()
  for (const { profesor, estado } of ocurrencias) {
    if (estado === 'CANCELADO') continue
    const item = porProfesor.get(profesor.id)
    if (item) item.cantidad += 1
    else
      porProfesor.set(profesor.id, {
        profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
        cantidad: 1,
      })
  }
  return [...porProfesor.values()]
    .sort(
      (a, b) =>
        b.cantidad - a.cantidad ||
        a.profesor.apellido.localeCompare(b.profesor.apellido, 'es') ||
        a.profesor.nombre.localeCompare(b.profesor.nombre, 'es') ||
        a.profesor.id - b.profesor.id,
    )
    .slice(0, MAX_PROFESORES_TABLERO)
}

// ---------------------------------------------------------------------------------------------
// Asistencia (HU-39, T-112, decisión T-162)
// ---------------------------------------------------------------------------------------------

/** Filas de cada tabla de la pestaña "Asistencia". */
export const FILAS_POR_PAGINA_ASISTENCIA = 10

/** Lo que las reglas de asistencia miran de una ocurrencia (una `Ocurrencia` del motor lo cumple). */
export type OcurrenciaAsistencia = OcurrenciaTablero &
  Pick<Ocurrencia, 'alumnoId' | 'plazoAsistencia'>

/**
 * "Asistió" y "No asistió": los turnos con asistencia registrada (`REALIZADO` y `AUSENTE`), con su
 * porcentaje **sobre esos turnos**, no sobre el total del período. Los cerrados y los pendientes de
 * registro no entran en la base. Sin ningún registro, los dos en 0.
 */
export function conteosDeAsistencia(ocurrencias: readonly Pick<OcurrenciaTablero, 'estado'>[]): {
  asistio: Conteo
  noAsistio: Conteo
} {
  const asistio = ocurrencias.filter((o) => o.estado === 'REALIZADO').length
  const noAsistio = ocurrencias.filter((o) => o.estado === 'AUSENTE').length
  const registrados = asistio + noAsistio
  return {
    asistio: { cantidad: asistio, porcentaje: porcentaje(asistio, registrados) },
    noAsistio: { cantidad: noAsistio, porcentaje: porcentaje(noAsistio, registrados) },
  }
}

/** Alumnos distintos con al menos un turno `REALIZADO` ("Presente") en el período. */
export function alumnosAtendidos(
  ocurrencias: readonly Pick<OcurrenciaAsistencia, 'estado' | 'alumnoId'>[],
): number {
  return new Set(ocurrencias.filter((o) => o.estado === 'REALIZADO').map((o) => o.alumnoId)).size
}

/** Las cifras de asistencia de un grupo de turnos (un profesor o una materia). */
export type CifrasDeAsistencia = {
  /** Turnos con asistencia registrada (`REALIZADO` y `AUSENTE`): cada hora de un alumno cuenta como un turno. */
  asistenciasRegistradas: number
  /** `asistenciasRegistradas` sobre `total`. */
  porcentajeRegistrado: number
  /** `SIN_REGISTRAR` con el plazo vencido: los que cerró el sistema. */
  cerradosSinRegistrar: number
  /** `cerradosSinRegistrar` sobre `total`. */
  porcentajeCerrados: number
  /** `SIN_REGISTRAR` que todavía están dentro del plazo de 7 días: el profesor aún puede marcarlos. */
  sinRegistrar: number
  /** `sinRegistrar` sobre `total`. */
  porcentajeSinRegistrar: number
  /**
   * Los turnos que ya pasaron y no se cancelaron: las registradas, las cerradas y las sin registrar
   * dentro del plazo. Es la base de los tres porcentajes ("12 de 20"), que suman 100. Los
   * cancelados y los agendados no están.
   */
  total: number
}

/**
 * Las cifras de un grupo de turnos. Los cancelados no cuentan (no hay asistencia que registrar) y
 * los agendados tampoco (todavía no pasaron). Los tres porcentajes son sobre `total` y salen en 0
 * si es 0.
 */
function cifrasDeAsistencia(ocurrencias: readonly OcurrenciaAsistencia[]): CifrasDeAsistencia {
  let asistenciasRegistradas = 0
  let cerradosSinRegistrar = 0
  let sinRegistrar = 0
  for (const { estado, plazoAsistencia } of ocurrencias) {
    if (estado === 'REALIZADO' || estado === 'AUSENTE') asistenciasRegistradas += 1
    else if (estado === 'SIN_REGISTRAR') {
      if (plazoAsistencia?.vencido === true) cerradosSinRegistrar += 1
      else sinRegistrar += 1
    }
  }
  const total = asistenciasRegistradas + cerradosSinRegistrar + sinRegistrar
  return {
    asistenciasRegistradas,
    porcentajeRegistrado: porcentaje(asistenciasRegistradas, total),
    cerradosSinRegistrar,
    porcentajeCerrados: porcentaje(cerradosSinRegistrar, total),
    sinRegistrar,
    porcentajeSinRegistrar: porcentaje(sinRegistrar, total),
    total,
  }
}

export type FilaProfesorAsistencia = CifrasDeAsistencia & {
  profesor: { id: number; nombre: string; apellido: string }
  /** Tiene al menos un turno cerrado sin registrar en el período. */
  noRegistraAsistencia: boolean
}

export type FilaMateriaAsistencia = CifrasDeAsistencia & {
  materia: { id: number; nombre: string }
}

/** Agrupa las ocurrencias **no canceladas** por una clave (`id` de profesor o de materia). */
function agruparPor(
  ocurrencias: readonly OcurrenciaAsistencia[],
  claveDe: (ocurrencia: OcurrenciaAsistencia) => number,
): Map<number, OcurrenciaAsistencia[]> {
  const grupos = new Map<number, OcurrenciaAsistencia[]>()
  for (const ocurrencia of ocurrencias) {
    if (ocurrencia.estado === 'CANCELADO') continue
    const clave = claveDe(ocurrencia)
    const grupo = grupos.get(clave)
    if (grupo) grupo.push(ocurrencia)
    else grupos.set(clave, [ocurrencia])
  }
  return grupos
}

/**
 * Una fila por profesor con al menos un turno no cancelado en el período, **sin orden**:
 * `ordenarProfesores` lo decide. Sólo agregados: nada de los alumnos.
 */
export function filasDeProfesores(
  ocurrencias: readonly OcurrenciaAsistencia[],
): FilaProfesorAsistencia[] {
  return [...agruparPor(ocurrencias, (o) => o.profesor.id).values()].map((grupo) => {
    const { profesor } = grupo[0] as OcurrenciaAsistencia
    const cifras = cifrasDeAsistencia(grupo)
    return {
      profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
      ...cifras,
      noRegistraAsistencia: cifras.cerradosSinRegistrar > 0,
    }
  })
}

/**
 * Una fila por materia con al menos un turno no cancelado en el período. Orden fijo: cerrados sin
 * registrar de mayor a menor; en empate, nombre (`localeCompare` con `'es'`) e `id`.
 */
export function filasDeMaterias(
  ocurrencias: readonly OcurrenciaAsistencia[],
): FilaMateriaAsistencia[] {
  return [...agruparPor(ocurrencias, (o) => o.materia.id).values()]
    .map((grupo) => {
      const { materia } = grupo[0] as OcurrenciaAsistencia
      return {
        materia: { id: materia.id, nombre: materia.nombre },
        ...cifrasDeAsistencia(grupo),
      }
    })
    .sort(
      (a, b) =>
        b.cerradosSinRegistrar - a.cerradosSinRegistrar ||
        a.materia.nombre.localeCompare(b.materia.nombre, 'es') ||
        a.materia.id - b.materia.id,
    )
}

/** Columnas por las que se puede ordenar la tabla de profesores. */
export const COLUMNAS_PROFESORES = [
  'profesor',
  'asistenciasRegistradas',
  'porcentajeRegistrado',
  'cerradosSinRegistrar',
  'porcentajeCerrados',
  'sinRegistrar',
  'porcentajeSinRegistrar',
] as const
export type ColumnaProfesores = (typeof COLUMNAS_PROFESORES)[number]

export type Direccion = 'asc' | 'desc'

/** Orden por defecto de la tabla de profesores: los que más turnos cerrados sin registrar tienen. */
export const ORDEN_PROFESORES_POR_DEFECTO: { orden: ColumnaProfesores; direccion: Direccion } = {
  orden: 'cerradosSinRegistrar',
  direccion: 'desc',
}

type ConProfesor = { profesor: { id: number; nombre: string; apellido: string } }

function compararNombres(a: ConProfesor, b: ConProfesor): number {
  return (
    a.profesor.apellido.localeCompare(b.profesor.apellido, 'es') ||
    a.profesor.nombre.localeCompare(b.profesor.nombre, 'es') ||
    a.profesor.id - b.profesor.id
  )
}

/**
 * Las filas de profesores ordenadas por `orden` en `direccion` (copia, no toca la entrada). En
 * empate, siempre apellido y nombre ascendentes y después `id`, así el orden es estable entre
 * consultas y páginas. `profesor` ordena por apellido y nombre.
 */
export function ordenarProfesores(
  filas: readonly FilaProfesorAsistencia[],
  { orden, direccion }: { orden: ColumnaProfesores; direccion: Direccion },
): FilaProfesorAsistencia[] {
  const signo = direccion === 'asc' ? 1 : -1
  return [...filas].sort((a, b) => {
    const principal = orden === 'profesor' ? compararNombres(a, b) : a[orden] - b[orden]
    return signo * principal || compararNombres(a, b)
  })
}

/** El filtro "Sólo con turnos sin registrar": los profesores con `noRegistraAsistencia`. */
export function soloQueNoRegistran(
  filas: readonly FilaProfesorAsistencia[],
): FilaProfesorAsistencia[] {
  return filas.filter((fila) => fila.noRegistraAsistencia)
}

/** Los números de la torta de la pestaña "Asistencia", sobre el período pedido. */
export type ResumenDeAsistencia = {
  /** Turnos `REALIZADO`. */
  presentes: Conteo
  /** Turnos `AUSENTE`. */
  ausentes: Conteo
  /** Turnos "Sin registrar" que todavía están dentro del plazo de 7 días. */
  sinRegistrar: Conteo
  /** Turnos "Sin registrar" que cerró el sistema (pasaron los 7 días del plazo). */
  cerrados: Conteo
  /** Los cuatro juntos: la base de los porcentajes. */
  total: number
  /**
   * La fecha de la clase más antigua y la de la más reciente entre los turnos que cerró el sistema,
   * o `null` si no cerró ninguno.
   */
  clasesCerradas: { desde: string; hasta: string } | null
}

/**
 * Las fechas de las clases cuyo turno cerró el sistema: de la más antigua a la más reciente. Son
 * siempre anteriores a la ventana de registro (un turno se cierra recién a los 7 días de la clase).
 * `null` si no hay ninguno cerrado.
 */
export function clasesCerradasDelSistema(
  ocurrencias: readonly Pick<OcurrenciaAsistencia, 'estado' | 'plazoAsistencia' | 'fecha'>[],
): { desde: string; hasta: string } | null {
  const fechas = ocurrencias
    .filter((o) => o.estado === 'SIN_REGISTRAR' && o.plazoAsistencia?.vencido === true)
    .map((o) => o.fecha)
    .sort()
  const primera = fechas[0]
  const ultima = fechas[fechas.length - 1]
  return primera === undefined || ultima === undefined ? null : { desde: primera, hasta: ultima }
}

/**
 * El resumen del período: presentes, ausentes, sin registrar (dentro del plazo) y cerrados por el
 * sistema, cada uno con su porcentaje sobre los cuatro juntos. Los cancelados y los agendados no
 * entran. Sin ningún turno de los cuatro, todo en 0.
 */
export function resumenDeAsistencia(
  ocurrencias: readonly OcurrenciaAsistencia[],
): ResumenDeAsistencia {
  const cifras = cifrasDeAsistencia(ocurrencias)
  const ausentes = ocurrencias.filter((o) => o.estado === 'AUSENTE').length
  const presentes = cifras.asistenciasRegistradas - ausentes
  const conteo = (cantidad: number): Conteo => ({
    cantidad,
    porcentaje: porcentaje(cantidad, cifras.total),
  })
  return {
    presentes: conteo(presentes),
    ausentes: conteo(ausentes),
    sinRegistrar: conteo(cifras.sinRegistrar),
    cerrados: conteo(cifras.cerradosSinRegistrar),
    total: cifras.total,
    clasesCerradas: clasesCerradasDelSistema(ocurrencias),
  }
}

/**
 * La ventana de registro que termina hoy: de `PLAZO_ASISTENCIA_DIAS` días atrás a hoy. Las clases de
 * esas fechas son las que el profesor todavía puede registrar, así que no depende del período que
 * se mira en el tablero.
 */
export function ventanaDeRegistro(fechaHoy: string): { desde: string; hasta: string } {
  return { desde: sumarDias(fechaHoy, -PLAZO_ASISTENCIA_DIAS), hasta: fechaHoy }
}

/**
 * Profesores con al menos un turno "Sin registrar" **dentro del plazo**: los que todavía deben
 * marcar la asistencia de alguna clase. Se calcula sobre las ocurrencias de `ventanaDeRegistro`.
 */
export function profesoresConTurnosPorRegistrar(
  ocurrencias: readonly Pick<OcurrenciaAsistencia, 'estado' | 'plazoAsistencia' | 'profesor'>[],
): number {
  return new Set(
    ocurrencias
      .filter((o) => o.estado === 'SIN_REGISTRAR' && o.plazoAsistencia?.vencido === false)
      .map((o) => o.profesor.id),
  ).size
}

// ---------------------------------------------------------------------------------------------
// Finanzas (HU-47, T-128)
// ---------------------------------------------------------------------------------------------

/** Lo que las reglas de finanzas miran de un cobro (un `CobroConReparto` del motor lo cumple). */
export type CobroTablero = Pick<CobroConReparto, 'fechaPago' | 'cerradaSinRegistrar'> & {
  profesor: ProfesorRef
  reparto: TotalReparto
}

/** Una liquidación pagada: el `total` que se le transfirió al profesor, tal como se guardó. */
export type LiquidacionPagada = {
  profesor: ProfesorRef
  /** `YYYY-MM-DD`. */
  fechaTransferencia: string
  total: number
}

/** Lo que se le debe a `hoy` a un profesor (`saldoAPagarPorProfesor`); puede ser negativo. */
export type SaldoDeProfesor = { profesor: ProfesorRef; saldo: number }

/** Cuántos meses trae la evolución mensual. */
export const MESES_EVOLUCION = 6

/**
 * El reparto con el que el tablero cuenta un cobro. Un turno cerrado sin registrar no se le debe
 * al profesor (HU-44): su importe completo va al centro. Si no, el reparto del cobro tal cual. Es
 * la única regla del reparto del tablero: la usan el resumen, la tabla y la evolución, así la parte
 * del centro de la tabla suma el margen y las dos partes suman lo cobrado.
 */
export function repartoParaElTablero(
  cobro: Pick<CobroTablero, 'cerradaSinRegistrar' | 'reparto'>,
): TotalReparto {
  const { importe, parteCentro, parteProfesor } = cobro.reparto
  return cobro.cerradaSinRegistrar
    ? { importe, parteCentro: importe, parteProfesor: 0 }
    : { importe, parteCentro, parteProfesor }
}

/** Las partes de varios cobros sumadas en centavos, con la regla de `repartoParaElTablero`. */
function sumarCobros(cobros: readonly CobroTablero[]): TotalReparto {
  return sumarReparto(cobros.map(repartoParaElTablero))
}

/** Los números principales de la pestaña "Finanzas". */
export type ResumenDeFinanzas = {
  totalCobrado: number
  margenCentro: { importe: number; porcentaje: number }
  incluyeSinRegistrar: number
  pagadoAProfesores: number
  saldoAPagarAProfesores: number
}

/**
 * El resumen del período. `totalCobrado` es el de `totalCobradoEntre` (el mismo de "General");
 * `cobros` y `pagadas` son los del período. El margen es la parte del centro de los cobros más el
 * importe completo de los cerrados sin registrar (`repartoParaElTablero`), con su porcentaje sobre
 * `totalCobrado`; `incluyeSinRegistrar`, el importe de esos cerrados. El saldo es a hoy y suma sólo
 * los positivos: un profesor con saldo negativo no lo resta (punto 12, decisión T-169).
 */
export function resumenDeFinanzas({
  totalCobrado,
  cobros,
  pagadas,
  saldos,
}: {
  totalCobrado: number
  cobros: readonly CobroTablero[]
  pagadas: readonly LiquidacionPagada[]
  saldos: readonly SaldoDeProfesor[]
}): ResumenDeFinanzas {
  const margen = sumarCobros(cobros).parteCentro
  return {
    totalCobrado,
    margenCentro: { importe: margen, porcentaje: porcentaje(margen, totalCobrado) },
    incluyeSinRegistrar: sumarImportes(
      cobros.filter((c) => c.cerradaSinRegistrar).map((c) => c.reparto.importe),
    ),
    pagadoAProfesores: sumarImportes(pagadas.map((p) => p.total)),
    saldoAPagarAProfesores: sumarImportes(saldos.map((s) => s.saldo).filter((saldo) => saldo > 0)),
  }
}

export type FilaFinanzasProfesor = {
  profesor: ProfesorRef
  turnosCobrados: number
  totalCobrado: number
  parteCentro: number
  parteProfesor: number
  pagado: number
  /** El de `saldoAPagarPorProfesor`, a hoy: puede ser negativo. */
  saldoPendiente: number
}

/**
 * Una fila por profesor con alguna cifra distinta de 0 (cobros o pagado en el período, o saldo a
 * hoy), activo o inactivo, **sin orden**: `ordenarFinanzas` lo decide. Las partes, con
 * `repartoParaElTablero`: un cerrado sin registrar va entero a la parte del centro.
 */
export function filasDeFinanzasPorProfesor({
  cobros,
  pagadas,
  saldos,
}: {
  cobros: readonly CobroTablero[]
  pagadas: readonly LiquidacionPagada[]
  saldos: readonly SaldoDeProfesor[]
}): FilaFinanzasProfesor[] {
  type Grupo = {
    profesor: ProfesorRef
    cobros: CobroTablero[]
    pagadas: number[]
    saldo: number
  }
  const grupos = new Map<number, Grupo>()
  const grupoDe = (profesor: ProfesorRef): Grupo => {
    let grupo = grupos.get(profesor.id)
    if (!grupo) {
      grupo = {
        profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
        cobros: [],
        pagadas: [],
        saldo: 0,
      }
      grupos.set(profesor.id, grupo)
    }
    return grupo
  }
  for (const cobro of cobros) grupoDe(cobro.profesor).cobros.push(cobro)
  for (const pagada of pagadas) grupoDe(pagada.profesor).pagadas.push(pagada.total)
  for (const { profesor, saldo } of saldos) grupoDe(profesor).saldo = saldo

  return [...grupos.values()].flatMap((grupo): FilaFinanzasProfesor[] => {
    const partes = sumarCobros(grupo.cobros)
    const pagado = sumarImportes(grupo.pagadas)
    if (grupo.cobros.length === 0 && pagado === 0 && grupo.saldo === 0) return []
    return [
      {
        profesor: grupo.profesor,
        turnosCobrados: grupo.cobros.length,
        totalCobrado: partes.importe,
        parteCentro: partes.parteCentro,
        parteProfesor: partes.parteProfesor,
        pagado,
        saldoPendiente: grupo.saldo,
      },
    ]
  })
}

/** Columnas por las que se puede ordenar la tabla de finanzas por profesor. */
export const COLUMNAS_FINANZAS = [
  'profesor',
  'turnosCobrados',
  'totalCobrado',
  'parteCentro',
  'parteProfesor',
  'pagado',
  'saldoPendiente',
] as const
export type ColumnaFinanzas = (typeof COLUMNAS_FINANZAS)[number]

/** Orden por defecto de la tabla de finanzas: los que más cobraron primero. */
export const ORDEN_FINANZAS_POR_DEFECTO: { orden: ColumnaFinanzas; direccion: Direccion } = {
  orden: 'totalCobrado',
  direccion: 'desc',
}

/**
 * Las filas de finanzas ordenadas por `orden` en `direccion` (copia, no toca la entrada), con el
 * mismo criterio que `ordenarProfesores`: en empate, apellido, nombre e `id` ascendentes; `profesor`
 * ordena por apellido y nombre.
 */
export function ordenarFinanzas(
  filas: readonly FilaFinanzasProfesor[],
  { orden, direccion }: { orden: ColumnaFinanzas; direccion: Direccion },
): FilaFinanzasProfesor[] {
  const signo = direccion === 'asc' ? 1 : -1
  return [...filas].sort((a, b) => {
    const principal = orden === 'profesor' ? compararNombres(a, b) : a[orden] - b[orden]
    return signo * principal || compararNombres(a, b)
  })
}

/**
 * Los `MESES_EVOLUCION` meses `YYYY-MM` que terminan en el de `hasta`, del más viejo al más nuevo
 * (cruzan el cambio de año: `'2027-02-10'` → `2026-09` … `2027-02`).
 */
export function mesesDeEvolucion(hasta: string): string[] {
  const meses = [mesDe(hasta)]
  while (meses.length < MESES_EVOLUCION) meses.unshift(mesAnterior(meses[0] as string))
  return meses
}

export type MesDeEvolucion = {
  mes: string
  totalCobrado: number
  margenCentro: number
  pagadoAProfesores: number
}

/**
 * Por cada mes de `meses`: lo cobrado (por `fechaPago`), el margen del centro (con
 * `repartoParaElTablero`) y lo pagado a los profesores (por `fechaTransferencia`). Los meses
 * anteriores son completos; el último llega hasta `hasta` (el fin del período). Un mes sin
 * movimientos va en 0: siempre una fila por mes.
 */
export function evolucionMensual({
  meses,
  hasta,
  cobros,
  pagadas,
}: {
  meses: readonly string[]
  hasta: string
  cobros: readonly CobroTablero[]
  pagadas: readonly LiquidacionPagada[]
}): MesDeEvolucion[] {
  const delMes = (mes: string, fecha: string) => fecha <= hasta && mesDe(fecha) === mes
  return meses.map((mes) => {
    const partes = sumarCobros(cobros.filter((c) => delMes(mes, c.fechaPago)))
    return {
      mes,
      totalCobrado: partes.importe,
      margenCentro: partes.parteCentro,
      pagadoAProfesores: sumarImportes(
        pagadas.filter((p) => delMes(mes, p.fechaTransferencia)).map((p) => p.total),
      ),
    }
  })
}

// Se crea una sola vez. Las partes numéricas no dependen del formato del locale.
const formatoZona = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Milisegundos que la hora de pared de la zona del negocio le lleva a UTC en ese instante. */
function desfaseDeZona(instante: number): number {
  const partes = formatoZona.formatToParts(new Date(instante))
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((p) => p.type === tipo)?.value)
  const pared = Date.UTC(
    parte('year'),
    parte('month') - 1,
    parte('day'),
    parte('hour'),
    parte('minute'),
    parte('second'),
  )
  return pared - instante
}

/** El instante en que empieza `fecha` (00:00) en la zona del negocio. */
function inicioDelDia(fecha: string): Date {
  const medianocheUTC = fechaADate(fecha).getTime()
  // Dos pasos: el desfase se lee en el instante aproximado, por si la zona lo cambia ese día.
  const aproximado = medianocheUTC - desfaseDeZona(medianocheUTC)
  return new Date(medianocheUTC - desfaseDeZona(aproximado))
}

/**
 * El período `[desde, hasta]` (fechas de calendario, extremos incluidos) como instantes de la zona
 * del negocio: `desde` es el inicio de `desde` (incluido) y `hasta` el inicio del día siguiente a
 * `hasta` (**excluido**). Para comparar contra una marca de auditoría (`createdAt`), que es un
 * instante: en Salta (UTC−3) el día empieza a las 03:00 UTC.
 */
export function instantesDelPeriodo(desde: string, hasta: string): { desde: Date; hasta: Date } {
  return { desde: inicioDelDia(desde), hasta: inicioDelDia(sumarDias(hasta, 1)) }
}
