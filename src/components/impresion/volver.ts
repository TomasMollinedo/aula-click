// "Volver" de las hojas de impresión (`BotonVolverImprimir`): decide si la pestaña tiene adónde
// volver. Puro, con el historial inyectado, para poder probarlo sin navegador.

export type HistorialDePestana = {
  /** `window.history.length`. */
  longitud: number
  /**
   * `navigation.currentEntry.index` (Navigation API), si el navegador la tiene: la posición entre
   * las entradas **de este sitio**. `history.length` cuenta también las ajenas (en Chrome, la
   * página de "Nueva pestaña" desde la que se pegó la URL), y volver ahí saca a la persona de la app.
   */
  indice?: number
}

/**
 * La pestaña tiene una pantalla anterior de la app a la que volver. Una hoja abierta en una pestaña
 * nueva (`target="_blank"`) o con la URL pegada no la tiene: ahí "Volver" cierra la pestaña o va a
 * la ruta de respaldo.
 */
export function tieneHistorialPropio({ longitud, indice }: HistorialDePestana): boolean {
  if (indice !== undefined) return indice > 0
  return longitud > 1
}
