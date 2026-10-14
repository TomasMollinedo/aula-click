import type { Prisma } from '@/generated/prisma/client'
import { ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import type { TipoAdjunto, UltimoAdjunto } from './adjuntos.validation'

// Lo que otras features necesitan del comprobante adjunto de un pago (HU-24, T-95), dentro de su
// propia transacción (decisión T-39). No crea el cliente de Prisma: lo recibe (`prisma` o el `tx` de
// quien llama), y de Prisma sólo importa tipos.
//
// - `pagos` (T-96): `vincularAdjunto` dentro de la transacción del pago, así un pago que falla no
//   se queda con el adjunto.
// - quien muestre el adjunto de un pago (`adjuntos` y el detalle del pago, T-98): `ultimoAdjunto`.

export type { UltimoAdjunto }

export type ClienteAdjuntos = Prisma.TransactionClient

export const CODIGO_ADJUNTO_INVALIDO = 'ADJUNTO_INVALIDO'
export const MENSAJE_ADJUNTO_INVALIDO =
  'El comprobante adjunto no existe o ya se usó en otro pago: volvé a subirlo'

/**
 * Vincula el adjunto `adjuntoId` al pago `pagoId`. Tiene que existir, estar activo, no estar
 * vinculado a otro pago y haberlo subido el mismo usuario que registra el pago; si no, 400
 * `ADJUNTO_INVALIDO` en `comprobanteAdjuntoId` (el campo del body de `POST /pagos`).
 *
 * El control y la escritura son un solo `UPDATE` con todo en el `where`: si dos pagos quieren el
 * mismo adjunto a la vez, sólo uno lo consigue y el otro recibe el 400.
 */
export async function vincularAdjunto(
  tx: ClienteAdjuntos,
  { adjuntoId, pagoId, actor }: { adjuntoId: number; pagoId: number; actor: Actor },
): Promise<void> {
  const { count } = await tx.comprobanteAdjunto.updateMany({
    where: { id: adjuntoId, pagoId: null, estado: 'ACTIVO', createdById: actor.userId },
    data: { pagoId, updatedById: actor.userId },
  })
  if (count === 0) {
    throw new ValidationError(MENSAJE_ADJUNTO_INVALIDO, {
      code: CODIGO_ADJUNTO_INVALIDO,
      details: [{ path: ['comprobanteAdjuntoId'], message: MENSAJE_ADJUNTO_INVALIDO }],
    })
  }
}

/**
 * El último adjunto **activo** del pago (decisión T-136: el de `createdAt` más reciente, con `id`
 * de desempate), o `null` si no tiene: nunca tuvo, o se quitó. Reemplazar conserva los anteriores,
 * pero se muestra sólo este. Una consulta.
 */
export async function ultimoAdjunto(
  client: ClienteAdjuntos,
  pagoId: number,
): Promise<UltimoAdjunto | null> {
  const fila = await client.comprobanteAdjunto.findFirst({
    where: { pagoId, estado: 'ACTIVO' },
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
