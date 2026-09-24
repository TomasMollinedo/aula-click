import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, errorHandler, NotFoundError } from '@/server/errors'
import { createRouter } from '@/server/router'
import { bloquesRoutes } from '../bloques.routes'

// Contrato HTTP de bloques: validación de Zod, auth y OpenAPI. Sin base ni variables de entorno:
// los repositories y Better Auth se reemplazan por mocks. Las reglas se prueban en el service.

const { repository, profesoresRepository, turnosRepository, getSession } = vi.hoisted(() => ({
  repository: {
    crearBloques: vi.fn(),
    buscarPorId: vi.fn(),
    editarBloque: vi.fn(),
    eliminarBloque: vi.fn(),
  },
  profesoresRepository: { buscarParaBloque: vi.fn() },
  turnosRepository: { contarVigentesPorBloque: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../bloques.repository', () => ({ bloquesRepository: repository }))
vi.mock('@/server/features/profesores/profesores.repository', () => ({
  profesoresRepository,
}))
vi.mock('@/server/features/turnos/turnos.repository', () => ({ turnosRepository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/bloques', bloquesRoutes)

const BODY = { profesorId: 3, diaSemana: 1, horaInicio: '14:00', horaFin: '15:00', aulaId: 7 }
const BLOQUE_ACTUAL = {
  id: 10,
  profesorId: 3,
  aulaId: 7,
  diaSemana: 1,
  horaInicio: 840,
  horaFin: 900,
  estado: 'ACTIVO',
}
const BLOQUE_RESPUESTA = {
  id: 10,
  diaSemana: 1,
  horaInicio: '14:00',
  horaFin: '15:00',
  aula: { id: 7, nombre: 'Aula 3' },
}

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function pedir(path: string, metodo: string, body?: unknown) {
  return app.request(`/api/v1/bloques${path}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  profesoresRepository.buscarParaBloque.mockResolvedValue({
    estado: 'ACTIVO',
    tieneMateriaActiva: true,
  })
  turnosRepository.contarVigentesPorBloque.mockResolvedValue(0)
  repository.crearBloques.mockResolvedValue([BLOQUE_RESPUESTA])
  repository.buscarPorId.mockResolvedValue(BLOQUE_ACTUAL)
  repository.editarBloque.mockResolvedValue(BLOQUE_RESPUESTA)
  repository.eliminarBloque.mockResolvedValue(BLOQUE_RESPUESTA)
})

describe('POST /bloques', () => {
  it('responde 201 con la cantidad y el detalle, y pasa el actor al service', async () => {
    const res = await pedir('', 'POST', BODY)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ cantidad: 1, bloques: [BLOQUE_RESPUESTA] })
    expect(repository.crearBloques).toHaveBeenCalledWith(
      { profesorId: 3, aulaId: 7, diaSemana: 1, horas: [{ horaInicio: 840, horaFin: 900 }] },
      { userId: 'usr_mesa', role: 'MESA_ENTRADAS' },
    )
  })

  it('profesor inexistente → 404 NO_ENCONTRADO', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue(null)
    const res = await pedir('', 'POST', BODY)
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it('profesor inactivo → 409 PROFESOR_INACTIVO', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'INACTIVO',
      tieneMateriaActiva: true,
    })
    const res = await pedir('', 'POST', BODY)
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('PROFESOR_INACTIVO')
  })

  it('profesor sin materias → 409 PROFESOR_SIN_MATERIAS', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'ACTIVO',
      tieneMateriaActiva: false,
    })
    const res = await pedir('', 'POST', BODY)
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('PROFESOR_SIN_MATERIAS')
  })

  it('bloque superpuesto → 409 BLOQUE_SUPERPUESTO con details', async () => {
    repository.crearBloques.mockRejectedValue(
      new ConflictError('El profesor ya tiene un bloque en ese horario', {
        code: 'BLOQUE_SUPERPUESTO',
        details: [{ diaSemana: 1, horaInicio: '14:00', horaFin: '15:00', bloqueExistenteId: 5 }],
      }),
    )
    const res = await pedir('', 'POST', BODY)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatchObject({ code: 'BLOQUE_SUPERPUESTO' })
  })

  it('aula ocupada → 409 AULA_OCUPADA con el mensaje exacto de la HU', async () => {
    repository.crearBloques.mockRejectedValue(
      new ConflictError(
        'No hay un aula disponible en ese horario. Por favor, elija otro horario.',
        {
          code: 'AULA_OCUPADA',
          details: [{ diaSemana: 1, horaInicio: '14:00', horaFin: '15:00', profesorId: 9 }],
        },
      ),
    )
    const res = await pedir('', 'POST', BODY)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatchObject({
      code: 'AULA_OCUPADA',
      message: 'No hay un aula disponible en ese horario. Por favor, elija otro horario.',
    })
  })

  it('aula inexistente → 404 NO_ENCONTRADO', async () => {
    repository.crearBloques.mockRejectedValue(new NotFoundError('Aula no encontrada'))
    const res = await pedir('', 'POST', BODY)
    expect(res.status).toBe(404)
  })

  it.each([
    ['sin body', undefined],
    ['sin profesorId', { ...BODY, profesorId: undefined }],
    ['diaSemana fuera de rango (0)', { ...BODY, diaSemana: 0 }],
    ['diaSemana fuera de rango (8)', { ...BODY, diaSemana: 8 }],
    ['hora con formato inválido', { ...BODY, horaInicio: '14:30:00' }],
    ['horaInicio no en punto', { ...BODY, horaInicio: '14:30' }],
    ['horaFin no en punto', { ...BODY, horaFin: '15:30' }],
    ['horaFin no posterior a horaInicio', { ...BODY, horaInicio: '15:00', horaFin: '15:00' }],
    ['horaFin anterior a horaInicio', { ...BODY, horaInicio: '15:00', horaFin: '14:00' }],
    ['aulaId inválido', { ...BODY, aulaId: 0 }],
  ])('%s → 400, sin llegar al service', async (_caso, body) => {
    const res = await pedir('', 'POST', body)
    expect(res.status).toBe(400)
    expect(profesoresRepository.buscarParaBloque).not.toHaveBeenCalled()
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('', 'POST', BODY)).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('', 'POST', BODY)).status).toBe(403)
  })
})

describe('PATCH /bloques/{bloqueId}', () => {
  it('responde 200 con el bloque editado, y pasa el actor al service', async () => {
    const res = await pedir('/10', 'PATCH', { aulaId: 9 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(BLOQUE_RESPUESTA)
    expect(repository.editarBloque).toHaveBeenCalledWith(
      10,
      { diaSemana: 1, horaInicio: 840, horaFin: 900, aulaId: 9 },
      { userId: 'usr_mesa', role: 'MESA_ENTRADAS' },
    )
  })

  it('bloque inexistente → 404 NO_ENCONTRADO', async () => {
    repository.buscarPorId.mockResolvedValue(null)
    const res = await pedir('/99', 'PATCH', { aulaId: 9 })
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it('con turnos vigentes → 409 TURNOS_VIGENTES con la cantidad', async () => {
    turnosRepository.contarVigentesPorBloque.mockResolvedValue(3)
    const res = await pedir('/10', 'PATCH', { aulaId: 9 })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatchObject({
      code: 'TURNOS_VIGENTES',
      details: { cantidad: 3 },
    })
  })

  it('el resultado deja de durar una hora exacta → 400 VALIDACION', async () => {
    const res = await pedir('/10', 'PATCH', { horaFin: '16:00' })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('profesor inactivo → 409 PROFESOR_INACTIVO', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'INACTIVO',
      tieneMateriaActiva: true,
    })
    const res = await pedir('/10', 'PATCH', { aulaId: 9 })
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('PROFESOR_INACTIVO')
  })

  it('bloque superpuesto → 409 BLOQUE_SUPERPUESTO', async () => {
    repository.editarBloque.mockRejectedValue(
      new ConflictError('El profesor ya tiene un bloque en ese horario', {
        code: 'BLOQUE_SUPERPUESTO',
        details: [{ diaSemana: 1, horaInicio: '15:00', horaFin: '16:00', bloqueExistenteId: 20 }],
      }),
    )
    const res = await pedir('/10', 'PATCH', { horaInicio: '15:00', horaFin: '16:00' })
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('BLOQUE_SUPERPUESTO')
  })

  it.each([
    ['sin body', undefined],
    ['body vacío', {}],
    ['diaSemana fuera de rango', { diaSemana: 0 }],
    ['hora no en punto', { horaInicio: '14:30' }],
    ['aulaId inválido', { aulaId: 0 }],
    ['bloqueId inválido en el path', { aulaId: 9 }],
  ])('%s → 400, sin llegar al service', async (_caso, body) => {
    const path = _caso === 'bloqueId inválido en el path' ? '/abc' : '/10'
    const res = await pedir(path, 'PATCH', body)
    expect(res.status).toBe(400)
    expect(repository.buscarPorId).not.toHaveBeenCalled()
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/10', 'PATCH', { aulaId: 9 })).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/10', 'PATCH', { aulaId: 9 })).status).toBe(403)
  })
})

describe('DELETE /bloques/{bloqueId}', () => {
  it('responde 200 con el bloque dado de baja, y pasa el actor al service', async () => {
    const res = await pedir('/10', 'DELETE')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(BLOQUE_RESPUESTA)
    expect(repository.eliminarBloque).toHaveBeenCalledWith(10, {
      userId: 'usr_mesa',
      role: 'MESA_ENTRADAS',
    })
  })

  it('bloque inexistente → 404 NO_ENCONTRADO', async () => {
    repository.buscarPorId.mockResolvedValue(null)
    const res = await pedir('/99', 'DELETE')
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it('con turnos vigentes → 409 TURNOS_VIGENTES con la cantidad, sin dar de baja', async () => {
    turnosRepository.contarVigentesPorBloque.mockResolvedValue(1)
    const res = await pedir('/10', 'DELETE')
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatchObject({
      code: 'TURNOS_VIGENTES',
      details: { cantidad: 1 },
    })
    expect(repository.eliminarBloque).not.toHaveBeenCalled()
  })

  it('se puede dar de baja aunque el profesor esté inactivo (no se valida su estado)', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'INACTIVO',
      tieneMateriaActiva: true,
    })
    const res = await pedir('/10', 'DELETE')
    expect(res.status).toBe(200)
    expect(profesoresRepository.buscarParaBloque).not.toHaveBeenCalled()
  })

  it('bloqueId inválido en el path → 400', async () => {
    const res = await pedir('/abc', 'DELETE')
    expect(res.status).toBe(400)
    expect(repository.buscarPorId).not.toHaveBeenCalled()
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/10', 'DELETE')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/10', 'DELETE')).status).toBe(403)
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })

  it('declara los endpoints con todos sus status codes', () => {
    const respuestasPost = doc.paths['/api/v1/bloques']?.post?.responses ?? {}
    expect(Object.keys(respuestasPost).sort()).toEqual(['201', '400', '401', '403', '404', '409'])

    const respuestasPatch = doc.paths['/api/v1/bloques/{bloqueId}']?.patch?.responses ?? {}
    expect(Object.keys(respuestasPatch).sort()).toEqual(['200', '400', '401', '403', '404', '409'])

    const respuestasDelete = doc.paths['/api/v1/bloques/{bloqueId}']?.delete?.responses ?? {}
    expect(Object.keys(respuestasDelete).sort()).toEqual(['200', '400', '401', '403', '404', '409'])
  })

  it('registra los componentes de bloques', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining(['BloqueCrear', 'BloqueEditar', 'Bloque', 'BloquesCreados']),
    )
  })
})
