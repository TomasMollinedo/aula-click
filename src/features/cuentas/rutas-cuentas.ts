// URLs a las que enlaza `cuentas`. La API de cuentas es solo de mesa de entradas (responde 403 a
// cualquier otro rol), igual que la de pagos, así que el segmento es fijo: no hay otro rol que
// reuse estos componentes con su propia `rutaBase`.

/**
 * `/mesa/pagos/31/comprobante`: el comprobante de T-52, con el id del pago (`pagoId`), no con el
 * número de comprobante. La ruta vive en `app/(documentos)/mesa/`, sin el layout del segmento.
 */
export function hrefComprobante(pagoId: number): string {
  return `/mesa/pagos/${pagoId}/comprobante`
}

/** `/mesa/alumnos/12?tab=pagos`: la pestaña "Pagos" de la ficha (`AlumnoDetalle` lee `?tab=`). */
export function hrefFichaAlumno(alumnoId: number): string {
  return `/mesa/alumnos/${alumnoId}?tab=pagos`
}
