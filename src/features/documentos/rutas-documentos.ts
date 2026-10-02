import type { EstadoTurno } from '@/components/turno/indicadores-turno'
import type { FiltrosAgenda } from '@/types/agenda'

// URLs de los documentos oficiales en PDF que arma la API (docs/contrato-api.md → Documentos PDF).
// Son enlaces (`<a target="_blank">`), no pedidos con `fetchJson`: el navegador abre el PDF en su
// visor, en otra pestaña, y desde ahí se descarga. Único lugar donde se arman: los componentes de
// esta feature sólo las usan. (El comprobante de pago tiene la suya en `features/pagos`.)

/** `/api/v1/ocurrencias/31/2026-10-05/pdf`: el detalle de un turno en una fecha. */
export function hrefPdfTurno({ turnoId, fecha }: { turnoId: number; fecha: string }): string {
  return `/api/v1/ocurrencias/${turnoId}/${fecha}/pdf`
}

/**
 * `/api/v1/ocurrencias/pdf?alumnoId=…&desde=…&hasta=…`: los turnos de un alumno en el rango. Con
 * turnos tildados manda `seleccion` (`turnoId:fecha` de cada uno) y no `estado`: una selección
 * explícita ya dice qué va en el documento. Sin tildar nada, manda `estado` si hay uno elegido.
 */
export function hrefPdfTurnosAlumno({
  alumnoId,
  desde,
  hasta,
  estado,
  seleccionadas,
}: {
  alumnoId: number
  desde: string
  hasta: string
  estado: EstadoTurno | null
  seleccionadas: readonly { turnoId: number; fecha: string }[]
}): string {
  const query = new URLSearchParams({ alumnoId: String(alumnoId), desde, hasta })
  if (seleccionadas.length > 0) {
    query.set(
      'seleccion',
      seleccionadas.map((turno) => `${turno.turnoId}:${turno.fecha}`).join(','),
    )
  } else if (estado) {
    query.set('estado', estado)
  }
  return `/api/v1/ocurrencias/pdf?${query}`
}

/**
 * `/api/v1/agendas/diaria/pdf?fecha=…&profesorId=…`: la agenda de un profesor en un día, con los
 * filtros de cancelados y de prioridad si están puestos. `null` sin profesor elegido: la agenda de
 * todo el centro no tiene PDF.
 */
export function hrefPdfAgenda({
  fecha,
  filtros,
}: {
  fecha: string
  filtros: FiltrosAgenda
}): string | null {
  if (filtros.profesorId == null) return null
  const query = new URLSearchParams({ fecha, profesorId: String(filtros.profesorId) })
  if (filtros.incluirCancelados) query.set('incluirCancelados', 'true')
  if (filtros.prioridad) query.set('prioridad', filtros.prioridad)
  return `/api/v1/agendas/diaria/pdf?${query}`
}
