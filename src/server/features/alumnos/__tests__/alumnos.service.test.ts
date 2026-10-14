import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import type { AlumnosRepository } from '../alumnos.repository'
import { crearAlumnosService } from '../alumnos.service'
import type { AlumnoDetalle, AlumnoGuardado, CrearAlumno } from '../alumnos.validation'

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
    avatarKey: null,
    acceso: null,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    createdBy: { id: 'usr_mesa', nombre: 'Ana', apellido: 'Pérez' },
    updatedBy: { id: 'usr_mesa', nombre: 'Ana', apellido: 'Pérez' },
    ...campos,
  }
}

/** Lo que el service devuelve a partir de una fila del repository: sin `avatarKey`, con `fotoUrl`. */
function detalle(alumno: AlumnoGuardado, menorDeEdad: boolean): AlumnoDetalle {
  const { avatarKey, ...resto } = alumno
  return {
    ...resto,
    menorDeEdad,
    fotoUrl: avatarKey === null ? null : `https://minio.local/${avatarKey}`,
  }
}

function crearRepository() {
  return {
    listar: vi.fn<AlumnosRepository['listar']>(),
    listarDeProfesor: vi.fn<AlumnosRepository['listarDeProfesor']>(),
    buscarPorId: vi.fn<AlumnosRepository['buscarPorId']>(),
    crear: vi.fn<AlumnosRepository['crear']>(),
    actualizar: vi.fn<AlumnosRepository['actualizar']>(),
    buscarPerfil: vi.fn<AlumnosRepository['buscarPerfil']>(),
    usuariosTomados: vi.fn<AlumnosRepository['usuariosTomados']>(),
    existeUsuarioConDni: vi.fn<AlumnosRepository['existeUsuarioConDni']>(),
    crearAcceso: vi.fn<AlumnosRepository['crearAcceso']>(),
    restablecerContrasena: vi.fn<AlumnosRepository['restablecerContrasena']>(),
    actualizarFoto: vi.fn<AlumnosRepository['actualizarFoto']>(),
    quitarFoto: vi.fn<AlumnosRepository['quitarFoto']>(),
  }
}

function crearProfesoresRepository() {
  return { buscarIdPorUsuario: vi.fn<ProfesoresRepository['buscarIdPorUsuario']>() }
}

let repository: ReturnType<typeof crearRepository>
let profesoresRepository: ReturnType<typeof crearProfesoresRepository>
let service: ReturnType<typeof crearAlumnosService>
// La URL prefirmada se inyecta (como en `profesores`): el service no conoce `lib/storage`.
const getPresignedUrl = vi.fn<(key: string) => Promise<string>>()

