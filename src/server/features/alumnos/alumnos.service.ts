import { NotFoundError, ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { normalizarBusqueda, terminosDeBusqueda } from '@/server/shared/busqueda'
import { hoy, type Reloj } from '@/server/shared/fechas'
import type { AlumnosRepository } from './alumnos.repository'
import type {
  AlumnoDetalle,
  AlumnoGuardado,
  CrearAlumno,
  EditarAlumno,
  ListarAlumnosQuery,
} from './alumnos.validation'
import { esMenorDeEdad } from './edad'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases.

const MENSAJE_INVALIDO = 'Datos de entrada inválidos'
const MENSAJE_TUTOR = 'Obligatorio para menores de edad'
// tutorDni no es obligatorio (HU-01).
const TUTOR_OBLIGATORIO = ['tutorNombre', 'tutorApellido', 'tutorTelefono', 'tutorEmail'] as const

type DatosReglas = Pick<CrearAlumno, 'fechaNacimiento' | (typeof TUTOR_OBLIGATORIO)[number]>

// Mismo formato que el seed usa para los usuarios: apellido, nombre y DNI.
function calcularBusqueda(alumno: { apellido: string; nombre: string; dni: string }): string {
  return normalizarBusqueda(`${alumno.apellido} ${alumno.nombre} ${alumno.dni}`)
}

/** Fecha de nacimiento no futura y, si es menor, los datos del tutor (un solo 400 con todos). */
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
  if (!esMenorDeEdad(datos.fechaNacimiento, fechaHoy)) return

  // Mismo formato que las issues de Zod: el frontend marca los campos igual que en un 400 de Zod.
  const faltantes = TUTOR_OBLIGATORIO.filter((campo) => !datos[campo])
  if (faltantes.length > 0) {
    throw new ValidationError(MENSAJE_INVALIDO, {
      details: faltantes.map((campo) => ({ path: [campo], message: MENSAJE_TUTOR })),
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
  reloj,
}: {
  repository: AlumnosRepository
  reloj?: Reloj
}) {
  // `fechaHoy` se calcula una vez por operación: validación y `menorDeEdad` usan el mismo día.
  const conEdad = (alumno: AlumnoGuardado, fechaHoy: string): AlumnoDetalle => ({
    ...alumno,
    menorDeEdad: esMenorDeEdad(alumno.fechaNacimiento, fechaHoy),
  })

  return {
    listar(query: ListarAlumnosQuery) {
      return repository.listar({
        page: query.page,
        pageSize: query.pageSize,
        terminos: terminosDeBusqueda(query.q),
      })
    },

    async obtener(id: number): Promise<AlumnoDetalle> {
      const alumno = await repository.buscarPorId(id)
      if (!alumno) throw new NotFoundError('Alumno no encontrado')
      return conEdad(alumno, hoy(reloj))
    },

    async crear(datos: CrearAlumno, actor: Actor): Promise<AlumnoDetalle> {
      const fechaHoy = hoy(reloj)
      validarReglas(datos, fechaHoy)
      const alumno = await repository.crear({ ...datos, busqueda: calcularBusqueda(datos) }, actor)
      return conEdad(alumno, fechaHoy)
    },

    /** Las reglas se aplican sobre el estado resultante (actual + cambios). */
    async editar(id: number, cambios: EditarAlumno, actor: Actor): Promise<AlumnoDetalle> {
      const actual = await repository.buscarPorId(id)
      if (!actual) throw new NotFoundError('Alumno no encontrado')

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
