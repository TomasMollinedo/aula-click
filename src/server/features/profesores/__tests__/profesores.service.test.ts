import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError } from '@/server/errors'
import type { MateriasRepository } from '@/server/features/materias/materias.repository'
import type { MateriaConEstado } from '@/server/features/materias/materias.validation'
import type { TurnosRepository } from '@/server/features/turnos/turnos.repository'
import type { Actor } from '@/server/shared/actor'
import type { ProfesoresRepository } from '../profesores.repository'
import { crearProfesoresService } from '../profesores.service'
import type { ProfesorConAsignaciones, ProfesorGuardado } from '../profesores.validation'

// Los repositories se reemplazan por falsos: sin Docker ni Postgres. El service los importa solo
// como tipo, así que no hace falta mockear los módulos reales.

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

// Mediodía del 22/09/2026 en Salta (UTC-3).
const HOY = '2026-09-22'
const relojFijo = () => new Date('2026-09-22T15:00:00Z')

const MATEMATICA: MateriaConEstado = { id: 2, nombre: 'Matemática', estado: 'ACTIVO' }
const FISICA: MateriaConEstado = { id: 7, nombre: 'Física', estado: 'ACTIVO' }
const QUIMICA_INACTIVA: MateriaConEstado = { id: 9, nombre: 'Química', estado: 'INACTIVO' }

type Asignacion = ProfesorConAsignaciones['asignaciones'][number]
const asignacion = (materia: MateriaConEstado, estado: Asignacion['estado']): Asignacion => ({
  materiaId: materia.id,
  nombre: materia.nombre,
  estado,
})
const profesor = (
  asignaciones: Asignacion[] = [],
  estado: ProfesorConAsignaciones['estado'] = 'ACTIVO',
): ProfesorConAsignaciones => ({ estado, asignaciones })

const GUARDADO: ProfesorGuardado = {
  id: 3,
  nombre: 'Martín',
  apellido: 'Pérez',
  dni: '28333444',
  telefono: '3874333444',
  email: 'martin.perez@aulaclick.local',
  titulo: 'Profesor en Matemática',
  matricula: 'MP-0001',
  capacidad: 5,
  estado: 'ACTIVO',
  avatarKey: null,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  createdBy: null,
  updatedBy: null,
}

/** `ProfesorGuardado` (con `avatarKey`) → `ProfesorDetalle` esperado (con `fotoUrl`). */
function conFotoUrlEsperada(guardado: ProfesorGuardado) {
  const { avatarKey, ...resto } = guardado
  return { ...resto, fotoUrl: avatarKey ? `https://minio.local/${avatarKey}` : null }
}

function crearRepositories() {
  return {
    repository: {
      listar: vi.fn<ProfesoresRepository['listar']>(),
      buscarPorId: vi.fn<ProfesoresRepository['buscarPorId']>(),
      crear: vi.fn<ProfesoresRepository['crear']>(),
      actualizar: vi.fn<ProfesoresRepository['actualizar']>(),
      actualizarFoto: vi.fn<ProfesoresRepository['actualizarFoto']>(),
      quitarFoto: vi.fn<ProfesoresRepository['quitarFoto']>(),
      listarMateriasAsignadas: vi.fn<ProfesoresRepository['listarMateriasAsignadas']>(),
      buscarConAsignaciones: vi.fn<ProfesoresRepository['buscarConAsignaciones']>(),
      asignarMaterias: vi.fn<ProfesoresRepository['asignarMaterias']>(),
      quitarMaterias: vi.fn<ProfesoresRepository['quitarMaterias']>(),
      buscarParaBloque: vi.fn<ProfesoresRepository['buscarParaBloque']>(),
      buscarCapacidad: vi.fn<ProfesoresRepository['buscarCapacidad']>(),
      listarProfesoresDeMateria: vi.fn<ProfesoresRepository['listarProfesoresDeMateria']>(),
      listarProfesoresActivosDeMateria:
        vi.fn<ProfesoresRepository['listarProfesoresActivosDeMateria']>(),
    },
    materiasRepository: { buscarPorIds: vi.fn<MateriasRepository['buscarPorIds']>() },
    turnosRepository: {
      contarVigentesPorMateria: vi.fn<TurnosRepository['contarVigentesPorMateria']>(),
    },
    getPresignedUrl: vi.fn<(key: string) => Promise<string>>(),
  }
}

