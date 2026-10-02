// URLs a las que enlaza `cuentas`. La API de cuentas es solo de mesa de entradas (responde 403 a
// cualquier otro rol), así que el segmento es fijo: no hay otro rol que reuse estos componentes con
// su propia `rutaBase`. El comprobante de un pago ya no se enlaza desde acá (no hay historial): se
// abre desde el éxito del diálogo de cobro, que es de `pagos`.

/** `/mesa/alumnos/12?tab=pagos`: la pestaña "Pagos" de la ficha (`AlumnoDetalle` lee `?tab=`). */
export function hrefFichaAlumno(alumnoId: number): string {
  return `/mesa/alumnos/${alumnoId}?tab=pagos`
}
