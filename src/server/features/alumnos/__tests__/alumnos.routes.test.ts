import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { alumnosRoutes } from '../alumnos.routes'

// Contrato HTTP de alumnos: validación de Zod, auth y OpenAPI. Sin base ni variables de entorno:
// el repository y Better Auth se reemplazan por mocks. Las reglas se prueban en el service.

const { repository, profesoresRepository, getPresignedUrl, getSession } = vi.hoisted(() => ({
  repository: {
    listar: vi.fn(),
    listarDeProfesor: vi.fn(),
    buscarPorId: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    buscarPerfil: vi.fn(),
    usuariosTomados: vi.fn(),
    existeUsuarioConDni: vi.fn(),
    crearAcceso: vi.fn(),
    restablecerContrasena: vi.fn(),
    actualizarFoto: vi.fn(),
    quitarFoto: vi.fn(),
  },
  profesoresRepository: { buscarIdPorUsuario: vi.fn() },
  getPresignedUrl: vi.fn(),
  getSession: vi.fn(),
}))
vi.mock('../alumnos.repository', () => ({ alumnosRepository: repository }))
vi.mock('@/server/features/profesores/profesores.repository', () => ({ profesoresRepository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('@/lib/storage', () => ({ getPresignedUrl, putObject: vi.fn(), deleteObject: vi.fn() }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/alumnos', alumnosRoutes)

const minimo = {
  nombre: 'Juan',
  apellido: 'González',
  dni: '30.123.456',
  fechaNacimiento: '1990-05-14',
  email: 'Juan.Gonzalez@Mail.com',
  telefono: '387154123456',
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
  avatarKey: null,
  acceso: null,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  createdBy: null,
  updatedBy: null,
}

/** Acceso al portal tal como lo devuelve el repository en el detalle. */
const accesoGuardado = {
  usuario: 'jgonzalez456',
  creadoPor: { id: 'usr_mesa', nombre: 'Ana', apellido: 'Pérez' },
  creadoEl: '2026-09-01T12:00:00.000Z',
  restablecidaPor: null,
  restablecidaEl: null,
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
  getPresignedUrl.mockImplementation((key: string) => Promise.resolve(`https://minio.local/${key}`))
  repository.existeUsuarioConDni.mockResolvedValue(false)
  repository.usuariosTomados.mockResolvedValue([])
})

describe('auth', () => {
  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS (el listado general no admite PROFESOR) → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('')).status).toBe(403)
  })
})

describe('GET /alumnos/{id}', () => {
  it('con MESA_ENTRADAS responde 200', async () => {
    expect((await pedir('/1')).status).toBe(200)
  })

  // El detalle es el único endpoint de alumnos que también admite PROFESOR (un profesor ve la
  // ficha de un alumno con quien tiene turnos, sin poder editarla: PATCH sigue siendo MESA_ENTRADAS).
  it('con PROFESOR responde 200', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/1')).status).toBe(200)
  })

  it('con un rol que no es MESA_ENTRADAS ni PROFESOR → 403', async () => {
    getSession.mockResolvedValue(sesion('GERENTE'))
    expect((await pedir('/1')).status).toBe(403)
  })

  it('inexistente → 404 NO_ENCONTRADO', async () => {
    repository.buscarPorId.mockResolvedValue(null)
    const res = await pedir('/99')
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })
})

