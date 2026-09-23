import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError } from '@/server/errors'
import type { MateriasRepository } from '@/server/features/materias/materias.repository'
import type { MateriaConEstado } from '@/server/features/materias/materias.validation'
import type { TurnosRepository } from '@/server/features/turnos/turnos.repository'
import type { Actor } from '@/server/shared/actor'
import type { ProfesoresRepository } from '../profesores.repository'
import { crearProfesoresService } from '../profesores.service'
import type { ProfesorConAsignaciones } from '../profesores.validation'

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

function crearRepositories() {
  return {
    repository: {
      listarMateriasAsignadas: vi.fn<ProfesoresRepository['listarMateriasAsignadas']>(),
      buscarConAsignaciones: vi.fn<ProfesoresRepository['buscarConAsignaciones']>(),
      asignarMaterias: vi.fn<ProfesoresRepository['asignarMaterias']>(),
      quitarMaterias: vi.fn<ProfesoresRepository['quitarMaterias']>(),
    },
    materiasRepository: { buscarPorIds: vi.fn<MateriasRepository['buscarPorIds']>() },
    turnosRepository: {
      contarVigentesPorMateria: vi.fn<TurnosRepository['contarVigentesPorMateria']>(),
    },
  }
}

let repository: ReturnType<typeof crearRepositories>['repository']
let materiasRepository: ReturnType<typeof crearRepositories>['materiasRepository']
let turnosRepository: ReturnType<typeof crearRepositories>['turnosRepository']
let service: ReturnType<typeof crearProfesoresService>

beforeEach(() => {
  ;({ repository, materiasRepository, turnosRepository } = crearRepositories())
  service = crearProfesoresService({
    repository,
    materiasRepository,
    turnosRepository,
    reloj: relojFijo,
  })
  repository.listarMateriasAsignadas.mockResolvedValue([
    { id: 7, nombre: 'Física' },
    { id: 2, nombre: 'Matemática' },
  ])
})

/** Ejecuta `accion`, que debe fallar, y devuelve el error. */
function errorDe(accion: Promise<unknown>) {
  return accion.then(
    () => expect.fail('Se esperaba un error'),
    (error: unknown) => error,
  )
}

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