let repository: ReturnType<typeof crearRepositories>['repository']
let materiasRepository: ReturnType<typeof crearRepositories>['materiasRepository']
let turnosRepository: ReturnType<typeof crearRepositories>['turnosRepository']
let getPresignedUrl: ReturnType<typeof crearRepositories>['getPresignedUrl']
let service: ReturnType<typeof crearProfesoresService>

beforeEach(() => {
  ;({ repository, materiasRepository, turnosRepository, getPresignedUrl } = crearRepositories())
  service = crearProfesoresService({
    repository,
    materiasRepository,
    turnosRepository,
    getPresignedUrl,
    reloj: relojFijo,
  })
  repository.listarMateriasAsignadas.mockResolvedValue([
    { id: 7, nombre: 'Física' },
    { id: 2, nombre: 'Matemática' },
  ])
  getPresignedUrl.mockImplementation((key) => Promise.resolve(`https://minio.local/${key}`))
})

/** Ejecuta `accion`, que debe fallar, y devuelve el error. */
function errorDe(accion: Promise<unknown>) {
  return accion.then(
    () => expect.fail('Se esperaba un error'),
    (error: unknown) => error,
  )
}

const ALTA = {
  nombre: 'Martín',
  apellido: 'Pérez',
  dni: '28333444',
  telefono: '3874333444',
  email: 'martin.perez@aulaclick.local',
  titulo: 'Profesor en Matemática',
  matricula: 'MP-0001',
  capacidad: 5,
  password: 'inicial-2026',
}

describe('listar', () => {
  it('pagina, busca por palabras y arma la URL prefirmada de la foto', async () => {
    repository.listar.mockResolvedValue({
      data: [
        {
          id: 3,
          apellido: 'Pérez',
          nombre: 'Martín',
          dni: '28333444',
          estado: 'ACTIVO',
          avatarKey: 'k1',
        },
        {
          id: 7,
          apellido: 'Gómez',
          nombre: 'Luis',
          dni: '30111222',
          estado: 'ACTIVO',
          avatarKey: null,
        },
      ],
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    })

    const resultado = await service.listar({
      page: 1,
      pageSize: 20,
      q: 'perez',
      estado: 'ACTIVO',
    })

    expect(repository.listar).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      terminos: ['perez'],
      estado: 'ACTIVO',
      materiaId: undefined,
    })
    expect(resultado.data).toEqual([
      {
        id: 3,
        apellido: 'Pérez',
        nombre: 'Martín',
        dni: '28333444',
        estado: 'ACTIVO',
        fotoUrl: 'https://minio.local/k1',
      },
      {
        id: 7,
        apellido: 'Gómez',
        nombre: 'Luis',
        dni: '30111222',
        estado: 'ACTIVO',
        fotoUrl: null,
      },
    ])
  })

  it('estado TODOS no filtra: se lo pasa como undefined al repository', async () => {
    repository.listar.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })

    await service.listar({ page: 1, pageSize: 20, estado: 'TODOS' })

    expect(repository.listar).toHaveBeenCalledWith(expect.objectContaining({ estado: undefined }))
  })

  it('pasa materiaId al repository', async () => {
    repository.listar.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })

    await service.listar({ page: 1, pageSize: 20, estado: 'ACTIVO', materiaId: 2 })

    expect(repository.listar).toHaveBeenCalledWith(expect.objectContaining({ materiaId: 2 }))
  })
})

describe('obtener', () => {
  it('devuelve el detalle con fotoUrl null si no tiene foto', async () => {
    repository.buscarPorId.mockResolvedValue(GUARDADO)

    await expect(service.obtener(3)).resolves.toEqual(conFotoUrlEsperada(GUARDADO))
  })

  it('con avatarKey arma la URL prefirmada', async () => {
    repository.buscarPorId.mockResolvedValue({ ...GUARDADO, avatarKey: 'profesores/3/a.jpg' })

    const detalle = await service.obtener(3)

    expect(detalle.fotoUrl).toBe('https://minio.local/profesores/3/a.jpg')
    expect(getPresignedUrl).toHaveBeenCalledWith('profesores/3/a.jpg')
  })

  it('profesor inexistente → NotFoundError', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    await expect(service.obtener(99)).rejects.toThrow(NotFoundError)
  })
})

