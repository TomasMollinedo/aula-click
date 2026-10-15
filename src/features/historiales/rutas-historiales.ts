// La URL del documento PDF del historial académico que arma la API (docs/contrato-api.md →
// Documentos PDF). Es un enlace (`<a target="_blank">`), no un pedido con `fetchJson`: el navegador
// abre el PDF en su visor, en otra pestaña, y desde ahí se descarga. Único lugar donde se arma.

/**
 * `/api/v1/historiales/alumnos/12/pdf?mes=2026-10`: el historial académico del alumno en **un mes**,
 * con los filtros de materia y profesor si están puestos. El documento es de un mes, no de un rango
 * (HU-32): el `mes` lo decide la pantalla. La API decide todo lo demás (sale del mismo cálculo que
 * el historial que se está viendo).
 */
export function hrefPdfHistorial({
  alumnoId,
  mes,
  materiaId,
  profesorId,
}: {
  alumnoId: number
  /** Mes del documento (`AAAA-MM`). */
  mes: string
  materiaId?: number | null
  profesorId?: number | null
}): string {
  const query = new URLSearchParams({ mes })
  if (materiaId != null) query.set('materiaId', String(materiaId))
  if (profesorId != null) query.set('profesorId', String(profesorId))
  return `/api/v1/historiales/alumnos/${alumnoId}/pdf?${query}`
}
