import type { ClienteOcurrencias } from '@/server/features/turnos/ocurrencias.condiciones'
import { SELECT_USUARIO_AUDITORIA, type UsuarioAuditoria } from '@/server/shared/auditoria'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'
import { errorFormasDePago, sumarImportes } from './pagos.reglas'
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
// - `cuentas` (T-101): la cuenta del portal agrupada por materia con el mismo agrupado que el
//   comprobante (`agruparPorMateria`).
// - `anulaciones` (T-104): el pago a anular con sus turnos (`leerPagoParaAnular`) y los otros pagos
//   vigentes de la misma transferencia (`pagosConMismaTransferencia`), para la confirmación y sus
//   avisos.
//
// El tope, la suma y el agrupado sólo se re-exportan: la implementación es la de `pagos.reglas.ts`.

export {
  agruparPorMateria,
  DIAS_MAXIMOS_COBRO,
  limiteDeCobro,
  sumarImportes,
  type GrupoDeMateria,
} from './pagos.reglas'

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
    if (!codigo) throw errorFormasDePago()
    const importe = grupo._sum.importeTotal ? grupo._sum.importeTotal.toNumber() : 0
    totales[codigo] = sumarImportes([totales[codigo], importe])
  }
  return totales
}

/** Una ocurrencia de un pago a anular: la fecha, la materia y lo que se cobró por ella. */
export type TurnoDePagoAAnular = {
  turnoId: number
  fecha: string
  materia: { id: number; nombre: string }
  /** El importe cobrado (`importeAplicado`), en pesos: no cambia si después cambia el precio. */
  importe: number
}

/**
 * Lo que la anulación (HU-42, T-104) necesita de un pago: el estado (un anulado no se anula de
 * nuevo), el alumno, el número y el total para la confirmación, los turnos (fecha, materia e
 * importe cobrado) para los avisos de deuda y de precio, y la operación y el banco de una
 * transferencia para el aviso de transferencia compartida (`null` si es de otra forma).
 */
export type PagoParaAnular = {
  id: number
  numeroComprobante: number
  estado: 'VIGENTE' | 'ANULADO'
  alumno: { id: number; nombre: string; apellido: string }
  total: number
  turnos: TurnoDePagoAAnular[]
  transferencia: { operacion: string; banco: string } | null
}

/**
 * El pago `pagoId` para anularlo, o `null` si no existe. Una consulta. Los turnos van ordenados
 * por fecha y `turnoId`. Recibe `prisma` o el `tx` de la anulación (con el lock del alumno).
 */
export async function leerPagoParaAnular(
  client: ClienteOcurrencias,
  pagoId: number,
): Promise<PagoParaAnular | null> {
  const fila = await client.pago.findUnique({
    where: { id: pagoId },
    select: {
      id: true,
      numeroComprobante: true,
      estado: true,
      importeTotal: true,
      transferenciaOperacion: true,
      transferenciaBanco: true,
      alumno: { select: { id: true, nombre: true, apellido: true } },
      turnos: {
        select: {
          turnoId: true,
          fechaOcurrencia: true,
          importeAplicado: true,
          turno: { select: { materia: { select: { id: true, nombre: true } } } },
        },
      },
    },
  })
  if (!fila) return null
  const { transferenciaOperacion: operacion, transferenciaBanco: banco } = fila
  return {
    id: fila.id,
    numeroComprobante: fila.numeroComprobante,
    estado: fila.estado,
    alumno: fila.alumno,
    total: fila.importeTotal.toNumber(),
    turnos: fila.turnos
      .map((pt) => ({
        turnoId: pt.turnoId,
        fecha: dateAFecha(pt.fechaOcurrencia),
        materia: pt.turno.materia,
        importe: pt.importeAplicado.toNumber(),
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.turnoId - b.turnoId),
    transferencia: operacion !== null && banco !== null ? { operacion, banco } : null,
  }
}

/** Otro pago de la misma transferencia: su número y su alumno. */
export type PagoDeLaMismaTransferencia = {
  id: number
  numeroComprobante: number
  alumno: { id: number; nombre: string; apellido: string }
}

/**
 * Los otros pagos **vigentes** con la misma operación y el mismo banco (una transferencia puede
 * cubrir a varios alumnos, HU-23), sin `excluirPagoId` (el que se está por anular), por número de
 * comprobante. Es el aviso de HU-42: anular uno no anula los otros. Compara el texto tal como se
 * guardó (recortado); usa el índice `(transferenciaOperacion, transferenciaBanco)`. Una consulta.
 */
export async function pagosConMismaTransferencia(
  client: ClienteOcurrencias,
  { operacion, banco, excluirPagoId }: { operacion: string; banco: string; excluirPagoId: number },
): Promise<PagoDeLaMismaTransferencia[]> {
  return client.pago.findMany({
    where: {
      transferenciaOperacion: operacion,
      transferenciaBanco: banco,
      estado: 'VIGENTE',
      id: { not: excluirPagoId },
    },
    select: {
      id: true,
      numeroComprobante: true,
      alumno: { select: { id: true, nombre: true, apellido: true } },
    },
    orderBy: { numeroComprobante: 'asc' },
  })
}