describe('GET /alumnos/mis-alumnos', () => {
  const vacio = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }

  beforeEach(() => {
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(3)
    repository.listarDeProfesor.mockResolvedValue(vacio)
  })

  it('con rol PROFESOR responde 200 y resuelve el profesor con el userId de la sesión', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))

    const res = await pedir('/mis-alumnos')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(vacio)
    expect(profesoresRepository.buscarIdPorUsuario).toHaveBeenCalledWith('usr_mesa')
  })

  it('devuelve las materias que trae el repository, tal cual', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    repository.listarDeProfesor.mockResolvedValue({
      data: [
        {
          id: 12,
          apellido: 'Álvarez',
          nombre: 'Lucía',
          dni: '52345678',
          materias: [
            { id: 2, nombre: 'Matemática' },
            { id: 7, nombre: 'Física' },
          ],
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    })

    const res = await pedir('/mis-alumnos')

    expect((await res.json()).data[0].materias).toEqual([
      { id: 2, nombre: 'Matemática' },
      { id: 7, nombre: 'Física' },
    ])
  })

  it('pasa materiaId y q al repository', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))

    await pedir('/mis-alumnos?materiaId=7&q=gonz')

    expect(repository.listarDeProfesor).toHaveBeenCalledWith(
      expect.objectContaining({ profesorId: 3, materiaId: 7, terminos: ['gonz'] }),
    )
  })

  it('materiaId inválido → 400', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/mis-alumnos?materiaId=0')).status).toBe(400)
  })

  it('el usuario de la sesión sin ficha de profesor → 404 NO_ENCONTRADO', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(null)

    const res = await pedir('/mis-alumnos')

    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/mis-alumnos')).status).toBe(401)
  })

  it('con MESA_ENTRADAS (no PROFESOR) → 403', async () => {
    expect((await pedir('/mis-alumnos')).status).toBe(403)
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

  it('tutorDni con puntos y espacios se guarda solo con dígitos', async () => {
    const res = await pedir('', 'POST', { ...minimo, tutorDni: ' 20.111.222 ' })

    expect(res.status).toBe(201)
    expect(repository.crear.mock.calls[0][0].tutorDni).toBe('20111222')
  })

  it('los opcionales con formato se validan con su primitiva', async () => {
    const res = await pedir('', 'POST', { ...minimo, tutorEmail: 'no-es-email', tutorDni: '12' })
    const paths = (await res.json()).error.details.map((d: { path: string[] }) => d.path[0])

    expect(res.status).toBe(400)
    expect(paths).toEqual(expect.arrayContaining(['tutorEmail', 'tutorDni']))
  })

  it.each([
    ['nombre', 'Juan2'],
    ['apellido', 'González 3'],
    ['tutorNombre', 'Marta1'],
    ['tutorApellido', '4lvarez'],
    ['dni', '30A23456'],
    ['tutorDni', '2011122B'],
    ['telefono', '387 412 ABCD'],
    ['telefono', '+54 3874123456'],
    ['tutorTelefono', '387-15-XXXX-99'],
    ['tutorTelefono', '(387) 4123456'],
    ['nombre', 'Ana-María'],
    ['tutorApellido', "O'Connor"],
  ])('%s con caracteres no permitidos (%o) → 400 sobre ese campo', async (campo, valor) => {
    const res = await pedir('', 'POST', { ...minimo, [campo]: valor })

    expect(res.status).toBe(400)
    expect((await res.json()).error.details[0].path).toEqual([campo])
    expect(repository.crear).not.toHaveBeenCalled()
  })

  it('nombres con tildes y espacios → 201', async () => {
    const res = await pedir('', 'POST', {
      ...minimo,
      nombre: 'María José',
      apellido: 'Pérez Gil',
      tutorNombre: 'Ñusta',
      tutorApellido: 'Müller',
    })

    expect(res.status).toBe(201)
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

  it('con dni → 400 "El DNI no se puede modificar", sin llamar a actualizar', async () => {
    const res = await pedir('/1', 'PATCH', { dni: '40111222' })

    expect(res.status).toBe(400)
    expect((await res.json()).error.details[0]).toEqual({
      path: ['dni'],
      message: 'El DNI no se puede modificar',
    })
    expect(repository.actualizar).not.toHaveBeenCalled()
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
  const status = (path: string, metodo: 'get' | 'post' | 'patch' | 'delete') =>
    Object.keys(doc.paths[path]?.[metodo]?.responses ?? {}).sort()

  it('declara los endpoints con todos sus status codes', () => {
    expect(status('/api/v1/alumnos', 'get')).toEqual(['200', '400', '401', '403'])
    expect(status('/api/v1/alumnos/mis-alumnos', 'get')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
    ])
    expect(status('/api/v1/alumnos/{id}', 'get')).toEqual(['200', '400', '401', '403', '404'])
    expect(status('/api/v1/alumnos', 'post')).toEqual(['201', '400', '401', '403', '409'])
    expect(status('/api/v1/alumnos/{id}', 'patch')).toEqual(['200', '400', '401', '403', '404'])
    expect(status('/api/v1/alumnos/usuario-sugerido', 'get')).toEqual(['200', '400', '401', '403'])
    expect(status('/api/v1/alumnos/mi-perfil', 'get')).toEqual(['200', '401', '403', '404'])
    expect(status('/api/v1/alumnos/{id}/foto', 'post')).toEqual(['200', '400', '401', '403', '404'])
    expect(status('/api/v1/alumnos/{id}/foto', 'delete')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
    ])
    expect(status('/api/v1/alumnos/{id}/acceso', 'post')).toEqual([
      '201',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
    expect(status('/api/v1/alumnos/{id}/acceso/restablecimiento', 'post')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
  })

  it('la foto se declara como multipart binario', () => {
    const body = doc.paths['/api/v1/alumnos/{id}/foto']?.post?.requestBody as {
      content: Record<
        string,
        { schema: { properties: { foto: { type: string; format: string } } } }
      >
    }
    const foto = body.content['multipart/form-data']?.schema.properties.foto

    expect(foto).toMatchObject({ type: 'string', format: 'binary' })
  })

  it('registra los componentes de alumnos', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'AlumnoListadoItem',
        'AlumnoDeProfesorListadoItem',
        'AlumnoMateria',
        'AlumnoCrear',
        'AlumnoEditar',
        'AlumnoDetalle',
        'AccesoAlumno',
        'UsuarioSugerido',
        'MiPerfilAlumno',
        'UsuarioAuditoria',
      ]),
    )
  })
})

// ---------------------------------------------------------------------------------------------
// Foto (HU-26), acceso al portal (HU-27) y perfil del portal (HU-28)
// ---------------------------------------------------------------------------------------------

/** Multipart con el campo `foto`. `bytes` permite mandar una firma válida o una inventada. */
function pedirFoto(path: string, archivo: File) {
  const form = new FormData()
  form.append('foto', archivo)
  return app.request(`/api/v1/alumnos${path}`, { method: 'POST', body: form })
}

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0x00])

