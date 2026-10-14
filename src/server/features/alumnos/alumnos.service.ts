import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import { alumnoDeLaSesion, type Actor } from '@/server/shared/actor'
import { normalizarBusqueda, terminosDeBusqueda } from '@/server/shared/busqueda'
import { hoy, type Reloj } from '@/server/shared/fechas'
import type { AlumnosRepository } from './alumnos.repository'
import type {
  AlumnoDeProfesorFila,
  AlumnoDetalle,
  AlumnoGuardado,
  AlumnoListadoFila,
  AlumnosDeProfesorListado,
  AlumnosListado,
  CrearAlumno,
  EditarAlumno,
  FotoMimeType,
  ListarAlumnosQuery,
  ListarMisAlumnosQuery,
  MiPerfil,
  UsuarioSugerido,
  UsuarioSugeridoQuery,
} from './alumnos.validation'
import { esMenorDeEdad } from './edad'
import {
  MENSAJE_ACCESO_EXISTENTE,
  MENSAJE_SIN_ACCESO,
  primerUsuarioLibre,
  usuarioBase,
} from './usuario-portal'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases.

const MENSAJE_INVALIDO = 'Datos de entrada inválidos'
const MENSAJE_TUTOR = 'Obligatorio para menores de edad'
const MENSAJE_CONTACTO_MAYOR = 'Obligatorio para mayores de edad'
const MENSAJE_DNI_NO_EDITABLE = 'El DNI no se puede modificar'
const MENSAJE_NO_ENCONTRADO = 'Alumno no encontrado'
// Punto 10 de "Puntos a confirmar con las PO": cada persona tiene un solo usuario por DNI.
const MENSAJE_USUARIO_CON_DNI = 'Ya existe un usuario con ese DNI'
// tutorDni no es obligatorio (HU-01).
const TUTOR_OBLIGATORIO = ['tutorNombre', 'tutorApellido', 'tutorTelefono', 'tutorEmail'] as const
// Un menor puede no tener contacto propio (T-45, corrige T-25): en su lugar responden el tutor.
const CONTACTO_OBLIGATORIO = ['email', 'telefono'] as const

type DatosReglas = Pick<
  CrearAlumno,
  'fechaNacimiento' | (typeof TUTOR_OBLIGATORIO)[number] | (typeof CONTACTO_OBLIGATORIO)[number]
>

// Mismo formato que el seed usa para los usuarios: apellido, nombre y DNI.
function calcularBusqueda(alumno: { apellido: string; nombre: string; dni: string }): string {
  return normalizarBusqueda(`${alumno.apellido} ${alumno.nombre} ${alumno.dni}`)
}

/**
 * Fecha de nacimiento no futura y, según la edad, un solo grupo de campos obligatorios: los datos
 * del tutor si es menor, o el email y el teléfono propios si es mayor (T-45, corrige T-25). Un
 * solo 400 con todos los campos que falten del grupo que corresponda.
 */
function validarReglas(datos: DatosReglas, fechaHoy: string): void {
  if (datos.fechaNacimiento > fechaHoy) {
    throw new ValidationError(MENSAJE_INVALIDO, {
      details: [
        {
          path: ['fechaNacimiento'],
          message: 'La fecha de nacimiento no puede ser posterior a hoy',
        },
      ],
    })
  }

  const esMenor = esMenorDeEdad(datos.fechaNacimiento, fechaHoy)
  const obligatorios = esMenor ? TUTOR_OBLIGATORIO : CONTACTO_OBLIGATORIO
  const mensaje = esMenor ? MENSAJE_TUTOR : MENSAJE_CONTACTO_MAYOR

  // Mismo formato que las issues de Zod: el frontend marca los campos igual que en un 400 de Zod.
  const faltantes = obligatorios.filter((campo) => !datos[campo])
  if (faltantes.length > 0) {
    throw new ValidationError(MENSAJE_INVALIDO, {
      details: faltantes.map((campo) => ({ path: [campo], message: mensaje })),
    })
  }
}

// Solo los campos que vienen en la edición (undefined = no cambia).
function sinOmitidos<T extends object>(cambios: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(cambios).filter(([, valor]) => valor !== undefined),
  ) as Partial<T>
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real;
 * los tests, con un repository falso y un reloj fijo. Importa el repository solo como tipo, así
 * el service no carga Prisma ni `@/config/env`.
 */
