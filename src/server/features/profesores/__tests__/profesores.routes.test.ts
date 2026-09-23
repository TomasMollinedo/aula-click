import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { profesoresRoutes } from '../profesores.routes'

// Contrato HTTP de profesores: validación de Zod, auth y OpenAPI. Sin base ni variables de
// entorno: los repositories y Better Auth se reemplazan por mocks. Las reglas se prueban en el
// service.

const { repository, materiasRepository, turnosRepository, getPresignedUrl, getSession } =
  vi.hoisted(() => ({
    repository: {
      listar: vi.fn(),
      buscarPorId: vi.fn(),
      crear: vi.fn(),
      actualizar: vi.fn(),
      actualizarFoto: vi.fn(),
      quitarFoto: vi.fn(),
      listarMateriasAsignadas: vi.fn(),
      buscarConAsignaciones: vi.fn(),
      asignarMaterias: vi.fn(),
      quitarMaterias: vi.fn(),
    },
    materiasRepository: { buscarPorIds: vi.fn() },
    turnosRepository: { contarVigentesPorMateria: vi.fn() },
    getPresignedUrl: vi.fn(),
    getSession: vi.fn(),
  }))
vi.mock('../profesores.repository', () => ({ profesoresRepository: repository }))
vi.mock('@/server/features/materias/materias.repository', () => ({ materiasRepository }))
vi.mock('@/server/features/turnos/turnos.repository', () => ({ turnosRepository }))
vi.mock('@/lib/storage', () => ({ getPresignedUrl, putObject: vi.fn(), deleteObject: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/profesores', profesoresRoutes)

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function pedir(path: string, metodo = 'GET', body?: unknown) {
  return app.request(`/api/v1/profesores${path}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function pedirMultipart(path: string, form: FormData, metodo = 'POST') {
  return app.request(`/api/v1/profesores${path}`, { method: metodo, body: form })
}

const GUARDADO = {
  id: 3,
  nombre: 'Martín',
  apellido: 'Pérez',
  dni: '28333444',
  telefono: '387 4333444',
  email: 'martin.perez@aulaclick.local',
  titulo: 'Profesor en Matemática',
  matricula: 'MP-0001',
  estado: 'ACTIVO',
  avatarKey: null,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  createdBy: null,
  updatedBy: null,
}

const ALTA = {
  nombre: 'Martín',
  apellido: 'Pérez',
  dni: '28.333.444',
  telefono: '387 4333444',
  email: 'Martin.Perez@AulaClick.local',
  titulo: 'Profesor en Matemática',
  matricula: 'MP-0001',
  password: 'inicial-2026',
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  getPresignedUrl.mockImplementation((key: string) => Promise.resolve(`https://minio.local/${key}`))
  repository.listar.mockResolvedValue({
    data: [{ id: 3, apellido: 'Pérez', nombre: 'Martín', estado: 'ACTIVO', avatarKey: null }],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  })
  repository.buscarPorId.mockResolvedValue(GUARDADO)
  repository.crear.mockResolvedValue(GUARDADO)
  repository.actualizar.mockResolvedValue(GUARDADO)
  repository.actualizarFoto.mockResolvedValue(GUARDADO)
  repository.quitarFoto.mockResolvedValue(GUARDADO)
  repository.listarMateriasAsignadas.mockResolvedValue([{ id: 2, nombre: 'Matemática' }])
  repository.buscarConAsignaciones.mockResolvedValue({ estado: 'ACTIVO', asignaciones: [] })
  repository.asignarMaterias.mockResolvedValue(undefined)
  repository.quitarMaterias.mockResolvedValue(undefined)
  turnosRepository.contarVigentesPorMateria.mockResolvedValue([])
  materiasRepository.buscarPorIds.mockResolvedValue([
    { id: 2, nombre: 'Matemática', estado: 'ACTIVO' },
  ])
})

describe('GET /profesores', () => {
  it('responde 200 paginado, con fotoUrl armada a partir de avatarKey', async () => {
    repository.listar.mockResolvedValue({
      data: [{ id: 3, apellido: 'Pérez', nombre: 'Martín', estado: 'ACTIVO', avatarKey: 'k1' }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    })

    const res = await pedir('')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: [
        {
          id: 3,
          apellido: 'Pérez',
          nombre: 'Martín',
          estado: 'ACTIVO',
          fotoUrl: 'https://minio.local/k1',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    })
  })

  it('estado por defecto ACTIVO', async () => {
    await pedir('')
    expect(repository.listar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'ACTIVO' }))
  })

  it('estado=TODOS no filtra', async () => {
    await pedir('?estado=TODOS')
    expect(repository.listar).toHaveBeenCalledWith(expect.objectContaining({ estado: undefined }))
  })

  it('estado inválido → 400', async () => {
    expect((await pedir('?estado=BORRADO')).status).toBe(400)
  })

  it('materiaId se pasa al service', async () => {
    await pedir('?materiaId=2')
    expect(repository.listar).toHaveBeenCalledWith(expect.objectContaining({ materiaId: 2 }))
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('')).status).toBe(403)
  })
})

