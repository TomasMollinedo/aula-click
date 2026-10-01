import { prisma } from '@/lib/prisma'
import type { MotivoCancelacion } from '@/generated/prisma/client'
import {
  leerPrioridades,
  type PrioridadDeTurno,
} from '@/server/features/examenes/examenes.condiciones'
import {
  leerOcurrencias,
  type FiltroOcurrencias,
  type Ocurrencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import { armarAuditoria, SELECT_USUARIO_AUDITORIA, type Auditoria } from '@/server/shared/auditoria'
import { dateAFecha, type Reloj } from '@/server/shared/fechas'

// Único lugar de la feature que usa Prisma. `ocurrencias` no tiene tabla propia: combina el motor
// de `turnos` (T-30, la única expansión) y `leerPrioridades` de `examenes` (T-31). Un repository no
// puede importar otro repository (ESLint): el DNI del alumno, observaciones, temas y la auditoría
// (lo único del turno que no trae `leerOcurrencias`, que no expone `busqueda` ni estos campos) se
// leen acá directo, igual que `FinalizacionRecurrencia`, que tampoco expone ninguna otra feature.

export type { Ocurrencia, PrioridadDeTurno }

export type Finalizacion = {
  fechaDesde: string
  motivo: MotivoCancelacion
  detalle: string | null
  createdBy: { id: string; nombre: string; apellido: string } | null
  createdAt: string
}

/** Lo del turno que `leerOcurrencias` no trae: DNI del alumno, observaciones, temas y auditoría. */
export type DatosAdicionalesTurno = {
  alumnoDni: string
  observaciones: string | null
  temas: string | null
} & Auditoria

export const ocurrenciasRepository = {
  /**
   * La ocurrencia `(turnoId, fecha)` calculada por el motor, o `null` si el turno no existe o esa
   * fecha no es una de sus ocurrencias (el mismo `leerOcurrencias` de T-30 resuelve las dos cosas:
   * sin filas, ninguna de las dos existe).
   */
  async buscarOcurrencia(
    turnoId: number,
    fecha: string,
    reloj?: Reloj,
  ): Promise<Ocurrencia | null> {
    const ocurrencias = await leerOcurrencias(
      prisma,
      { desde: fecha, hasta: fecha, turnoIds: [turnoId] },
      reloj,
    )
    return ocurrencias[0] ?? null
  },

  /** DNI del alumno, observaciones, temas y auditoría del turno: lo que no trae `leerOcurrencias`. */
  async buscarDatosAdicionales(turnoId: number): Promise<DatosAdicionalesTurno | null> {
    const fila = await prisma.turno.findUnique({
      where: { id: turnoId },
      select: {
        observaciones: true,
        temas: true,
        alumno: { select: { dni: true } },
        createdAt: true,
        updatedAt: true,
        createdBy: { select: SELECT_USUARIO_AUDITORIA },
        updatedBy: { select: SELECT_USUARIO_AUDITORIA },
      },
    })
    if (!fila) return null
    return {
      alumnoDni: fila.alumno.dni,
      observaciones: fila.observaciones,
      temas: fila.temas,
      ...armarAuditoria(fila),
    }
  },

  /** La `FinalizacionRecurrencia` del turno, si tiene una (a lo sumo una por turno). */
  async buscarFinalizacion(turnoId: number): Promise<Finalizacion | null> {
    const fila = await prisma.finalizacionRecurrencia.findUnique({
      where: { turnoId },
      select: {
        fechaDesde: true,
        motivo: true,
        detalle: true,
        createdAt: true,
        createdBy: { select: SELECT_USUARIO_AUDITORIA },
      },
    })
    if (!fila) return null
    return {
      fechaDesde: dateAFecha(fila.fechaDesde),
      motivo: fila.motivo,
      detalle: fila.detalle,
      createdBy: fila.createdBy,
      createdAt: fila.createdAt.toISOString(),
    }
  },

  /** Ocurrencias del alumno en `[desde, hasta]` (motor de T-30), incluidas las canceladas. */
  async leerOcurrenciasDelAlumno(filtro: FiltroOcurrencias, reloj?: Reloj): Promise<Ocurrencia[]> {
    return leerOcurrencias(prisma, filtro, reloj)
  },

  /**
   * `{ id, nombre, apellido }` de un usuario por su id, o `null` si no existe. Lo usa el detalle
   * para resolver `Ocurrencia.cancelacion.createdById` (el motor de T-30 sólo trae el id, no el
   * usuario completo: `alumno`/`profesor` sí lo resuelven, `cancelacion` no).
   */
  async resolverUsuarioAuditoria(
    id: string,
  ): Promise<{ id: string; nombre: string; apellido: string } | null> {
    return prisma.usuario.findUnique({ where: { id }, select: SELECT_USUARIO_AUDITORIA })
  },

  /** Prioridad (y el examen que la determina) de un lote de ocurrencias, en una sola consulta. */
  async leerPrioridades(
    items: { alumnoId: number; materiaId: number; fecha: string }[],
  ): Promise<Map<string, PrioridadDeTurno>> {
    return leerPrioridades(prisma, items)
  },
}

export type OcurrenciasRepository = typeof ocurrenciasRepository
