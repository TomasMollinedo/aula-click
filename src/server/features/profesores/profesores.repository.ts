import { randomUUID } from 'node:crypto'
import { Prisma, type Estado as EstadoPrisma } from '@/generated/prisma/client'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteObject, putObject } from '@/lib/storage'
import { ConflictError, NotFoundError } from '@/server/errors'
import {
  contarVigentesPorMateria,
  listarVigentesPorProfesor,
  ocupacionMaximaPorFila,
  type OcupacionMaximaPorFila,
  type TurnosVigentesPorMateria,
  type TurnoVigentePorProfesor,
} from '@/server/features/turnos/turnos.condiciones'
import type { Actor } from '@/server/shared/actor'
import { armarAuditoria, SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import type { Estado } from '@/server/shared/estado'
import { armarMeta, calcularSkipTake } from '@/server/shared/paginacion'
import {
  FOTO_EXTENSIONES,
  type CrearProfesor,
  type EditarProfesor,
  type FotoMimeType,
  type MateriasAsignadas,
  type ProfesorConAsignaciones,
  type ProfesorDeMateria,
  type ProfesorGuardado,
  type ProfesorParaBloque,
  type ProfesorListadoFila,
  type ProfesoresListado,
} from './profesores.validation'

// Único lugar de la feature que usa Prisma. Traduce errores del motor (P2002 -> ConflictError),
// completa la auditoría con el Actor y devuelve DTOs: ningún tipo de Prisma sale de acá.
// Sin reglas de negocio.

// `A` si los dos tipos tienen exactamente los mismos valores; si no, `never`, y la asignación
// de `aGuardado` deja de compilar. Así el enum de shared no se desalinea de Prisma.
type MismosValores<A, B> = [A] extends [B] ? ([B] extends [A] ? A : never) : never

const INCLUDE_USUARIO = {
  usuario: {
    include: {
      createdBy: { select: SELECT_USUARIO_AUDITORIA },
      updatedBy: { select: SELECT_USUARIO_AUDITORIA },
    },
  },
} satisfies Prisma.ProfesorInclude

type FilaProfesor = Prisma.ProfesorGetPayload<{ include: typeof INCLUDE_USUARIO }>

const MENSAJE_NO_ENCONTRADO = 'Profesor no encontrado'
// Nombres de los índices únicos que genera Prisma (ver la migración inicial): dni y email son
// de Usuario (tabla `usuario`); matrícula es de Profesor (tabla `profesor`).
const INDICE_DNI = 'usuario_dni_key'
const INDICE_EMAIL = 'usuario_email_key'
const INDICE_MATRICULA = 'profesor_matricula_key'

const MENSAJES_DUPLICADO = {
  dni: 'Ya existe un profesor con ese DNI',
  email: 'Ya existe un usuario con ese email',
  matricula: 'Ya existe un profesor con esa matrícula',
} as const

function aGuardado(fila: FilaProfesor): ProfesorGuardado {
  const estado: MismosValores<Estado, EstadoPrisma> = fila.usuario.estado
  return {
    id: fila.id,
    nombre: fila.usuario.nombre,
    apellido: fila.usuario.apellido,
    dni: fila.usuario.dni,
    telefono: fila.usuario.telefono,
    email: fila.usuario.email,
    titulo: fila.titulo,
    matricula: fila.matricula,
    capacidad: fila.capacidad,
    estado,
    avatarKey: fila.usuario.avatarKey,
    ...armarAuditoria(fila.usuario),
  }
}

/**
 * Con Prisma 7 + `@prisma/adapter-pg`, un P2002 trae en `meta.driverAdapterError.cause.constraint`
 * `{ index: '<tabla>_<campo>_key' }` (o `{ fields: [...] }` si `pg` no informa el nombre).
 * A diferencia de alumnos y materias, acá hay tres UNIQUE posibles (dni, email, matrícula): si la
 * forma no se puede leer, no se adivina y el error sigue siendo un 500.
 */
function campoDuplicado(
  meta: Record<string, unknown> | undefined,
): keyof typeof MENSAJES_DUPLICADO | undefined {
  const causa = (meta?.driverAdapterError as { cause?: { constraint?: unknown } } | undefined)
    ?.cause
  const restriccion = causa?.constraint as { index?: unknown; fields?: unknown } | undefined
  const index = typeof restriccion?.index === 'string' ? restriccion.index : undefined
  const fields = Array.isArray(restriccion?.fields) ? restriccion.fields : undefined
  if (index === INDICE_DNI || fields?.includes('dni')) return 'dni'
  if (index === INDICE_EMAIL || fields?.includes('email')) return 'email'
  if (index === INDICE_MATRICULA || fields?.includes('matricula')) return 'matricula'
  return undefined
}

function traducirDuplicado(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const campo = campoDuplicado(error.meta)
    if (campo) {
      throw new ConflictError(MENSAJES_DUPLICADO[campo], {
        details: [{ path: [campo], message: MENSAJES_DUPLICADO[campo] }],
        cause: error,
      })
    }
  }
  throw error
}

