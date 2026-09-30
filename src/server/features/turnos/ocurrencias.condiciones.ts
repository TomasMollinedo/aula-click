import type { MotivoCancelacion, Prisma } from '@/generated/prisma/client'
import { dateAFecha, diaSemanaISO, fechaADate, hoy, type Reloj } from '@/server/shared/fechas'
import {
  CODIGO_ALUMNO_SUPERPUESTO,
  CODIGO_BLOQUE_LLENO,
  CODIGO_MATERIA_INACTIVA,
  CODIGO_MATERIA_NO_ASIGNADA,
  CODIGO_PROFESOR_INACTIVO,
  MENSAJE_ALUMNO_SUPERPUESTO,
  MENSAJE_BLOQUE_NO_ENCONTRADO,
  MENSAJE_FECHA_PASADA,
  MENSAJE_MATERIA_INACTIVA,
  MENSAJE_MATERIA_NO_ASIGNADA,
  MENSAJE_MATERIA_NO_ENCONTRADA,
  MENSAJE_PROFESOR_INACTIVO,
  MENSAJE_PROFESOR_NO_ENCONTRADO,
  estadoDeOcurrencia,
  fechasDeLaSerie,
  finEfectivo,
  nombreDia,
  ocupaLugarEn,
  primeraFechaLibre,
  type EstadoOcurrencia,
} from './turnos.reglas'
import { ESTADOS_TURNO, TIPOS_TURNO, type SerieFechas, type TipoTurno } from './turnos.validation'

// Motor de **ocurrencias** (docs/convenciones-backend.md → Ocurrencias, T-30): la única
// implementación de expandir un turno en sus ocurrencias, su estado y su pago, la ocupación de una
// hora en una fecha, la superposición del alumno y los locks de la reserva. Lo usan `turnos` y las
// features del Sprint 2 (agendas, ocurrencias, cancelaciones, finalizaciones, reprogramaciones,
// pagos, cuentas, exámenes y tablero), desde su repository y con su `tx` si están en una
// transacción (decisión T-39). No crea el cliente de Prisma (lo recibe): de Prisma solo importa
// tipos. Las reglas son las puras de `turnos.reglas.ts`: acá no se reescriben.
//
// Una ocurrencia es `(turnoId, fecha)` (definición B); no se persiste. No hay reglas de
// reprogramación: un turno reprogramado ya está en su fecha y su bloque nuevos (definición A).
// Sólo los turnos `ACTIVO` generan ocurrencias: `Turno.estado = CANCELADO` existe sólo para los
// turnos cancelados antes del Sprint 2, que no ocupan lugar ni aparecen en ninguna lectura.
//
// De otra feature solo se importan `*.repository` y `*.condiciones` (lo hace cumplir ESLint).

// Valores y tipos que otras features necesitan sin importar la validation de `turnos`.
export { ESTADOS_TURNO, TIPOS_TURNO }
// Códigos, mensajes y nombres de día de las validaciones del destino de un turno (alta y
// reprogramación): una sola definición, la de `turnos.reglas.ts`.
export {
  CODIGO_ALUMNO_SUPERPUESTO,
  CODIGO_BLOQUE_LLENO,
  CODIGO_MATERIA_INACTIVA,
  CODIGO_MATERIA_NO_ASIGNADA,
  CODIGO_PROFESOR_INACTIVO,
  MENSAJE_ALUMNO_SUPERPUESTO,
  MENSAJE_BLOQUE_NO_ENCONTRADO,
  MENSAJE_FECHA_PASADA,
  MENSAJE_MATERIA_INACTIVA,
  MENSAJE_MATERIA_NO_ASIGNADA,
  MENSAJE_MATERIA_NO_ENCONTRADA,
  MENSAJE_PROFESOR_INACTIVO,
  MENSAJE_PROFESOR_NO_ENCONTRADO,
  nombreDia,
}
export type { EstadoOcurrencia, MotivoCancelacion, TipoTurno }

/** Cliente con el que se consulta: `prisma` o el `tx` de una transacción. */
export type ClienteOcurrencias = Prisma.TransactionClient

export type EstadoPagoOcurrencia = 'PENDIENTE' | 'PAGADO'

