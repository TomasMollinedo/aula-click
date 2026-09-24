import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import type { AlumnosRepository } from '../alumnos.repository'
import { crearAlumnosService } from '../alumnos.service'
import type { AlumnoGuardado, CrearAlumno } from '../alumnos.validation'

// El repository se reemplaza por un falso: sin Docker ni Postgres. El service importa el
// repository solo como tipo, así que no hace falta mockear el módulo real.

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

// Mediodía del 22/09/2026 en Salta (UTC-3).
const HOY = '2026-09-22'
const relojFijo = () => new Date('2026-09-22T15:00:00Z')

const MENSAJE_TUTOR = 'Obligatorio para menores de edad'

const adulto = {
  nombre: 'Juan',
  apellido: 'González',
  dni: '30123456',
  fechaNacimiento: '1990-05-14',
  email: 'juan.gonzalez@mail.com',
  telefono: '387154123456',
} satisfies CrearAlumno

const tutor = {
  tutorNombre: 'Marta',
  tutorApellido: 'Álvarez',
  tutorTelefono: '387154339876',
  tutorEmail: 'marta.alvarez@mail.com',
}

// Menor en HOY: cumple 18 el 08/03/2030.
const menor = { ...adulto, nombre: 'Lucía', dni: '52345678', fechaNacimiento: '2012-03-08' }

function guardado(campos: Partial<AlumnoGuardado> = {}): AlumnoGuardado {
  return {
    id: 1,
    ...adulto,
    nivelEscolaridad: null,
    grado: null,
    institucionEducativa: null,
    observaciones: null,
    tutorNombre: null,
    tutorApellido: null,
    tutorDni: null,
    tutorTelefono: null,
    tutorEmail: null,
    estado: 'ACTIVO',
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    createdBy: { id: 'usr_mesa', nombre: 'Ana', apellido: 'Pérez' },
    updatedBy: { id: 'usr_mesa', nombre: 'Ana', apellido: 'Pérez' },
    ...campos,
  }
}

function crearRepository() {
  return {
    listar: vi.fn<AlumnosRepository['listar']>(),
    buscarPorId: vi.fn<AlumnosRepository['buscarPorId']>(),
    crear: vi.fn<AlumnosRepository['crear']>(),
    actualizar: vi.fn<AlumnosRepository['actualizar']>(),
  }
}

let repository: ReturnType<typeof crearRepository>
let service: ReturnType<typeof crearAlumnosService>

beforeEach(() => {
  repository = crearRepository()
  service = crearAlumnosService({ repository, reloj: relojFijo })
})

/** Ejecuta `accion`, que debe fallar con `ValidationError`, y devuelve sus `details`. */
async function detallesDe(accion: Promise<unknown>) {
  const error = await accion.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ValidationError)
  return (error as ValidationError).details
}

const faltaTutor = (...campos: string[]) =>
  campos.map((campo) => ({ path: [campo], message: MENSAJE_TUTOR }))

describe('listar', () => {
  const vacio = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }

  beforeEach(() => {
    repository.listar.mockResolvedValue(vacio)
  })

  it.each([
    ['  GONZÁLEZ ', ['gonzalez']],
    ['gonz', ['gonz']],
    ['juan  gonz', ['juan', 'gonz']],
    ['30.123', ['30123']],
    ['', []],
    [undefined, []],
    ['a b c d e f g', ['a', 'b', 'c', 'd', 'e']],
  ])('q %o → términos %o', async (q, terminos) => {
    await expect(service.listar({ page: 2, pageSize: 10, q })).resolves.toEqual(vacio)
    expect(repository.listar).toHaveBeenCalledWith({ page: 2, pageSize: 10, terminos })
  })
})