export function crearAlumnosService({
  repository,
  profesoresRepository,
  getPresignedUrl,
  reloj,
}: {
  repository: AlumnosRepository
  profesoresRepository: Pick<ProfesoresRepository, 'buscarIdPorUsuario'>
  /**
   * Se inyecta (en vez de importar `@/lib/storage` directo) para que el service no cargue
   * `@/config/env`, igual que en `profesores`.
   */
  getPresignedUrl: (key: string) => Promise<string>
  reloj?: Reloj
}) {
  /** `avatarKey` (interno) → `fotoUrl` (URL prefirmada, o `null` si no tiene). */
  async function fotoUrlDe(avatarKey: string | null): Promise<string | null> {
    return avatarKey ? await getPresignedUrl(avatarKey) : null
  }

  // `fechaHoy` se calcula una vez por operación: validación y `menorDeEdad` usan el mismo día.
  async function conEdad(alumno: AlumnoGuardado, fechaHoy: string): Promise<AlumnoDetalle> {
    const { avatarKey, ...resto } = alumno
    return {
      ...resto,
      menorDeEdad: esMenorDeEdad(alumno.fechaNacimiento, fechaHoy),
      fotoUrl: await fotoUrlDe(avatarKey),
    }
  }

  async function conFotoUrl<T extends { avatarKey: string | null }>(
    fila: T,
  ): Promise<Omit<T, 'avatarKey'> & { fotoUrl: string | null }> {
    const { avatarKey, ...resto } = fila
    return { ...resto, fotoUrl: await fotoUrlDe(avatarKey) }
  }

  /** El detalle de un alumno que una escritura devolvió, o 404 si entre medio dejó de existir. */
  async function detalleDe(alumno: AlumnoGuardado | null): Promise<AlumnoDetalle> {
    if (!alumno) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)
    return conEdad(alumno, hoy(reloj))
  }

  return {
    async listar(query: ListarAlumnosQuery): Promise<AlumnosListado> {
      const pagina = await repository.listar({
        page: query.page,
        pageSize: query.pageSize,
        terminos: terminosDeBusqueda(query.q),
      })
      return {
        data: await Promise.all(pagina.data.map((fila: AlumnoListadoFila) => conFotoUrl(fila))),
        meta: pagina.meta,
      }
    },

    /**
     * Alumnos del profesor de la sesión (el `id` nunca viaja en un parámetro: sale del `Actor`,
     * igual que `agenda-propia` de `turnos`). Sin ficha de profesor → `NotFoundError`.
     */
    async listarMisAlumnos(
      query: ListarMisAlumnosQuery,
      actor: Actor,
    ): Promise<AlumnosDeProfesorListado> {
      const profesorId = await profesoresRepository.buscarIdPorUsuario(actor.userId)
      if (profesorId === null) throw new NotFoundError('El usuario no tiene ficha de profesor')
      const pagina = await repository.listarDeProfesor({
        profesorId,
        materiaId: query.materiaId,
        terminos: terminosDeBusqueda(query.q),
        page: query.page,
        pageSize: query.pageSize,
        fechaHoy: hoy(reloj),
      })
      return {
        data: await Promise.all(pagina.data.map((fila: AlumnoDeProfesorFila) => conFotoUrl(fila))),
        meta: pagina.meta,
      }
    },

    async obtener(id: number): Promise<AlumnoDetalle> {
      return detalleDe(await repository.buscarPorId(id))
    },

    /**
     * Alta del alumno y de su acceso al portal (HU-27), en una sola transacción del repository: si
     * algo falla no queda ni el alumno ni la cuenta. Un DNI que ya tiene usuario (por ejemplo, el de
     * un profesor que además toma clases) se rechaza con 409: cada persona tiene un solo usuario por
     * DNI (punto 10 de "Puntos a confirmar con las PO" del Sprint 3).
     */
    async crear(datos: CrearAlumno, actor: Actor): Promise<AlumnoDetalle> {
      const fechaHoy = hoy(reloj)
      validarReglas(datos, fechaHoy)
      if (await repository.existeUsuarioConDni(datos.dni)) {
        throw new ConflictError(MENSAJE_USUARIO_CON_DNI, {
          details: [{ path: ['dni'], message: MENSAJE_USUARIO_CON_DNI }],
        })
      }
      const alumno = await repository.crear({ ...datos, busqueda: calcularBusqueda(datos) }, actor)
      return conEdad(alumno, fechaHoy)
    },

    /**
     * Usuario que se le asignaría al alumno con esos datos (HU-27), para mostrarlo en el formulario
     * de alta. Es sólo una sugerencia: el definitivo se calcula al guardar, porque entre la consulta
     * y el alta otro alumno puede quedarse con él.
     */
    async usuarioSugerido(query: UsuarioSugeridoQuery): Promise<UsuarioSugerido> {
      const base = usuarioBase(query.nombre, query.apellido, query.dni)
      return { usuario: primerUsuarioLibre(base, await repository.usuariosTomados(base)) }
    },

    /**
     * Crea el acceso al portal de un alumno anterior a este incremento (HU-27). Si ya lo tiene,
     * 409: cada alumno tiene una sola cuenta.
     */
    async crearAcceso(id: number, actor: Actor): Promise<AlumnoDetalle> {
      const alumno = await repository.buscarPorId(id)
      if (!alumno) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)
      if (alumno.acceso) throw new ConflictError(MENSAJE_ACCESO_EXISTENTE)
      return detalleDe(await repository.crearAcceso(id, actor))
    },

    /**
     * Restablece la contraseña del alumno a su DNI (HU-27) y registra quién y cuándo (T-135). Sin
     * acceso al portal, 409: no hay contraseña que restablecer.
     */
    async restablecerContrasena(id: number, actor: Actor): Promise<AlumnoDetalle> {
      const alumno = await repository.buscarPorId(id)
      if (!alumno) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)
      if (!alumno.acceso) throw new ConflictError(MENSAJE_SIN_ACCESO)
      return detalleDe(await repository.restablecerContrasena(id, actor))
    },

    /** Sube o reemplaza la foto (JPG o PNG, ya validados por el schema). */
    async subirFoto(id: number, foto: File, actor: Actor): Promise<AlumnoDetalle> {
      // El tipo ya lo validó subirFotoAlumnoSchema (solo JPG o PNG llegan hasta acá).
      const mimeType = foto.type as FotoMimeType
      const bytes = new Uint8Array(await foto.arrayBuffer())
      return detalleDe(await repository.actualizarFoto(id, { bytes, mimeType }, actor))
    },

    /** Quita la foto, si tiene. Sin foto no es un error: es idempotente. */
    async quitarFoto(id: number, actor: Actor): Promise<AlumnoDetalle> {
      return detalleDe(await repository.quitarFoto(id, actor))
    },

    /**
     * Perfil del alumno de la sesión, para el menú del portal (HU-28). El alumno sale del `Actor`
     * (`alumnoDeLaSesion`): nunca de un parámetro, así nadie pide el perfil de otro.
     */
    async miPerfil(actor: Actor): Promise<MiPerfil> {
      const perfil = await repository.buscarPerfil(alumnoDeLaSesion(actor))
      if (!perfil) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)
      return conFotoUrl(perfil)
    },

    /**
     * Las reglas se aplican sobre el estado resultante (actual + cambios). El DNI no se puede
     * modificar (T-45): un `dni` en el body se rechaza, nunca se ignora en silencio.
     */
    async editar(id: number, cambios: EditarAlumno, actor: Actor): Promise<AlumnoDetalle> {
      if (cambios.dni !== undefined) {
        throw new ValidationError(MENSAJE_INVALIDO, {
          details: [{ path: ['dni'], message: MENSAJE_DNI_NO_EDITABLE }],
        })
      }

      const actual = await repository.buscarPorId(id)
      if (!actual) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)

      const fechaHoy = hoy(reloj)
      const resultado = { ...actual, ...sinOmitidos(cambios) }
      validarReglas(resultado, fechaHoy)
      const alumno = await repository.actualizar(
        id,
        { ...cambios, busqueda: calcularBusqueda(resultado) },
        actor,
      )
      return conEdad(alumno, fechaHoy)
    },
  }
}

export type AlumnosService = ReturnType<typeof crearAlumnosService>
