import type { PeriodoHistorial } from './filtros-historial'

// La URL del documento PDF del historial académico que arma la API (docs/contrato-api.md →
// Documentos PDF). Es un enlace (`<a target="_blank">`), no un pedido con `fetchJson`: el navegador
// abre el PDF en su visor, en otra pestaña, y desde ahí se descarga. Único lugar donde se arma.

/**
 * `/api/v1/historiales/alumnos/12/pdf?mes=2026-10` con un mes elegido, o
 * `…/pdf?desde=2026-09-05&hasta=2026-10-12` con un rango (decisión T-163): **el período que se está
 * viendo**, tal como está en la URL de la pantalla, más los filtros de materia y profesor si están
 * puestos. La API decide todo lo demás (el documento sale del mismo cálculo que el historial).
 */
export function hrefPdfHistorial({
  alumnoId,
  periodo,
  materiaId,
  profesorId,
}: {
  alumnoId: number
  /** El de los filtros: con `opcion: 'mes'` va el mes; con `'rango'`, las dos fechas. */
  periodo: PeriodoHistorial
  materiaId?: number | null
  profesorId?: number | null
}): string {
  const query = new URLSearchParams(
    periodo.opcion === 'mes'
      ? { mes: periodo.mes }
      : { desde: periodo.desde, hasta: periodo.hasta },
  )
  if (materiaId != null) query.set('materiaId', String(materiaId))
  if (profesorId != null) query.set('profesorId', String(profesorId))
  return `/api/v1/historiales/alumnos/${alumnoId}/pdf?${query}`
}
