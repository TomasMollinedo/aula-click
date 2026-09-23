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
    darDeBaja: vi.fn(),
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
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  createdBy: null,
  updatedBy: null,
}

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function pedir(path: string, metodo = 'GET', body?: unknown) {
  return app.request(`/api/v1/materias${path}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.listarActivas.mockResolvedValue([{ id: 1, nombre: 'Matemática' }])
  repository.buscarPorId.mockResolvedValue(guardada)
  repository.crear.mockResolvedValue(guardada)
  repository.darDeBaja.mockResolvedValue({ ...guardada, estado: 'INACTIVO' })
  profesoresRepository.listarProfesoresDeMateria.mockResolvedValue([])
})

describe('auth', () => {
  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/1')).status).toBe(403)
  })

  it('el selector también exige el rol', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/selector')).status).toBe(403)
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
    repository.listar.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })
    expect((await pedir(`?estado=${estado}`)).status).toBe(200)
  })

  it('sin estado, el listado filtra por ACTIVO', async () => {
    repository.listar.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })

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

describe('POST /materias', () => {
  it('alta con solo el nombre → 201, con la busqueda normalizada y sin profesores', async () => {
    const res = await pedir('', 'POST', { nombre: '  Matemática  ' })

    expect(res.status).toBe(201)
    expect(repository.crear).toHaveBeenCalledWith(
      { nombre: 'Matemática', busqueda: 'matematica' },
      { userId: 'usr_mesa', role: 'MESA_ENTRADAS' },
    )
    expect(await res.json()).toMatchObject({ id: 1, profesores: [] })
  })

  it.each(['', '   '])('descripcion %o llega como null', async (descripcion) => {
    await pedir('', 'POST', { nombre: 'Matemática', descripcion })

    expect(repository.crear.mock.calls[0][0].descripcion).toBeNull()
  })

  it.each([undefined, '', '   '])('sin nombre (%o) → 400', async (nombre) => {
    const res = await pedir('', 'POST', { nombre })

    expect(res.status).toBe(400)
    expect((await res.json()).error.details[0].path).toEqual(['nombre'])
  })

  it('busqueda, estado y auditoría del body se descartan', async () => {
    await pedir('', 'POST', {
      nombre: 'Matemática',
      busqueda: 'x',
      estado: 'INACTIVO',
      createdById: 'otro',
    })

    const datos = repository.crear.mock.calls[0][0]
    expect(datos.busqueda).toBe('matematica')
    expect(datos).not.toHaveProperty('estado')
    expect(datos).not.toHaveProperty('createdById')
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

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })
  const status = (path: string, metodo: 'get' | 'post' | 'patch') =>
    Object.keys(doc.paths[path]?.[metodo]?.responses ?? {}).sort()

  it('declara los 5 endpoints con todos sus status codes', () => {
    expect(status('/api/v1/materias', 'get')).toEqual(['200', '400', '401', '403'])
    expect(status('/api/v1/materias/selector', 'get')).toEqual(['200', '400', '401', '403'])
    expect(status('/api/v1/materias/{id}', 'get')).toEqual(['200', '400', '401', '403', '404'])
    expect(status('/api/v1/materias', 'post')).toEqual(['201', '400', '401', '403', '409'])
    expect(status('/api/v1/materias/{id}/baja', 'patch')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
  })

  it('registra los componentes de materias', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'MateriaListadoItem',
        'MateriaSelectorItem',
        'MateriaCrear',
        'MateriaProfesor',
        'MateriaDetalle',
        'UsuarioAuditoria',
      ]),
    )
  })
})