/**
 * Un turno en una fecha concreta. Las horas van en minutos desde medianoche (como `BloqueAgenda`)
 * y las fechas en `YYYY-MM-DD`: cada feature las convierte al armar su DTO (`minutosAHora`), y
 * arma el DTO **campo por campo**, nunca con spread de `Ocurrencia`.
 */
export type Ocurrencia = {
  turnoId: number
  fecha: string
  bloqueAgendaId: number
  diaSemana: number
  horaInicio: number
  horaFin: number
  profesorId: number
  aulaId: number
  alumnoId: number
  materiaId: number
  tipo: TipoTurno
  estado: EstadoOcurrencia
  /**
   * `PAGADO` si hay un `PagoTurno` para `(turnoId, fecha)` (definición D: no se mira
   * `Pago.estado`). `importeAplicado` es un número con hasta dos decimales (convenciones-backend.md
   * → Importes).
   */
  pago: { estado: EstadoPagoOcurrencia; pagoId?: number; importeAplicado?: number }
  /** Sólo si está cancelada. `createdAt` en ISO 8601 UTC, como la auditoría. */
  cancelacion?: {
    motivo: MotivoCancelacion
    detalle: string | null
    createdById: string
    createdAt: string
  }
  /** La serie (turno o tramo) a la que pertenece: `fechaFin` guardada y su fin efectivo. */
  serie: { fechaInicio: string; fechaFin: string | null; finEfectivo: string | null }
  /**
   * `busqueda` (de `alumno` y de `profesor`) es un campo **interno**: sólo para filtrar por `q` y
   * ordenar igual que la base (decisión T-54). Nunca viaja en una respuesta.
   */
  alumno: { id: number; nombre: string; apellido: string; busqueda: string }
  profesor: { id: number; nombre: string; apellido: string; busqueda: string }
  materia: { id: number; nombre: string }
  aula: { id: number; nombre: string }
}

/** Filtro de `leerOcurrencias`. El rango (`YYYY-MM-DD`, extremos incluidos) es obligatorio. */
export type FiltroOcurrencias = {
  desde: string
  hasta: string
  alumnoId?: number
  /** Filtra por el profesor del bloque. */
  profesorId?: number
  materiaId?: number
  /** Filtra por el aula del bloque. */
  aulaId?: number
  turnoIds?: number[]
  bloqueAgendaIds?: number[]
}

/** Una ocurrencia puntual, para sacarla de una cuenta (`excluir`). */
export type OcurrenciaExcluida = { turnoId: number; fecha: string }

/** Una consulta de `ocupacionesEn`. */
export type ConsultaOcupacion = {
  bloqueAgendaId: number
  fecha: string
  excluir?: OcurrenciaExcluida
}

// ---------------------------------------------------------------------------------------------
// Condiciones de consulta (prefiltros)
// ---------------------------------------------------------------------------------------------

/**
 * Turno `ACTIVO` con al menos una fecha guardada en `[inicio, fin]` (`fin` `null` = sin fin):
 * `fechaInicio <= fin` y `fechaFin` nula o `>= inicio`. Es el **prefiltro** de todas las lecturas
 * del motor: no mira la finalización ni las cancelaciones (eso lo decide `ocupaLugarEn` en
 * memoria). Equivale al predicado puro `seCruzaCon` de `turnos.reglas.ts`.
 *
 * Ojo al combinarla: tiene un `OR` (y puede tener `fechaInicio`) en el primer nivel. Se puede
 * mezclar por spread con otras claves (`bloqueAgendaId`, `alumnoId`, un `OR` anidado en una
 * relación), pero no con otra condición que también tenga `OR` o `fechaInicio` en el primer nivel:
 * el spread pisaría uno con otro. En ese caso, `AND: [a, b]`.
 */
export function condicionTurnoSeCruzaCon(inicio: string, fin: string | null) {
  return {
    estado: 'ACTIVO',
    ...(fin === null ? {} : { fechaInicio: { lte: fechaADate(fin) } }),
    OR: [{ fechaFin: null }, { fechaFin: { gte: fechaADate(inicio) } }],
  } satisfies Prisma.TurnoWhereInput
}

