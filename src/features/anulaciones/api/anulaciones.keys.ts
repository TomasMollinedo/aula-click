// Todo cuelga de `all`: la previa de una anulación y las demás consultas de la feature.
export const anulacionesKeys = {
  all: ['anulaciones'] as const,
  previa: (pagoId: number) => [...anulacionesKeys.all, 'previa', pagoId] as const,
}