describe('obtener', () => {
  it('devuelve el detalle con menorDeEdad', async () => {
    repository.buscarPorId.mockResolvedValue(guardado({ fechaNacimiento: menor.fechaNacimiento }))

    const alumno = await service.obtener(1)

    expect(repository.buscarPorId).toHaveBeenCalledWith(1)
    expect(alumno).toEqual({
      ...guardado({ fechaNacimiento: menor.fechaNacimiento }),
      menorDeEdad: true,
    })
  })

  it('un adulto tiene menorDeEdad false', async () => {
    repository.buscarPorId.mockResolvedValue(guardado())
    expect((await service.obtener(1)).menorDeEdad).toBe(false)
  })

  it('inexistente → NotFoundError', async () => {
    repository.buscarPorId.mockResolvedValue(null)
    await expect(service.obtener(99)).rejects.toThrow(NotFoundError)
  })
})

describe('crear', () => {
  beforeEach(() => {
    repository.crear.mockResolvedValue(guardado())
  })

  it('adulto con solo los obligatorios: pasa los datos, la busqueda normalizada y el actor', async () => {
    const alumno = await service.crear(adulto, actor)

    expect(repository.crear).toHaveBeenCalledWith(
      { ...adulto, busqueda: 'gonzalez juan 30123456' },
      actor,
    )
    expect(alumno).toEqual({ ...guardado(), menorDeEdad: false })
  })

  it('menor sin tutor → un solo ValidationError con los 4 campos del tutor', async () => {
    const details = await detallesDe(service.crear(menor, actor))

    expect(details).toEqual(
      faltaTutor('tutorNombre', 'tutorApellido', 'tutorTelefono', 'tutorEmail'),
    )
    expect(repository.crear).not.toHaveBeenCalled()
  })

  it('menor con tutor incompleto → solo los campos que faltan (tutorDni no es obligatorio)', async () => {
    const details = await detallesDe(
      service.crear({ ...menor, tutorNombre: 'Marta', tutorEmail: null }, actor),
    )
    expect(details).toEqual(faltaTutor('tutorApellido', 'tutorTelefono', 'tutorEmail'))
  })

  it('menor con los obligatorios y los 4 del tutor, sin datos escolares → ok', async () => {
    repository.crear.mockResolvedValue(guardado({ ...menor, ...tutor }))

    const alumno = await service.crear({ ...menor, ...tutor }, actor)

    expect(repository.crear).toHaveBeenCalledWith(
      { ...menor, ...tutor, busqueda: 'gonzalez lucia 52345678' },
      actor,
    )
    expect(alumno.menorDeEdad).toBe(true)
  })

  it('los datos del tutor de un adulto se guardan tal cual', async () => {
    await service.crear({ ...adulto, ...tutor, tutorDni: '20111222' }, actor)

    expect(repository.crear).toHaveBeenCalledWith(
      expect.objectContaining({ ...tutor, tutorDni: '20111222' }),
      actor,
    )
  })

  it('el día exacto en que cumple 18 no exige tutor', async () => {
    await service.crear({ ...menor, fechaNacimiento: '2008-09-22' }, actor)
    expect(repository.crear).toHaveBeenCalled()
  })

  it('el día anterior a cumplir 18 exige tutor', async () => {
    const details = await detallesDe(
      service.crear({ ...menor, fechaNacimiento: '2008-09-23' }, actor),
    )
    expect(details).toHaveLength(4)
  })

  it('a las 02:30Z del día en que cumple 18 (23:30 del día anterior en Salta) todavía es menor', async () => {
    const service = crearAlumnosService({
      repository,
      reloj: () => new Date('2026-09-22T02:30:00Z'),
    })
    const details = await detallesDe(
      service.crear({ ...menor, fechaNacimiento: '2008-09-22' }, actor),
    )
    expect(details).toHaveLength(4)
  })

  it('fecha de nacimiento posterior a hoy → ValidationError en fechaNacimiento', async () => {
    const details = await detallesDe(
      service.crear({ ...adulto, ...tutor, fechaNacimiento: '2026-09-23' }, actor),
    )
    expect(details).toEqual([
      { path: ['fechaNacimiento'], message: 'La fecha de nacimiento no puede ser posterior a hoy' },
    ])
    expect(repository.crear).not.toHaveBeenCalled()
  })

  it('nacido hoy es válido (con tutor)', async () => {
    await service.crear({ ...adulto, ...tutor, fechaNacimiento: HOY }, actor)
    expect(repository.crear).toHaveBeenCalled()
  })

  it('DNI duplicado: propaga el ConflictError del repository', async () => {
    repository.crear.mockRejectedValue(new ConflictError('Ya existe un alumno con ese DNI'))
    await expect(service.crear(adulto, actor)).rejects.toThrow(ConflictError)
  })
})

