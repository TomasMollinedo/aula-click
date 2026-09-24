import {
  Prisma,
  type Estado as EstadoPrisma,
  type NivelEscolaridad as NivelPrisma,
} from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ConflictError, NotFoundError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import type { Estado } from '@/server/shared/estado'
import { armarAuditoria, SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'
import { armarMeta, calcularSkipTake } from '@/server/shared/paginacion'
import type {
  AlumnoGuardado,
  AlumnosListado,
  CrearAlumno,
  EditarAlumno,
  NivelEscolaridad,
} from './alumnos.validation'

// Único lugar de la feature que usa Prisma. Traduce errores del motor (P2002 -> ConflictError),
// completa la auditoría con el Actor y devuelve DTOs: ningún tipo de Prisma sale de acá.
// Sin reglas de negocio.

// `A` si los dos tipos tienen exactamente los mismos valores; si no, `never`, y la asignación
// de `aGuardado` deja de compilar. Así los enums de la validation no se desalinean de Prisma.
type MismosValores<A, B> = [A] extends [B] ? ([B] extends [A] ? A : never) : never

const INCLUDE_AUDITORIA = {
  createdBy: { select: SELECT_USUARIO_AUDITORIA },
  updatedBy: { select: SELECT_USUARIO_AUDITORIA },
} satisfies Prisma.AlumnoInclude

type FilaAlumno = Prisma.AlumnoGetPayload<{ include: typeof INCLUDE_AUDITORIA }>

const MENSAJE_DNI_DUPLICADO = 'Ya existe un alumno con ese DNI'
// Nombre del índice único que genera Prisma para `Alumno.dni` (ver la migración inicial).
const INDICE_DNI = 'alumno_dni_key'

function aGuardado(fila: FilaAlumno): AlumnoGuardado {
  const nivelEscolaridad: MismosValores<NivelEscolaridad, NivelPrisma> | null =
    fila.nivelEscolaridad
  const estado: MismosValores<Estado, EstadoPrisma> = fila.estado
  return {
    id: fila.id,
    nombre: fila.nombre,
    apellido: fila.apellido,
    dni: fila.dni,
    fechaNacimiento: dateAFecha(fila.fechaNacimiento),
    email: fila.email,
    telefono: fila.telefono,
    nivelEscolaridad,
    grado: fila.grado,
    institucionEducativa: fila.institucionEducativa,
    observaciones: fila.observaciones,
    tutorNombre: fila.tutorNombre,
    tutorApellido: fila.tutorApellido,
    tutorDni: fila.tutorDni,
    tutorTelefono: fila.tutorTelefono,
    tutorEmail: fila.tutorEmail,
    estado,
    ...armarAuditoria(fila),
  }
}

/**
 * Con Prisma 7 + `@prisma/adapter-pg`, un P2002 trae en `meta.driverAdapterError.cause.constraint`
 * `{ index: 'alumno_dni_key' }` (o `{ fields: ['dni'] }` si `pg` no informa el nombre). El único
 * UNIQUE de `alumno` es `dni`: si la forma no se puede leer, se asume DNI.
 */
function esDniDuplicado(meta: Record<string, unknown> | undefined): boolean {
  const causa = (meta?.driverAdapterError as { cause?: { constraint?: unknown } } | undefined)
    ?.cause
  const restriccion = causa?.constraint as { index?: unknown; fields?: unknown } | undefined
  if (typeof restriccion?.index === 'string') return restriccion.index === INDICE_DNI
  if (Array.isArray(restriccion?.fields)) return restriccion.fields.includes('dni')
  return true
}

function traducirDniDuplicado(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    esDniDuplicado(error.meta)
  ) {
    throw new ConflictError(MENSAJE_DNI_DUPLICADO, {
      details: [{ path: ['dni'], message: MENSAJE_DNI_DUPLICADO }],
      cause: error,
    })
  }
  throw error
}

export const alumnosRepository = {
  /**
   * Página de alumnos cuya `busqueda` contiene **todos** los `terminos` (sin términos: todos).
   * Orden por `busqueda` y luego `id`: `busqueda` empieza por el apellido normalizado (sin tildes
   * ni mayúsculas), así el orden es por apellido y nombre sin depender de la collation de
   * Postgres ("Álvarez" no queda después de "Zapata"), e `id` desempata.
   */
  async listar(parametros: {
    page: number
    pageSize: number
    terminos: string[]
  }): Promise<AlumnosListado> {
    const where = {
      AND: parametros.terminos.map((termino) => ({ busqueda: { contains: termino } })),
    } satisfies Prisma.AlumnoWhereInput
    const [data, total] = await prisma.$transaction([
      prisma.alumno.findMany({
        where,
        select: { id: true, apellido: true, nombre: true, dni: true },
        orderBy: [{ busqueda: 'asc' }, { id: 'asc' }],
        ...calcularSkipTake(parametros),
      }),
      prisma.alumno.count({ where }),
    ])
    return { data, meta: armarMeta(parametros, total) }
  },

  /** Detalle con la auditoría, o `null` si no existe. */
  async buscarPorId(id: number): Promise<AlumnoGuardado | null> {
    const fila = await prisma.alumno.findUnique({ where: { id }, include: INCLUDE_AUDITORIA })
    return fila && aGuardado(fila)
  },

  /** Alta con `createdById` y `updatedById` del actor. DNI repetido → `ConflictError`. */
  async crear(datos: CrearAlumno & { busqueda: string }, actor: Actor): Promise<AlumnoGuardado> {
    const { fechaNacimiento, ...resto } = datos
    try {
      const fila = await prisma.alumno.create({
        data: {
          ...resto,
          fechaNacimiento: fechaADate(fechaNacimiento),
          createdById: actor.userId,
          updatedById: actor.userId,
        },
        include: INCLUDE_AUDITORIA,
      })
      return aGuardado(fila)
    } catch (error) {
      traducirDniDuplicado(error)
    }
  },

  /**
   * Edición parcial (lo `undefined` no cambia; `null` borra) con `updatedById` del actor.
   * Inexistente → `NotFoundError`; DNI repetido → `ConflictError`.
   */
  async actualizar(
    id: number,
    datos: EditarAlumno & { busqueda: string },
    actor: Actor,
  ): Promise<AlumnoGuardado> {
    const { fechaNacimiento, ...resto } = datos
    try {
      const fila = await prisma.alumno.update({
        where: { id },
        data: {
          ...resto,
          ...(fechaNacimiento === undefined
            ? {}
            : { fechaNacimiento: fechaADate(fechaNacimiento) }),
          updatedById: actor.userId,
        },
        include: INCLUDE_AUDITORIA,
      })
      return aGuardado(fila)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundError('Alumno no encontrado', { cause: error })
      }
      traducirDniDuplicado(error)
    }
  },
}

export type AlumnosRepository = typeof alumnosRepository
