import { ConflictError, NotFoundError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import type { AdjuntosRepository } from './adjuntos.repository'
import type {
  AdjuntoDePago,
  AdjuntoSubido,
  ArchivoAGuardar,
  PagoDelAdjunto,
  TipoAdjunto,
} from './adjuntos.validation'

// Reglas del comprobante adjunto de un pago (HU-24, T-95). No conoce HTTP ni Prisma: lanza AppError
// o sus subclases. Tipo, firma y tamaño ya los validó la ruta (`archivoSchema`).

/** Largo máximo del nombre que se guarda: alcanza para mostrarlo y no deja crecer la fila. */
const LARGO_MAXIMO_NOMBRE = 200

/** El `File` del multipart, como lo guarda el repository. El nombre vacío pasa a "comprobante". */
export async function archivoAGuardar(archivo: File): Promise<ArchivoAGuardar> {
  const nombre = archivo.name.trim().slice(0, LARGO_MAXIMO_NOMBRE) || 'comprobante'
  return {
    bytes: new Uint8Array(await archivo.arrayBuffer()),
    // El tipo ya lo validó `archivoSchema` (sólo JPG, PNG o PDF llegan hasta acá).
    tipo: archivo.type as TipoAdjunto,
    nombre,
  }
}

export const MENSAJE_PAGO_NO_ENCONTRADO = 'Pago no encontrado'
export const MENSAJE_SIN_ADJUNTO = 'El pago no tiene comprobante adjunto'
export const CODIGO_PAGO_ANULADO = 'PAGO_ANULADO'
export const MENSAJE_PAGO_ANULADO =
  'El pago está anulado: su comprobante adjunto se conserva como estaba'
export const MENSAJE_EFECTIVO_SIN_ADJUNTO = 'Un pago en efectivo no lleva comprobante adjunto'
export const CODIGO_ADJUNTO_OBLIGATORIO = 'ADJUNTO_OBLIGATORIO'
export const MENSAJE_ADJUNTO_OBLIGATORIO =
  'Un pago por transferencia no puede quedar sin comprobante: reemplazalo'

/** Las formas de pago que llevan comprobante adjunto (HU-24): obligatorio u opcional. */
function llevaAdjunto(pago: PagoDelAdjunto): boolean {
  return pago.tipoFormaPago === 'TRANSFERENCIA' || pago.tipoFormaPago === 'DEBITO'
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real y
 * `firmarUrl` (la URL prefirmada que abre el archivo en otra pestaña, de `lib/storage`); los tests,
 * con falsos. Los recibe inyectados: el service no carga Prisma, MinIO ni `@/config/env`.
 */
export function crearAdjuntosService({
  repository,
  firmarUrl,
}: {
  repository: Pick<AdjuntosRepository, 'subir' | 'leerPago' | 'ultimo' | 'reemplazar' | 'quitar'>
  firmarUrl: (archivoKey: string, nombreArchivo: string) => Promise<string>
}) {
  /** El pago, si existe; si no, 404. */
  async function pagoExistente(pagoId: number): Promise<PagoDelAdjunto> {
    const pago = await repository.leerPago(pagoId)
    if (!pago) throw new NotFoundError(MENSAJE_PAGO_NO_ENCONTRADO)
    return pago
  }

  /** Un pago anulado conserva todo como estaba (HU-42): no se reemplaza ni se quita. */
  function exigirVigente(pago: PagoDelAdjunto): void {
    if (pago.estado === 'ANULADO') {
      throw new ConflictError(MENSAJE_PAGO_ANULADO, { code: CODIGO_PAGO_ANULADO })
    }
  }

  async function verUltimo(pagoId: number): Promise<AdjuntoDePago> {
    await pagoExistente(pagoId)
    const ultimo = await repository.ultimo(pagoId)
    if (!ultimo) throw new NotFoundError(MENSAJE_SIN_ADJUNTO)
    const { archivoKey, ...datos } = ultimo
    return { ...datos, url: await firmarUrl(archivoKey, ultimo.nombre) }
  }

  return {
    /**
     * Sube el comprobante **antes** de registrar el pago: queda sin pago hasta que `POST /pagos` lo
     * vincula (T-96). Uno que nunca se vincula queda guardado y sin mostrarse.
     */
    async subir(archivo: File, actor: Actor): Promise<AdjuntoSubido> {
      return repository.subir(await archivoAGuardar(archivo), actor)
    },

    /**
     * El último adjunto activo del pago, con una URL que lo abre en otra pestaña. 404 si el pago no
     * existe o no tiene adjunto (nunca tuvo, o se quitó). Un pago anulado lo sigue mostrando.
     */
    verUltimo,

    /**
     * Reemplaza el comprobante: adjunta uno nuevo y conserva los anteriores (fila y archivo). En un
     * pago con débito sin adjunto (nunca tuvo, o se quitó), lo adjunta. Chequeos, en orden: pago
     * inexistente (404), anulado (409 `PAGO_ANULADO`) y forma de pago sin adjunto, como efectivo
     * (409). Devuelve el adjunto que queda, como el `GET`.
     */
    async reemplazar(pagoId: number, archivo: File, actor: Actor): Promise<AdjuntoDePago> {
      const pago = await pagoExistente(pagoId)
      exigirVigente(pago)
      if (!llevaAdjunto(pago)) throw new ConflictError(MENSAJE_EFECTIVO_SIN_ADJUNTO)
      await repository.reemplazar(pagoId, await archivoAGuardar(archivo), actor)
      return verUltimo(pagoId)
    },

    /**
     * Quita el comprobante de un pago **con débito**, donde es opcional (HU-24): baja lógica, sin
     * borrar filas ni archivos. Chequeos, en orden: pago inexistente (404), anulado (409
     * `PAGO_ANULADO`), por transferencia (409 `ADJUNTO_OBLIGATORIO`: es obligatorio, se reemplaza)
     * y efectivo o sin adjunto activo (404).
     */
    async quitar(pagoId: number, actor: Actor): Promise<void> {
      const pago = await pagoExistente(pagoId)
      exigirVigente(pago)
      if (pago.tipoFormaPago === 'TRANSFERENCIA') {
        throw new ConflictError(MENSAJE_ADJUNTO_OBLIGATORIO, { code: CODIGO_ADJUNTO_OBLIGATORIO })
      }
      const quitados = pago.tipoFormaPago === 'DEBITO' ? await repository.quitar(pagoId, actor) : 0
      if (quitados === 0) throw new NotFoundError(MENSAJE_SIN_ADJUNTO)
    },
  }
}

export type AdjuntosService = ReturnType<typeof crearAdjuntosService>
