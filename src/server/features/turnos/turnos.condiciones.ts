import type { Prisma } from '@/generated/prisma/client'
import { proximaFechaDelDia } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import { condicionTurnoVigente, leerSeries, type Serie } from './ocurrencias.condiciones'
import { ocupacionMaxima, primeraFechaLibre } from './turnos.reglas'
import type {
  OcupacionMaximaPorFila,
  TurnosVigentesPorBloque,
  TurnosVigentesPorMateria,
  TurnoVigentePorProfesor,
} from './turnos.validation'

// Lecturas de turnos vigentes y de ocupación que otras features hacen **dentro de su propia
// transacción** (decisión T-39). Es la única implementación: `turnos.repository` las usa con el
// cliente común (`prisma`) y los repositories de `bloques` y `profesores` con su `tx`, para chequear
// turnos vigentes con el lock ya tomado. No crea el cliente de Prisma (lo recibe): de Prisma solo
// importa tipos. Sin reglas de negocio: qué hacer con lo leído lo decide el service.
//
// Cuentan con el motor de ocurrencias (`ocurrencias.condiciones.ts`, T-30): una ocurrencia
// cancelada o posterior al fin efectivo de su serie no ocupa lugar ni hace vigente al turno.
//
// De otra feature solo se importan `*.repository` y `*.condiciones` (lo hace cumplir ESLint).

// Prefiltros de consulta: viven en el motor y se re-exportan acá, donde los importaban las otras
// features desde T-39.
export { condicionTurnoSeCruzaCon, condicionTurnoVigente } from './ocurrencias.condiciones'

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
 * **Turno vigente** (docs/dominio.md → Turnos, decisión T-52): serie `ACTIVO` con al menos una
 * ocurrencia no cancelada entre hoy y su fin efectivo. Una serie sin fin efectivo siempre es
 * vigente (las cancelaciones son finitas); una finalizada, o con todas sus fechas restantes
 * canceladas, deja de serlo.
 */
function esVigente(serie: Serie, fechaHoy: string): boolean {
  return primeraFechaLibre(serie, fechaHoy, null) !== null
}

/** Series vigentes desde `fechaHoy` que cumplen el filtro (una consulta, regla en memoria). */
async function leerVigentes(
  db: ClienteTurnos,
  fechaHoy: string,
  filtro: {
    alumnoId?: number
    profesorId?: number
    materiaIds?: number[]
    bloqueAgendaIds?: number[]
  },
): Promise<Serie[]> {
  const series = await leerSeries(db, { ...filtro, desde: fechaHoy, hasta: null })
  return series.filter((serie) => esVigente(serie, fechaHoy))
}

/** Cuenta por clave numérica, ordenado por la clave. */
function contarPor(series: readonly Serie[], clave: (serie: Serie) => number): [number, number][] {
  const cantidades = new Map<number, number>()
  for (const serie of series) {
    cantidades.set(clave(serie), (cantidades.get(clave(serie)) ?? 0) + 1)
  }
  return [...cantidades].sort(([a], [b]) => a - b)
}

/**
 * Cantidad de turnos vigentes por materia, filtrable por alumno, profesor (el del bloque) y
 * materias. Solo vienen las materias con al menos un turno vigente, ordenadas por id.
 */
export async function contarVigentesPorMateria(
  db: ClienteTurnos,
  filtro: { fechaHoy: string; alumnoId?: number; profesorId?: number; materiaIds?: number[] },
): Promise<TurnosVigentesPorMateria[]> {
  const vigentes = await leerVigentes(db, filtro.fechaHoy, {
    alumnoId: filtro.alumnoId,
    profesorId: filtro.profesorId,
    materiaIds: filtro.materiaIds,
  })
  return contarPor(vigentes, (serie) => serie.materiaId).map(([materiaId, cantidad]) => ({
    materiaId,
    cantidad,
  }))
}

