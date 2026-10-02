import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/server/errors'
import { materiasDelProfesorConAlumno } from '@/server/features/turnos/ocurrencias.condiciones'
import { contarVigentesPorMateria } from '@/server/features/turnos/turnos.condiciones'
import type { Actor } from '@/server/shared/actor'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'
import type {
  CrearExamen,
  EditarExamen,
  ExamenGuardado,
  ExamenPendiente,
  ExamenUsuarioAuditoria,
} from './examenes.validation'

// Único lugar de la feature que usa Prisma. Traduce errores del motor (P2025 -> NotFoundError) y
// devuelve DTOs: ningún tipo de Prisma sale de acá. Sin reglas de negocio.

const MENSAJE_NO_ENCONTRADO = 'Examen no encontrado'

// A diferencia de `SELECT_USUARIO_AUDITORIA` (`shared/auditoria.ts`), acá se suma `role`: HU-17
// pide mostrar el rol de quien cargó o modificó el examen, algo que ninguna otra entidad necesita.
const SELECT_USUARIO_AUDITORIA_CON_ROL = {
  id: true,
  nombre: true,
  apellido: true,
  role: true,
} as const

const INCLUDE_EXAMEN = {
  materia: { select: { nombre: true } },
  createdBy: { select: SELECT_USUARIO_AUDITORIA_CON_ROL },
  updatedBy: { select: SELECT_USUARIO_AUDITORIA_CON_ROL },
} satisfies Prisma.ExamenInclude

type FilaExamen = Prisma.ExamenGetPayload<{ include: typeof INCLUDE_EXAMEN }>

// `Usuario.role` es `string` en Prisma (FK a la tabla `Rol`, T-23): la base ya garantiza que sólo
// tiene valores del catálogo, que son los mismos que `ROLES` (`shared/actor.ts`).
function usuarioConRol(
  usuario: { id: string; nombre: string; apellido: string; role: string } | null,
): ExamenUsuarioAuditoria | null {
  return (
    usuario && {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      role: usuario.role as ExamenUsuarioAuditoria['role'],
    }
  )
}

function aGuardado(fila: FilaExamen): ExamenGuardado {
  return {
    id: fila.id,
    alumnoId: fila.alumnoId,
    materiaId: fila.materiaId,
    materia: { id: fila.materiaId, nombre: fila.materia.nombre },
    fecha: dateAFecha(fila.fecha),
    tipo: fila.tipo,
    observaciones: fila.observaciones,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
    createdBy: usuarioConRol(fila.createdBy),
    updatedBy: usuarioConRol(fila.updatedBy),
  }
}

function traducirNoEncontrado(error: unknown): void {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    throw new NotFoundError(MENSAJE_NO_ENCONTRADO, { cause: error })
  }
}