/**
 * **Prefiltro** de turno vigente: `ACTIVO`, `fechaFin` nula o `>= hoy`, y sin finalización o con
 * `finalizacion.fechaDesde > hoy`. Es necesario pero **no suficiente**: un turno vigente tiene
 * además al menos una ocurrencia no cancelada entre hoy y su fin efectivo, y eso lo decide
 * `primeraFechaLibre(serie, hoy, null) !== null` de `turnos.reglas.ts`, en memoria. Las lecturas de
 * vigentes de `turnos.condiciones.ts` aplican la regla completa.
 *
 * Se exporta para quien la compone en una consulta propia (`alumnos.listarDeProfesor`, "Mis
 * alumnos"): ahí una serie con todas sus fechas restantes canceladas sigue contando (pendiente,
 * decisión T-52). Las dos condiciones de fecha van en un `AND`: se puede mezclar por spread con
 * `bloqueAgenda`, `alumnoId` o `materiaId`, pero no con otro `AND`.
 */
export function condicionTurnoVigente(fechaHoy: string) {
  const hoyDate = fechaADate(fechaHoy)
  return {
    estado: 'ACTIVO',
    AND: [
      { OR: [{ fechaFin: null }, { fechaFin: { gte: hoyDate } }] },
      {
        OR: [
          { finalizacion: { is: null } },
          { finalizacion: { is: { fechaDesde: { gt: hoyDate } } } },
        ],
      },
    ],
  } satisfies Prisma.TurnoWhereInput
}

// ---------------------------------------------------------------------------------------------
// Lector de series
// ---------------------------------------------------------------------------------------------

const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Días de la semana (ISO) que toca el rango `[desde, hasta]`, o `undefined` si los toca a todos
 * (rango de una semana o más, o sin fin), para no filtrar de más. Recorre como mucho siete fechas.
 */
function diasDelRango(desde: string, hasta: string | null): number[] | undefined {
  if (hasta === null) return undefined
  const dias = new Set<number>()
  let fecha = desde
  while (fecha <= hasta && dias.size < 7) {
    dias.add(diaSemanaISO(fecha))
    fecha = dateAFecha(new Date(fechaADate(fecha).getTime() + MS_POR_DIA))
  }
  return dias.size >= 7 ? undefined : [...dias]
}

/** Qué series leer: las `ACTIVO` que se cruzan con `[desde, hasta]` y cumplen el resto. */
export type FiltroSeries = {
  desde: string
  /** `null` = sin fin (se leen todas las cancelaciones desde `desde`). */
  hasta: string | null
  bloqueAgendaIds?: number[]
  alumnoId?: number
  profesorId?: number
  materiaId?: number
  materiaIds?: number[]
  aulaId?: number
  turnoIds?: number[]
  /** Sólo filas de ese día y que se pisan con `[horaInicio, horaFin)` (superposición). */
  horario?: { diaSemana: number; horaInicio: number; horaFin: number }
}

function rangoFechas(desde: string, hasta: string | null) {
  return {
    gte: fechaADate(desde),
    ...(hasta === null ? {} : { lte: fechaADate(hasta) }),
  }
}

function selectSerie(desde: string, hasta: string | null) {
  const rango = rangoFechas(desde, hasta)
  return {
    id: true,
    bloqueAgendaId: true,
    alumnoId: true,
    materiaId: true,
    tipo: true,
    estado: true,
    fechaInicio: true,
    fechaFin: true,
    bloqueAgenda: {
      select: {
        diaSemana: true,
        horaInicio: true,
        horaFin: true,
        profesorId: true,
        aulaId: true,
        aula: { select: { id: true, nombre: true } },
        profesor: {
          select: {
            id: true,
            usuario: { select: { nombre: true, apellido: true, busqueda: true } },
          },
        },
      },
    },
    alumno: { select: { id: true, nombre: true, apellido: true, busqueda: true } },
    materia: { select: { id: true, nombre: true } },
    finalizacion: { select: { fechaDesde: true } },
    cancelaciones: {
      where: { fechaOcurrencia: rango },
      select: {
        fechaOcurrencia: true,
        motivo: true,
        detalle: true,
        createdById: true,
        createdAt: true,
      },
    },
    pagoTurnos: {
      where: { fechaOcurrencia: rango },
      select: { fechaOcurrencia: true, pagoId: true, importeAplicado: true },
    },
  } satisfies Prisma.TurnoSelect
}

