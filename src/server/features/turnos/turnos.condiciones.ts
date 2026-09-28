import type { Prisma } from '@/generated/prisma/client'
import { dateAFecha, fechaADate, proximaFechaDelDia } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import { ocupacionMaxima } from './turnos.reglas'
import type {
  OcupacionMaximaPorFila,
  TurnosVigentesPorBloque,
  TurnosVigentesPorMateria,
  TurnoVigentePorProfesor,
} from './turnos.validation'

// Condiciones de consulta de turnos y las lecturas que otras features necesitan hacer **dentro de
// su propia transacción** (decisión T-39). Es la única implementación: `turnos.repository` las usa
// con el cliente común (`prisma`) y los repositories de `bloques` y `profesores` con su `tx`, para
// chequear turnos vigentes con el lock ya tomado. No crea el cliente de Prisma (lo recibe): de
// Prisma solo importa tipos. Sin reglas de negocio: qué hacer con lo leído lo decide el service.
//
// De otra feature solo se importan `*.repository` y `*.condiciones` (lo hace cumplir ESLint).

// Tipos de lo que devuelven estas lecturas, para que otras features no importen la validation.
export type {
  OcupacionMaximaPorFila,
  TurnosVigentesPorBloque,
  TurnosVigentesPorMateria,
  TurnoVigentePorProfesor,
}

/** Cliente con el que se consulta: `prisma` o el `tx` de una transacción. */
export type ClienteTurnos = Prisma.TransactionClient

/**
 * Condición de **turno vigente** (docs/dominio.md → Turnos): `fechaFin` nula (recurrente sin fin)
 * o >= hoy, y estado `ACTIVO`. Un turno `CANCELADO` no cuenta: la vigencia se decide por fecha,
 * pero un cancelado no bloquea nada.
 *
 * Es la **única** implementación de la condición (convenciones-backend.md → Turno vigente): se
 * reutiliza desde acá, nunca se reescribe en otra feature. `fechaHoy` la calcula el service con
 * `hoy()` y su reloj inyectable.
 */
export function condicionTurnoVigente(fechaHoy: string) {
  return {
    estado: 'ACTIVO',
    OR: [{ fechaFin: null }, { fechaFin: { gte: fechaADate(fechaHoy) } }],
  } satisfies Prisma.TurnoWhereInput
}

/**
 * Turno `ACTIVO` con al menos una fecha en `[inicio, fin]` (`fin` `null` = sin fin): `fechaInicio
 * <= fin` y `fechaFin` nula o `>= inicio`. Es la lectura de "los turnos que pueden chocar con un
 * pedido" (reserva) y la base de `condicionTurnoOcupaLugar`. Equivale al predicado puro
 * `seCruzaCon` de `turnos.reglas.ts`. Se combina con el `bloqueAgendaId` o el `alumnoId`.
 *
 * Ojo al combinarla: tiene un `OR` (y puede tener `fechaInicio`) en el primer nivel. Se puede
 * mezclar por spread con otras claves (`bloqueAgendaId`, `alumnoId`, un `OR` anidado en una
 * relación), pero no con otra condición que también tenga `OR` o `fechaInicio` en el primer nivel
 * (como `condicionTurnoVigente`): el spread pisaría uno con otro. En ese caso, `AND: [a, b]`.
 */
export function condicionTurnoSeCruzaCon(inicio: string, fin: string | null) {
  return {
    estado: 'ACTIVO',
    ...(fin === null ? {} : { fechaInicio: { lte: fechaADate(fin) } }),
    OR: [{ fechaFin: null }, { fechaFin: { gte: fechaADate(inicio) } }],
  } satisfies Prisma.TurnoWhereInput
}

/**
 * Condición de **turno que ocupa lugar** en una fila de `bloque_agenda` en `fecha` (una sola para
 * los dos tipos): `ACTIVO`, `fechaInicio <= fecha` y `fechaFin` nula o `>= fecha`. Una sesión
 * única es el caso `fechaInicio = fechaFin`; un recurrente ocupa lugar en cada fecha de su rango
 * (todas caen en el día de su fila). Es la ocupación del horario (T-33) y del control de
 * capacidad (`BLOQUE_LLENO`): se reutiliza desde acá, nunca se reescribe. Equivale al predicado
 * puro `ocupaLugarEn` de `turnos.reglas.ts`. Se combina con el `bloqueAgendaId` de la fila o, en la
 * agenda diaria (T-23) y sus selectores, con el día de la semana del bloque (`bloqueAgenda.diaSemana`).
 */
export function condicionTurnoOcupaLugar(fecha: string) {
  return condicionTurnoSeCruzaCon(fecha, fecha)
}

/**
 * Cantidad de turnos vigentes por materia, filtrable por profesor (el del bloque) y materias.
 * Solo vienen las materias con al menos un turno vigente.
 */
