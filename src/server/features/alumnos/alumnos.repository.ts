import { randomUUID } from 'node:crypto'
import {
  Prisma,
  type Estado as EstadoPrisma,
  type NivelEscolaridad as NivelPrisma,
} from '@/generated/prisma/client'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteObject, putObject } from '@/lib/storage'
import { ConflictError, NotFoundError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import type { Estado } from '@/server/shared/estado'
import { claveDeArchivo } from '@/server/shared/archivos'
import { armarAuditoria, SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import { normalizarBusqueda } from '@/server/shared/busqueda'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'
import { armarMeta, calcularSkipTake } from '@/server/shared/paginacion'
import { condicionTurnoVigente } from '@/server/features/turnos/turnos.condiciones'
import { agruparMateriasPorAlumno } from './materias-por-alumno'
import {
  emailDeUsuario,
  MAX_INTENTOS_USUARIO,
  MENSAJE_ACCESO_EXISTENTE,
  MENSAJE_SIN_ACCESO,
  primerUsuarioLibre,
  usuarioBase,
} from './usuario-portal'
import type {
  AccesoAlumno,
  AlumnoDeProfesorFila,
  AlumnoGuardado,
  AlumnoListadoFila,
  AlumnosDeProfesorListado,
  AlumnosListado,
  CrearAlumno,
  EditarAlumno,
  FotoMimeType,
  MiPerfilGuardado,
  NivelEscolaridad,
} from './alumnos.validation'
import { FOTO_EXTENSIONES } from './alumnos.validation'

// Único lugar de la feature que usa Prisma. Traduce errores del motor (P2002 -> ConflictError),
// completa la auditoría con el Actor y devuelve DTOs: ningún tipo de Prisma sale de acá.
// Sin reglas de negocio.

// `A` si los dos tipos tienen exactamente los mismos valores; si no, `never`, y la asignación
// de `aGuardado` deja de compilar. Así los enums de la validation no se desalinean de Prisma.
type MismosValores<A, B> = [A] extends [B] ? ([B] extends [A] ? A : never) : never

/**
 * El acceso al portal (HU-27) sale de la cuenta del alumno: el `Usuario` con su `alumnoId` (T-131)
 * y su `Account` credential, donde viven `contrasenaInicial` y quién restableció la contraseña
 * (T-135). Quién creó el acceso y cuándo es la auditoría del propio `Usuario`.
 */
const SELECT_USUARIO_ACCESO = {
  id: true,
  username: true,
  createdAt: true,
  createdBy: { select: SELECT_USUARIO_AUDITORIA },
  accounts: {
    where: { providerId: 'credential' },
    select: {
      contrasenaRestablecidaFecha: true,
      contrasenaRestablecidaPor: { select: SELECT_USUARIO_AUDITORIA },
    },
    take: 1,
  },
} satisfies Prisma.UsuarioSelect

const INCLUDE_AUDITORIA = {
  createdBy: { select: SELECT_USUARIO_AUDITORIA },
  updatedBy: { select: SELECT_USUARIO_AUDITORIA },
  usuario: { select: SELECT_USUARIO_ACCESO },
} satisfies Prisma.AlumnoInclude

type FilaAlumno = Prisma.AlumnoGetPayload<{ include: typeof INCLUDE_AUDITORIA }>

const MENSAJE_DNI_DUPLICADO = 'Ya existe un alumno con ese DNI'
const MENSAJE_USUARIO_CON_DNI = 'Ya existe un usuario con ese DNI'
// Nombres de los índices únicos que genera Prisma (ver las migraciones).
const INDICE_ALUMNO_DNI = 'alumno_dni_key'
const INDICE_USUARIO_DNI = 'usuario_dni_key'
const INDICE_USUARIO_USERNAME = 'usuario_username_key'
const INDICE_USUARIO_EMAIL = 'usuario_email_key'

function armarAcceso(usuario: FilaAlumno['usuario']): AccesoAlumno | null {
  if (!usuario?.username) return null
  const cuenta = usuario.accounts[0]
  return {
    usuario: usuario.username,
    creadoPor: usuario.createdBy,
    creadoEl: usuario.createdAt.toISOString(),
    restablecidaPor: cuenta?.contrasenaRestablecidaPor ?? null,
    restablecidaEl: cuenta?.contrasenaRestablecidaFecha?.toISOString() ?? null,
  }
}

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
    avatarKey: fila.avatarKey,
    acceso: armarAcceso(fila.usuario),
    ...armarAuditoria(fila),
  }
}