type FilaSerie = Prisma.TurnoGetPayload<{ select: ReturnType<typeof selectSerie> }>

/**
 * Una serie (turno o tramo) leída con su fin efectivo, sus fechas canceladas y sus pagos dentro
 * del rango pedido, y las referencias que usan las ocurrencias. Interna de `turnos`: las otras
 * features leen ocurrencias (`leerOcurrencias`), no series.
 */
export type Serie = SerieFechas & {
  turnoId: number
  bloqueAgendaId: number
  alumnoId: number
  materiaId: number
  tipo: TipoTurno
  fechaFin: string | null
  diaSemana: number
  horaInicio: number
  horaFin: number
  profesorId: number
  aulaId: number
  cancelaciones: Map<string, NonNullable<Ocurrencia['cancelacion']>>
  pagos: Map<string, { pagoId: number; importeAplicado: number }>
  alumno: Ocurrencia['alumno']
  profesor: Ocurrencia['profesor']
  materia: Ocurrencia['materia']
  aula: Ocurrencia['aula']
}

function aSerie(fila: FilaSerie): Serie {
  const { bloqueAgenda } = fila
  const fechaFin = fila.fechaFin && dateAFecha(fila.fechaFin)
  const cancelaciones = new Map(
    fila.cancelaciones.map((c) => [
      dateAFecha(c.fechaOcurrencia),
      {
        motivo: c.motivo,
        detalle: c.detalle,
        createdById: c.createdById,
        createdAt: c.createdAt.toISOString(),
      },
    ]),
  )
  return {
    turnoId: fila.id,
    bloqueAgendaId: fila.bloqueAgendaId,
    alumnoId: fila.alumnoId,
    materiaId: fila.materiaId,
    tipo: fila.tipo,
    estado: fila.estado,
    fechaInicio: dateAFecha(fila.fechaInicio),
    fechaFin,
    finEfectivo: finEfectivo(
      { fechaFin },
      fila.finalizacion && { fechaDesde: dateAFecha(fila.finalizacion.fechaDesde) },
    ),
    canceladas: [...cancelaciones.keys()].sort(),
    cancelaciones,
    pagos: new Map(
      fila.pagoTurnos.map((p) => [
        dateAFecha(p.fechaOcurrencia),
        { pagoId: p.pagoId, importeAplicado: p.importeAplicado.toNumber() },
      ]),
    ),
    diaSemana: bloqueAgenda.diaSemana,
    horaInicio: bloqueAgenda.horaInicio,
    horaFin: bloqueAgenda.horaFin,
    profesorId: bloqueAgenda.profesorId,
    aulaId: bloqueAgenda.aulaId,
    alumno: fila.alumno,
    profesor: {
      id: bloqueAgenda.profesor.id,
      nombre: bloqueAgenda.profesor.usuario.nombre,
      apellido: bloqueAgenda.profesor.usuario.apellido,
      busqueda: bloqueAgenda.profesor.usuario.busqueda,
    },
    materia: fila.materia,
    aula: bloqueAgenda.aula,
  }
}

/**
 * Lector de series de la feature (lo usan el motor, `turnos.condiciones` y `turnos.repository`):
 * las series `ACTIVO` que se cruzan con `[desde, hasta]` (`condicionTurnoSeCruzaCon`) y cumplen el
 * filtro, con su fin efectivo, sus cancelaciones y sus pagos de ese rango y sus referencias, en
 * **una sola consulta** (sin N+1). Ordenadas por hora de inicio e id.
 */