describe('POST /alumnos/{id}/foto', () => {
  beforeEach(() => {
    repository.actualizarFoto.mockResolvedValue(guardado)
  })

  it('un JPG válido responde 200 y llega al repository', async () => {
    const res = await pedirFoto('/1/foto', new File([JPG], 'foto.jpg', { type: 'image/jpeg' }))

    expect(res.status).toBe(200)
    expect(repository.actualizarFoto).toHaveBeenCalled()
  })

  it.each([
    ['un tipo que no es imagen', new File([JPG], 'foto.txt', { type: 'text/plain' })],
    [
      'un archivo cuyo contenido no es del tipo que declara',
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'foto.jpg', { type: 'image/jpeg' }),
    ],
  ])('%s → 400 VALIDACION, sin tocar el repository', async (_caso, archivo) => {
    const res = await pedirFoto('/1/foto', archivo)

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
    expect(repository.actualizarFoto).not.toHaveBeenCalled()
  })

  it('una foto de más de 5 MB → 400 VALIDACION', async () => {
    const grande = new Uint8Array(5 * 1024 * 1024 + 1)
    grande.set(JPG)
    const res = await pedirFoto('/1/foto', new File([grande], 'foto.jpg', { type: 'image/jpeg' }))

    expect(res.status).toBe(400)
    expect(repository.actualizarFoto).not.toHaveBeenCalled()
  })

  it('un alumno que no existe → 404', async () => {
    repository.actualizarFoto.mockResolvedValue(null)

    const res = await pedirFoto('/99/foto', new File([JPG], 'foto.jpg', { type: 'image/jpeg' }))

    expect(res.status).toBe(404)
  })

  it('sin sesión → 401; con otro rol → 403', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect(
      (await pedirFoto('/1/foto', new File([JPG], 'f.jpg', { type: 'image/jpeg' }))).status,
    ).toBe(401)

    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect(
      (await pedirFoto('/1/foto', new File([JPG], 'f.jpg', { type: 'image/jpeg' }))).status,
    ).toBe(403)
  })
})

describe('DELETE /alumnos/{id}/foto', () => {
  beforeEach(() => {
    repository.quitarFoto.mockResolvedValue(guardado)
  })

  it('responde 200 y llega al repository', async () => {
    const res = await pedir('/1/foto', 'DELETE')

    expect(res.status).toBe(200)
    expect(repository.quitarFoto).toHaveBeenCalled()
  })

  it('un alumno que no existe → 404', async () => {
    repository.quitarFoto.mockResolvedValue(null)

    expect((await pedir('/99/foto', 'DELETE')).status).toBe(404)
  })

  it('con un rol que no es mesa de entradas → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))

    expect((await pedir('/1/foto', 'DELETE')).status).toBe(403)
  })
})

describe('GET /alumnos/usuario-sugerido', () => {
  beforeEach(() => {
    repository.usuariosTomados.mockResolvedValue([])
  })

  it('con los tres datos responde el usuario', async () => {
    const res = await pedir('/usuario-sugerido?nombre=Juan&apellido=Pérez&dni=45.123.456')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ usuario: 'jperez456' })
  })

  it.each([
    ['sin nombre', '?apellido=Pérez&dni=45123456'],
    ['sin apellido', '?nombre=Juan&dni=45123456'],
    ['sin dni', '?nombre=Juan&apellido=Pérez'],
    ['con un dni de menos dígitos', '?nombre=Juan&apellido=Pérez&dni=123'],
    ['con un nombre con números', '?nombre=Juan2&apellido=Pérez&dni=45123456'],
  ])('%s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedir(`/usuario-sugerido${query}`)

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('no lo captura `/{id}` (se registra antes)', async () => {
    await pedir('/usuario-sugerido?nombre=Juan&apellido=Pérez&dni=45123456')

    expect(repository.buscarPorId).not.toHaveBeenCalled()
  })

  it('con un rol que no es mesa de entradas → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))

    expect((await pedir('/usuario-sugerido?nombre=Juan&apellido=Pérez&dni=45123456')).status).toBe(
      403,
    )
  })
})

