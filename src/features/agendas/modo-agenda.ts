// Cómo se ve una agenda: como calendario semanal o como lista (HU-19). El modo vive en la URL
// (`?modo=lista`) y no se recuerda entre visitas. Funciones puras (el hook está en
// `use-modo-agenda`).

export type ModoAgenda = 'calendario' | 'lista'

/** Quien entra a una agenda ve el calendario semanal; la lista se elige con el selector. */
export const MODO_POR_DEFECTO: ModoAgenda = 'calendario'

/** Lo que trae la URL puede ser cualquier cosa (o nada): un valor desconocido es el modo por defecto. */
export function parsearModo(valor: string | null | undefined): ModoAgenda {
  return valor === 'calendario' || valor === 'lista' ? valor : MODO_POR_DEFECTO
}

/** Copia de `params` con el modo dado: el modo por defecto no se escribe y los demás parámetros se conservan. */
export function paramsConModo(params: URLSearchParams, modo: ModoAgenda): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  if (modo === MODO_POR_DEFECTO) nuevos.delete('modo')
  else nuevos.set('modo', modo)
  return nuevos
}
