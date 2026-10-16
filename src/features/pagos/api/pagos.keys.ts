// Todo cuelga de `all`: registrar o anular un pago invalida `all`. El adjunto cuelga del detalle de
// su pago: reemplazarlo o quitarlo invalida ese detalle, y con él su adjunto.
export const pagosKeys = {
  all: ['pagos'] as const,
  detalle: (pagoId: number) => [...pagosKeys.all, 'detalle', pagoId] as const,
  adjunto: (pagoId: number) => [...pagosKeys.detalle(pagoId), 'adjunto'] as const,
  /** Los pagos del alumno de la sesión, por página (portal, HU-37). */
  misPagos: (page: number) => [...pagosKeys.all, 'misPagos', page] as const,
}