export async function leerSeries(
  client: ClienteOcurrencias,
  filtro: FiltroSeries,
): Promise<Serie[]> {
  const dias = filtro.horario
    ? [filtro.horario.diaSemana]
    : diasDelRango(filtro.desde, filtro.hasta)
  const filas = await client.turno.findMany({
    where: {
      ...condicionTurnoSeCruzaCon(filtro.desde, filtro.hasta),
      ...(filtro.alumnoId === undefined ? {} : { alumnoId: filtro.alumnoId }),
      ...(filtro.materiaId === undefined && filtro.materiaIds === undefined
        ? {}
        : {
            materiaId: {
              in: [
                ...(filtro.materiaId === undefined ? [] : [filtro.materiaId]),
                ...(filtro.materiaIds ?? []),
              ],
            },
          }),
      ...(filtro.turnoIds === undefined ? {} : { id: { in: filtro.turnoIds } }),
      ...(filtro.bloqueAgendaIds === undefined
        ? {}
        : { bloqueAgendaId: { in: filtro.bloqueAgendaIds } }),
      bloqueAgenda: {
        ...(filtro.profesorId === undefined ? {} : { profesorId: filtro.profesorId }),
        ...(filtro.aulaId === undefined ? {} : { aulaId: filtro.aulaId }),
        ...(dias === undefined ? {} : { diaSemana: { in: dias } }),
        ...(filtro.horario
          ? {
              horaInicio: { lt: filtro.horario.horaFin },
              horaFin: { gt: filtro.horario.horaInicio },
            }
          : {}),
      },
    },
    select: selectSerie(filtro.desde, filtro.hasta),
    orderBy: [{ bloqueAgenda: { horaInicio: 'asc' } }, { id: 'asc' }],
  })
  return filas.map(aSerie)
}

/** La serie con una fecha puntual sacada de la cuenta (como si estuviera cancelada). */
function sinExcluida(serie: Serie, excluir?: OcurrenciaExcluida): SerieFechas {
  if (!excluir || excluir.turnoId !== serie.turnoId) return serie
  return { ...serie, canceladas: [...serie.canceladas, excluir.fecha] }
}

function aOcurrencia(serie: Serie, fecha: string, fechaHoy: string): Ocurrencia {
  const cancelacion = serie.cancelaciones.get(fecha)
  const pago = serie.pagos.get(fecha)
  return {
    turnoId: serie.turnoId,
    fecha,
    bloqueAgendaId: serie.bloqueAgendaId,
    diaSemana: serie.diaSemana,
    horaInicio: serie.horaInicio,
    horaFin: serie.horaFin,
    profesorId: serie.profesorId,
    aulaId: serie.aulaId,
    alumnoId: serie.alumnoId,
    materiaId: serie.materiaId,
    tipo: serie.tipo,
    estado: estadoDeOcurrencia(fecha, cancelacion !== undefined, fechaHoy),
    pago: pago
      ? { estado: 'PAGADO', pagoId: pago.pagoId, importeAplicado: pago.importeAplicado }
      : { estado: 'PENDIENTE' },
    ...(cancelacion ? { cancelacion } : {}),
    serie: {
      fechaInicio: serie.fechaInicio,
      fechaFin: serie.fechaFin,
      finEfectivo: serie.finEfectivo,
    },
    alumno: serie.alumno,
    profesor: serie.profesor,
    materia: serie.materia,
    aula: serie.aula,
  }
}

function porFechaHoraYTurno(a: Ocurrencia, b: Ocurrencia): number {
  return (
    (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) ||
    a.horaInicio - b.horaInicio ||
    a.turnoId - b.turnoId
  )
}

// ---------------------------------------------------------------------------------------------
// Lecturas públicas
// ---------------------------------------------------------------------------------------------

/**
 * Ocurrencias de `[filtro.desde, filtro.hasta]` (rango obligatorio): cada fecha del día de la
 * semana del bloque entre `fechaInicio` y el fin efectivo de cada serie `ACTIVO` que cumple el
 * filtro (`profesorId` y `aulaId` filtran por el bloque), **incluidas las canceladas**, con su
 * estado (`CANCELADO`, `SIN_REGISTRAR` o `AGENDADO`), su pago y su cancelación. Cada tramo es un
 * turno propio. `reloj` (por defecto el del sistema) sólo decide `SIN_REGISTRAR`.
 *
 * Una cantidad fija de consultas (la de `leerSeries`), sin importar cuántos turnos haya; el resto
 * se expande en memoria con las reglas puras. Ordenadas por fecha, hora de inicio y `turnoId`.
 */
export async function leerOcurrencias(
  client: ClienteOcurrencias,
  filtro: FiltroOcurrencias,
  reloj?: Reloj,
): Promise<Ocurrencia[]> {
  if (filtro.hasta < filtro.desde) return []
  const fechaHoy = hoy(reloj)
  const series = await leerSeries(client, filtro)
  return series
    .flatMap((serie) =>
      fechasDeLaSerie(serie, filtro.desde, filtro.hasta).map((fecha) =>
        aOcurrencia(serie, fecha, fechaHoy),
      ),
    )
    .sort(porFechaHoraYTurno)
}

