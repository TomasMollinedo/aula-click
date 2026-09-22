import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { alumnosRoutes } from '../alumnos.routes'

// Contrato HTTP de alumnos: validación de Zod, auth y OpenAPI. Sin base ni variables de entorno:
// el repository y Better Auth se reemplazan por mocks. Las reglas se prueban en el service.

const { repository, getSession } = vi.hoisted(() => ({
  repository: { listar: vi.fn(), buscarPorId: vi.fn(), crear: vi.fn(), actualizar: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../alumnos.repository', () => ({ alumnosRepository: repository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/alumnos', alumnosRoutes)

const minimo = {
  nombre: 'Juan',
  apellido: 'González',
  dni: '30.123.456',
  fechaNacimiento: '1990-05-14',
  email: 'Juan.Gonzalez@Mail.com',
  telefono: '(387) 15-412-3456',
}

const guardado = {
  id: 1,
  ...minimo,
  dni: '30123456',
  email: 'juan.gonzalez@mail.com',
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
  return app.request(`/api/v1/alumnos${path}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.buscarPorId.mockResolvedValue(guardado)
  repository.crear.mockResolvedValue(guardado)
  repository.actualizar.mockResolvedValue(guardado)
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
})

describe('POST /alumnos', () => {
  it('alta con solo los obligatorios → 201; el resto no se envía (queda null en la base)', async () => {
    const res = await pedir('', 'POST', minimo)

    expect(res.status).toBe(201)
    expect(repository.crear).toHaveBeenCalledWith(
      {
        ...minimo,
        dni: '30123456',
        email: 'juan.gonzalez@mail.com',
        busqueda: 'gonzalez juan 30123456',
      },
      { userId: 'usr_mesa', role: 'MESA_ENTRADAS' },
    )
    expect(await res.json()).toMatchObject({ id: 1, menorDeEdad: false })
  })

  it('los opcionales con "" o solo espacios llegan como null', async () => {
    await pedir('', 'POST', {
      ...minimo,
      grado: '',
      observaciones: '   ',
      tutorDni: '',
      tutorEmail: '',
      nivelEscolaridad: '',
    })

    expect(repository.crear.mock.calls[0][0]).toMatchObject({
      grado: null,
      observaciones: null,
      tutorDni: null,
      tutorEmail: null,
      nivelEscolaridad: null,
    })
  })

  it('los opcionales con formato se validan con su primitiva', async () => {
    const res = await pedir('', 'POST', { ...minimo, tutorEmail: 'no-es-email', tutorDni: '12' })
    const paths = (await res.json()).error.details.map((d: { path: string[] }) => d.path[0])

    expect(res.status).toBe(400)
    expect(paths).toEqual(expect.arrayContaining(['tutorEmail', 'tutorDni']))
  })

  it.each(['nombre', 'apellido', 'dni', 'fechaNacimiento', 'email', 'telefono'])(
    'sin %s → 400',
    async (campo) => {
      const res = await pedir('', 'POST', { ...minimo, [campo]: undefined })
      expect(res.status).toBe(400)
      expect((await res.json()).error.details[0].path).toEqual([campo])
    },
  )

  it('nivel de escolaridad fuera del enum → 400', async () => {
    expect((await pedir('', 'POST', { ...minimo, nivelEscolaridad: 'DOCTORADO' })).status).toBe(400)
  })

  it('busqueda, estado y auditoría del body se descartan', async () => {
    await pedir('', 'POST', { ...minimo, busqueda: 'x', estado: 'INACTIVO', createdById: 'otro' })

    const datos = repository.crear.mock.calls[0][0]
    expect(datos.busqueda).toBe('gonzalez juan 30123456')
    expect(datos).not.toHaveProperty('estado')
    expect(datos).not.toHaveProperty('createdById')
  })
})

describe('PATCH /alumnos/{id}', () => {
  it('body vacío → 400 "Debe enviar al menos un campo"', async () => {
    const res = await pedir('/1', 'PATCH', {})
    expect(res.status).toBe(400)
    expect((await res.json()).error.details[0].message).toBe('Debe enviar al menos un campo')
  })

  it('un obligatorio en null → 400', async () => {
    expect((await pedir('/1', 'PATCH', { telefono: null })).status).toBe(400)
  })

  it('un opcional en null → 200 y se envía null para borrarlo', async () => {
    const res = await pedir('/1', 'PATCH', { nivelEscolaridad: null })

    expect(res.status).toBe(200)
    expect(repository.actualizar.mock.calls[0][1]).toEqual({
      nivelEscolaridad: null,
      busqueda: 'gonzalez juan 30123456',
    })
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })
  const status = (path: string, metodo: 'get' | 'post' | 'patch') =>
    Object.keys(doc.paths[path]?.[metodo]?.responses ?? {}).sort()

  it('declara los 4 endpoints con todos sus status codes', () => {
    expect(status('/api/v1/alumnos', 'get')).toEqual(['200', '400', '401', '403'])
    expect(status('/api/v1/alumnos/{id}', 'get')).toEqual(['200', '400', '401', '403', '404'])
    expect(status('/api/v1/alumnos', 'post')).toEqual(['201', '400', '401', '403', '409'])
    expect(status('/api/v1/alumnos/{id}', 'patch')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
  })

  it('registra los componentes de alumnos', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'AlumnoListadoItem',
        'AlumnoCrear',
        'AlumnoEditar',
        'AlumnoDetalle',
        'UsuarioAuditoria',
      ]),
    )
  })
})
