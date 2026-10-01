// Todo cuelga de `all`: finalizar (y lo que invalide finalizaciones) vuelve a pedir las previas.
export const finalizacionesKeys = {
  all: ['finalizaciones'] as const,
  previa: (turnoId: number, fechaDesde: string) =>
    [...finalizacionesKeys.all, 'previa', turnoId, fechaDesde] as const,
}