describe('GET /profesores/{id}', () => {
  it('responde 200 con el detalle', async () => {
    const res = await pedir('/3')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 3, apellido: 'Pérez', fotoUrl: null })
  })

  it('profesor inexistente → 404 NO_ENCONTRADO', async () => {
    repository.buscarPorId.mockResolvedValue(null)
    const res = await pedir('/99')
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it.each(['/abc', '/0', '/-1'])('id inválido %s → 400', async (id) => {
    expect((await pedir(id)).status).toBe(400)
  })
})

describe('POST /profesores', () => {
  it('alta con todos los datos → 201, con busqueda calculada y sin devolver la contraseña', async () => {
    const res = await pedir('', 'POST', ALTA)

    expect(res.status).toBe(201)
    expect(repository.crear).toHaveBeenCalledWith(
      {
        ...ALTA,
        dni: '28333444',
        email: 'martin.perez@aulaclick.local',
        busqueda: 'perez martin 28333444',
      },
      { userId: 'usr_mesa', role: 'MESA_ENTRADAS' },
    )
    const body = await res.json()
    expect(body).not.toHaveProperty('password')
    expect(body).toMatchObject({ id: 3, matricula: 'MP-0001' })
  })

  it.each(['nombre', 'apellido', 'dni', 'telefono', 'email', 'titulo', 'matricula', 'password'])(
    'sin %s → 400',
    async (campo) => {
      const res = await pedir('', 'POST', { ...ALTA, [campo]: undefined })
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('VALIDACION')
    },
  )

  it('contraseña de menos de 8 caracteres → 400', async () => {
    const res = await pedir('', 'POST', { ...ALTA, password: '1234567' })
    expect(res.status).toBe(400)
  })

  it.each([
    ['dni', 'Ya existe un profesor con ese DNI'],
    ['email', 'Ya existe un usuario con ese email'],
    ['matricula', 'Ya existe un profesor con esa matrícula'],
  ])('%s repetido → 409 con el campo en details', async (campo, mensaje) => {
    repository.crear.mockRejectedValue(
      new ConflictError(mensaje, { details: [{ path: [campo], message: mensaje }] }),
    )

    const res = await pedir('', 'POST', ALTA)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICTO')
    expect(body.error.details).toEqual([{ path: [campo], message: mensaje }])
  })

  it('busqueda, estado y auditoría del body se descartan', async () => {
    await pedir('', 'POST', { ...ALTA, busqueda: 'x', estado: 'INACTIVO', createdById: 'otro' })

    const datos = repository.crear.mock.calls[0][0]
    expect(datos).not.toHaveProperty('estado')
    expect(datos).not.toHaveProperty('createdById')
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('', 'POST', ALTA)).status).toBe(403)
  })
})

describe('PATCH /profesores/{id}', () => {
  it('edición parcial → 200, sin tocar los campos omitidos', async () => {
    const res = await pedir('/3', 'PATCH', { telefono: '387 4000000' })

    expect(res.status).toBe(200)
    expect(repository.actualizar).toHaveBeenCalledWith(
      3,
      { telefono: '387 4000000', busqueda: 'perez martin 28333444' },
      { userId: 'usr_mesa', role: 'MESA_ENTRADAS' },
    )
  })

  it('body vacío → 400 "Debe enviar al menos un campo"', async () => {
    const res = await pedir('/3', 'PATCH', {})
    expect(res.status).toBe(400)
    expect((await res.json()).error.details[0].message).toBe('Debe enviar al menos un campo')
  })

  it('no acepta password: el body lo descarta silenciosamente', async () => {
    await pedir('/3', 'PATCH', { telefono: '387 4000000', password: 'otra-clave-123' })

    expect(repository.actualizar.mock.calls[0][1]).not.toHaveProperty('password')
  })

  it('profesor inexistente → 404 NO_ENCONTRADO', async () => {
    repository.buscarPorId.mockResolvedValue(null)
    const res = await pedir('/99', 'PATCH', { telefono: '387 4000000' })
    expect(res.status).toBe(404)
  })

  it('DNI, email o matrícula repetidos → 409', async () => {
    repository.actualizar.mockRejectedValue(
      new ConflictError('Ya existe un profesor con esa matrícula'),
    )
    const res = await pedir('/3', 'PATCH', { matricula: 'MP-0002' })
    expect(res.status).toBe(409)
  })
})

