import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError } from '@/server/errors'
import type { MateriasRepository } from '@/server/features/materias/materias.repository'
import type { MateriaConEstado } from '@/server/features/materias/materias.validation'
import type { Actor } from '@/server/shared/actor'
import type { ProfesoresRepository } from '../profesores.repository'
import { crearProfesoresService } from '../profesores.service'
import type { ProfesorParaAsignar } from '../profesores.validation'

// Los repositories se reemplazan por falsos: sin Docker ni Postgres. El service los importa solo
// como tipo, así que no hace falta mockear los módulos reales.

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

const MATEMATICA: MateriaConEstado = { id: 2, nombre: 'Matemática', estado: 'ACTIVO' }
const FISICA: MateriaConEstado = { id: 7, nombre: 'Física', estado: 'ACTIVO' }
const QUIMICA_INACTIVA: MateriaConEstado = { id: 9, nombre: 'Química', estado: 'INACTIVO' }

function crearRepositories() {
  return {
    repository: {
      listarMateriasAsignadas: vi.fn<ProfesoresRepository['listarMateriasAsignadas']>(),
      buscarParaAsignar: vi.fn<ProfesoresRepository['buscarParaAsignar']>(),
      asignarMaterias: vi.fn<ProfesoresRepository['asignarMaterias']>(),
    },
    materiasRepository: { buscarPorIds: vi.fn<MateriasRepository['buscarPorIds']>() },
  }
}

let repository: ReturnType<typeof crearRepositories>['repository']
let materiasRepository: ReturnType<typeof crearRepositories>['materiasRepository']
let service: ReturnType<typeof crearProfesoresService>

beforeEach(() => {
  ;({ repository, materiasRepository } = crearRepositories())
  service = crearProfesoresService({ repository, materiasRepository })
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
    const materias = [
      { id: 7, nombre: 'Física' },
      { id: 2, nombre: 'Matemática' },
    ]
    repository.listarMateriasAsignadas.mockResolvedValue(materias)

    await expect(service.listarMateriasAsignadas(3)).resolves.toEqual(materias)
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
  const activo = (asignaciones: ProfesorParaAsignar['asignaciones'] = []): ProfesorParaAsignar => ({
    estado: 'ACTIVO',
    asignaciones,
  })

  beforeEach(() => {
    repository.buscarParaAsignar.mockResolvedValue(activo())
    materiasRepository.buscarPorIds.mockResolvedValue([MATEMATICA, FISICA])
    repository.listarMateriasAsignadas.mockResolvedValue([
      { id: 7, nombre: 'Física' },
      { id: 2, nombre: 'Matemática' },
    ])
  })

  it('asigna varias materias en una sola llamada y devuelve las asignadas actualizadas', async () => {
    const resultado = await service.asignarMaterias(3, { materiaIds: [2, 7] }, actor)

    expect(repository.buscarParaAsignar).toHaveBeenCalledWith(3, [2, 7])
    expect(materiasRepository.buscarPorIds).toHaveBeenCalledWith([2, 7])
    expect(repository.asignarMaterias).toHaveBeenCalledOnce()
    expect(repository.asignarMaterias).toHaveBeenCalledWith(3, [2, 7], actor)
    expect(resultado).toEqual([
      { id: 7, nombre: 'Física' },
      { id: 2, nombre: 'Matemática' },
    ])
  })

  it('una asignación dada de baja no es conflicto: se manda a asignar (el repository la reactiva)', async () => {
    repository.buscarParaAsignar.mockResolvedValue(activo([{ materiaId: 2, estado: 'INACTIVO' }]))

    await service.asignarMaterias(3, { materiaIds: [2, 7] }, actor)

    expect(repository.asignarMaterias).toHaveBeenCalledWith(3, [2, 7], actor)
  })

  it('profesor inexistente → NotFoundError, sin leer materias ni asignar', async () => {
    repository.buscarParaAsignar.mockResolvedValue(null)

    const error = await errorDe(service.asignarMaterias(99, { materiaIds: [2] }, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ message: 'Profesor no encontrado' })
    expect(materiasRepository.buscarPorIds).not.toHaveBeenCalled()
    expect(repository.asignarMaterias).not.toHaveBeenCalled()
  })

  it('profesor inactivo → 409 PROFESOR_INACTIVO, sin asignar', async () => {
    repository.buscarParaAsignar.mockResolvedValue({ estado: 'INACTIVO', asignaciones: [] })

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
    repository.buscarParaAsignar.mockResolvedValue(activo([{ materiaId: 7, estado: 'ACTIVO' }]))

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
