// Las subpestañas de una pantalla (`?vista=por-cobrar|realizados`) se guardan en la URL. Funciones
// puras: este es el único lugar que conoce el nombre del parámetro `vista` de las subpestañas y
// cómo se arma la URL al cambiar de una a otra.

const PARAM_VISTA = 'vista'

/** La subpestaña pedida en la URL; un valor ausente o desconocido es la que va por defecto. */
export function leerVista<T extends string>(
  params: URLSearchParams,
  valores: readonly T[],
  porDefecto: T,
): T {
  const valor = params.get(PARAM_VISTA)
  return valores.find((v) => v === valor) ?? porDefecto
}

/**
 * Los parámetros de la subpestaña `vista`. Se arman de cero: solo se conservan los que dice
 * `conservar` (por ejemplo `tab`, de la pestaña que contiene las subpestañas), así los filtros, las
 * páginas y el detalle abierto de la subpestaña anterior se van, igual que al cambiar de pestaña.
 * La subpestaña por defecto no se escribe.
 */
export function paramsConVista<T extends string>(
  params: URLSearchParams,
  vista: T,
  { porDefecto, conservar }: { porDefecto: T; conservar: readonly string[] },
): URLSearchParams {
  const nuevos = new URLSearchParams()
  for (const nombre of conservar) {
    const valor = params.get(nombre)
    if (valor !== null) nuevos.set(nombre, valor)
  }
  if (vista !== porDefecto) nuevos.set(PARAM_VISTA, vista)
  return nuevos
}
