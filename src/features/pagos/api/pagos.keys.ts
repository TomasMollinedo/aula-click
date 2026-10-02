// Todo cuelga de `all`: registrar un pago invalida `all`.
export const pagosKeys = {
  all: ['pagos'] as const,
  comprobantes: () => [...pagosKeys.all, 'comprobante'] as const,
  comprobante: (pagoId: number) => [...pagosKeys.comprobantes(), pagoId] as const,
}