/**
 * Con Prisma 7 + `@prisma/adapter-pg`, un P2002 trae en `meta.driverAdapterError.cause.constraint`
 * `{ index: '<tabla>_<campo>_key' }` (o `{ fields: [...] }` si `pg` no informa el nombre). El alta
 * escribe `Alumno`, `Usuario` y `Account` en una transacción, así que hay varios únicos posibles:
 * si la forma no se puede leer, no se adivina (como en `profesores`) y el error sigue siendo 500.
 */
function indiceDuplicado(error: unknown): string | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return undefined
  }
  const causa = (error.meta?.driverAdapterError as { cause?: { constraint?: unknown } } | undefined)
    ?.cause
  const restriccion = causa?.constraint as { index?: unknown; fields?: unknown } | undefined
  if (typeof restriccion?.index === 'string') return restriccion.index
  if (Array.isArray(restriccion?.fields)) return `fields:${restriccion.fields.join(',')}`
  return undefined
}

/** El usuario (o su email, que deriva de él) ya existe: el alta lo reintenta con el sufijo siguiente. */
function esUsuarioOcupado(error: unknown): boolean {
  const indice = indiceDuplicado(error)
  return (
    indice === INDICE_USUARIO_USERNAME ||
    indice === INDICE_USUARIO_EMAIL ||
    indice === 'fields:username' ||
    indice === 'fields:email'
  )
}

/** DNI repetido, del alumno o de un usuario ya existente (punto 10 de las PO). */
function traducirDuplicado(error: unknown): never {
  const indice = indiceDuplicado(error)
  if (indice === INDICE_ALUMNO_DNI || indice === 'fields:dni') {
    throw new ConflictError(MENSAJE_DNI_DUPLICADO, {
      details: [{ path: ['dni'], message: MENSAJE_DNI_DUPLICADO }],
      cause: error,
    })
  }
  if (indice === INDICE_USUARIO_DNI) {
    throw new ConflictError(MENSAJE_USUARIO_CON_DNI, {
      details: [{ path: ['dni'], message: MENSAJE_USUARIO_CON_DNI }],
      cause: error,
    })
  }
  throw error
}

/** `busqueda` de un `Usuario`: el mismo formato que usan el seed y el alta de profesor. */
function busquedaDeUsuario(datos: { apellido: string; nombre: string; dni: string }): string {
  return normalizarBusqueda(`${datos.apellido} ${datos.nombre} ${datos.dni}`)
}

/** Usuarios ya tomados que arrancan con `base`, para calcular el sufijo libre (HU-27). */
async function usuariosTomados(base: string): Promise<string[]> {
  const filas = await prisma.usuario.findMany({
    where: { username: { startsWith: base } },
    select: { username: true },
  })
  return filas.flatMap((fila) => (fila.username === null ? [] : [fila.username]))
}

/** Detalle con la auditoría y el acceso, o `null` si no existe. Lo reusan todas las escrituras. */
async function buscarPorId(id: number): Promise<AlumnoGuardado | null> {
  const fila = await prisma.alumno.findUnique({ where: { id }, include: INCLUDE_AUDITORIA })
  return fila && aGuardado(fila)
}

const SELECT_LISTADO = {
  id: true,
  apellido: true,
  nombre: true,
  dni: true,
  avatarKey: true,
} satisfies Prisma.AlumnoSelect

/** Datos del alumno con los que se completa su `Usuario` (T-132). */
type DatosDeLaCuenta = {
  nombre: string
  apellido: string
  dni: string
  telefono?: string | null
  tutorTelefono?: string | null
}

/**
 * Crea el `Usuario` (rol ALUMNO, con su `username`, el email sintético y el `alumnoId`) y su
 * `Account` credential con el DNI hasheado (`contrasenaInicial: true`), dentro de la transacción
 * que le pasan. El teléfono es el del alumno o, si no tiene, el del tutor (HU-02 garantiza uno).
 */