/**
 * Cantidad de turnos vigentes de varias filas de `bloque_agenda` en una sola consulta. Solo
 * vienen las filas con al menos un turno vigente, ordenadas por id.
 */
export async function contarVigentesPorBloques(
  db: ClienteTurnos,
  bloqueAgendaIds: number[],
  fechaHoy: string,
): Promise<TurnosVigentesPorBloque[]> {
  const vigentes = await leerVigentes(db, fechaHoy, { bloqueAgendaIds })
  return contarPor(vigentes, (serie) => serie.bloqueAgendaId).map(([bloqueAgendaId, cantidad]) => ({
    bloqueAgendaId,
    cantidad,
  }))
}

/**
 * Turnos vigentes del profesor (de cualquiera de sus bloques), con los datos que HU-06 pide
 * mostrar antes de la baja: alumno, materia, tipo, fechas y horario. `fecha` es `fechaInicio` (se
 * conserva por compatibilidad); `fechaFin` es la guardada (`null` en un recurrente sin fin).
 * Ordenados por fecha y id.
 */
export async function listarVigentesPorProfesor(
  db: ClienteTurnos,
  profesorId: number,
  fechaHoy: string,
): Promise<TurnoVigentePorProfesor[]> {
  const vigentes = await leerVigentes(db, fechaHoy, { profesorId })
  return [...vigentes]
    .sort(
      (a, b) =>
        (a.fechaInicio < b.fechaInicio ? -1 : a.fechaInicio > b.fechaInicio ? 1 : 0) ||
        a.turnoId - b.turnoId,
    )
    .map((serie) => ({
      alumno: { id: serie.alumno.id, nombre: serie.alumno.nombre, apellido: serie.alumno.apellido },
      materia: serie.materia,
      tipo: serie.tipo,
      fecha: serie.fechaInicio,
      fechaFin: serie.fechaFin,
      horaInicio: minutosAHora(serie.horaInicio),
      horaFin: minutosAHora(serie.horaFin),
    }))
}

/**
 * Ocupación simultánea máxima de cada hora activa del profesor, desde hoy en adelante: la mayor
 * cantidad de ocurrencias que ocupan lugar en esa hora en una misma fecha (`ocupacionMaxima` de
 * `turnos.reglas.ts`, la misma cuenta que `BLOQUE_LLENO`: una cancelada o posterior al fin efectivo
 * libera su lugar). Solo vienen las horas con algún turno vigente, ordenadas por día y hora. La usa
 * la edición de la capacidad del profesor (T-15).
 *
 * Dos consultas fijas: las horas activas del profesor con algún candidato a vigente
 * (`condicionTurnoVigente`, el prefiltro) y las series de esas horas (`leerSeries`); sin horas, no
 * lee series.
 */
export async function ocupacionMaximaPorFila(
  db: ClienteTurnos,
  profesorId: number,
  fechaHoy: string,
): Promise<OcupacionMaximaPorFila[]> {
  const filas = await db.bloqueAgenda.findMany({
    where: { profesorId, estado: 'ACTIVO', turnos: { some: condicionTurnoVigente(fechaHoy) } },
    select: { id: true, diaSemana: true, horaInicio: true, horaFin: true },
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }, { id: 'asc' }],
  })
  if (filas.length === 0) return []

  const series = await leerSeries(db, {
    bloqueAgendaIds: filas.map((fila) => fila.id),
    desde: fechaHoy,
    hasta: null,
  })
  const porFila = new Map<number, Serie[]>()
  for (const serie of series) {
    porFila.set(serie.bloqueAgendaId, [...(porFila.get(serie.bloqueAgendaId) ?? []), serie])
  }
  return filas.flatMap((fila) => {
    const delaFila = porFila.get(fila.id) ?? []
    const maxima = delaFila.some((serie) => esVigente(serie, fechaHoy))
      ? ocupacionMaxima(delaFila, proximaFechaDelDia(fila.diaSemana, fechaHoy))
      : null
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
