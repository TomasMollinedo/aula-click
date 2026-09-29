import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { materiasRoutes } from '../materias.routes'

// Contrato HTTP de materias: validación de Zod, auth y OpenAPI. Sin base ni variables de entorno:
// los repositories y Better Auth se reemplazan por mocks. Las reglas se prueban en el service.

const { repository, profesoresRepository, getSession } = vi.hoisted(() => ({
  repository: {
    listar: vi.fn(),
    listarActivas: vi.fn(),
    buscarPorId: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    darDeBaja: vi.fn(),
    reactivar: vi.fn(),
  },
  profesoresRepository: { listarProfesoresDeMateria: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../materias.repository', () => ({ materiasRepository: repository }))
vi.mock('@/server/features/profesores/profesores.repository', () => ({ profesoresRepository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/materias', materiasRoutes)

const guardada = {
  id: 1,
  nombre: 'Matemática',
  descripcion: null,
  estado: 'ACTIVO',
  precioHora: 8000.5,
  sinPrecio: false,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  createdBy: null,
  updatedBy: null,
}

const ALTA = { nombre: 'Matemática', precioHora: 8000.5 }

function sesion(role = 'GERENTE') {
  return {
    headers: new Headers(),
    response: { user: { id: `usr_${role}`, role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function pedir(path: string, metodo = 'GET', body?: unknown) {
  return app.request(`/api/v1/materias${path}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const listadoVacio = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.listar.mockResolvedValue(listadoVacio)
  repository.listarActivas.mockResolvedValue([{ id: 1, nombre: 'Matemática' }])
  repository.buscarPorId.mockResolvedValue(guardada)
  repository.crear.mockResolvedValue(guardada)
  repository.actualizar.mockResolvedValue(guardada)
  repository.darDeBaja.mockResolvedValue({ ...guardada, estado: 'INACTIVO' })
  repository.reactivar.mockResolvedValue(guardada)
  profesoresRepository.listarProfesoresDeMateria.mockResolvedValue([])
})

describe('auth', () => {
  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('')).status).toBe(401)
  })

  const escrituras = [
    ['POST /', '', 'POST', ALTA],
    ['PATCH /{id}', '/1', 'PATCH', { precioHora: 9000 }],
    ['PATCH /{id}/baja', '/1/baja', 'PATCH', undefined],
    ['PATCH /{id}/reactivacion', '/1/reactivacion', 'PATCH', undefined],
  ] as const

  it.each(escrituras)(
    'MESA_ENTRADAS en %s → 403, sin escribir',
    async (_nombre, path, metodo, body) => {
      getSession.mockResolvedValue(sesion('MESA_ENTRADAS'))

      const res = await pedir(path, metodo, body)

      expect(res.status).toBe(403)
      expect((await res.json()).error.code).toBe('SIN_PERMISO')
      expect(repository.crear).not.toHaveBeenCalled()
      expect(repository.actualizar).not.toHaveBeenCalled()
      expect(repository.darDeBaja).not.toHaveBeenCalled()
      expect(repository.reactivar).not.toHaveBeenCalled()
    },
  )

  it.each(escrituras)('PROFESOR en %s → 403', async (_nombre, path, metodo, body) => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir(path, metodo, body)).status).toBe(403)
  })

  it.each([
    ['listado', ''],
    ['detalle', '/1'],
    ['selector', '/selector'],
  ])('MESA_ENTRADAS y GERENTE leen el %s; PROFESOR → 403', async (_nombre, path) => {
    for (const role of ['MESA_ENTRADAS', 'GERENTE']) {
      getSession.mockResolvedValue(sesion(role))
      expect((await pedir(path)).status).toBe(200)
    }
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir(path)).status).toBe(403)
  })

  it('MESA_ENTRADAS lista con el precio y la marca "sin precio"', async () => {
    getSession.mockResolvedValue(sesion('MESA_ENTRADAS'))
    const data = [
      { id: 1, nombre: 'Física', estado: 'ACTIVO', precioHora: 8000.5, sinPrecio: false },
      { id: 2, nombre: 'Latín', estado: 'INACTIVO', precioHora: null, sinPrecio: true },
    ]
    repository.listar.mockResolvedValue({ ...listadoVacio, data })

    const res = await pedir('?estado=TODOS')

    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual(data)
  })

  it('MESA_ENTRADAS ve el detalle con el precio', async () => {
    getSession.mockResolvedValue(sesion('MESA_ENTRADAS'))

    const res = await pedir('/1')

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ precioHora: 8000.5, sinPrecio: false })
  })
})

describe('params y query', () => {
  it.each(['/abc', '/0', '/-1', '/1.5'])('id inválido %s → 400', async (path) => {
    const res = await pedir(path)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('q de más de 100 caracteres → 400', async () => {
    expect((await pedir(`?q=${'a'.repeat(101)}`)).status).toBe(400)
  })

  it('estado fuera del enum → 400', async () => {
    expect((await pedir('?estado=BORRADO')).status).toBe(400)
  })

  it.each(['ACTIVO', 'INACTIVO', 'TODOS'])('estado %s es válido', async (estado) => {
    expect((await pedir(`?estado=${estado}`)).status).toBe(200)
  })

  it('sin estado, el listado filtra por ACTIVO', async () => {
    await pedir('')

    expect(repository.listar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'ACTIVO' }))
  })
})

describe('GET /materias/selector', () => {
  // La ruta estática va antes que /{id}: si la tomara el path con parámetro, sería un 400.
  it('devuelve el arreglo de materias activas, sin paginar', async () => {
    const res = await pedir('/selector')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 1, nombre: 'Matemática' }])
    expect(repository.listarActivas).toHaveBeenCalled()
  })
})

// Precios inválidos, comunes al alta y a la edición.
const preciosInvalidos = [
  ['0', 0],
  ['negativo', -100],
  ['con 3 decimales', 100.005],
  ['con 3 decimales chicos', 0.001],
  ['mayor al tope de Decimal(10,2)', 100_000_000],
  ['null', null],
  ['texto', '8000'],
] as const

describe('POST /materias', () => {
  it('alta con nombre y precio → 201, con la busqueda normalizada, el actor y sin profesores', async () => {
    const res = await pedir('', 'POST', { nombre: '  Matemática  ', precioHora: 8000.5 })

    expect(res.status).toBe(201)
    expect(repository.crear).toHaveBeenCalledWith(
      { nombre: 'Matemática', precioHora: 8000.5, busqueda: 'matematica' },
      { userId: 'usr_GERENTE', role: 'GERENTE' },
    )
    expect(await res.json()).toMatchObject({ id: 1, precioHora: 8000.5, profesores: [] })
  })

  it.each([8000, 8000.5, 8000.25, 0.01, 1.13, 99_999_999.99])(
    'precio %o es válido',
    async (precioHora) => {
      expect((await pedir('', 'POST', { ...ALTA, precioHora })).status).toBe(201)
      expect(repository.crear.mock.calls[0][0].precioHora).toBe(precioHora)
    },
  )

  it.each(preciosInvalidos)('precio %s → 400 sobre precioHora', async (_caso, precioHora) => {
    const res = await pedir('', 'POST', { ...ALTA, precioHora })

    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error.code).toBe('VALIDACION')
    expect(error.details[0].path).toEqual(['precioHora'])
    expect(repository.crear).not.toHaveBeenCalled()
  })

  it('sin precio → 400 (es obligatorio en el alta)', async () => {
    const res = await pedir('', 'POST', { nombre: 'Matemática' })

    expect(res.status).toBe(400)
    expect((await res.json()).error.details[0].path).toEqual(['precioHora'])
  })

  it.each(['', '   '])('descripcion %o llega como null', async (descripcion) => {
    await pedir('', 'POST', { ...ALTA, descripcion })

    expect(repository.crear.mock.calls[0][0].descripcion).toBeNull()
  })

  it.each([undefined, '', '   '])('sin nombre (%o) → 400', async (nombre) => {
    const res = await pedir('', 'POST', { nombre, precioHora: 8000 })

    expect(res.status).toBe(400)
    expect((await res.json()).error.details[0].path).toEqual(['nombre'])
  })

  it('busqueda, estado, sinPrecio y auditoría del body se descartan', async () => {
    await pedir('', 'POST', {
      ...ALTA,
      busqueda: 'x',
      estado: 'INACTIVO',
      sinPrecio: true,
      createdById: 'otro',
    })

    const datos = repository.crear.mock.calls[0][0]
    expect(datos.busqueda).toBe('matematica')
    expect(datos).not.toHaveProperty('estado')
    expect(datos).not.toHaveProperty('sinPrecio')
    expect(datos).not.toHaveProperty('createdById')
  })
})

describe('PATCH /materias/{id}', () => {
  it('solo el precio → 200, sin tocar nombre ni busqueda', async () => {
    const res = await pedir('/1', 'PATCH', { precioHora: 9500.75 })

    expect(res.status).toBe(200)
    expect(repository.actualizar).toHaveBeenCalledWith(
      1,
      { precioHora: 9500.75 },
      { userId: 'usr_GERENTE', role: 'GERENTE' },
    )
  })

  it('nombre, descripción y precio juntos, con la busqueda recalculada', async () => {
    await pedir('/1', 'PATCH', { nombre: ' Física ', descripcion: 'Mecánica', precioHora: 9000 })

    expect(repository.actualizar.mock.calls[0][1]).toEqual({
      nombre: 'Física',
      descripcion: 'Mecánica',
      precioHora: 9000,
      busqueda: 'fisica',
    })
  })

  it('descripcion null la borra', async () => {
    await pedir('/1', 'PATCH', { descripcion: null })

    expect(repository.actualizar.mock.calls[0][1]).toEqual({ descripcion: null })
  })

  it.each(preciosInvalidos)('precio %s → 400 sobre precioHora', async (_caso, precioHora) => {
    const res = await pedir('/1', 'PATCH', { precioHora })

    expect(res.status).toBe(400)
    expect((await res.json()).error.details[0].path).toEqual(['precioHora'])
    expect(repository.actualizar).not.toHaveBeenCalled()
  })

  it.each([null, '', '   '])('nombre %o → 400', async (nombre) => {
    const res = await pedir('/1', 'PATCH', { nombre })

    expect(res.status).toBe(400)
    expect((await res.json()).error.details[0].path).toEqual(['nombre'])
  })

  it('body sin campos conocidos → 400', async () => {
    expect((await pedir('/1', 'PATCH', { estado: 'ACTIVO' })).status).toBe(400)
    expect(repository.actualizar).not.toHaveBeenCalled()
  })

  it('inexistente → 404', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    expect((await pedir('/99', 'PATCH', { precioHora: 9000 })).status).toBe(404)
  })
})

describe('PATCH /materias/{id}/baja', () => {
  it('sin profesores asignados → 200 e INACTIVO', async () => {
    const res = await pedir('/1/baja', 'PATCH')

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ estado: 'INACTIVO', profesores: [] })
  })

  it('con profesores asignados → 409 MATERIA_CON_PROFESORES', async () => {
    profesoresRepository.listarProfesoresDeMateria.mockResolvedValue([
      { id: 8, apellido: 'Gómez', nombre: 'Luis', estado: 'ACTIVO' },
    ])

    const res = await pedir('/1/baja', 'PATCH')
    const { error } = await res.json()

    expect(res.status).toBe(409)
    expect(error.code).toBe('MATERIA_CON_PROFESORES')
    expect(error.details).toEqual([{ id: 8, apellido: 'Gómez', nombre: 'Luis', estado: 'ACTIVO' }])
  })

  it('inexistente → 404', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    const res = await pedir('/99/baja', 'PATCH')

    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })
})

describe('PATCH /materias/{id}/reactivacion', () => {
  it('con precio → 200 y ACTIVO', async () => {
    repository.buscarPorId.mockResolvedValue({ ...guardada, estado: 'INACTIVO' })

    const res = await pedir('/1/reactivacion', 'PATCH')

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ estado: 'ACTIVO' })
  })

  it('sin precio → 409 MATERIA_SIN_PRECIO', async () => {
    repository.buscarPorId.mockResolvedValue({
      ...guardada,
      estado: 'INACTIVO',
      precioHora: null,
      sinPrecio: true,
    })

    const res = await pedir('/1/reactivacion', 'PATCH')

    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('MATERIA_SIN_PRECIO')
    expect(repository.reactivar).not.toHaveBeenCalled()
  })

  it('inexistente → 404', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    expect((await pedir('/99/reactivacion', 'PATCH')).status).toBe(404)
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })
  const status = (path: string, metodo: 'get' | 'post' | 'patch') =>
    Object.keys(doc.paths[path]?.[metodo]?.responses ?? {}).sort()

  it('declara los 7 endpoints con todos sus status codes', () => {
    const conConflicto = ['200', '400', '401', '403', '404', '409']
    expect(status('/api/v1/materias', 'get')).toEqual(['200', '400', '401', '403'])
    expect(status('/api/v1/materias/selector', 'get')).toEqual(['200', '400', '401', '403'])
    expect(status('/api/v1/materias/{id}', 'get')).toEqual(['200', '400', '401', '403', '404'])
    expect(status('/api/v1/materias', 'post')).toEqual(['201', '400', '401', '403', '409'])
    expect(status('/api/v1/materias/{id}', 'patch')).toEqual(conConflicto)
    expect(status('/api/v1/materias/{id}/baja', 'patch')).toEqual(conConflicto)
    expect(status('/api/v1/materias/{id}/reactivacion', 'patch')).toEqual(conConflicto)
  })

  it('registra los componentes de materias', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'MateriaListadoItem',
        'MateriaSelectorItem',
        'MateriaCrear',
        'MateriaEditar',
        'MateriaProfesor',
        'MateriaDetalle',
        'UsuarioAuditoria',
      ]),
    )
  })
})