export const examenesRepository = {
  /** Exámenes `ACTIVO` del alumno, por fecha (el service arma próximos/pasados). */
  async listarDelAlumno(alumnoId: number): Promise<ExamenGuardado[]> {
    const filas = await prisma.examen.findMany({
      where: { alumnoId, estado: 'ACTIVO' },
      include: INCLUDE_EXAMEN,
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    })
    return filas.map(aGuardado)
  },

  /** Detalle con la auditoría, en cualquier estado, o `null` si no existe. */
  async buscarPorId(id: number): Promise<ExamenGuardado | null> {
    const fila = await prisma.examen.findUnique({ where: { id }, include: INCLUDE_EXAMEN })
    return fila && aGuardado(fila)
  },

  /**
   * El examen `ACTIVO` de esa materia y ese alumno con fecha `>= fechaHoy` (un pendiente), si lo
   * hay. `excluirId` lo saca de la búsqueda: al editar, el propio examen no cuenta como su
   * duplicado. Devuelve `{ id, tipo, fecha }`, lo que pide el 409 `EXAMEN_PENDIENTE`.
   */
  async buscarPendiente(
    alumnoId: number,
    materiaId: number,
    fechaHoy: string,
    excluirId?: number,
  ): Promise<ExamenPendiente | null> {
    const fila = await prisma.examen.findFirst({
      where: {
        alumnoId,
        materiaId,
        estado: 'ACTIVO',
        fecha: { gte: fechaADate(fechaHoy) },
        ...(excluirId === undefined ? {} : { id: { not: excluirId } }),
      },
      select: { id: true, tipo: true, fecha: true },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    })
    return fila && { id: fila.id, tipo: fila.tipo, fecha: dateAFecha(fila.fecha) }
  },

  /** Alta con `createdById` y `updatedById` del actor. */
  async crear(datos: CrearExamen, actor: Actor): Promise<ExamenGuardado> {
    const fila = await prisma.examen.create({
      data: {
        alumnoId: datos.alumnoId,
        materiaId: datos.materiaId,
        fecha: fechaADate(datos.fecha),
        tipo: datos.tipo,
        observaciones: datos.observaciones ?? null,
        createdById: actor.userId,
        updatedById: actor.userId,
      },
      include: INCLUDE_EXAMEN,
    })
    return aGuardado(fila)
  },

  /**
   * Edición parcial (lo `undefined` no cambia) con `updatedById` del actor.
   * Inexistente → `NotFoundError` (el service ya lo buscó: acá cubre la carrera entre los dos).
   */
  async actualizar(id: number, cambios: EditarExamen, actor: Actor): Promise<ExamenGuardado> {
    try {
      const fila = await prisma.examen.update({
        where: { id },
        data: {
          ...(cambios.materiaId === undefined ? {} : { materiaId: cambios.materiaId }),
          ...(cambios.fecha === undefined ? {} : { fecha: fechaADate(cambios.fecha) }),
          ...(cambios.tipo === undefined ? {} : { tipo: cambios.tipo }),
          ...(cambios.observaciones === undefined ? {} : { observaciones: cambios.observaciones }),
          updatedById: actor.userId,
        },
        include: INCLUDE_EXAMEN,
      })
      return aGuardado(fila)
    } catch (error) {
      traducirNoEncontrado(error)
      throw error
    }
  },

  /** Baja lógica ("eliminar" en la HU): `estado` a `INACTIVO`, nada se borra. */
  async darDeBaja(id: number, actor: Actor): Promise<ExamenGuardado> {
    try {
      const fila = await prisma.examen.update({
        where: { id },
        data: { estado: 'INACTIVO', updatedById: actor.userId },
        include: INCLUDE_EXAMEN,
      })
      return aGuardado(fila)
    } catch (error) {
      traducirNoEncontrado(error)
      throw error
    }
  },

  /**
   * Materias que ese profesor le dicta a ese alumno (T-29/T-30): selector de `PROFESOR` en
   * `GET /examenes/materias` y chequeo de permiso en el alta, la edición y la baja. Es la función
   * de `ocurrencias.condiciones.ts` (T-39: de otra feature sólo se importan `*.repository` y
   * `*.condiciones`), con el cliente de Prisma de esta feature.
   */
  materiasDictadas(profesorId: number, alumnoId: number) {
    return materiasDelProfesorConAlumno(prisma, { profesorId, alumnoId })
  },

  /**
   * Ids de las materias en las que el alumno tiene algún turno **vigente** (al menos una fecha no
   * cancelada de `fechaHoy` en adelante; docs/convenciones-backend.md → Turno vigente). Con
   * `profesorId`, sólo los turnos con ese profesor. Es la lectura de `turnos.condiciones.ts`
   * (T-39), con el cliente de Prisma de esta feature: la regla no se reescribe acá.
   */
  async materiasConTurnoVigente(
    alumnoId: number,
    fechaHoy: string,
    profesorId?: number,
  ): Promise<number[]> {
    const grupos = await contarVigentesPorMateria(prisma, { fechaHoy, alumnoId, profesorId })
    return grupos.map((grupo) => grupo.materiaId)
  },
}

export type ExamenesRepository = typeof examenesRepository