describe('editar', () => {
  beforeEach(() => {
    repository.actualizar.mockResolvedValue(guardado())
  })

  it('inexistente → NotFoundError, sin actualizar', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    await expect(service.editar(99, { nombre: 'Pedro' }, actor)).rejects.toThrow(NotFoundError)
    expect(repository.actualizar).not.toHaveBeenCalled()
  })

  it('DNI duplicado: propaga el ConflictError del repository', async () => {
    repository.buscarPorId.mockResolvedValue(guardado())
    repository.actualizar.mockRejectedValue(new ConflictError('Ya existe un alumno con ese DNI'))

    await expect(service.editar(1, { dni: '40111222' }, actor)).rejects.toThrow(ConflictError)
  })

  it('cambiar la fecha de nacimiento a la de un menor sin tutor cargado → ValidationError', async () => {
    repository.buscarPorId.mockResolvedValue(guardado())

    const details = await detallesDe(service.editar(1, { fechaNacimiento: '2012-03-08' }, actor))

    expect(details).toEqual(
      faltaTutor('tutorNombre', 'tutorApellido', 'tutorTelefono', 'tutorEmail'),
    )
    expect(repository.actualizar).not.toHaveBeenCalled()
  })

  it('borrar el email del tutor de un menor → ValidationError', async () => {
    repository.buscarPorId.mockResolvedValue(guardado({ ...menor, ...tutor }))

    const details = await detallesDe(service.editar(1, { tutorEmail: null }, actor))

    expect(details).toEqual(faltaTutor('tutorEmail'))
  })

  it('fecha de nacimiento futura → ValidationError', async () => {
    repository.buscarPorId.mockResolvedValue(guardado())
    const details = await detallesDe(service.editar(1, { fechaNacimiento: '2027-01-01' }, actor))
    expect(details).toEqual([
      { path: ['fechaNacimiento'], message: 'La fecha de nacimiento no puede ser posterior a hoy' },
    ])
  })

  it('cambiar el apellido recalcula busqueda con el nombre y el DNI actuales', async () => {
    repository.buscarPorId.mockResolvedValue(guardado())

    await service.editar(1, { apellido: 'Pérez' }, actor)

    expect(repository.actualizar).toHaveBeenCalledWith(
      1,
      { apellido: 'Pérez', busqueda: 'perez juan 30123456' },
      actor,
    )
  })

  it('borrar (null) el nivel de escolaridad de un alumno → ok', async () => {
    repository.buscarPorId.mockResolvedValue(
      guardado({ nivelEscolaridad: 'SECUNDARIO', grado: '5° año' }),
    )

    const alumno = await service.editar(1, { nivelEscolaridad: null, grado: null }, actor)

    expect(repository.actualizar).toHaveBeenCalledWith(
      1,
      { nivelEscolaridad: null, grado: null, busqueda: 'gonzalez juan 30123456' },
      actor,
    )
    expect(alumno).toEqual({ ...guardado(), menorDeEdad: false })
  })

  it('editar otro dato de un menor con tutor completo → ok', async () => {
    repository.buscarPorId.mockResolvedValue(guardado({ ...menor, ...tutor }))
    repository.actualizar.mockResolvedValue(guardado({ ...menor, ...tutor, grado: '3° año' }))

    const alumno = await service.editar(1, { grado: '3° año' }, actor)

    expect(alumno.menorDeEdad).toBe(true)
  })
})
