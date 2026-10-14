// Funciones puras de `CampoArchivo` (campo-archivo.tsx), aparte para testearlas sin DOM.
// Son ayuda para quien elige el archivo: la validación de verdad (tipo, firma y tamaño) es de la
// API (`archivoSchema` de `server/shared/archivos.ts`).

/** Tipos aceptados: tipo MIME → etiqueta que ve el usuario (`{ 'image/jpeg': 'JPG' }`). */
export type TiposAceptados = Readonly<Record<string, string>>

/** Por qué no se acepta un archivo: tipo fuera de `aceptar` o más de `maxBytes`. */
export type RechazoArchivo = 'tipo' | 'tamano'

/**
 * Por qué no se acepta el archivo, o `null` si se acepta. El tipo se mira primero: un archivo de
 * otro tipo se informa así aunque además sea grande.
 */
export function rechazoArchivo(
  archivo: { type: string; size: number },
  aceptar: TiposAceptados,
  maxBytes: number,
): RechazoArchivo | null {
  if (!Object.hasOwn(aceptar, archivo.type)) return 'tipo'
  if (archivo.size > maxBytes) return 'tamano'
  return null
}

/** Etiquetas sin repetir, en lenguaje natural: "JPG, PNG o PDF". */
export function listarEtiquetas(aceptar: TiposAceptados): string {
  const etiquetas = [...new Set(Object.values(aceptar))]
  if (etiquetas.length <= 1) return etiquetas.join('')
  return `${etiquetas.slice(0, -1).join(', ')} o ${etiquetas.at(-1)}`
}

const UNIDADES = ['KB', 'MB', 'GB'] as const

/**
 * Tamaño legible con coma decimal y a lo sumo un decimal: "850 B", "12 KB", "1,5 MB", "5 MB".
 * Usa múltiplos de 1024, los mismos con los que se arma `maxBytes` (`5 * 1024 * 1024`).
 */
export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  let valor = bytes
  let unidad: (typeof UNIDADES)[number] = 'KB'
  for (const siguiente of UNIDADES) {
    valor /= 1024
    unidad = siguiente
    if (valor < 1024) break
  }
  const redondeado = Math.round(valor * 10) / 10
  return `${redondeado.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${unidad}`
}

/** Si el archivo se muestra como miniatura (imagen) en lugar de con un ícono. */
export function esImagen(tipo: string): boolean {
  return tipo.startsWith('image/')
}
