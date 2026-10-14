import { prisma } from '@/lib/prisma'
import type { MotivoCancelacion } from '@/generated/prisma/client'
import {
  leerPrioridades,
  type PrioridadDeTurno,
} from '@/server/features/examenes/examenes.condiciones'
import {
  leerPagoDeOcurrencia,
  type PagoDeOcurrencia,
} from '@/server/features/pagos/pagos.condiciones'
import {
  leerFilasDeLaSerie,
  leerOcurrencias,
  type FilaDeSerie,
  type FiltroOcurrencias,
  type Ocurrencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Role } from '@/server/shared/actor'
import {
  armarAuditoria,
  SELECT_USUARIO_AUDITORIA,
  type Auditoria,
  type UsuarioAuditoria,
} from '@/server/shared/auditoria'
import { dateAFecha, type Reloj } from '@/server/shared/fechas'

// Único lugar de la feature que usa Prisma. `ocurrencias` no tiene tabla propia: combina el motor
// de `turnos` (T-30, la única expansión), `leerPrioridades` de `examenes` (T-31) y
// `leerPagoDeOcurrencia` de `pagos`. Un repository no puede importar otro repository (ESLint): el
// DNI del alumno, observaciones, temas, la auditoría y el precio vigente de la materia (lo del turno
// que no trae `leerOcurrencias`, que no expone `busqueda` ni estos campos) se leen acá directo,
// igual que `FinalizacionRecurrencia`, que tampoco expone ninguna otra feature.

export type { FilaDeSerie, Ocurrencia, PagoDeOcurrencia, PrioridadDeTurno }

export type Finalizacion = {
  fechaDesde: string
  motivo: MotivoCancelacion
  detalle: string | null
  createdBy: { id: string; nombre: string; apellido: string } | null
  createdAt: string
}

/** Usuario de auditoría con su rol (`createdBy` del turno, HU-29). */
export type UsuarioAuditoriaConRol = UsuarioAuditoria & { rol: Role }

/**
 * Lo del turno que `leerOcurrencias` no trae: DNI del alumno, observaciones, temas, auditoría y el
 * precio por hora **vigente** de su materia (`null` si no tiene; un `number`, nunca un `Decimal`).
 * `createdBy` trae además su rol, para que el detalle diga si lo registró el alumno desde el portal.
 */
export type DatosAdicionalesTurno = {
  alumnoDni: string
  observaciones: string | null
  temas: string | null
  precioVigente: number | null
} & Omit<Auditoria, 'createdBy'> & { createdBy: UsuarioAuditoriaConRol | null }

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

  /**
   * DNI del alumno, observaciones, temas, auditoría y precio vigente de la materia del turno: lo
   * que no trae `leerOcurrencias`. Una sola consulta.
   */
  async buscarDatosAdicionales(turnoId: number): Promise<DatosAdicionalesTurno | null> {
    const fila = await prisma.turno.findUnique({
      where: { id: turnoId },
      select: {
        observaciones: true,
        temas: true,
        alumno: { select: { dni: true } },
        materia: { select: { precioHora: true } },
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { ...SELECT_USUARIO_AUDITORIA, role: true } },
        updatedBy: { select: SELECT_USUARIO_AUDITORIA },
      },
    })
    if (!fila) return null
    const { createdBy } = fila
    return {
      alumnoDni: fila.alumno.dni,
      observaciones: fila.observaciones,
      temas: fila.temas,
      precioVigente: fila.materia.precioHora ? fila.materia.precioHora.toNumber() : null,
      ...armarAuditoria(fila),
      // `Usuario.role` es `string` en Prisma (FK a la tabla `Rol`, T-23): la base ya garantiza que
      // sólo tiene valores del catálogo, que son los mismos que `ROLES` (`shared/actor.ts`).
      createdBy: createdBy && {
        id: createdBy.id,
        nombre: createdBy.nombre,
        apellido: createdBy.apellido,
        rol: createdBy.role as Role,
      },
    }
  },

  /**
   * Las filas de la serie del turno que son de su **misma hora** (`serieId` y `bloqueAgendaId`,
   * decisión T-103): el propio turno y sus otros tramos `RECURRENTE` `ACTIVO`. Es el conjunto
   * sobre el que actúa "Finalizar" (decisión T-104). `[]` si el turno no existe.
   */
  async leerFilasDeLaHora(turnoId: number): Promise<FilaDeSerie[]> {
    const serie = await leerFilasDeLaSerie(prisma, turnoId)
    if (!serie) return []
    return serie.filas.filter((fila) => fila.bloqueAgendaId === serie.turno.bloqueAgendaId)
  },

  /**
   * La `FinalizacionRecurrencia` de alguno de esos turnos (los tramos de una misma hora, que se
   * finalizan juntos con la misma `fechaDesde`, motivo y detalle), o `null` si ninguno tiene.
   */
  async buscarFinalizacion(turnoIds: number[]): Promise<Finalizacion | null> {
    const fila = await prisma.finalizacionRecurrencia.findFirst({
      where: { turnoId: { in: turnoIds } },
      orderBy: { id: 'asc' },
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

  /**
   * `{ id, nombre, apellido }` de varios usuarios, por id, en una sola consulta. Lo usa el detalle
   * para resolver quién registró y quién modificó la asistencia (`Ocurrencia.asistencia` sólo trae
   * los ids). Un id que no existe no está en el `Map`.
   */
  async resolverUsuariosAuditoria(ids: string[]): Promise<Map<string, UsuarioAuditoria>> {
    const usuarios = await prisma.usuario.findMany({
      where: { id: { in: ids } },
      select: SELECT_USUARIO_AUDITORIA,
    })
    return new Map(usuarios.map((usuario) => [usuario.id, usuario]))
  },

  /** Los datos del pago de una ocurrencia pagada (`Ocurrencia.pago.pagoId`), en una consulta. */
  async buscarPago(pagoId: number): Promise<PagoDeOcurrencia | null> {
    return leerPagoDeOcurrencia(prisma, pagoId)
  },

  /** Prioridad (y el examen que la determina) de un lote de ocurrencias, en una sola consulta. */
  async leerPrioridades(
    items: { alumnoId: number; materiaId: number; fecha: string }[],
  ): Promise<Map<string, PrioridadDeTurno>> {
    return leerPrioridades(prisma, items)
  },
}

export type OcurrenciasRepository = typeof ocurrenciasRepository