beforeEach(() => {
  repository = crearRepository()
  profesoresRepository = crearProfesoresRepository()
  getPresignedUrl.mockReset()
  getPresignedUrl.mockImplementation((key) => Promise.resolve(`https://minio.local/${key}`))
  repository.existeUsuarioConDni.mockResolvedValue(false)
  repository.usuariosTomados.mockResolvedValue([])
  service = crearAlumnosService({
    repository,
    profesoresRepository,
    getPresignedUrl,
    reloj: relojFijo,
  })
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

describe('listarMisAlumnos', () => {
  const vacio = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }

  beforeEach(() => {
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(3)
    repository.listarDeProfesor.mockResolvedValue(vacio)
  })

  it('resuelve el profesor con el userId del actor, nunca con un id del pedido', async () => {
    await service.listarMisAlumnos({ page: 1, pageSize: 20, q: undefined }, actor)

    expect(profesoresRepository.buscarIdPorUsuario).toHaveBeenCalledWith(actor.userId)
  })

  it('pasa profesorId, materiaId, términos, paginación y la fecha de hoy del reloj', async () => {
    await service.listarMisAlumnos({ page: 2, pageSize: 10, q: 'gonz', materiaId: 7 }, actor)

    expect(repository.listarDeProfesor).toHaveBeenCalledWith({
      profesorId: 3,
      materiaId: 7,
      terminos: ['gonz'],
      page: 2,
      pageSize: 10,
      fechaHoy: HOY,
    })
  })

  it('sin materiaId, lo pasa undefined (sin filtrar por materia)', async () => {
    await service.listarMisAlumnos({ page: 1, pageSize: 20, q: undefined }, actor)

    expect(repository.listarDeProfesor).toHaveBeenCalledWith(
      expect.objectContaining({ materiaId: undefined }),
    )
  })

  it('el usuario de la sesión sin ficha de profesor → NotFoundError, sin listar', async () => {
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(null)

    await expect(
      service.listarMisAlumnos({ page: 1, pageSize: 20, q: undefined }, actor),
    ).rejects.toThrow(NotFoundError)
    expect(repository.listarDeProfesor).not.toHaveBeenCalled()
  })
})

describe('obtener', () => {
  it('devuelve el detalle con menorDeEdad', async () => {
    repository.buscarPorId.mockResolvedValue(guardado({ fechaNacimiento: menor.fechaNacimiento }))

    const alumno = await service.obtener(1)

    expect(repository.buscarPorId).toHaveBeenCalledWith(1)
    expect(alumno).toEqual(detalle(guardado({ fechaNacimiento: menor.fechaNacimiento }), true))
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
    expect(alumno).toEqual(detalle(guardado(), false))
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

  it('mayor sin email → ValidationError en email (T-45, corrige T-25)', async () => {
    const details = await detallesDe(service.crear({ ...adulto, email: null }, actor))

    expect(details).toEqual([{ path: ['email'], message: 'Obligatorio para mayores de edad' }])
    expect(repository.crear).not.toHaveBeenCalled()
  })

  it('mayor sin email ni teléfono → un solo ValidationError con los 2 campos', async () => {
    const details = await detallesDe(
      service.crear({ ...adulto, email: null, telefono: null }, actor),
    )
    expect(details).toEqual([
      { path: ['email'], message: 'Obligatorio para mayores de edad' },
      { path: ['telefono'], message: 'Obligatorio para mayores de edad' },
    ])
  })

  it('menor sin email ni teléfono propios, con tutor completo → ok', async () => {
    const datos = { ...menor, ...tutor, email: null, telefono: null }
    repository.crear.mockResolvedValue(guardado(datos))

    const alumno = await service.crear(datos, actor)

    expect(repository.crear).toHaveBeenCalledWith(
      { ...datos, busqueda: 'gonzalez lucia 52345678' },
      actor,
    )
    expect(alumno.menorDeEdad).toBe(true)
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
      profesoresRepository,
      getPresignedUrl,
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

  it('con dni → ValidationError "El DNI no se puede modificar", sin tocar el repository', async () => {
    const details = await detallesDe(service.editar(1, { dni: '40111222' }, actor))

    expect(details).toEqual([{ path: ['dni'], message: 'El DNI no se puede modificar' }])
    expect(repository.buscarPorId).not.toHaveBeenCalled()
    expect(repository.actualizar).not.toHaveBeenCalled()
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

  it('un menor sin email propio que pasa a mayor → ValidationError en email (T-45)', async () => {
    repository.buscarPorId.mockResolvedValue(guardado({ ...menor, ...tutor, email: null }))

    const details = await detallesDe(
      service.editar(1, { fechaNacimiento: adulto.fechaNacimiento }, actor),
    )

    expect(details).toEqual([{ path: ['email'], message: 'Obligatorio para mayores de edad' }])
    expect(repository.actualizar).not.toHaveBeenCalled()
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
    expect(alumno).toEqual(detalle(guardado(), false))
  })

  it('editar otro dato de un menor con tutor completo → ok', async () => {
    repository.buscarPorId.mockResolvedValue(guardado({ ...menor, ...tutor }))
    repository.actualizar.mockResolvedValue(guardado({ ...menor, ...tutor, grado: '3° año' }))

    const alumno = await service.editar(1, { grado: '3° año' }, actor)

    expect(alumno.menorDeEdad).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------
// Foto (HU-26) y acceso al portal (HU-27, HU-28)
// ---------------------------------------------------------------------------------------------

/** Acceso tal como lo devuelve el repository dentro del detalle. */
const acceso = {
  usuario: 'jgonzalez456',
  creadoPor: { id: 'usr_mesa', nombre: 'Ana', apellido: 'Pérez' },
  creadoEl: '2026-09-01T12:00:00.000Z',
  restablecidaPor: null,
  restablecidaEl: null,
}

describe('foto', () => {
  const jpg = () =>
    new File([new Uint8Array([0xff, 0xd8, 0xff])], 'foto.jpg', { type: 'image/jpeg' })

  it('subir la foto: la manda al repository con sus bytes y devuelve la URL prefirmada', async () => {
    repository.actualizarFoto.mockResolvedValue(guardado({ avatarKey: 'alumnos/1/abc.jpg' }))

    const alumno = await service.subirFoto(1, jpg(), actor)

    expect(repository.actualizarFoto).toHaveBeenCalledWith(
      1,
      { bytes: new Uint8Array([0xff, 0xd8, 0xff]), mimeType: 'image/jpeg' },
      actor,
    )
    expect(alumno.fotoUrl).toBe('https://minio.local/alumnos/1/abc.jpg')
  })

  it('subir la foto de un alumno que no existe → 404', async () => {
    repository.actualizarFoto.mockResolvedValue(null)

    await expect(service.subirFoto(99, jpg(), actor)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('quitar la foto de un alumno que no tiene no es un error', async () => {
    repository.quitarFoto.mockResolvedValue(guardado({ avatarKey: null }))

    const alumno = await service.quitarFoto(1, actor)

    expect(repository.quitarFoto).toHaveBeenCalledWith(1, actor)
    expect(alumno.fotoUrl).toBe(null)
  })

  it('quitar la foto de un alumno que no existe → 404', async () => {
    repository.quitarFoto.mockResolvedValue(null)

    await expect(service.quitarFoto(99, actor)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('sin foto, el detalle no pide ninguna URL prefirmada', async () => {
    repository.buscarPorId.mockResolvedValue(guardado())

    expect((await service.obtener(1)).fotoUrl).toBe(null)
    expect(getPresignedUrl).not.toHaveBeenCalled()
  })
})

describe('usuarioSugerido', () => {
  const datos = { nombre: 'Juan', apellido: 'Pérez', dni: '45123456' }

  it('arma el usuario con la regla de la HU', async () => {
    await expect(service.usuarioSugerido(datos)).resolves.toEqual({ usuario: 'jperez456' })
    expect(repository.usuariosTomados).toHaveBeenCalledWith('jperez456')
  })

  it('con el usuario tomado, sugiere el sufijo siguiente', async () => {
    repository.usuariosTomados.mockResolvedValue(['jperez456', 'jperez456-2'])

    await expect(service.usuarioSugerido(datos)).resolves.toEqual({ usuario: 'jperez456-3' })
  })

  it('normaliza tildes, "ñ" y un apellido compuesto', async () => {
    await expect(
      service.usuarioSugerido({ nombre: 'Ángel', apellido: 'Peña Gutiérrez', dni: '40222333' }),
    ).resolves.toEqual({ usuario: 'apenagutierrez333' })
  })
})

describe('crear con acceso al portal', () => {
  beforeEach(() => {
    repository.crear.mockResolvedValue(guardado({ acceso }))
  })

  it('el alta devuelve el alumno con su acceso', async () => {
    const alumno = await service.crear(adulto, actor)

    expect(repository.crear).toHaveBeenCalledWith(
      { ...adulto, busqueda: 'gonzalez juan 30123456' },
      actor,
    )
    expect(alumno.acceso?.usuario).toBe('jgonzalez456')
  })

  it('un DNI que ya tiene usuario → 409, sin crear nada', async () => {
    repository.existeUsuarioConDni.mockResolvedValue(true)

    const error = await service.crear(adulto, actor).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect((error as ConflictError).message).toBe('Ya existe un usuario con ese DNI')
    expect((error as ConflictError).details).toEqual([
      { path: ['dni'], message: 'Ya existe un usuario con ese DNI' },
    ])
    expect(repository.crear).not.toHaveBeenCalled()
  })

  it('los datos inválidos se rechazan antes de mirar si el DNI ya tiene usuario', async () => {
    await detallesDe(service.crear({ ...menor }, actor))

    expect(repository.existeUsuarioConDni).not.toHaveBeenCalled()
  })
})

describe('crearAcceso', () => {
  it('un alumno sin acceso lo obtiene', async () => {
    repository.buscarPorId.mockResolvedValue(guardado({ acceso: null }))
    repository.crearAcceso.mockResolvedValue(guardado({ acceso }))

    const alumno = await service.crearAcceso(1, actor)

    expect(repository.crearAcceso).toHaveBeenCalledWith(1, actor)
    expect(alumno.acceso?.usuario).toBe('jgonzalez456')
  })

  it('crear el acceso dos veces → 409', async () => {
    repository.buscarPorId.mockResolvedValue(guardado({ acceso }))

    const error = await service.crearAcceso(1, actor).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect((error as ConflictError).message).toBe('El alumno ya tiene acceso al portal')
    expect(repository.crearAcceso).not.toHaveBeenCalled()
  })

  it('un alumno que no existe → 404', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    await expect(service.crearAcceso(99, actor)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('restablecerContrasena', () => {
  it('con acceso, lo restablece y devuelve quién y cuándo', async () => {
    const restablecido = {
      ...acceso,
      restablecidaPor: { id: 'usr_mesa', nombre: 'Ana', apellido: 'Pérez' },
      restablecidaEl: '2026-09-22T15:00:00.000Z',
    }
    repository.buscarPorId.mockResolvedValue(guardado({ acceso }))
    repository.restablecerContrasena.mockResolvedValue(guardado({ acceso: restablecido }))

    const alumno = await service.restablecerContrasena(1, actor)

    expect(repository.restablecerContrasena).toHaveBeenCalledWith(1, actor)
    expect(alumno.acceso?.restablecidaEl).toBe('2026-09-22T15:00:00.000Z')
  })

  it('restablecer sin acceso → 409', async () => {
    repository.buscarPorId.mockResolvedValue(guardado({ acceso: null }))

    const error = await service.restablecerContrasena(1, actor).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect((error as ConflictError).message).toBe('El alumno no tiene acceso al portal')
    expect(repository.restablecerContrasena).not.toHaveBeenCalled()
  })

  it('un alumno que no existe → 404', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    await expect(service.restablecerContrasena(99, actor)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('editar no cambia el usuario (HU-27)', () => {
  it('cambiar el nombre deja el mismo usuario de ingreso', async () => {
    repository.buscarPorId.mockResolvedValue(guardado({ acceso }))
    repository.actualizar.mockResolvedValue(guardado({ nombre: 'Juan Carlos', acceso }))

    const alumno = await service.editar(1, { nombre: 'Juan Carlos' }, actor)

    expect(alumno.acceso?.usuario).toBe('jgonzalez456')
    // La edición no toca la cuenta: el usuario no se regenera ni se consulta.
    expect(repository.usuariosTomados).not.toHaveBeenCalled()
    expect(repository.crearAcceso).not.toHaveBeenCalled()
  })
})

describe('miPerfil', () => {
  const sesionDelAlumno: Actor = { userId: 'usr_alumno', role: 'ALUMNO', alumnoId: 12 }

  it('devuelve el perfil del alumno de la sesión, con su foto', async () => {
    repository.buscarPerfil.mockResolvedValue({
      nombre: 'Lucía',
      apellido: 'Álvarez',
      usuario: 'lalvarez678',
      avatarKey: 'alumnos/12/foto.jpg',
    })

    const perfil = await service.miPerfil(sesionDelAlumno)

    expect(repository.buscarPerfil).toHaveBeenCalledWith(12)
    expect(perfil).toEqual({
      nombre: 'Lucía',
      apellido: 'Álvarez',
      usuario: 'lalvarez678',
      fotoUrl: 'https://minio.local/alumnos/12/foto.jpg',
    })
  })

  it('un usuario de otro rol → 403, sin consultar nada', async () => {
    await expect(service.miPerfil(actor)).rejects.toBeInstanceOf(ForbiddenError)
    expect(repository.buscarPerfil).not.toHaveBeenCalled()
  })

  it('una cuenta ALUMNO sin alumno vinculado → 403', async () => {
    await expect(service.miPerfil({ userId: 'usr_alumno', role: 'ALUMNO' })).rejects.toBeInstanceOf(
      ForbiddenError,
    )
  })

  it('el alumno de la sesión ya no existe → 404', async () => {
    repository.buscarPerfil.mockResolvedValue(null)

    await expect(service.miPerfil(sesionDelAlumno)).rejects.toBeInstanceOf(NotFoundError)
  })
})