/** Clave del `Map` que devuelve `ocupacionesEn`. */
export function claveOcupacion(bloqueAgendaId: number, fecha: string): string {
  return `${bloqueAgendaId}|${fecha}`
}

/**
 * Ocupación de varias horas en varias fechas en **una sola consulta**: por cada consulta, cuántas
 * ocurrencias **ocupan lugar** en esa fila en esa fecha (`ocupaLugarEn`: `ACTIVO`, dentro del fin
 * efectivo y no canceladas; una pagada o pasada ocupa lugar igual). Un turno reprogramado es un
 * turno más: no hay nada que sumar ni restar. `excluir` saca esa ocurrencia de su consulta.
 * Devuelve un `Map` por `claveOcupacion(bloqueAgendaId, fecha)` con todas las consultas (0 si no
 * hay ninguna); si una clave se repite, vale la última consulta.
 */
export async function ocupacionesEn(
  client: ClienteOcurrencias,
  consultas: readonly ConsultaOcupacion[],
): Promise<Map<string, number>> {
  const resultado = new Map<string, number>()
  if (consultas.length === 0) return resultado
  const fechas = consultas.map((c) => c.fecha).sort()
  const series = await leerSeries(client, {
    desde: fechas[0] ?? '',
    hasta: fechas.at(-1) ?? '',
    bloqueAgendaIds: [...new Set(consultas.map((c) => c.bloqueAgendaId))],
  })
  const porFila = new Map<number, Serie[]>()
  for (const serie of series) {
    porFila.set(serie.bloqueAgendaId, [...(porFila.get(serie.bloqueAgendaId) ?? []), serie])
  }
  for (const { bloqueAgendaId, fecha, excluir } of consultas) {
    const cantidad = (porFila.get(bloqueAgendaId) ?? []).filter((serie) =>
      ocupaLugarEn(sinExcluida(serie, excluir), fecha),
    ).length
    resultado.set(claveOcupacion(bloqueAgendaId, fecha), cantidad)
  }
  return resultado
}

/** Cuántas ocurrencias ocupan lugar en esa hora y esa fecha: `ocupacionesEn` con una consulta. */
export async function ocupacionEn(
  client: ClienteOcurrencias,
  consulta: ConsultaOcupacion,
): Promise<number> {
  const ocupacion = await ocupacionesEn(client, [consulta])
  return ocupacion.get(claveOcupacion(consulta.bloqueAgendaId, consulta.fecha)) ?? 0
}

/**
 * Ocurrencias del alumno que se pisan con `[horaInicio, horaFin)` (minutos) en el día de la semana
 * de `fecha`, de cualquier profesor, que **ocupan lugar** (una cancelada o fuera del fin efectivo
 * no choca). `excluir` saca esa ocurrencia (la propia, al reprogramar).
 *
 * - Sin `hasta`: las del alumno en `fecha` (sesión única, reprogramación).
 * - Con `hasta` (`YYYY-MM-DD`, o `null` = sin fin): un pedido semanal desde `fecha` hasta `hasta`
 *   (el alta de un recurrente). Devuelve, por cada turno en conflicto, **la primera ocurrencia en
 *   la que choca** (`primeraFechaLibre`, que saltea las canceladas sin recorrer una serie sin fin).
 *
 * Una sola consulta. Ordenadas por fecha, hora de inicio y `turnoId`.
 */
export async function superposicionesDelAlumno(
  client: ClienteOcurrencias,
  pedido: {
    alumnoId: number
    fecha: string
    hasta?: string | null
    horaInicio: number
    horaFin: number
    excluir?: OcurrenciaExcluida
  },
  reloj?: Reloj,
): Promise<Ocurrencia[]> {
  const hasta = pedido.hasta === undefined ? pedido.fecha : pedido.hasta
  if (hasta !== null && hasta < pedido.fecha) return []
  const fechaHoy = hoy(reloj)
  const series = await leerSeries(client, {
    desde: pedido.fecha,
    hasta,
    alumnoId: pedido.alumnoId,
    horario: {
      diaSemana: diaSemanaISO(pedido.fecha),
      horaInicio: pedido.horaInicio,
      horaFin: pedido.horaFin,
    },
  })
  return series
    .flatMap((serie) => {
      const fecha = primeraFechaLibre(sinExcluida(serie, pedido.excluir), pedido.fecha, hasta)
      return fecha === null ? [] : [aOcurrencia(serie, fecha, fechaHoy)]
    })
    .sort(porFechaHoraYTurno)
}

