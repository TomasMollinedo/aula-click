// `details` de un error sobre una lista del body (por ejemplo `materiaIds` o `bloqueIds`), con la
// misma forma que las issues de Zod: así la UI marca cada elemento igual que en un 400
// (docs/contrato-api.md → Errores).

/** Un elemento de `details`: `path` y `message` como en Zod, más datos propios del error. */
export type DetallePorPosicion = { path: (string | number)[]; message: string } & Record<
  string,
  unknown
>

/**
 * Un detalle por cada id de `ids` que cumple `condicion`, con `path` = `[campo, posición]`.
 * `extra` agrega datos propios del error (por ejemplo la cantidad de turnos vigentes). `[]` si
 * ninguno la cumple.
 */
export function detallesPorPosicion(
  campo: string,
  ids: number[],
  condicion: (id: number) => boolean,
  mensaje: (id: number) => string,
  extra: (id: number) => Record<string, unknown> = () => ({}),
): DetallePorPosicion[] {
  return ids.flatMap((id, i) =>
    condicion(id) ? [{ path: [campo, i], message: mensaje(id), ...extra(id) }] : [],
  )
}
