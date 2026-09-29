// Cómo se ve una agenda: como calendario semanal o como lista (HU-19). Se recuerda la última
// elección de cada usuario en el navegador. Funciones puras (el hook está en `use-modo-agenda`).

export type ModoAgenda = 'calendario' | 'lista'

/** La lista es lo que había antes del calendario: quien nunca eligió sigue viendo lo de siempre. */
export const MODO_POR_DEFECTO: ModoAgenda = 'lista'

/** Clave de `localStorage`: incluye el id del usuario para que dos personas en un mismo navegador no se pisen. */
export function claveModoAgenda(usuarioId: string): string {
  return `agenda:modo:${usuarioId}`
}

/** Lo guardado puede ser cualquier cosa (o nada): un valor desconocido es el modo por defecto. */
export function parsearModo(valor: string | null | undefined): ModoAgenda {
  return valor === 'calendario' || valor === 'lista' ? valor : MODO_POR_DEFECTO
}
