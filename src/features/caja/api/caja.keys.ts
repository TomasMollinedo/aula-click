import type { ListarCajaParams } from '../caja.types'

// Las query keys de la caja. Es sólo lectura (no tiene mutaciones propias): `all` existe para que
// lo que mueve dinero en otra feature pueda invalidar la caja completa si alguna vez hace falta.
export const cajaKeys = {
  /** Prefijo de todo: invalidarlo refresca cualquier día. */
  all: ['caja'] as const,
  delDia: ({ fecha, tipo, formaPago }: ListarCajaParams) =>
    [
      ...cajaKeys.all,
      'del-dia',
      { fecha: fecha ?? null, tipo: tipo ?? null, formaPago: formaPago ?? null },
    ] as const,
}
