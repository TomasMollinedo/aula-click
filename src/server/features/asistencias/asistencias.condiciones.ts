import type { Prisma } from '@/generated/prisma/client'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'

// Lecturas de asistencias que otras features hacen dentro de su repository (decisión T-39): de
// Prisma sólo importa tipos y recibe el cliente (`prisma` o el `tx` de quien llama). La usan
// `asistencias` (pantalla del profesor, T-81), `historiales` (HU-33, T-108) y `pagos` (los turnos ya
// dictados de un pago, que no se puede anular: decisión T-179).

/** Una ocurrencia por su turno y su fecha (`YYYY-MM-DD`). */
export type OcurrenciaConsultada = { turnoId: number; fecha: string }

/** Una ocurrencia que ya tiene asistencia, con su estado. */
export type AsistenciaDeOcurrencia = OcurrenciaConsultada & { estado: 'PRESENTE' | 'AUSENTE' }

/**
 * De las ocurrencias pedidas, las que tienen asistencia registrada (`PRESENTE` o `AUSENTE`), con su
 * estado; las que no tienen, no vienen. **Una sola consulta**, sobre el único
 * `(turnoId, fechaOcurrencia)`. Recibe `prisma` o el `tx` de quien llama: dentro de una
 * transacción con el lock del alumno ve la asistencia que otro registró antes de tomarlo.
 */
export async function asistenciasDeOcurrencias(
  client: Prisma.TransactionClient,
  ocurrencias: readonly OcurrenciaConsultada[],
): Promise<AsistenciaDeOcurrencia[]> {
  if (ocurrencias.length === 0) return []
  const filas = await client.asistenciaTurno.findMany({
    where: {
      OR: ocurrencias.map(({ turnoId, fecha }) => ({
        turnoId,
        fechaOcurrencia: fechaADate(fecha),
      })),
    },
    select: { turnoId: true, fechaOcurrencia: true, estado: true },
  })
  return filas.map((fila) => ({
    turnoId: fila.turnoId,
    fecha: dateAFecha(fila.fechaOcurrencia),
    estado: fila.estado,
  }))
}

/** Una consulta de `ultimasIndicaciones`: la última anterior a `antesDe` (`YYYY-MM-DD`). */
export type ConsultaIndicaciones = { alumnoId: number; materiaId: number; antesDe: string }

/** Las indicaciones de una asistencia y la fecha de esa clase. */
export type IndicacionesAnteriores = { fecha: string; indicaciones: string }

/**
 * Por cada consulta, la **última asistencia `PRESENTE` con indicaciones** de ese alumno en esa
 * materia (de cualquier profesor) con fecha anterior a `antesDe`, o `null` si no hay. Devuelve un
 * arreglo alineado con `items`. **Una sola consulta** para todas, sin importar cuántas sean; dentro
 * de un mismo día gana la hora más tardía.
 */
export async function ultimasIndicaciones(
  client: Prisma.TransactionClient,
  items: readonly ConsultaIndicaciones[],
): Promise<(IndicacionesAnteriores | null)[]> {
  if (items.length === 0) return []
  const filas = await client.asistenciaTurno.findMany({
    where: {
      estado: 'PRESENTE',
      indicaciones: { not: null },
      OR: items.map((item) => ({
        fechaOcurrencia: { lt: fechaADate(item.antesDe) },
        turno: { alumnoId: item.alumnoId, materiaId: item.materiaId },
      })),
    },
    select: {
      fechaOcurrencia: true,
      indicaciones: true,
      turno: { select: { alumnoId: true, materiaId: true } },
    },
    orderBy: [
      { fechaOcurrencia: 'desc' },
      { turno: { bloqueAgenda: { horaInicio: 'desc' } } },
      { id: 'desc' },
    ],
  })

  return items.map((item) => {
    const fila = filas.find(
      (f) =>
        f.turno.alumnoId === item.alumnoId &&
        f.turno.materiaId === item.materiaId &&
        dateAFecha(f.fechaOcurrencia) < item.antesDe,
    )
    return fila?.indicaciones
      ? { fecha: dateAFecha(fila.fechaOcurrencia), indicaciones: fila.indicaciones }
      : null
  })
}
