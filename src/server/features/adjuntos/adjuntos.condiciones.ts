import type { Prisma } from '@/generated/prisma/client'
import { ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import type { TipoAdjunto, UltimoAdjunto } from './adjuntos.validation'

// Lo que otras features necesitan del comprobante adjunto de un pago (HU-24, T-95) o de la
// transferencia a un profesor (HU-44, T-123), dentro de su propia transacción (decisión T-39). No
// crea el cliente de Prisma: lo recibe (`prisma` o el `tx` de quien llama), y de Prisma sólo importa
// tipos.
//
// - `pagos` (T-96): `vincularAdjunto` dentro de la transacción del pago, así un pago que falla no
//   se queda con el adjunto.
// - quien muestre el adjunto de un pago (`adjuntos` y el detalle del pago, T-98): `ultimoAdjunto`.
// - `liquidaciones` (T-124): `vincularAdjuntoALiquidacion` dentro de la transacción del pago de la
//   liquidación, y `ultimoAdjuntoDeLiquidacion` para su detalle (y `adjuntos`, para el `GET`).
//
// Un adjunto es de un pago **o** de una liquidación (decisiones T-158 y T-165): cada vínculo exige
// que no tenga ninguno de los dos y que lo vincule quien lo subió.

export type { UltimoAdjunto }

export type ClienteAdjuntos = Prisma.TransactionClient

export const CODIGO_ADJUNTO_INVALIDO = 'ADJUNTO_INVALIDO'
export const MENSAJE_ADJUNTO_INVALIDO =
  'El comprobante adjunto no existe o ya se usó en otro pago: volvé a subirlo'
export const MENSAJE_ADJUNTO_INVALIDO_LIQUIDACION =
  'El comprobante de la transferencia no existe o ya se usó: volvé a subirlo'

/** 400 `ADJUNTO_INVALIDO` en `comprobanteAdjuntoId` (el campo del body de quien vincula). */
function errorAdjuntoInvalido(mensaje: string): ValidationError {
  return new ValidationError(mensaje, {
    code: CODIGO_ADJUNTO_INVALIDO,
    details: [{ path: ['comprobanteAdjuntoId'], message: mensaje }],
  })
}

/**
 * Vincula el adjunto `adjuntoId` al pago `pagoId`. Tiene que existir, estar activo, no estar
 * vinculado a otro pago ni a una liquidación y haberlo subido el mismo usuario que registra el pago;
 * si no, 400 `ADJUNTO_INVALIDO` en `comprobanteAdjuntoId` (el campo del body de `POST /pagos`).
 *
 * El control y la escritura son un solo `UPDATE` con todo en el `where`: si dos pagos quieren el
 * mismo adjunto a la vez, sólo uno lo consigue y el otro recibe el 400.
 */
export async function vincularAdjunto(
  tx: ClienteAdjuntos,
  { adjuntoId, pagoId, actor }: { adjuntoId: number; pagoId: number; actor: Actor },
): Promise<void> {
  const { count } = await tx.comprobanteAdjunto.updateMany({
    where: {
      id: adjuntoId,
      pagoId: null,
      liquidacionId: null,
      estado: 'ACTIVO',
      createdById: actor.userId,
    },
    data: { pagoId, updatedById: actor.userId },
  })
  if (count === 0) throw errorAdjuntoInvalido(MENSAJE_ADJUNTO_INVALIDO)
}

/**
 * Vincula el adjunto `adjuntoId` a la liquidación `liquidacionId` (el comprobante de la
 * transferencia a un profesor, HU-44). Las mismas comprobaciones que `vincularAdjunto`: existe, está
 * activo, no está vinculado a un pago ni a otra liquidación y lo subió el mismo usuario que registra
 * la transferencia; si no, 400 `ADJUNTO_INVALIDO` en `comprobanteAdjuntoId` con
 * `MENSAJE_ADJUNTO_INVALIDO_LIQUIDACION`. Un solo `UPDATE` condicional, como el de un pago.
 */
export async function vincularAdjuntoALiquidacion(
  tx: ClienteAdjuntos,
  { adjuntoId, liquidacionId, actor }: { adjuntoId: number; liquidacionId: number; actor: Actor },
): Promise<void> {
  const { count } = await tx.comprobanteAdjunto.updateMany({
    where: {
      id: adjuntoId,
      pagoId: null,
      liquidacionId: null,
      estado: 'ACTIVO',
      createdById: actor.userId,
    },
    data: { liquidacionId, updatedById: actor.userId },
  })
  if (count === 0) throw errorAdjuntoInvalido(MENSAJE_ADJUNTO_INVALIDO_LIQUIDACION)
}

/**
 * El último adjunto **activo** que cumple `where` (decisión T-136: el de `createdAt` más reciente,
 * con `id` de desempate), o `null`. Una consulta.
 */
async function ultimoActivo(
  client: ClienteAdjuntos,
  where: { pagoId: number } | { liquidacionId: number },
): Promise<UltimoAdjunto | null> {
  const fila = await client.comprobanteAdjunto.findFirst({
    where: { ...where, estado: 'ACTIVO' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      archivoKey: true,
      nombreArchivo: true,
      mimeType: true,
      bytes: true,
      createdAt: true,
      createdBy: { select: SELECT_USUARIO_AUDITORIA },
    },
  })
  return (
    fila && {
      id: fila.id,
      archivoKey: fila.archivoKey,
      nombre: fila.nombreArchivo,
      tipo: fila.mimeType as TipoAdjunto,
      bytes: fila.bytes,
      adjuntadoPor: fila.createdBy,
      adjuntadoEl: fila.createdAt.toISOString(),
    }
  )
}

/**
 * El último adjunto **activo** del pago, o `null` si no tiene: nunca tuvo, o se quitó. Reemplazar
 * conserva los anteriores, pero se muestra sólo este.
 */
export async function ultimoAdjunto(
  client: ClienteAdjuntos,
  pagoId: number,
): Promise<UltimoAdjunto | null> {
  return ultimoActivo(client, { pagoId })
}

/**
 * El último adjunto **activo** de la liquidación (el comprobante de la transferencia), o `null` si
 * no tiene: es opcional (HU-44), y una liquidación `DESCONTADA` no tiene transferencia.
 */
export async function ultimoAdjuntoDeLiquidacion(
  client: ClienteAdjuntos,
  liquidacionId: number,
): Promise<UltimoAdjunto | null> {
  return ultimoActivo(client, { liquidacionId })
}
