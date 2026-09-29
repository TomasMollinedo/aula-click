import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import type { MateriasRepository } from '../materias.repository'
import {
  CODIGO_MATERIA_CON_PROFESORES,
  CODIGO_MATERIA_SIN_PRECIO,
  crearMateriasService,
} from '../materias.service'
import type { MateriaGuardada, MateriaProfesor } from '../materias.validation'

// Los repositories se reemplazan por falsos: sin Docker ni Postgres. El service los importa solo
// como tipo, así que no hace falta mockear los módulos reales.

const actor: Actor = { userId: 'usr_gerente', role: 'GERENTE' }

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
    precioHora: 8000,
    sinPrecio: false,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    createdBy: { id: 'usr_gerente', nombre: 'Laura', apellido: 'Díaz' },
    updatedBy: { id: 'usr_gerente', nombre: 'Laura', apellido: 'Díaz' },
    ...campos,
  }
}

const sinPrecio = { estado: 'INACTIVO', precioHora: null, sinPrecio: true } as const

function crearRepository() {
  return {
    listar: vi.fn<MateriasRepository['listar']>(),
    listarActivas: vi.fn<MateriasRepository['listarActivas']>(),
    // La usa profesores (T-11), no materias: está para completar el tipo del repository.
    buscarPorIds: vi.fn<MateriasRepository['buscarPorIds']>(),
    buscarPorId: vi.fn<MateriasRepository['buscarPorId']>(),
    crear: vi.fn<MateriasRepository['crear']>(),
    actualizar: vi.fn<MateriasRepository['actualizar']>(),
    darDeBaja: vi.fn<MateriasRepository['darDeBaja']>(),
    reactivar: vi.fn<MateriasRepository['reactivar']>(),
  }
}

function crearProfesoresRepository() {
  return { listarProfesoresDeMateria: vi.fn<ProfesoresRepository['listarProfesoresDeMateria']>() }
}

let repository: ReturnType<typeof crearRepository>
let profesoresRepository: ReturnType<typeof crearProfesoresRepository>
let service: ReturnType<typeof crearMateriasService>

/** Escrituras del repository de materias: sirve para afirmar que no se escribió nada más. */
function escrituras() {
  return {
    crear: repository.crear.mock.calls.length,
    actualizar: repository.actualizar.mock.calls.length,
    darDeBaja: repository.darDeBaja.mock.calls.length,
    reactivar: repository.reactivar.mock.calls.length,
  }
}

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

  it('devuelve el precio y la marca "sin precio" de cada materia tal como los da el repository', async () => {
    const pagina = {
      data: [
        { id: 1, nombre: 'Física', estado: 'ACTIVO', precioHora: 8000.5, sinPrecio: false },
        { id: 2, nombre: 'Latín', ...sinPrecio },
      ],
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    } as const
    repository.listar.mockResolvedValue({ ...pagina, data: [...pagina.data] })

    expect((await service.listar({ page: 1, pageSize: 20, estado: 'TODOS' })).data).toEqual(
      pagina.data,
    )
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
  it('agrega los profesores con asignación activa al detalle, con el precio', async () => {
    repository.buscarPorId.mockResolvedValue(guardada())
    profesoresRepository.listarProfesoresDeMateria.mockResolvedValue([profesor])

    const materia = await service.obtener(1)

    expect(repository.buscarPorId).toHaveBeenCalledWith(1)
    expect(profesoresRepository.listarProfesoresDeMateria).toHaveBeenCalledWith(1)
    expect(materia).toEqual({ ...guardada(), profesores: [profesor] })
    expect(materia).toMatchObject({ precioHora: 8000, sinPrecio: false })
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
  const alta = { nombre: 'Matemática', descripcion: null, precioHora: 8000.5 }

  beforeEach(() => {
    repository.crear.mockResolvedValue(guardada({ precioHora: 8000.5 }))
  })

  it('pasa los datos con el precio, la busqueda normalizada y el actor; la materia nueva no tiene profesores', async () => {
    const materia = await service.crear(alta, actor)

    expect(repository.crear).toHaveBeenCalledWith({ ...alta, busqueda: 'matematica' }, actor)
    expect(materia).toEqual({ ...guardada({ precioHora: 8000.5 }), profesores: [] })
    expect(profesoresRepository.listarProfesoresDeMateria).not.toHaveBeenCalled()
  })

  it.each([
    ['Matemática', 'matematica'],
    ['  Álgebra   Lineal ', 'algebra lineal'],
    ['MATEMATICA', 'matematica'],
  ])('busqueda de %o es %o (así choca con el nombre repetido)', async (nombre, busqueda) => {
    await service.crear({ ...alta, nombre }, actor)

    expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ busqueda }), actor)
  })

  it('nombre repetido: propaga el ConflictError del repository', async () => {
    repository.crear.mockRejectedValue(new ConflictError('Ya existe una materia con ese nombre'))

    await expect(service.crear(alta, actor)).rejects.toThrow(ConflictError)
  })
})

