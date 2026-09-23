import { Prisma, type Estado } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ConflictError, NotFoundError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { armarAuditoria, SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import { armarMeta, calcularSkipTake } from '@/server/shared/paginacion'
import type {
  CrearMateria,
  EstadoMateria,
  MateriaGuardada,
  MateriaSelectorItem,
  MateriasListado,
} from './materias.validation'

// Único lugar de la feature que usa Prisma. Traduce errores del motor (P2002 -> ConflictError),
// completa la auditoría con el Actor y devuelve DTOs: ningún tipo de Prisma sale de acá.
// Sin reglas de negocio.

// `A` si los dos tipos tienen exactamente los mismos valores; si no, `never`, y la asignación
// de `aGuardada` deja de compilar. Así el enum de la validation no se desalinea de Prisma.
type MismosValores<A, B> = [A] extends [B] ? ([B] extends [A] ? A : never) : never

const INCLUDE_AUDITORIA = {
  createdBy: { select: SELECT_USUARIO_AUDITORIA },
  updatedBy: { select: SELECT_USUARIO_AUDITORIA },
} satisfies Prisma.MateriaInclude

type FilaMateria = Prisma.MateriaGetPayload<{ include: typeof INCLUDE_AUDITORIA }>

const MENSAJE_NOMBRE_DUPLICADO = 'Ya existe una materia con ese nombre'
const MENSAJE_NO_ENCONTRADA = 'Materia no encontrada'
// Nombre del índice único que genera Prisma para `Materia.busqueda` (ver la migración inicial).
const INDICE_BUSQUEDA = 'materia_busqueda_key'

function aGuardada(fila: FilaMateria): MateriaGuardada {
  const estado: MismosValores<EstadoMateria, Estado> = fila.estado
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    estado,
    ...armarAuditoria(fila),
  }
}

/**
 * Con Prisma 7 + `@prisma/adapter-pg`, un P2002 trae en `meta.driverAdapterError.cause.constraint`
 * `{ index: 'materia_busqueda_key' }` (o `{ fields: ['busqueda'] }` si `pg` no informa el nombre).
 * El único UNIQUE de `materia` es `busqueda`: si la forma no se puede leer, se asume el nombre.
 */
function esNombreDuplicado(meta: Record<string, unknown> | undefined): boolean {
  const causa = (meta?.driverAdapterError as { cause?: { constraint?: unknown } } | undefined)
    ?.cause
  const restriccion = causa?.constraint as { index?: unknown; fields?: unknown } | undefined
  if (typeof restriccion?.index === 'string') return restriccion.index === INDICE_BUSQUEDA
  if (Array.isArray(restriccion?.fields)) return restriccion.fields.includes('busqueda')
  return true
}

/**
 * El choque es sobre `busqueda` (el nombre normalizado), pero el `path` del `details` es `nombre`:
 * es el campo que cargó el usuario y el que tiene que marcar el formulario.
 */
function traducirNombreDuplicado(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    esNombreDuplicado(error.meta)
  ) {
    throw new ConflictError(MENSAJE_NOMBRE_DUPLICADO, {
      details: [{ path: ['nombre'], message: MENSAJE_NOMBRE_DUPLICADO }],
      cause: error,
    })
  }
  throw error
}

export const materiasRepository = {
  /**
   * Página de materias cuya `busqueda` contiene **todos** los `terminos` (sin términos: todas),
   * filtradas por `estado` (sin `estado`: activas e inactivas).
   * Orden por `busqueda` y luego `id`: `busqueda` es el nombre normalizado (sin tildes ni
   * mayúsculas), así el orden es por nombre sin depender de la collation de Postgres
   * ("Álgebra" no queda después de "Zoología"), e `id` desempata.
   */
  async listar(parametros: {
    page: number
    pageSize: number
    terminos: string[]
    estado?: EstadoMateria
  }): Promise<MateriasListado> {
    const where = {
      AND: parametros.terminos.map((termino) => ({ busqueda: { contains: termino } })),
      ...(parametros.estado === undefined ? {} : { estado: parametros.estado }),
    } satisfies Prisma.MateriaWhereInput
    const [data, total] = await prisma.$transaction([
      prisma.materia.findMany({
        where,
        select: { id: true, nombre: true, estado: true },
        orderBy: [{ busqueda: 'asc' }, { id: 'asc' }],
        ...calcularSkipTake(parametros),
      }),
      prisma.materia.count({ where }),
    ])
    return { data, meta: armarMeta(parametros, total) }
  },

  /**
   * Materias activas para un selector: sin paginar y ordenadas por nombre. La importan otras
   * features (asignaciones de profesores y turnos) para sus dropdowns.
   */
  listarActivas(): Promise<MateriaSelectorItem[]> {
    return prisma.materia.findMany({
      where: { estado: 'ACTIVO' },
      select: { id: true, nombre: true },
      orderBy: [{ busqueda: 'asc' }, { id: 'asc' }],
    })
  },

  /** Detalle con la auditoría, o `null` si no existe. Los profesores los trae el service. */
  async buscarPorId(id: number): Promise<MateriaGuardada | null> {
    const fila = await prisma.materia.findUnique({ where: { id }, include: INCLUDE_AUDITORIA })
    return fila && aGuardada(fila)
  },

  /** Alta con `createdById` y `updatedById` del actor. Nombre repetido → `ConflictError`. */
  async crear(datos: CrearMateria & { busqueda: string }, actor: Actor): Promise<MateriaGuardada> {
    try {
      const fila = await prisma.materia.create({
        data: { ...datos, createdById: actor.userId, updatedById: actor.userId },
        include: INCLUDE_AUDITORIA,
      })
      return aGuardada(fila)
    } catch (error) {
      traducirNombreDuplicado(error)
    }
  },

  /**
   * Baja lógica: `estado` a `INACTIVO` con `updatedById` del actor. Nada se borra.
   * Inexistente → `NotFoundError` (el service ya la buscó: acá cubre la carrera entre los dos).
   */
  async darDeBaja(id: number, actor: Actor): Promise<MateriaGuardada> {
    try {
      const fila = await prisma.materia.update({
        where: { id },
        data: { estado: 'INACTIVO', updatedById: actor.userId },
        include: INCLUDE_AUDITORIA,
      })
      return aGuardada(fila)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundError(MENSAJE_NO_ENCONTRADA, { cause: error })
      }
      throw error
    }
  },
}

export type MateriasRepository = typeof materiasRepository