async function crearCuentaDelAlumno(
  tx: Prisma.TransactionClient,
  alumnoId: number,
  datos: DatosDeLaCuenta,
  username: string,
  actor: Actor,
): Promise<void> {
  const usuarioId = randomUUID()
  const hash = await hashPassword(datos.dni)
  await tx.usuario.create({
    data: {
      id: usuarioId,
      nombre: datos.nombre,
      apellido: datos.apellido,
      dni: datos.dni,
      busqueda: busquedaDeUsuario(datos),
      telefono: datos.telefono ?? datos.tutorTelefono ?? '',
      email: emailDeUsuario(username),
      emailVerified: true,
      username,
      displayUsername: username,
      role: 'ALUMNO',
      alumnoId,
      createdById: actor.userId,
      updatedById: actor.userId,
      accounts: {
        create: {
          id: randomUUID(),
          providerId: 'credential',
          accountId: usuarioId,
          password: hash,
          contrasenaInicial: true,
        },
      },
    },
    select: { id: true },
  })
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
  }): Promise<{ data: AlumnoListadoFila[]; meta: AlumnosListado['meta'] }> {
    const where = {
      AND: parametros.terminos.map((termino) => ({ busqueda: { contains: termino } })),
    } satisfies Prisma.AlumnoWhereInput
    const [data, total] = await prisma.$transaction([
      prisma.alumno.findMany({
        where,
        select: SELECT_LISTADO,
        orderBy: [{ busqueda: 'asc' }, { id: 'asc' }],
        ...calcularSkipTake(parametros),
      }),
      prisma.alumno.count({ where }),
    ])
    return { data, meta: armarMeta(parametros, total) }
  },

  /**
   * Página de alumnos del profesor: los que tienen al menos un turno vigente con él (`docs/dominio.md`
   * → Turnos; misma condición que usa `profesores` para la baja, vía `turnos.condiciones`, nunca
   * reescrita acá), filtrable por materia. Mismo orden y búsqueda por palabras que `listar`. Cada
   * alumno trae además sus materias vigentes con el profesor (todas, sin el filtro `materiaId`: es
   * lo que le da sentido a ese filtro), en una segunda consulta acotada a la página ya resuelta.
   */
  async listarDeProfesor(parametros: {
    profesorId: number
    materiaId: number | undefined
    terminos: string[]
    page: number
    pageSize: number
    fechaHoy: string
  }): Promise<{ data: AlumnoDeProfesorFila[]; meta: AlumnosDeProfesorListado['meta'] }> {
    // Sin `materiaId`: la condición de "materias vigentes del alumno con el profesor" de abajo.
    const condicionDelProfesor = {
      ...condicionTurnoVigente(parametros.fechaHoy),
      bloqueAgenda: { profesorId: parametros.profesorId },
    } satisfies Prisma.TurnoWhereInput
    const where = {
      AND: [
        ...parametros.terminos.map((termino) => ({ busqueda: { contains: termino } })),
        {
          turnos: {
            some: {
              ...condicionDelProfesor,
              ...(parametros.materiaId === undefined ? {} : { materiaId: parametros.materiaId }),
            },
          },
        },
      ],
    } satisfies Prisma.AlumnoWhereInput
    const [pagina, total] = await prisma.$transaction([
      prisma.alumno.findMany({
        where,
        select: SELECT_LISTADO,
        orderBy: [{ busqueda: 'asc' }, { id: 'asc' }],
        ...calcularSkipTake(parametros),
      }),
      prisma.alumno.count({ where }),
    ])

    const alumnoIds = pagina.map((alumno) => alumno.id)
    const turnos =
      alumnoIds.length === 0
        ? []
        : await prisma.turno.findMany({
            where: { ...condicionDelProfesor, alumnoId: { in: alumnoIds } },
            select: { alumnoId: true, materia: { select: { id: true, nombre: true } } },
            orderBy: [{ materia: { busqueda: 'asc' } }, { materiaId: 'asc' }],
          })
    const materiasPorAlumno = agruparMateriasPorAlumno(turnos)

    return {
      data: pagina.map((alumno) => ({
        ...alumno,
        materias: materiasPorAlumno.get(alumno.id) ?? [],
      })),
      meta: armarMeta(parametros, total),
    }
  },

  /** Detalle con la auditoría y el acceso al portal, o `null` si no existe. */
  buscarPorId,

  /** Nombre, apellido, usuario y foto del alumno, para su menú del portal. `null` si no existe. */
  async buscarPerfil(alumnoId: number): Promise<MiPerfilGuardado | null> {
    const fila = await prisma.alumno.findUnique({
      where: { id: alumnoId },
      select: {
        nombre: true,
        apellido: true,
        avatarKey: true,
        usuario: { select: { username: true } },
      },
    })
    return (
      fila && {
        nombre: fila.nombre,
        apellido: fila.apellido,
        usuario: fila.usuario?.username ?? null,
        avatarKey: fila.avatarKey,
      }
    )
  },

  /** Usuarios ya tomados que arrancan con `base`, para calcular el sufijo libre (HU-27). */
  usuariosTomados,

  /** Si ese DNI ya tiene una cuenta (un profesor que además toma clases, punto 10 de las PO). */
  async existeUsuarioConDni(dni: string): Promise<boolean> {
    const usuario = await prisma.usuario.findUnique({ where: { dni }, select: { id: true } })
    return usuario !== null
  },

  /**
   * Alta del alumno y de su acceso al portal (HU-27) en una sola transacción: `Alumno`, `Usuario`
   * (rol ALUMNO) y su `Account` credential con el DNI como contraseña inicial. Si otra alta se
   * queda con el usuario entre la consulta y el `INSERT` (P2002), se reintenta con el sufijo
   * siguiente. DNI repetido (de alumno o de usuario) → `ConflictError`.
   */
  async crear(datos: CrearAlumno & { busqueda: string }, actor: Actor): Promise<AlumnoGuardado> {
    const { fechaNacimiento, ...resto } = datos
    const base = usuarioBase(datos.nombre, datos.apellido, datos.dni)

    for (let intento = 1; intento <= MAX_INTENTOS_USUARIO; intento++) {
      const username = primerUsuarioLibre(base, await usuariosTomados(base))
      try {
        const alumnoId = await prisma.$transaction(async (tx) => {
          const alumno = await tx.alumno.create({
            data: {
              ...resto,
              fechaNacimiento: fechaADate(fechaNacimiento),
              createdById: actor.userId,
              updatedById: actor.userId,
            },
            select: { id: true },
          })
          await crearCuentaDelAlumno(tx, alumno.id, datos, username, actor)
          return alumno.id
        })

        const guardado = await buscarPorId(alumnoId)
        if (!guardado) throw new Error('Alumno recién creado no encontrado')
        return guardado
      } catch (error) {
        if (!esUsuarioOcupado(error)) traducirDuplicado(error)
      }
    }
    throw new ConflictError('No se pudo generar un usuario para el alumno')
  },

  /**
   * Crea el acceso al portal de un alumno que todavía no lo tiene (alumnos anteriores a este
   * incremento, HU-27), con la misma regla y el DNI como contraseña inicial. `null` si el alumno
   * no existe; si ya tiene acceso, `ConflictError`.
   */
  async crearAcceso(id: number, actor: Actor): Promise<AlumnoGuardado | null> {
    const alumno = await prisma.alumno.findUnique({
      where: { id },
      select: {
        nombre: true,
        apellido: true,
        dni: true,
        telefono: true,
        tutorTelefono: true,
        usuario: { select: { id: true } },
      },
    })
    if (!alumno) return null
    if (alumno.usuario) throw new ConflictError(MENSAJE_ACCESO_EXISTENTE)

    const base = usuarioBase(alumno.nombre, alumno.apellido, alumno.dni)
    for (let intento = 1; intento <= MAX_INTENTOS_USUARIO; intento++) {
      const username = primerUsuarioLibre(base, await usuariosTomados(base))
      try {
        await prisma.$transaction((tx) => crearCuentaDelAlumno(tx, id, alumno, username, actor))
        return buscarPorId(id)
      } catch (error) {
        if (!esUsuarioOcupado(error)) traducirDuplicado(error)
      }
    }
    throw new ConflictError('No se pudo generar un usuario para el alumno')
  },

  /**
   * Restablece la contraseña al DNI del alumno, deja `contrasenaInicial: true` y registra quién y
   * cuándo (T-135). `null` si el alumno no existe; sin acceso, `ConflictError`.
   */
  async restablecerContrasena(id: number, actor: Actor): Promise<AlumnoGuardado | null> {
    const alumno = await prisma.alumno.findUnique({
      where: { id },
      select: { dni: true, usuario: { select: { id: true } } },
    })
    if (!alumno) return null
    if (!alumno.usuario) throw new ConflictError(MENSAJE_SIN_ACCESO)

    const hash = await hashPassword(alumno.dni)
    await prisma.account.updateMany({
      where: { userId: alumno.usuario.id, providerId: 'credential' },
      data: {
        password: hash,
        contrasenaInicial: true,
        contrasenaRestablecidaPorId: actor.userId,
        contrasenaRestablecidaFecha: new Date(),
      },
    })
    return buscarPorId(id)
  },

  /**
   * Edición parcial (lo `undefined` no cambia; `null` borra) con `updatedById` del actor. Si cambia
   * el nombre o el apellido y el alumno tiene cuenta, sincroniza los de su `Usuario` en la misma
   * transacción: el usuario de ingreso **no** cambia (HU-27), sólo el nombre que muestra la sesión.
   * Inexistente → `NotFoundError`.
   */
  async actualizar(
    id: number,
    datos: EditarAlumno & { busqueda: string },
    actor: Actor,
  ): Promise<AlumnoGuardado> {
    const { fechaNacimiento, ...resto } = datos
    try {
      await prisma.$transaction(async (tx) => {
        const alumno = await tx.alumno.update({
          where: { id },
          data: {
            ...resto,
            ...(fechaNacimiento === undefined
              ? {}
              : { fechaNacimiento: fechaADate(fechaNacimiento) }),
            updatedById: actor.userId,
          },
          select: {
            nombre: true,
            apellido: true,
            dni: true,
            usuario: { select: { id: true } },
          },
        })
        const cambiaElNombre = datos.nombre !== undefined || datos.apellido !== undefined
        if (alumno.usuario && cambiaElNombre) {
          await tx.usuario.update({
            where: { id: alumno.usuario.id },
            data: {
              nombre: alumno.nombre,
              apellido: alumno.apellido,
              busqueda: busquedaDeUsuario(alumno),
              updatedById: actor.userId,
            },
          })
        }
      })
      const guardado = await buscarPorId(id)
      if (!guardado) throw new NotFoundError('Alumno no encontrado')
      return guardado
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundError('Alumno no encontrado', { cause: error })
      }
      traducirDuplicado(error)
    }
  },

  /**
   * Sube (o reemplaza) la foto: guarda el objeto nuevo, actualiza la clave del alumno y recién
   * entonces borra el anterior. `null` si el alumno no existe.
   */
  async actualizarFoto(
    id: number,
    foto: { bytes: Uint8Array; mimeType: FotoMimeType },
    actor: Actor,
  ): Promise<AlumnoGuardado | null> {
    const alumno = await prisma.alumno.findUnique({ where: { id }, select: { avatarKey: true } })
    if (!alumno) return null

    const key = claveDeArchivo(`alumnos/${id}`, FOTO_EXTENSIONES[foto.mimeType])
    await putObject(key, foto.bytes, foto.mimeType)
    await prisma.alumno.update({
      where: { id },
      data: {
        avatarKey: key,
        avatarMimeType: foto.mimeType,
        avatarUpdatedAt: new Date(),
        updatedById: actor.userId,
      },
    })
    if (alumno.avatarKey) await deleteObject(alumno.avatarKey)

    return buscarPorId(id)
  },

  /** Quita la foto (si tiene) y borra el objeto. `null` si el alumno no existe. */
  async quitarFoto(id: number, actor: Actor): Promise<AlumnoGuardado | null> {
    const alumno = await prisma.alumno.findUnique({ where: { id }, select: { avatarKey: true } })
    if (!alumno) return null

    if (alumno.avatarKey) {
      await prisma.alumno.update({
        where: { id },
        data: {
          avatarKey: null,
          avatarMimeType: null,
          avatarUpdatedAt: null,
          updatedById: actor.userId,
        },
      })
      await deleteObject(alumno.avatarKey)
    }

    return buscarPorId(id)
  },
}

export type AlumnosRepository = typeof alumnosRepository
