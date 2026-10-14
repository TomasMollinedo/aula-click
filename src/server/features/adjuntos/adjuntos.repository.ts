import { prisma } from '@/lib/prisma'
import { putObject } from '@/lib/storage'
import type { Actor } from '@/server/shared/actor'
import { claveDeArchivo } from '@/server/shared/archivos'
import { ultimoAdjunto } from './adjuntos.condiciones'
import {
  TIPOS_ADJUNTO,
  type AdjuntoSubido,
  type ArchivoAGuardar,
  type PagoDelAdjunto,
  type TipoAdjunto,
  type UltimoAdjunto,
} from './adjuntos.validation'

// Único lugar de la feature que crea consultas con Prisma y que sube a MinIO (por `lib/storage`).
// Completa la auditoría con el Actor y devuelve DTOs. Sin reglas de negocio. En la base se guarda la
// clave del objeto, nunca la URL (arquitectura-backend.md → Archivos).

/**
 * Sube el archivo a `adjuntos/<uuid>.<ext>` y crea su `ComprobanteAdjunto` (activo), sin pago o ya
 * vinculado a `pagoId`. Sube primero: si la fila no se pudiera crear, el archivo queda guardado y
 * sin mostrarse, como uno que nunca se vinculó.
 */
async function guardar(
  archivo: ArchivoAGuardar,
  actor: Actor,
  pagoId: number | null,
): Promise<AdjuntoSubido> {
  const archivoKey = claveDeArchivo('adjuntos', TIPOS_ADJUNTO[archivo.tipo])
  await putObject(archivoKey, archivo.bytes, archivo.tipo)
  const fila = await prisma.comprobanteAdjunto.create({
    data: {
      pagoId,
      archivoKey,
      mimeType: archivo.tipo,
      nombreArchivo: archivo.nombre,
      bytes: archivo.bytes.byteLength,
      createdById: actor.userId,
      updatedById: actor.userId,
    },
    select: { id: true, nombreArchivo: true, mimeType: true, bytes: true },
  })
  return {
    id: fila.id,
    nombre: fila.nombreArchivo,
    tipo: fila.mimeType as TipoAdjunto,
    bytes: fila.bytes,
  }
}

export const adjuntosRepository = {
  /** Sube un adjunto todavía sin pago: se vincula al registrar el pago (`vincularAdjunto`). */
  async subir(archivo: ArchivoAGuardar, actor: Actor): Promise<AdjuntoSubido> {
    return guardar(archivo, actor, null)
  },

  /** Estado del pago y tipo de su forma de pago, o `null` si el pago no existe. */
  async leerPago(pagoId: number): Promise<PagoDelAdjunto | null> {
    const pago = await prisma.pago.findUnique({
      where: { id: pagoId },
      select: { estado: true, formaPago: { select: { tipoFormaPago: true } } },
    })
    return pago && { estado: pago.estado, tipoFormaPago: pago.formaPago.tipoFormaPago }
  },

  /** El último adjunto activo del pago (`ultimoAdjunto`, una sola implementación), o `null`. */
  async ultimo(pagoId: number): Promise<UltimoAdjunto | null> {
    return ultimoAdjunto(prisma, pagoId)
  },

  /**
   * Adjunta un archivo nuevo al pago. Los anteriores **no se tocan**, ni la fila ni el archivo: se
   * muestra sólo el último activo (decisión T-136).
   */
  async reemplazar(pagoId: number, archivo: ArchivoAGuardar, actor: Actor): Promise<void> {
    await guardar(archivo, actor, pagoId)
  },

  /**
   * Quita el comprobante del pago: baja lógica de **todos** sus adjuntos activos (`INACTIVO` con
   * quién y cuándo), así no "reaparece" uno anterior que se había reemplazado. No borra filas ni
   * archivos. Devuelve cuántos quitó (0 si no tenía).
   */
  async quitar(pagoId: number, actor: Actor): Promise<number> {
    const { count } = await prisma.comprobanteAdjunto.updateMany({
      where: { pagoId, estado: 'ACTIVO' },
      data: { estado: 'INACTIVO', updatedById: actor.userId },
    })
    return count
  },
}

export type AdjuntosRepository = typeof adjuntosRepository
