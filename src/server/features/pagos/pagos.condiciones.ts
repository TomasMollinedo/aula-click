import type { ClienteOcurrencias } from '@/server/features/turnos/ocurrencias.condiciones'
import { SELECT_USUARIO_AUDITORIA, type UsuarioAuditoria } from '@/server/shared/auditoria'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'

// Lo que otras features necesitan del cobro sin importar `pagos.reglas.ts` ni el repository (de otra
// feature solo se importan `*.repository` y `*.condiciones`, lo hace cumplir ESLint, y un repository
// no importa otro). No crea el cliente de Prisma: lo recibe.
//
// - `cuentas` (T-53): los "próximos" de la cuenta usan el mismo tope de 8 semanas que `POST /pagos`,
//   así la UI nunca ofrece cobrar algo que la API rechaza con `FUERA_DE_RANGO`, y la deuda se suma
//   en centavos como el total de un pago.
// - `ocurrencias`: el detalle de un turno ofrece "Registrar pago" con ese mismo tope y, si ya está
//   pagado, muestra los datos de su pago (`leerPagoDeOcurrencia`).
// - `tablero` (T-61): el total cobrado en un período (`totalCobradoEntre`).
//
// El tope y la suma sólo se re-exportan: la implementación es la de `pagos.reglas.ts`.

export { DIAS_MAXIMOS_COBRO, limiteDeCobro, sumarImportes } from './pagos.reglas'

/**
 * Los datos del pago que muestra el detalle de una ocurrencia pagada. El importe no está acá: es el
 * `importeAplicado` de esa ocurrencia, que ya trae el motor (`Ocurrencia.pago`).
 */
export type PagoDeOcurrencia = {
  numeroComprobante: number
  fechaPago: string
  formaPago: { id: number; nombre: string }
  registradoPor: UsuarioAuditoria
  registradoEl: string
}

/** El pago `pagoId` (el de `Ocurrencia.pago.pagoId`), o `null` si no existe. Una consulta. */
export async function leerPagoDeOcurrencia(
  client: ClienteOcurrencias,
  pagoId: number,
): Promise<PagoDeOcurrencia | null> {
  const fila = await client.pago.findUnique({
    where: { id: pagoId },
    select: {
      numeroComprobante: true,
      fechaPago: true,
      createdAt: true,
      formaPago: { select: { id: true, nombre: true } },
      createdBy: { select: SELECT_USUARIO_AUDITORIA },
    },
  })
  if (!fila) return null
  return {
    numeroComprobante: fila.numeroComprobante,
    fechaPago: dateAFecha(fila.fechaPago),
    formaPago: fila.formaPago,
    registradoPor: fila.createdBy,
    registradoEl: fila.createdAt.toISOString(),
  }
}

/**
 * Total cobrado en `[desde, hasta]` (`YYYY-MM-DD`, extremos incluidos): la suma de `importeTotal`
 * de los pagos `VIGENTE` por su **fecha de pago** (`fechaPago`, no `createdAt`), en pesos; 0 si no
 * hay ninguno. Una consulta. Lo usa el tablero del gerente (T-61).
 */
export async function totalCobradoEntre(
  client: ClienteOcurrencias,
  { desde, hasta }: { desde: string; hasta: string },
): Promise<number> {
  const { _sum } = await client.pago.aggregate({
    where: {
      estado: 'VIGENTE',
      fechaPago: { gte: fechaADate(desde), lte: fechaADate(hasta) },
    },
    _sum: { importeTotal: true },
  })
  // La base suma en `Decimal`, que es exacto: no hay error de coma flotante que acumular.
  return _sum.importeTotal ? _sum.importeTotal.toNumber() : 0
}
