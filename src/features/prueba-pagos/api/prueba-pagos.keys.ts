// TEMPORAL (T-52): ver `prueba-pagos.api.ts`.
export const pruebaPagosKeys = {
  all: ['prueba-pagos'] as const,
  precios: () => [...pruebaPagosKeys.all, 'precios'] as const,
}