describe('editar', () => {
  beforeEach(() => {
    repository.buscarPorId.mockResolvedValue(guardada())
    repository.actualizar.mockResolvedValue(guardada({ precioHora: 9500 }))
  })

  it('cambiar el precio solo actualiza la materia: ninguna otra escritura (los pagos guardan su importe)', async () => {
    const materia = await service.editar(1, { precioHora: 9500 }, actor)

    expect(repository.actualizar).toHaveBeenCalledExactlyOnceWith(1, { precioHora: 9500 }, actor)
    expect(escrituras()).toEqual({ crear: 0, actualizar: 1, darDeBaja: 0, reactivar: 0 })
    expect(materia).toMatchObject({ precioHora: 9500, profesores: [] })
  })

  it('con nombre, recalcula la busqueda', async () => {
    await service.editar(1, { nombre: '  Álgebra  Lineal ' }, actor)

    expect(repository.actualizar).toHaveBeenCalledWith(
      1,
      { nombre: '  Álgebra  Lineal ', busqueda: 'algebra lineal' },
      actor,
    )
  })

  it('sin nombre, no manda busqueda (no la pisa)', async () => {
    await service.editar(1, { descripcion: null }, actor)

    expect(repository.actualizar.mock.calls[0][1]).not.toHaveProperty('busqueda')
  })

  it('una materia inactiva y sin precio se puede editar (para cargarle el precio)', async () => {
    repository.buscarPorId.mockResolvedValue(guardada(sinPrecio))

    await service.editar(1, { precioHora: 6000 }, actor)

    expect(repository.actualizar).toHaveBeenCalledWith(1, { precioHora: 6000 }, actor)
  })

  it('devuelve el detalle con los profesores que la dictan', async () => {
    profesoresRepository.listarProfesoresDeMateria.mockResolvedValue([profesor])

    expect((await service.editar(1, { precioHora: 9500 }, actor)).profesores).toEqual([profesor])
  })

  it('nombre duplicado → 409: propaga el ConflictError del repository', async () => {
    repository.actualizar.mockRejectedValue(
      new ConflictError('Ya existe una materia con ese nombre', {
        details: [{ path: ['nombre'], message: 'Ya existe una materia con ese nombre' }],
      }),
    )

    const error = await service.editar(1, { nombre: 'Física' }, actor).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ statusCode: 409, code: 'CONFLICTO' })
  })

  it('inexistente → NotFoundError, sin escribir', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    await expect(service.editar(99, { precioHora: 9500 }, actor)).rejects.toThrow(NotFoundError)
    expect(repository.actualizar).not.toHaveBeenCalled()
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

describe('reactivar', () => {
  beforeEach(() => {
    repository.buscarPorId.mockResolvedValue(guardada({ estado: 'INACTIVO' }))
    repository.reactivar.mockResolvedValue(guardada())
  })

  it('con precio: la reactiva con el actor y devuelve el detalle con sus profesores', async () => {
    profesoresRepository.listarProfesoresDeMateria.mockResolvedValue([profesor])

    const materia = await service.reactivar(1, actor)

    expect(repository.reactivar).toHaveBeenCalledWith(1, actor)
    expect(materia).toEqual({ ...guardada(), profesores: [profesor] })
  })

  it('ya activa: no es un error, vuelve a dejarla ACTIVO', async () => {
    repository.buscarPorId.mockResolvedValue(guardada())

    await expect(service.reactivar(1, actor)).resolves.toMatchObject({ estado: 'ACTIVO' })
  })

  it('sin precio → 409 MATERIA_SIN_PRECIO, sin reactivar', async () => {
    repository.buscarPorId.mockResolvedValue(guardada(sinPrecio))

    const error = await service.reactivar(1, actor).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({
      statusCode: 409,
      code: CODIGO_MATERIA_SIN_PRECIO,
      message: 'La materia no tiene precio: cárguelo antes de reactivarla',
    })
    expect(repository.reactivar).not.toHaveBeenCalled()
  })

  it('inexistente → NotFoundError, sin reactivar', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    await expect(service.reactivar(99, actor)).rejects.toThrow(NotFoundError)
    expect(repository.reactivar).not.toHaveBeenCalled()
  })
})
