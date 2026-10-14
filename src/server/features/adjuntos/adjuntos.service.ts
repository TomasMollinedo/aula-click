import type { Actor } from '@/server/shared/actor'
import type { AdjuntosRepository } from './adjuntos.repository'
import type { AdjuntoSubido, ArchivoAGuardar, TipoAdjunto } from './adjuntos.validation'

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

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real;
 * los tests, con uno falso. Lo importa solo como tipo: el service no carga Prisma ni `@/config/env`.
 */
export function crearAdjuntosService({
  repository,
}: {
  repository: Pick<AdjuntosRepository, 'subir'>
}) {
  return {
    /**
     * Sube el comprobante **antes** de registrar el pago: queda sin pago hasta que `POST /pagos` lo
     * vincula (T-96). Uno que nunca se vincula queda guardado y sin mostrarse.
     */
    async subir(archivo: File, actor: Actor): Promise<AdjuntoSubido> {
      return repository.subir(await archivoAGuardar(archivo), actor)
    },
  }
}

export type AdjuntosService = ReturnType<typeof crearAdjuntosService>
