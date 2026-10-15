import { AppError } from '@/server/errors'
import type { ClienteOcurrencias } from '@/server/features/turnos/ocurrencias.condiciones'
import { SELECT_USUARIO_AUDITORIA, type UsuarioAuditoria } from '@/server/shared/auditoria'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'
import { sumarImportes } from './pagos.reglas'
import type { CodigoFormaPago } from './pagos.validation'

// Lo que otras features necesitan del cobro sin importar `pagos.reglas.ts` ni el repository (de otra
// feature solo se importan `*.repository` y `*.condiciones`, lo hace cumplir ESLint, y un repository
// no importa otro). No crea el cliente de Prisma: lo recibe.
//
// - `cuentas` (T-53): los "próximos" de la cuenta usan el mismo tope de 8 semanas que `POST /pagos`,
//   así la UI nunca ofrece cobrar algo que la API rechaza con `FUERA_DE_RANGO`, y la deuda se suma
//   en centavos como el total de un pago.
// - `ocurrencias`: el detalle de un turno ofrece "Registrar pago" con ese mismo tope y, si ya está
//   pagado, muestra los datos de su pago (`leerPagoDeOcurrencia`).
// - `tablero` (T-61): el total cobrado en un período (`totalCobradoEntre`) y, por forma de pago,
//   para los pagos realizados (T-98) y el tablero (T-112): `totalCobradoPorForma`.
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

/** Un período `YYYY-MM-DD`, con los dos extremos incluidos. */
type Periodo = { desde: string; hasta: string }

/**
 * Lo cobrado en el período: los pagos `VIGENTE` (un anulado no cuenta, HU-42) por su **fecha de
 * pago** (`fechaPago`, no `createdAt`). El mismo filtro para el total y para el total por forma.
 */
function cobradosEntre({ desde, hasta }: Periodo) {
  return {
    estado: 'VIGENTE' as const,
    fechaPago: { gte: fechaADate(desde), lte: fechaADate(hasta) },
  }
}

/**
 * Total cobrado en `[desde, hasta]` (`YYYY-MM-DD`, extremos incluidos): la suma de `importeTotal`
 * de los pagos `VIGENTE` por su fecha de pago (`cobradosEntre`), en pesos; 0 si no hay ninguno.
 * Una consulta. Lo usa el tablero del gerente (T-61).
 */
export async function totalCobradoEntre(
  client: ClienteOcurrencias,
  periodo: Periodo,
): Promise<number> {
  const { _sum } = await client.pago.aggregate({
    where: cobradosEntre(periodo),
    _sum: { importeTotal: true },
  })
  // La base suma en `Decimal`, que es exacto: no hay error de coma flotante que acumular.
  return _sum.importeTotal ? _sum.importeTotal.toNumber() : 0
}

/** Lo cobrado por cada forma de pago, en pesos (0 si no hubo ninguno de esa forma). */
export type TotalesPorForma = Record<CodigoFormaPago, number>

const MENSAJE_FORMA_SIN_CODIGO = 'Hay pagos con una forma de pago sin código: corré `pnpm db:seed`'

/**
 * Total cobrado en `[desde, hasta]` por forma de pago (HU-36, HU-41): `{ EFECTIVO, TRANSFERENCIA,
 * DEBITO }`, con el mismo filtro que `totalCobradoEntre` (sólo pagos `VIGENTE`, por fecha de pago),
 * así la suma de las tres es ese total. Dos consultas: la suma por `formaPagoId` en la base y el
 * código de esas formas (la forma se decide por su código, nunca por el nombre). Una forma de pago
 * con pagos y sin código → 500 (falta el seed, decisión T-134).
 */
export async function totalCobradoPorForma(
  client: ClienteOcurrencias,
  periodo: Periodo,
): Promise<TotalesPorForma> {
  const totales: TotalesPorForma = { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0 }
  const grupos = await client.pago.groupBy({
    by: ['formaPagoId'],
    where: cobradosEntre(periodo),
    _sum: { importeTotal: true },
  })
  if (grupos.length === 0) return totales

  const formas = await client.formaPago.findMany({
    where: { id: { in: grupos.map((g) => g.formaPagoId) } },
    select: { id: true, tipoFormaPago: true },
  })
  const codigoDe = new Map(formas.map((f) => [f.id, f.tipoFormaPago]))
  for (const grupo of grupos) {
    const codigo = codigoDe.get(grupo.formaPagoId)
    if (!codigo) throw new AppError(MENSAJE_FORMA_SIN_CODIGO, 500)
    const importe = grupo._sum.importeTotal ? grupo._sum.importeTotal.toNumber() : 0
    totales[codigo] = sumarImportes([totales[codigo], importe])
  }
  return totales
}