/**
 * Materias (`{ id, nombre }`) de los turnos `ACTIVO` del alumno en bloques de ese profesor, sin
 * repetir y ordenadas por nombre (sin tildes ni mayúsculas, `busqueda`) e `id`. No filtra por
 * fecha: lo usa `examenes` (T-55) para las materias que el profesor le dicta al alumno.
 */
export async function materiasDelProfesorConAlumno(
  client: ClienteOcurrencias,
  { profesorId, alumnoId }: { profesorId: number; alumnoId: number },
): Promise<{ id: number; nombre: string }[]> {
  return client.materia.findMany({
    where: { turnos: { some: { estado: 'ACTIVO', alumnoId, bloqueAgenda: { profesorId } } } },
    select: { id: true, nombre: true },
    orderBy: [{ busqueda: 'asc' }, { id: 'asc' }],
  })
}

// ---------------------------------------------------------------------------------------------
// Locks
// ---------------------------------------------------------------------------------------------

/**
 * Toma los locks de una escritura sobre turnos, **siempre en este orden** (decisiones T-38 y T-39;
 * docs/convenciones-backend.md → Concurrencia), para que el alta, la cancelación, la finalización,
 * la reprogramación y el pago no se bloqueen en sentido cruzado:
 * 1. `profesor` `FOR SHARE`: no espera a otra reserva, sí a un cambio del horario o del profesor
 *    (`bloques` y `profesores` lo toman `FOR UPDATE`);
 * 2. las filas de `bloque_agenda`, ordenadas por id, `FOR UPDATE`: serializan la capacidad de cada
 *    hora (el orden evita deadlocks entre escrituras de varias horas);
 * 3. `alumno` `FOR UPDATE` (`bloquearAlumno`): serializa la superposición del alumno entre
 *    profesores distintos y el estado de sus ocurrencias (cancelada, pagada).
 *
 * **Se llama antes de cualquier lectura o escritura de la transacción**: lo que se lea después ya
 * no puede cambiar hasta el commit. Los ids viajan como parámetros del tagged template (nunca
 * interpolados en el texto).
 */
export async function bloquearParaReserva(
  tx: ClienteOcurrencias,
  {
    profesorId,
    bloqueAgendaIds,
    alumnoId,
  }: { profesorId: number; bloqueAgendaIds: readonly number[]; alumnoId: number },
): Promise<void> {
  const ids = [...new Set(bloqueAgendaIds)].sort((a, b) => a - b)
  await tx.$queryRaw`SELECT id FROM profesor WHERE id = ${profesorId} FOR SHARE`
  await tx.$queryRaw`SELECT id FROM bloque_agenda WHERE id = ANY(${ids}::int[]) ORDER BY id FOR UPDATE`
  await bloquearAlumno(tx, alumnoId)
}

/**
 * `alumno` `FOR UPDATE`: el paso 3 (el último) del orden de `bloquearParaReserva`, que lo usa. Es
 * para las escrituras que dependen del **estado de las ocurrencias de un alumno** pero no de la
 * ocupación ni de la superposición: el pago (T-51) y, por la misma razón, puede usarlo la
 * cancelación (T-45). Cancelar, reprogramar, finalizar y pagar toman este lock, así que se
 * serializan entre sí; como es un sufijo del orden compartido, no hay deadlock posible con quien
 * toma el orden completo.
 *
 * **Se llama antes de cualquier lectura de la transacción.** El id viaja como parámetro.
 */
export async function bloquearAlumno(tx: ClienteOcurrencias, alumnoId: number): Promise<void> {
  await tx.$queryRaw`SELECT id FROM alumno WHERE id = ${alumnoId} FOR UPDATE`
}
