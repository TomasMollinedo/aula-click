import { prisma } from '@/lib/prisma'
import {
  ultimoAdjuntoDeLiquidacion,
  type UltimoAdjunto,
} from '@/server/features/adjuntos/adjuntos.condiciones'
import {
  liquidacionDe,
  liquidacionesDelMes,
  type Liquidacion,
  type ProfesorRef,
} from './liquidaciones.condiciones'

// Único lugar de la feature que usa Prisma. Sin reglas de negocio: el cálculo es del motor
// (`liquidaciones.condiciones.ts`, T-121) y el adjunto, de `adjuntos.condiciones` (T-123).

export const liquidacionesRepository = {
  /** Una liquidación por profesor con movimientos en `mes` (aunque esté inactivo), por apellido y nombre. */
  async delMes({ mes, hoy }: { mes: string; hoy: string }): Promise<Liquidacion[]> {
    return liquidacionesDelMes(prisma, { mes, hoy })
  },

  /** La liquidación de `profesorId` en `mes` (cerrada o abierta), o `null` sin movimientos. */
  async deProfesor(datos: {
    profesorId: number
    mes: string
    hoy: string
  }): Promise<Liquidacion | null> {
    return liquidacionDe(prisma, datos)
  },

  /** El profesor con su nombre, sin mirar su estado; `null` si no existe. */
  async leerProfesor(id: number): Promise<ProfesorRef | null> {
    const fila = await prisma.profesor.findUnique({
      where: { id },
      select: { id: true, usuario: { select: { nombre: true, apellido: true } } },
    })
    return fila && { id: fila.id, nombre: fila.usuario.nombre, apellido: fila.usuario.apellido }
  },

  /** El comprobante de la transferencia de una liquidación cerrada, o `null`. */
  async ultimoAdjunto(liquidacionId: number): Promise<UltimoAdjunto | null> {
    return ultimoAdjuntoDeLiquidacion(prisma, liquidacionId)
  },
}

export type LiquidacionesRepository = typeof liquidacionesRepository