describe('POST /profesores/{id}/foto', () => {
  function formConFoto(nombre = 'foto.jpg', tipo = 'image/jpeg', bytes = [1, 2, 3]) {
    const form = new FormData()
    form.append('foto', new File([new Uint8Array(bytes)], nombre, { type: tipo }))
    return form
  }

  it('sube la foto → 200 con el detalle actualizado', async () => {
    repository.actualizarFoto.mockResolvedValue({ ...GUARDADO, avatarKey: 'profesores/3/a.jpg' })

    const res = await pedirMultipart('/3/foto', formConFoto())

    expect(res.status).toBe(200)
    expect((await res.json()).fotoUrl).toBe('https://minio.local/profesores/3/a.jpg')
    expect(repository.actualizarFoto).toHaveBeenCalledWith(
      3,
      { bytes: expect.anything(), mimeType: 'image/jpeg' },
      { userId: 'usr_mesa', role: 'MESA_ENTRADAS' },
    )
  })

  it('un archivo que no es JPG ni PNG → 400', async () => {
    const res = await pedirMultipart('/3/foto', formConFoto('foto.gif', 'image/gif'))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
    expect(repository.actualizarFoto).not.toHaveBeenCalled()
  })

  it('un archivo que supera el tamaño máximo → 400', async () => {
    const grande = new Array(5 * 1024 * 1024 + 1).fill(0)
    const res = await pedirMultipart('/3/foto', formConFoto('foto.jpg', 'image/jpeg', grande))
    expect(res.status).toBe(400)
    expect(repository.actualizarFoto).not.toHaveBeenCalled()
  })

  it('sin archivo → 400', async () => {
    const res = await pedirMultipart('/3/foto', new FormData())
    expect(res.status).toBe(400)
  })

  it('profesor inexistente → 404', async () => {
    repository.actualizarFoto.mockResolvedValue(null)
    const res = await pedirMultipart('/99/foto', formConFoto())
    expect(res.status).toBe(404)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedirMultipart('/3/foto', formConFoto())).status).toBe(403)
  })
})

describe('DELETE /profesores/{id}/foto', () => {
  it('quita la foto → 200 con fotoUrl null', async () => {
    repository.quitarFoto.mockResolvedValue({ ...GUARDADO, avatarKey: null })

    const res = await pedir('/3/foto', 'DELETE')

    expect(res.status).toBe(200)
    expect((await res.json()).fotoUrl).toBeNull()
    expect(repository.quitarFoto).toHaveBeenCalledWith(3, {
      userId: 'usr_mesa',
      role: 'MESA_ENTRADAS',
    })
  })

  it('profesor inexistente → 404', async () => {
    repository.quitarFoto.mockResolvedValue(null)
    const res = await pedir('/99/foto', 'DELETE')
    expect(res.status).toBe(404)
  })
})

describe('GET /profesores/{id}/materias', () => {
  it('responde 200 con un arreglo, sin envolver en { data }', async () => {
    const res = await pedir('/3/materias')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 2, nombre: 'Matemática' }])
    expect(repository.listarMateriasAsignadas).toHaveBeenCalledWith(3)
  })

  it('profesor inexistente → 404 NO_ENCONTRADO', async () => {
    repository.listarMateriasAsignadas.mockResolvedValue(null)
    const res = await pedir('/99/materias')
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it.each(['/abc', '/0', '/-1', '/1.5'])('id inválido %s → 400', async (id) => {
    const res = await pedir(`${id}/materias`)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/3/materias')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/3/materias')).status).toBe(403)
  })
})