describe('crear', () => {
  it('crea al profesor con la busqueda calculada y devuelve el detalle', async () => {
    repository.crear.mockResolvedValue(GUARDADO)

    const resultado = await service.crear(ALTA, actor)

    expect(repository.crear).toHaveBeenCalledWith(
      { ...ALTA, busqueda: 'perez martin 28333444' },
      actor,
    )
    expect(resultado).toEqual(conFotoUrlEsperada(GUARDADO))
  })

  it('DNI, email o matrícula repetidos: el repository lanza y el service no lo atrapa', async () => {
    repository.crear.mockRejectedValue(new ConflictError('Ya existe un profesor con ese DNI'))

    await expect(service.crear(ALTA, actor)).rejects.toThrow(ConflictError)
  })
})

describe('editar', () => {
  it('recalcula la busqueda sobre el estado resultante (actual + cambios)', async () => {
    repository.buscarPorId.mockResolvedValue(GUARDADO)
    repository.actualizar.mockResolvedValue({ ...GUARDADO, apellido: 'Gómez' })

    await service.editar(3, { apellido: 'Gómez' }, actor)

    expect(repository.actualizar).toHaveBeenCalledWith(
      3,
      { apellido: 'Gómez', busqueda: 'gomez martin 28333444' },
      actor,
    )
  })

  it('profesor inexistente → NotFoundError, sin llamar a actualizar', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    const error = await errorDe(service.editar(99, { telefono: '3874000000' }, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(repository.actualizar).not.toHaveBeenCalled()
  })
})

describe('subirFoto', () => {
  it('sube la foto y devuelve el detalle con la URL prefirmada', async () => {
    repository.actualizarFoto.mockResolvedValue({ ...GUARDADO, avatarKey: 'profesores/3/x.png' })
    const foto = new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' })

    const detalle = await service.subirFoto(3, foto, actor)

    expect(repository.actualizarFoto).toHaveBeenCalledWith(
      3,
      { bytes: expect.any(Uint8Array), mimeType: 'image/png' },
      actor,
    )
    expect(detalle.fotoUrl).toBe('https://minio.local/profesores/3/x.png')
  })

  it('profesor inexistente → NotFoundError', async () => {
    repository.actualizarFoto.mockResolvedValue(null)
    const foto = new File([new Uint8Array([1])], 'foto.jpg', { type: 'image/jpeg' })

    await expect(service.subirFoto(99, foto, actor)).rejects.toThrow(NotFoundError)
  })
})

describe('quitarFoto', () => {
  it('quita la foto y devuelve el detalle sin ella', async () => {
    repository.quitarFoto.mockResolvedValue({ ...GUARDADO, avatarKey: null })

    const detalle = await service.quitarFoto(3, actor)

    expect(repository.quitarFoto).toHaveBeenCalledWith(3, actor)
    expect(detalle.fotoUrl).toBeNull()
  })

  it('profesor inexistente → NotFoundError', async () => {
    repository.quitarFoto.mockResolvedValue(null)

    await expect(service.quitarFoto(99, actor)).rejects.toThrow(NotFoundError)
  })
})

describe('listarMateriasAsignadas', () => {
  it('devuelve las materias con asignación activa que informa el repository', async () => {
    await expect(service.listarMateriasAsignadas(3)).resolves.toEqual([
      { id: 7, nombre: 'Física' },
      { id: 2, nombre: 'Matemática' },
    ])
    expect(repository.listarMateriasAsignadas).toHaveBeenCalledWith(3)
  })

  it('un profesor sin materias asignadas devuelve un arreglo vacío', async () => {
    repository.listarMateriasAsignadas.mockResolvedValue([])

    await expect(service.listarMateriasAsignadas(3)).resolves.toEqual([])
  })

  it('profesor inexistente → NotFoundError', async () => {
    repository.listarMateriasAsignadas.mockResolvedValue(null)

    await expect(service.listarMateriasAsignadas(99)).rejects.toThrow(NotFoundError)
  })
})

describe('asignarMaterias', () => {
  beforeEach(() => {
    repository.buscarConAsignaciones.mockResolvedValue(profesor())
    materiasRepository.buscarPorIds.mockResolvedValue([MATEMATICA, FISICA])
  })

  it('asigna varias materias en una sola llamada y devuelve las asignadas actualizadas', async () => {
    const resultado = await service.asignarMaterias(3, { materiaIds: [2, 7] }, actor)

    expect(repository.buscarConAsignaciones).toHaveBeenCalledWith(3, [2, 7])
    expect(materiasRepository.buscarPorIds).toHaveBeenCalledWith([2, 7])
    expect(repository.asignarMaterias).toHaveBeenCalledOnce()
    expect(repository.asignarMaterias).toHaveBeenCalledWith(3, [2, 7], actor)
    expect(resultado).toEqual([
      { id: 7, nombre: 'Física' },
      { id: 2, nombre: 'Matemática' },
    ])
  })

  it('una asignación dada de baja no es conflicto: se manda a asignar (el repository la reactiva)', async () => {
    repository.buscarConAsignaciones.mockResolvedValue(
      profesor([asignacion(MATEMATICA, 'INACTIVO')]),
    )

    await service.asignarMaterias(3, { materiaIds: [2, 7] }, actor)

    expect(repository.asignarMaterias).toHaveBeenCalledWith(3, [2, 7], actor)
  })

  it('profesor inexistente → NotFoundError, sin leer materias ni asignar', async () => {
    repository.buscarConAsignaciones.mockResolvedValue(null)

    const error = await errorDe(service.asignarMaterias(99, { materiaIds: [2] }, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ message: 'Profesor no encontrado' })
    expect(materiasRepository.buscarPorIds).not.toHaveBeenCalled()
    expect(repository.asignarMaterias).not.toHaveBeenCalled()
  })

  it('profesor inactivo → 409 PROFESOR_INACTIVO, sin asignar', async () => {
    repository.buscarConAsignaciones.mockResolvedValue(profesor([], 'INACTIVO'))

    const error = await errorDe(service.asignarMaterias(3, { materiaIds: [2] }, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'PROFESOR_INACTIVO' })
    expect(repository.asignarMaterias).not.toHaveBeenCalled()
  })

  it('materia inexistente → NotFoundError con cada materia faltante en details', async () => {
    materiasRepository.buscarPorIds.mockResolvedValue([MATEMATICA])

    const error = await errorDe(service.asignarMaterias(3, { materiaIds: [2, 99, 98] }, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({
      code: 'NO_ENCONTRADO',
      details: [
        { path: ['materiaIds', 1], message: 'La materia 99 no existe' },
        { path: ['materiaIds', 2], message: 'La materia 98 no existe' },
      ],
    })
    expect(repository.asignarMaterias).not.toHaveBeenCalled()
  })

  it('materia inactiva → 409 MATERIA_INACTIVA, sin asignar ninguna (todas o ninguna)', async () => {
    materiasRepository.buscarPorIds.mockResolvedValue([MATEMATICA, QUIMICA_INACTIVA])

    const error = await errorDe(service.asignarMaterias(3, { materiaIds: [2, 9] }, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({
      code: 'MATERIA_INACTIVA',
      details: [{ path: ['materiaIds', 1], message: 'La materia Química está inactiva' }],
    })
    expect(repository.asignarMaterias).not.toHaveBeenCalled()
  })

  it('materia ya asignada y activa → 409 CONFLICTO, sin asignar ninguna', async () => {
    repository.buscarConAsignaciones.mockResolvedValue(profesor([asignacion(FISICA, 'ACTIVO')]))

    const error = await errorDe(service.asignarMaterias(3, { materiaIds: [2, 7] }, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({
      code: 'CONFLICTO',
      details: [
        { path: ['materiaIds', 1], message: 'La materia Física ya está asignada al profesor' },
      ],
    })
    expect(repository.asignarMaterias).not.toHaveBeenCalled()
  })

  it('con varios problemas, informa primero el de mayor prioridad (inexistente antes que inactiva)', async () => {
    materiasRepository.buscarPorIds.mockResolvedValue([QUIMICA_INACTIVA])

    const error = await errorDe(service.asignarMaterias(3, { materiaIds: [9, 99] }, actor))

    expect(error).toBeInstanceOf(NotFoundError)
  })
})

describe('quitarMaterias', () => {
  beforeEach(() => {
    repository.buscarConAsignaciones.mockResolvedValue(
      profesor([asignacion(MATEMATICA, 'ACTIVO'), asignacion(FISICA, 'ACTIVO')]),
    )
    turnosRepository.contarVigentesPorMateria.mockResolvedValue([])
  })

  it('sin turnos vigentes: quita todas en una sola llamada y devuelve las asignadas actualizadas', async () => {
    repository.listarMateriasAsignadas.mockResolvedValue([])

    const resultado = await service.quitarMaterias(3, { materiaIds: [2, 7] }, actor)

    expect(repository.quitarMaterias).toHaveBeenCalledOnce()
    expect(repository.quitarMaterias).toHaveBeenCalledWith(3, [2, 7], actor)
    expect(resultado).toEqual([])
  })

  it('consulta los turnos vigentes con la fecha de hoy del reloj, el profesor y las materias', async () => {
    await service.quitarMaterias(3, { materiaIds: [2, 7] }, actor)

    expect(turnosRepository.contarVigentesPorMateria).toHaveBeenCalledWith({
      fechaHoy: HOY,
      profesorId: 3,
      materiaIds: [2, 7],
    })
  })

  it('se puede quitar aunque el profesor esté inactivo', async () => {
    repository.buscarConAsignaciones.mockResolvedValue(
      profesor([asignacion(MATEMATICA, 'ACTIVO')], 'INACTIVO'),
    )

    await service.quitarMaterias(3, { materiaIds: [2] }, actor)

    expect(repository.quitarMaterias).toHaveBeenCalledWith(3, [2], actor)
  })

  it('profesor inexistente → NotFoundError, sin consultar turnos ni quitar', async () => {
    repository.buscarConAsignaciones.mockResolvedValue(null)

    const error = await errorDe(service.quitarMaterias(99, { materiaIds: [2] }, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ message: 'Profesor no encontrado' })
    expect(turnosRepository.contarVigentesPorMateria).not.toHaveBeenCalled()
    expect(repository.quitarMaterias).not.toHaveBeenCalled()
  })

  it('materia no asignada o ya quitada → NotFoundError por cada una, sin quitar ninguna', async () => {
    repository.buscarConAsignaciones.mockResolvedValue(
      profesor([asignacion(MATEMATICA, 'ACTIVO'), asignacion(FISICA, 'INACTIVO')]),
    )

    const error = await errorDe(service.quitarMaterias(3, { materiaIds: [2, 7, 99] }, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({
      code: 'NO_ENCONTRADO',
      details: [
        { path: ['materiaIds', 1], message: 'La materia 7 no está asignada al profesor' },
        { path: ['materiaIds', 2], message: 'La materia 99 no está asignada al profesor' },
      ],
    })
    expect(repository.quitarMaterias).not.toHaveBeenCalled()
  })

  it('con turnos vigentes → 409 TURNOS_VIGENTES con la cantidad de cada materia, sin quitar ninguna', async () => {
    turnosRepository.contarVigentesPorMateria.mockResolvedValue([{ materiaId: 7, cantidad: 3 }])

    const error = await errorDe(service.quitarMaterias(3, { materiaIds: [2, 7] }, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({
      code: 'TURNOS_VIGENTES',
      details: [
        {
          path: ['materiaIds', 1],
          message: 'La materia Física tiene 3 turnos vigentes con el profesor',
          cantidad: 3,
        },
      ],
    })
    expect(repository.quitarMaterias).not.toHaveBeenCalled()
  })

  it('un solo turno vigente usa el singular en el mensaje', async () => {
    turnosRepository.contarVigentesPorMateria.mockResolvedValue([{ materiaId: 2, cantidad: 1 }])

    const error = await errorDe(service.quitarMaterias(3, { materiaIds: [2] }, actor))

    expect(error).toMatchObject({
      details: [expect.objectContaining({ message: expect.stringContaining('1 turno vigente') })],
    })
  })
})