export async function contarVigentesPorMateria(
  db: ClienteTurnos,
  filtro: { fechaHoy: string; profesorId?: number; materiaIds?: number[] },
): Promise<TurnosVigentesPorMateria[]> {
  const grupos = await db.turno.groupBy({
    by: ['materiaId'],
    where: {
      ...condicionTurnoVigente(filtro.fechaHoy),
      ...(filtro.profesorId === undefined
        ? {}
        : { bloqueAgenda: { profesorId: filtro.profesorId } }),
      ...(filtro.materiaIds === undefined ? {} : { materiaId: { in: filtro.materiaIds } }),
    },
    _count: { _all: true },
    orderBy: { materiaId: 'asc' },
  })
  return grupos.map((grupo) => ({ materiaId: grupo.materiaId, cantidad: grupo._count._all }))
}

/**
 * Cantidad de turnos vigentes de varias filas de `bloque_agenda` en una sola consulta. Solo
 * vienen las filas con al menos un turno vigente.
 */
export async function contarVigentesPorBloques(
  db: ClienteTurnos,
  bloqueAgendaIds: number[],
  fechaHoy: string,
): Promise<TurnosVigentesPorBloque[]> {
  const grupos = await db.turno.groupBy({
    by: ['bloqueAgendaId'],
    where: { ...condicionTurnoVigente(fechaHoy), bloqueAgendaId: { in: bloqueAgendaIds } },
    _count: { _all: true },
    orderBy: { bloqueAgendaId: 'asc' },
  })
  return grupos.map((grupo) => ({
    bloqueAgendaId: grupo.bloqueAgendaId,
    cantidad: grupo._count._all,
  }))
}

/**
 * Turnos vigentes del profesor (de cualquiera de sus bloques), con los datos que HU-06 pide
 * mostrar antes de la baja: alumno, materia, tipo, fechas y horario. `fecha` es `fechaInicio` (se
 * conserva por compatibilidad); `fechaFin` es `null` en un recurrente sin fin. Ordenados por fecha
 * y id.
 */
export async function listarVigentesPorProfesor(
  db: ClienteTurnos,
  profesorId: number,
  fechaHoy: string,
): Promise<TurnoVigentePorProfesor[]> {
  const filas = await db.turno.findMany({
    where: { ...condicionTurnoVigente(fechaHoy), bloqueAgenda: { profesorId } },
    select: {
      alumno: { select: { id: true, nombre: true, apellido: true } },
      materia: { select: { id: true, nombre: true } },
      tipo: true,
      fechaInicio: true,
      fechaFin: true,
      bloqueAgenda: { select: { horaInicio: true, horaFin: true } },
    },
    orderBy: [{ fechaInicio: 'asc' }, { id: 'asc' }],
  })
  return filas.map((fila) => ({
    alumno: fila.alumno,
    materia: fila.materia,
    tipo: fila.tipo,
    fecha: dateAFecha(fila.fechaInicio),
    fechaFin: fila.fechaFin && dateAFecha(fila.fechaFin),
    horaInicio: minutosAHora(fila.bloqueAgenda.horaInicio),
    horaFin: minutosAHora(fila.bloqueAgenda.horaFin),
  }))
}

/**
 * Ocupación simultánea máxima de cada hora activa del profesor, desde hoy en adelante: la mayor
 * cantidad de turnos que ocupan lugar en esa hora en una misma fecha (`ocupacionMaxima` de
 * `turnos.reglas.ts`, la misma cuenta que `BLOQUE_LLENO`). Solo vienen las horas con algún turno
 * vigente, ordenadas por día y hora. La usa la edición de la capacidad del profesor (T-15).
 */
export async function ocupacionMaximaPorFila(
  db: ClienteTurnos,
  profesorId: number,
  fechaHoy: string,
): Promise<OcupacionMaximaPorFila[]> {
  const filas = await db.bloqueAgenda.findMany({
    where: {
      profesorId,
      estado: 'ACTIVO',
      turnos: { some: condicionTurnoVigente(fechaHoy) },
    },
    select: {
      id: true,
      diaSemana: true,
      horaInicio: true,
      horaFin: true,
      turnos: {
        where: condicionTurnoVigente(fechaHoy),
        select: { estado: true, fechaInicio: true, fechaFin: true },
      },
    },
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }, { id: 'asc' }],
  })
  return filas.flatMap((fila) => {
    const maxima = ocupacionMaxima(
      fila.turnos.map((turno) => ({
        estado: turno.estado,
        fechaInicio: dateAFecha(turno.fechaInicio),
        fechaFin: turno.fechaFin && dateAFecha(turno.fechaFin),
      })),
      proximaFechaDelDia(fila.diaSemana, fechaHoy),
    )
    return maxima
      ? [
          {
            bloqueId: fila.id,
            diaSemana: fila.diaSemana,
            horaInicio: minutosAHora(fila.horaInicio),
            horaFin: minutosAHora(fila.horaFin),
            ...maxima,
          },
        ]
      : []
  })
}