describe('POST /alumnos/{id}/acceso', () => {
  it('un alumno sin acceso responde 201', async () => {
    repository.buscarPorId.mockResolvedValue({ ...guardado, acceso: null })
    repository.crearAcceso.mockResolvedValue({ ...guardado, acceso: accesoGuardado })

    const res = await pedir('/1/acceso', 'POST')

    expect(res.status).toBe(201)
    expect((await res.json()).acceso.usuario).toBe('jgonzalez456')
  })

  it('un alumno que ya tiene acceso → 409', async () => {
    repository.buscarPorId.mockResolvedValue({ ...guardado, acceso: accesoGuardado })

    const res = await pedir('/1/acceso', 'POST')

    expect(res.status).toBe(409)
    expect(repository.crearAcceso).not.toHaveBeenCalled()
  })

  it('un alumno que no existe → 404', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    expect((await pedir('/99/acceso', 'POST')).status).toBe(404)
  })

  it('con un rol que no es mesa de entradas → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))

    expect((await pedir('/1/acceso', 'POST')).status).toBe(403)
  })
})

describe('POST /alumnos/{id}/acceso/restablecimiento', () => {
  it('con acceso responde 200', async () => {
    repository.buscarPorId.mockResolvedValue({ ...guardado, acceso: accesoGuardado })
    repository.restablecerContrasena.mockResolvedValue({ ...guardado, acceso: accesoGuardado })

    const res = await pedir('/1/acceso/restablecimiento', 'POST')

    expect(res.status).toBe(200)
    expect(repository.restablecerContrasena).toHaveBeenCalled()
  })

  it('sin acceso → 409', async () => {
    repository.buscarPorId.mockResolvedValue({ ...guardado, acceso: null })

    const res = await pedir('/1/acceso/restablecimiento', 'POST')

    expect(res.status).toBe(409)
    expect(repository.restablecerContrasena).not.toHaveBeenCalled()
  })

  it('un alumno que no existe → 404', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    expect((await pedir('/99/acceso/restablecimiento', 'POST')).status).toBe(404)
  })

  it('la contraseña nunca viaja en la respuesta', async () => {
    repository.buscarPorId.mockResolvedValue({ ...guardado, acceso: accesoGuardado })
    repository.restablecerContrasena.mockResolvedValue({ ...guardado, acceso: accesoGuardado })

    const cuerpo = await (await pedir('/1/acceso/restablecimiento', 'POST')).text()

    expect(cuerpo).not.toContain('password')
    expect(cuerpo).not.toContain('contrasena')
  })
})

describe('GET /alumnos/mi-perfil', () => {
  const sesionAlumno = {
    headers: new Headers(),
    response: {
      user: { id: 'usr_alumno', role: 'ALUMNO', estado: 'ACTIVO', alumnoId: 12 },
      session: { id: 's-2' },
    },
  }

  beforeEach(() => {
    repository.buscarPerfil.mockResolvedValue({
      nombre: 'Lucía',
      apellido: 'Álvarez',
      usuario: 'lalvarez678',
      avatarKey: null,
    })
  })

  it('el alumno de la sesión ve su perfil, tomado del Actor y no de un parámetro', async () => {
    getSession.mockResolvedValue(sesionAlumno)

    const res = await pedir('/mi-perfil')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      nombre: 'Lucía',
      apellido: 'Álvarez',
      usuario: 'lalvarez678',
      fotoUrl: null,
    })
    expect(repository.buscarPerfil).toHaveBeenCalledWith(12)
  })

  it('no devuelve ningún otro dato de la ficha del alumno', async () => {
    getSession.mockResolvedValue(sesionAlumno)

    const cuerpo = await (await pedir('/mi-perfil')).json()

    expect(Object.keys(cuerpo).sort()).toEqual(['apellido', 'fotoUrl', 'nombre', 'usuario'])
  })

  it('mesa de entradas no puede usarlo → 403', async () => {
    expect((await pedir('/mi-perfil')).status).toBe(403)
    expect(repository.buscarPerfil).not.toHaveBeenCalled()
  })

  it('una cuenta ALUMNO sin alumno vinculado → 403 (lo corta requireAuth)', async () => {
    getSession.mockResolvedValue({
      headers: new Headers(),
      response: {
        user: { id: 'usr_alumno', role: 'ALUMNO', estado: 'ACTIVO' },
        session: { id: 's-3' },
      },
    })

    expect((await pedir('/mi-perfil')).status).toBe(403)
  })

  it('no lo captura `/{id}` (se registra antes)', async () => {
    getSession.mockResolvedValue(sesionAlumno)

    await pedir('/mi-perfil')

    expect(repository.buscarPorId).not.toHaveBeenCalled()
  })
})