describe('POST /profesores/{id}/materias', () => {
  it('responde 201 con las materias asignadas actualizadas y pasa el actor', async () => {
    const res = await pedir('/3/materias', 'POST', { materiaIds: [2] })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual([{ id: 2, nombre: 'Matemática' }])
    expect(repository.asignarMaterias).toHaveBeenCalledWith(3, [2], {
      userId: 'usr_mesa',
      role: 'MESA_ENTRADAS',
    })
  })

  it('profesor inactivo → 409 PROFESOR_INACTIVO', async () => {
    repository.buscarConAsignaciones.mockResolvedValue({ estado: 'INACTIVO', asignaciones: [] })
    const res = await pedir('/3/materias', 'POST', { materiaIds: [2] })
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('PROFESOR_INACTIVO')
  })

  it('materia inexistente → 404 con details por posición', async () => {
    const res = await pedir('/3/materias', 'POST', { materiaIds: [2, 99] })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatchObject({
      code: 'NO_ENCONTRADO',
      details: [{ path: ['materiaIds', 1], message: 'La materia 99 no existe' }],
    })
  })

  it('sin body → 400 (SOLICITUD_INVALIDA: Hono lo rechaza antes de validar), sin llegar al service', async () => {
    const res = await pedir('/3/materias', 'POST')
    expect(res.status).toBe(400)
    expect(repository.buscarConAsignaciones).not.toHaveBeenCalled()
  })

  it.each([
    ['sin materiaIds', {}],
    ['lista vacía', { materiaIds: [] }],
    ['ids repetidos', { materiaIds: [2, 2] }],
    ['id no entero', { materiaIds: [1.5] }],
    ['id como texto', { materiaIds: ['2'] }],
    ['id cero', { materiaIds: [0] }],
    ['más de 10 materias', { materiaIds: Array.from({ length: 11 }, (_, i) => i + 1) }],
  ])('%s → 400 VALIDACION, sin llegar al service', async (_caso, body) => {
    const res = await pedir('/3/materias', 'POST', body)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
    expect(repository.buscarConAsignaciones).not.toHaveBeenCalled()
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/3/materias', 'POST', { materiaIds: [2] })).status).toBe(403)
  })
})

describe('DELETE /profesores/{id}/materias', () => {
  beforeEach(() => {
    repository.buscarConAsignaciones.mockResolvedValue({
      estado: 'ACTIVO',
      asignaciones: [{ materiaId: 2, nombre: 'Matemática', estado: 'ACTIVO' }],
    })
    repository.listarMateriasAsignadas.mockResolvedValue([])
  })

  it('responde 200 con las materias asignadas actualizadas y pasa el actor', async () => {
    const res = await pedir('/3/materias', 'DELETE', { materiaIds: [2] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    expect(repository.quitarMaterias).toHaveBeenCalledWith(3, [2], {
      userId: 'usr_mesa',
      role: 'MESA_ENTRADAS',
    })
  })

  it('con turnos vigentes → 409 TURNOS_VIGENTES con la cantidad en details', async () => {
    turnosRepository.contarVigentesPorMateria.mockResolvedValue([{ materiaId: 2, cantidad: 2 }])
    const res = await pedir('/3/materias', 'DELETE', { materiaIds: [2] })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatchObject({
      code: 'TURNOS_VIGENTES',
      details: [{ path: ['materiaIds', 0], cantidad: 2 }],
    })
    expect(repository.quitarMaterias).not.toHaveBeenCalled()
  })

  it('materia no asignada → 404', async () => {
    const res = await pedir('/3/materias', 'DELETE', { materiaIds: [9] })
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it.each([
    ['lista vacía', { materiaIds: [] }],
    ['ids repetidos', { materiaIds: [2, 2] }],
    ['más de 10 materias', { materiaIds: Array.from({ length: 11 }, (_, i) => i + 1) }],
  ])('%s → 400 VALIDACION, sin llegar al service', async (_caso, body) => {
    const res = await pedir('/3/materias', 'DELETE', body)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
    expect(repository.buscarConAsignaciones).not.toHaveBeenCalled()
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/3/materias', 'DELETE', { materiaIds: [2] })).status).toBe(403)
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })
  const status = (path: string, metodo: 'get' | 'post' | 'patch' | 'delete') =>
    Object.keys(doc.paths[path]?.[metodo]?.responses ?? {}).sort()

  it('declara los endpoints de datos personales con todos sus status codes', () => {
    expect(status('/api/v1/profesores', 'get')).toEqual(['200', '400', '401', '403'])
    expect(status('/api/v1/profesores/{id}', 'get')).toEqual(['200', '400', '401', '403', '404'])
    expect(status('/api/v1/profesores', 'post')).toEqual(['201', '400', '401', '403', '409'])
    expect(status('/api/v1/profesores/{id}', 'patch')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
  })

  it('declara los endpoints de la foto con todos sus status codes', () => {
    expect(status('/api/v1/profesores/{id}/foto', 'post')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
    ])
    expect(status('/api/v1/profesores/{id}/foto', 'delete')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
    ])
  })

  it('declara los endpoints de materias con todos sus status codes', () => {
    expect(status('/api/v1/profesores/{id}/materias', 'get')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
    ])
    expect(status('/api/v1/profesores/{id}/materias', 'post')).toEqual([
      '201',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
    expect(status('/api/v1/profesores/{id}/materias', 'delete')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
  })

  it('registra los componentes de profesores y de materias asignadas', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'ProfesorListadoItem',
        'ProfesorCrear',
        'ProfesorEditar',
        'ProfesorDetalle',
        'MateriaAsignada',
        'MateriasAsignadas',
        'AsignarMaterias',
        'QuitarMaterias',
      ]),
    )
  })
})
