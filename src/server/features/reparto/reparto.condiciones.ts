import type { Prisma } from '@/generated/prisma/client'
import { MENSAJE_SIN_PORCENTAJE } from './reparto.reglas'

// Lo que otras features necesitan del reparto sin importar `reparto.reglas.ts` ni el repository (de
// otra feature solo se importan `*.repository` y `*.condiciones`, lo hace cumplir ESLint). No crea
// el cliente de Prisma: lo recibe.
//
// - `pagos` (T-122): `porcentajeVigente(tx)` dentro de la transacción del cobro, para guardarlo en
//   cada `PagoTurno`.
// - `liquidaciones` (T-121): `repartoDeTurno` y `sumarReparto` para la parte del profesor de cada
//   turno devengado y los totales de la liquidación.
// - `caja` (T-127) y `tablero` (T-128): `repartoDeTurno` y `sumarReparto` para el reparto de los
//   cobros del día y del período.
//
// La regla sólo se re-exporta: la implementación es la de `reparto.reglas.ts`.

export { repartoDeTurno, sumarReparto, type Reparto, type TotalReparto } from './reparto.reglas'

/**
 * Orden del historial de `PorcentajeCentro`: el más reciente primero, con `id` como desempate
 * (decisión T-155). El vigente es la primera fila en este orden.
 */
export const ORDEN_VIGENTE: Prisma.PorcentajeCentroOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
]

/**
 * El porcentaje del centro vigente (15 = 15 %): el último `PorcentajeCentro` en `ORDEN_VIGENTE`.
 * Sin ninguna fila es un error de configuración (decisión T-161): lanza `Error`, que el
 * `errorHandler` registra y responde 500. Nunca un valor por defecto.
 */
export async function porcentajeVigente(client: Prisma.TransactionClient): Promise<number> {
  const fila = await client.porcentajeCentro.findFirst({
    orderBy: ORDEN_VIGENTE,
    select: { porcentaje: true },
  })
  if (!fila) throw new Error(MENSAJE_SIN_PORCENTAJE)
  return fila.porcentaje.toNumber()
}