/** Detalle con la auditoría, o `null` si no existe. Función aparte: la reusan crear/actualizar/foto. */
async function buscarPorId(id: number): Promise<ProfesorGuardado | null> {
  const fila = await prisma.profesor.findUnique({ where: { id }, include: INCLUDE_USUARIO })
  return fila && aGuardado(fila)
}

/** Profesores con asignación activa de la materia; con `soloActivos`, además usuario `ACTIVO`. */
async function profesoresDeMateria({
  materiaId,
  soloActivos = false,
}: {
  materiaId: number
  soloActivos?: boolean
}): Promise<ProfesorDeMateria[]> {
  const filas = await prisma.profesor.findMany({
    where: {
      asignaciones: { some: { materiaId, estado: 'ACTIVO' } },
      ...(soloActivos ? { usuario: { estado: 'ACTIVO' } } : {}),
    },
    select: {
      id: true,
      usuario: { select: { apellido: true, nombre: true, estado: true } },
    },
    orderBy: [{ usuario: { busqueda: 'asc' } }, { id: 'asc' }],
  })
  return filas.map(({ id, usuario }) => ({ id, ...usuario }))
}

export const profesoresRepository = {
  /**
   * Página de profesores cuya `busqueda` (de su `Usuario`) contiene **todos** los `terminos`
   * (sin términos: todos), filtrados por `estado` (sin `estado`: activos e inactivos) y por
   * `materiaId` (asignación activa de esa materia). Orden por `busqueda` y luego `id`.
   */
  async listar(parametros: {
    page: number
    pageSize: number
    terminos: string[]
    estado?: Estado
    materiaId?: number
  }): Promise<{ data: ProfesorListadoFila[]; meta: ProfesoresListado['meta'] }> {
    const where = {
      usuario: {
        AND: parametros.terminos.map((termino) => ({ busqueda: { contains: termino } })),
        ...(parametros.estado === undefined ? {} : { estado: parametros.estado }),
      },
      ...(parametros.materiaId === undefined
        ? {}
        : { asignaciones: { some: { materiaId: parametros.materiaId, estado: 'ACTIVO' } } }),
    } satisfies Prisma.ProfesorWhereInput
    const [filas, total] = await prisma.$transaction([
      prisma.profesor.findMany({
        where,
        select: {
          id: true,
          usuario: {
            select: { apellido: true, nombre: true, dni: true, estado: true, avatarKey: true },
          },
        },
        orderBy: [{ usuario: { busqueda: 'asc' } }, { id: 'asc' }],
        ...calcularSkipTake(parametros),
      }),
      prisma.profesor.count({ where }),
    ])
    const data = filas.map(({ id, usuario }) => ({
      id,
      apellido: usuario.apellido,
      nombre: usuario.nombre,
      dni: usuario.dni,
      estado: usuario.estado,
      avatarKey: usuario.avatarKey,
    }))
    return { data, meta: armarMeta(parametros, total) }
  },

  /** Detalle con la auditoría, o `null` si no existe. */
  buscarPorId,

  /**
   * Alta en una sola escritura anidada de Prisma (Usuario + su cuenta credential + Profesor),
   * atómica: si algo falla no queda nada creado. La contraseña se hashea con `hashPassword()` de
   * `src/lib/auth.ts` (T-21), nunca `auth.api.signUpEmail` (bloqueado) ni un hash a mano.
   * DNI, email o matrícula repetidos → `ConflictError`.
   */
  async crear(
    datos: CrearProfesor & { busqueda: string },
    actor: Actor,
  ): Promise<ProfesorGuardado> {
    const { password, titulo, matricula, capacidad, ...usuarioDatos } = datos
    const usuarioId = randomUUID()
    const hash = await hashPassword(password)
    try {
      const usuario = await prisma.usuario.create({
        data: {
          id: usuarioId,
          ...usuarioDatos,
          role: 'PROFESOR',
          createdById: actor.userId,
          updatedById: actor.userId,
          accounts: {
            create: {
              id: randomUUID(),
              providerId: 'credential',
              accountId: usuarioId,
              password: hash,
            },
          },
          profesor: { create: { titulo, matricula, capacidad } },
        },
        select: { profesor: { select: { id: true } } },
      })
      // El profesor recién creado siempre existe: es la misma escritura anidada.
      const profesorId = usuario.profesor?.id
      const guardado = profesorId === undefined ? null : await buscarPorId(profesorId)
      if (!guardado) throw new Error('Profesor recién creado no encontrado')
      return guardado
    } catch (error) {
      traducirDuplicado(error)
    }
  },

  /**
   * Edición parcial (lo `undefined` no cambia) con `updatedById` del actor. La contraseña no se
   * edita. Inexistente → `NotFoundError`; DNI, email o matrícula repetidos → `ConflictError`.
   *
   * Si cambia la capacidad, en la misma transacción bloquea el profesor (`FOR UPDATE`, el lock que
   * la reserva de turnos toma `FOR SHARE`), lee la ocupación simultánea máxima de cada hora
   * (`ocupacionMaximaPorFila` de `turnos.condiciones`) y se la pasa a `verificar`, la regla
   * `CAPACIDAD_INSUFICIENTE` del service (T-15), antes del `UPDATE`. Si llega `capacidad` sin
   * `ocupacion` lanza un `Error` de programación: la verificación bajo lock no se puede saltear.
   */
  async actualizar(
    id: number,
    cambios: EditarProfesor & { busqueda?: string },
    actor: Actor,
    ocupacion?: { fechaHoy: string; verificar: (porFila: OcupacionMaximaPorFila[]) => void },
  ): Promise<ProfesorGuardado> {
    const { titulo, matricula, capacidad, ...usuarioCambios } = cambios
    if (capacidad !== undefined && !ocupacion) {
      throw new Error(
        'profesoresRepository.actualizar: cambiar la capacidad requiere `ocupacion` (verificación bajo lock, T-15)',
      )
    }
    try {
      await prisma.$transaction(async (tx) => {
        if (capacidad !== undefined && ocupacion) {
          await tx.$queryRaw`SELECT id FROM profesor WHERE id = ${id} FOR UPDATE`
          ocupacion.verificar(await ocupacionMaximaPorFila(tx, id, ocupacion.fechaHoy))
        }
        await tx.profesor.update({
          where: { id },
          data: {
            ...(titulo === undefined ? {} : { titulo }),
            ...(matricula === undefined ? {} : { matricula }),
            ...(capacidad === undefined ? {} : { capacidad }),
            usuario: { update: { ...usuarioCambios, updatedById: actor.userId } },
          },
          select: { id: true },
        })
      })
      const guardado = await buscarPorId(id)
      if (!guardado) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)
      return guardado
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundError(MENSAJE_NO_ENCONTRADO, { cause: error })
      }
      traducirDuplicado(error)
    }
  },

  /**
   * Sube (o reemplaza) la foto: guarda el objeto nuevo, actualiza la clave en `Usuario` y recién
   * después borra el objeto anterior (si había). `null` si el profesor no existe: no sube nada.
   */
  async actualizarFoto(
    id: number,
    foto: { bytes: Uint8Array; mimeType: FotoMimeType },
    actor: Actor,
  ): Promise<ProfesorGuardado | null> {
    const profesor = await prisma.profesor.findUnique({
      where: { id },
      select: { usuarioId: true, usuario: { select: { avatarKey: true } } },
    })
    if (!profesor) return null

    const key = `profesores/${id}/${randomUUID()}.${FOTO_EXTENSIONES[foto.mimeType]}`
    await putObject(key, foto.bytes, foto.mimeType)
    await prisma.usuario.update({
      where: { id: profesor.usuarioId },
      data: {
        avatarKey: key,
        avatarMimeType: foto.mimeType,
        avatarUpdatedAt: new Date(),
        updatedById: actor.userId,
      },
    })
    if (profesor.usuario.avatarKey) await deleteObject(profesor.usuario.avatarKey)

    return buscarPorId(id)
  },

  /** Quita la foto (si tiene) y borra el objeto. `null` si el profesor no existe. */
  async quitarFoto(id: number, actor: Actor): Promise<ProfesorGuardado | null> {
    const profesor = await prisma.profesor.findUnique({
      where: { id },
      select: { usuarioId: true, usuario: { select: { avatarKey: true } } },
    })
    if (!profesor) return null

    if (profesor.usuario.avatarKey) {
      await prisma.usuario.update({
        where: { id: profesor.usuarioId },
        data: {
          avatarKey: null,
          avatarMimeType: null,
          avatarUpdatedAt: null,
          updatedById: actor.userId,
        },
      })
      await deleteObject(profesor.usuario.avatarKey)
    }

    return buscarPorId(id)
  },

  /**
   * Materias con asignación `ACTIVO` del profesor, o `null` si el profesor no existe.
   * Orden por `busqueda` (nombre normalizado, sin tildes ni mayúsculas) y luego `id`.
   */
  async listarMateriasAsignadas(profesorId: number): Promise<MateriasAsignadas | null> {
    const profesor = await prisma.profesor.findUnique({
      where: { id: profesorId },
      select: {
        asignaciones: {
          where: { estado: 'ACTIVO' },
          select: { materia: { select: { id: true, nombre: true } } },
          orderBy: [{ materia: { busqueda: 'asc' } }, { materiaId: 'asc' }],
        },
      },
    })
    return profesor && profesor.asignaciones.map(({ materia }) => materia)
  },

  /**
   * Estado del profesor (el de su `Usuario`) y sus asignaciones de esas materias, activas o no,
   * con el nombre de la materia. `null` si el profesor no existe.
   */
  async buscarConAsignaciones(
    profesorId: number,
    materiaIds: number[],
  ): Promise<ProfesorConAsignaciones | null> {
    const profesor = await prisma.profesor.findUnique({
      where: { id: profesorId },
      select: {
        usuario: { select: { estado: true } },
        asignaciones: {
          where: { materiaId: { in: materiaIds } },
          select: { materiaId: true, estado: true, materia: { select: { nombre: true } } },
        },
      },
    })
    return (
      profesor && {
        estado: profesor.usuario.estado,
        asignaciones: profesor.asignaciones.map(({ materiaId, estado, materia }) => ({
          materiaId,
          nombre: materia.nombre,
          estado,
        })),
      }
    )
  },

  /**
   * Estado del profesor (el de su `Usuario`) y si tiene al menos una materia asignada activa.
   * `null` si el profesor no existe. Lectura para otras features: la usa `bloques` (HU-05) para
   * decidir `PROFESOR_INACTIVO` y `PROFESOR_SIN_MATERIAS` antes de cargar un bloque.
   */
  async buscarParaBloque(profesorId: number): Promise<ProfesorParaBloque | null> {
    const profesor = await prisma.profesor.findUnique({
      where: { id: profesorId },
      select: {
        usuario: { select: { estado: true } },
        asignaciones: { where: { estado: 'ACTIVO' }, select: { id: true }, take: 1 },
      },
    })
    return (
      profesor && {
        estado: profesor.usuario.estado,
        tieneMateriaActiva: profesor.asignaciones.length > 0,
      }
    )
  },

  /**
   * Capacidad del profesor, o `null` si no existe. Lectura para otras features: la usa `bloques`
   * (T-17) para calcular la capacidad efectiva de cada hora del horario (`min` con la del aula).
   */
  async buscarCapacidad(profesorId: number): Promise<number | null> {
    const profesor = await prisma.profesor.findUnique({
      where: { id: profesorId },
      select: { capacidad: true },
    })
    return profesor?.capacidad ?? null
  },

  /**
   * Asigna todas las materias en una sola transacción (todas o ninguna). El par profesor–materia
   * es único: si ya existe una fila (dada de baja), se reactiva; si no, se inserta.
   * Auditoría: `createdById` en el alta y `updatedById` siempre, con el actor.
   */
  async asignarMaterias(profesorId: number, materiaIds: number[], actor: Actor): Promise<void> {
    try {
      await prisma.$transaction(
        materiaIds.map((materiaId) =>
          prisma.asignacionMateria.upsert({
            where: { profesorId_materiaId: { profesorId, materiaId } },
            create: {
              profesorId,
              materiaId,
              createdById: actor.userId,
              updatedById: actor.userId,
            },
            update: { estado: 'ACTIVO', updatedById: actor.userId },
            select: { id: true },
          }),
        ),
      )
    } catch (error) {
      // Dos asignaciones simultáneas del mismo par: la segunda choca con el UNIQUE.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Alguna de las materias ya fue asignada a este profesor', {
          cause: error,
        })
      }
      throw error
    }
  },

  /**
   * Profesores con asignación `ACTIVO` de la materia, activos o no (con su `estado`), ordenados
   * por apellido y nombre (`busqueda` del usuario) y luego `id`. Lectura para otras features:
   * detalle de materias (quién la dicta) y baja de materias (T-09: no se puede con profesores).
   */
  async listarProfesoresDeMateria(materiaId: number): Promise<ProfesorDeMateria[]> {
    return profesoresDeMateria({ materiaId })
  },

  /**
   * Como `listarProfesoresDeMateria`, pero solo profesores activos: los que pueden recibir un
   * turno nuevo de esa materia (HU-07).
   */
  async listarProfesoresActivosDeMateria(materiaId: number): Promise<ProfesorDeMateria[]> {
    return profesoresDeMateria({ materiaId, soloActivos: true })
  },

  /**
   * Baja lógica de las asignaciones activas de esas materias (`estado = INACTIVO`), nunca borrado
   * físico: reasignar la materia reactiva la misma fila. Un solo UPDATE: todas o ninguna.
   * Auditoría: `updatedById` con el actor.
   *
   * En una transacción que bloquea el profesor (`FOR UPDATE`, el lock que la reserva de turnos
   * toma `FOR SHARE`): cuenta los turnos vigentes de esas materias con el profesor y se los pasa a
   * `verificar` (la regla `TURNOS_VIGENTES` del service) antes del `UPDATE`. Así una reserva
   * simultánea no se cuela, y una reserva posterior ve la asignación ya dada de baja.
   */
  async quitarMaterias(
    profesorId: number,
    materiaIds: number[],
    actor: Actor,
    vigentes: { fechaHoy: string; verificar: (porMateria: TurnosVigentesPorMateria[]) => void },
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM profesor WHERE id = ${profesorId} FOR UPDATE`
      vigentes.verificar(
        await contarVigentesPorMateria(tx, { fechaHoy: vigentes.fechaHoy, profesorId, materiaIds }),
      )
      await tx.asignacionMateria.updateMany({
        where: { profesorId, materiaId: { in: materiaIds }, estado: 'ACTIVO' },
        data: { estado: 'INACTIVO', updatedById: actor.userId },
      })
    })
  },

  /**
   * Baja lógica del profesor: pasa el `Usuario` a `INACTIVO` y revoca sus sesiones abiertas (no
   * puede seguir usando una que ya tenía; tampoco puede iniciar una nueva, por la guarda del
   * login). No toca materias, bloques ni turnos. `NotFoundError` si el profesor no existe (P2025).
   *
   * Todo en una transacción que bloquea el profesor (`FOR UPDATE`, el lock que la reserva de
   * turnos toma `FOR SHARE`): lista sus turnos vigentes y se los pasa a `verificar` (la regla
   * `TURNOS_VIGENTES` del service) antes del `UPDATE`, así una reserva simultánea no se cuela.
   */
  async darDeBaja(
    id: number,
    actor: Actor,
    vigentes: { fechaHoy: string; verificar: (turnos: TurnoVigentePorProfesor[]) => void },
  ): Promise<ProfesorGuardado> {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM profesor WHERE id = ${id} FOR UPDATE`
        vigentes.verificar(await listarVigentesPorProfesor(tx, id, vigentes.fechaHoy))
        const profesor = await tx.profesor.update({
          where: { id },
          data: { usuario: { update: { estado: 'INACTIVO', updatedById: actor.userId } } },
          select: { usuarioId: true },
        })
        await tx.session.deleteMany({ where: { userId: profesor.usuarioId } })
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundError(MENSAJE_NO_ENCONTRADO, { cause: error })
      }
      throw error
    }
    const guardado = await buscarPorId(id)
    if (!guardado) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)
    return guardado
  },

  /**
   * Reactivación: pasa el `Usuario` del profesor a `ACTIVO`. No revalida nada: sus materias y
   * bloques quedan intactos. `NotFoundError` si el profesor no existe (P2025).
   */
  async reactivar(id: number, actor: Actor): Promise<ProfesorGuardado> {
    try {
      await prisma.profesor.update({
        where: { id },
        data: { usuario: { update: { estado: 'ACTIVO', updatedById: actor.userId } } },
        select: { id: true },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundError(MENSAJE_NO_ENCONTRADO, { cause: error })
      }
      throw error
    }
    const guardado = await buscarPorId(id)
    if (!guardado) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)
    return guardado
  },
}

export type ProfesoresRepository = typeof profesoresRepository
