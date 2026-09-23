import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import type { MateriasRepository } from '../materias.repository'
import { CODIGO_MATERIA_CON_PROFESORES, crearMateriasService } from '../materias.service'
import type { MateriaGuardada, MateriaProfesor } from '../materias.validation'

// Los repositories se reemplazan por falsos: sin Docker ni Postgres. El service los importa solo
// como tipo, así que no hace falta mockear los módulos reales.

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

const profesor = {
  id: 8,
  apellido: 'Gómez',
  nombre: 'Luis',
  estado: 'ACTIVO',
} satisfies MateriaProfesor

function guardada(campos: Partial<MateriaGuardada> = {}): MateriaGuardada {
  return {
    id: 1,
    nombre: 'Matemática',
    descripcion: null,
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
    listar: vi.fn<MateriasRepository['listar']>(),
    listarActivas: vi.fn<MateriasRepository['listarActivas']>(),
    // La usa profesores (T-11), no materias: está para completar el tipo del repository.
    buscarPorIds: vi.fn<MateriasRepository['buscarPorIds']>(),
    buscarPorId: vi.fn<MateriasRepository['buscarPorId']>(),
    crear: vi.fn<MateriasRepository['crear']>(),
    darDeBaja: vi.fn<MateriasRepository['darDeBaja']>(),
  }
}

function crearProfesoresRepository() {
  return { listarProfesoresDeMateria: vi.fn<ProfesoresRepository['listarProfesoresDeMateria']>() }
}

let repository: ReturnType<typeof crearRepository>
let profesoresRepository: ReturnType<typeof crearProfesoresRepository>
let service: ReturnType<typeof crearMateriasService>

beforeEach(() => {
  repository = crearRepository()
  profesoresRepository = crearProfesoresRepository()
  profesoresRepository.listarProfesoresDeMateria.mockResolvedValue([])
  service = crearMateriasService({ repository, profesoresRepository })
})

describe('listar', () => {
  const vacio = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }

  beforeEach(() => {
    repository.listar.mockResolvedValue(vacio)
  })

  it.each([
    ['  MATEMÁTICA ', ['matematica']],
    ['mate', ['mate']],
    ['algebra lineal', ['algebra', 'lineal']],
    ['', []],
    [undefined, []],
    ['a b c d e f g', ['a', 'b', 'c', 'd', 'e']],
  ])('q %o → términos %o', async (q, terminos) => {
    await expect(service.listar({ page: 2, pageSize: 10, q, estado: 'ACTIVO' })).resolves.toEqual(
      vacio,
    )
    expect(repository.listar).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      terminos,
      estado: 'ACTIVO',
    })
  })

  it.each([
    ['ACTIVO', 'ACTIVO'],
    ['INACTIVO', 'INACTIVO'],
    // TODOS no es un valor de Estado: el repository lo recibe como "sin filtro".
    ['TODOS', undefined],
  ] as const)('estado %s → el repository recibe %o', async (estado, esperado) => {
    await service.listar({ page: 1, pageSize: 20, estado })

    expect(repository.listar).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      terminos: [],
      estado: esperado,
    })
  })
})

describe('listarActivas', () => {
  it('devuelve el selector tal como lo da el repository', async () => {
    const activas = [{ id: 3, nombre: 'Matemática' }]
    repository.listarActivas.mockResolvedValue(activas)

    await expect(service.listarActivas()).resolves.toEqual(activas)
  })
})

describe('obtener', () => {
  it('agrega los profesores con asignación activa al detalle', async () => {
    repository.buscarPorId.mockResolvedValue(guardada())
    profesoresRepository.listarProfesoresDeMateria.mockResolvedValue([profesor])

    const materia = await service.obtener(1)

    expect(repository.buscarPorId).toHaveBeenCalledWith(1)
    expect(profesoresRepository.listarProfesoresDeMateria).toHaveBeenCalledWith(1)
    expect(materia).toEqual({ ...guardada(), profesores: [profesor] })
  })

  it('sin asignaciones activas, profesores es un arreglo vacío', async () => {
    repository.buscarPorId.mockResolvedValue(guardada())
    expect((await service.obtener(1)).profesores).toEqual([])
  })

  it('inexistente → NotFoundError', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    await expect(service.obtener(99)).rejects.toThrow(NotFoundError)
    expect(profesoresRepository.listarProfesoresDeMateria).not.toHaveBeenCalled()
  })
})

describe('crear', () => {
  beforeEach(() => {
    repository.crear.mockResolvedValue(guardada())
  })

  it('pasa los datos, la busqueda normalizada y el actor; la materia nueva no tiene profesores', async () => {
    const materia = await service.crear({ nombre: 'Matemática', descripcion: null }, actor)

    expect(repository.crear).toHaveBeenCalledWith(
      { nombre: 'Matemática', descripcion: null, busqueda: 'matematica' },
      actor,
    )
    expect(materia).toEqual({ ...guardada(), profesores: [] })
    expect(profesoresRepository.listarProfesoresDeMateria).not.toHaveBeenCalled()
  })

  it.each([
    ['Matemática', 'matematica'],
    ['  Álgebra   Lineal ', 'algebra lineal'],
    ['MATEMATICA', 'matematica'],
  ])('busqueda de %o es %o (así choca con el nombre repetido)', async (nombre, busqueda) => {
    await service.crear({ nombre, descripcion: null }, actor)

    expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ busqueda }), actor)
  })

  it('nombre repetido: propaga el ConflictError del repository', async () => {
    repository.crear.mockRejectedValue(new ConflictError('Ya existe una materia con ese nombre'))

    await expect(service.crear({ nombre: 'Matemática', descripcion: null }, actor)).rejects.toThrow(
      ConflictError,
    )
  })
})

describe('darDeBaja', () => {
  beforeEach(() => {
    repository.buscarPorId.mockResolvedValue(guardada())
    repository.darDeBaja.mockResolvedValue(guardada({ estado: 'INACTIVO' }))
  })

  it('sin profesores asignados: la da de baja con el actor', async () => {
    const materia = await service.darDeBaja(1, actor)

    expect(repository.darDeBaja).toHaveBeenCalledWith(1, actor)
    expect(materia).toEqual({ ...guardada({ estado: 'INACTIVO' }), profesores: [] })
  })

  it('con profesores asignados → 409 MATERIA_CON_PROFESORES con los profesores en details', async () => {
    profesoresRepository.listarProfesoresDeMateria.mockResolvedValue([profesor])

    const error = await service.darDeBaja(1, actor).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({
      statusCode: 409,
      code: CODIGO_MATERIA_CON_PROFESORES,
      message: 'No se puede dar de baja una materia con profesores asignados',
      details: [profesor],
    })
    expect(repository.darDeBaja).not.toHaveBeenCalled()
  })

  it('inexistente → NotFoundError, sin dar de baja', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    await expect(service.darDeBaja(99, actor)).rejects.toThrow(NotFoundError)
    expect(repository.darDeBaja).not.toHaveBeenCalled()
  })
})
