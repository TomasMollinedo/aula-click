import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, errorHandler, NotFoundError } from '@/server/errors'
import { createRouter } from '@/server/router'
import { bloquesRoutes } from '../bloques.routes'

// Contrato HTTP de bloques: validación de Zod, auth y OpenAPI. Sin base ni variables de entorno:
// los repositories y Better Auth se reemplazan por mocks. Las reglas se prueban en el service.

const { repository, profesoresRepository, getSession } = vi.hoisted(() => ({
  repository: { crearBloques: vi.fn() },
  profesoresRepository: { buscarParaBloque: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../bloques.repository', () => ({ bloquesRepository: repository }))
vi.mock('@/server/features/profesores/profesores.repository', () => ({
  profesoresRepository,
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/bloques', bloquesRoutes)

const BODY = { profesorId: 3, diaSemana: 1, horaInicio: '14:00', horaFin: '15:00', aulaId: 7 }

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function pedir(body?: unknown) {
  return app.request('/api/v1/bloques', {
    method: 'POST',
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
  repository.crearBloques.mockResolvedValue([
    {
      id: 10,
      diaSemana: 1,
      horaInicio: '14:00',
      horaFin: '15:00',
      aula: { id: 7, nombre: 'Aula 3' },
    },
  ])
})

describe('POST /bloques', () => {
  it('responde 201 con la cantidad y el detalle, y pasa el actor al service', async () => {
    const res = await pedir(BODY)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      cantidad: 1,
      bloques: [
        {
          id: 10,
          diaSemana: 1,
          horaInicio: '14:00',
          horaFin: '15:00',
          aula: { id: 7, nombre: 'Aula 3' },
        },
      ],
    })
    expect(repository.crearBloques).toHaveBeenCalledWith(
      { profesorId: 3, aulaId: 7, diaSemana: 1, horas: [{ horaInicio: 840, horaFin: 900 }] },
      { userId: 'usr_mesa', role: 'MESA_ENTRADAS' },
    )
  })

  it('profesor inexistente → 404 NO_ENCONTRADO', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue(null)
    const res = await pedir(BODY)
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it('profesor inactivo → 409 PROFESOR_INACTIVO', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'INACTIVO',
      tieneMateriaActiva: true,
    })
    const res = await pedir(BODY)
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('PROFESOR_INACTIVO')
  })

  it('profesor sin materias → 409 PROFESOR_SIN_MATERIAS', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'ACTIVO',
      tieneMateriaActiva: false,
    })
    const res = await pedir(BODY)
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
    const res = await pedir(BODY)
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
    const res = await pedir(BODY)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatchObject({
      code: 'AULA_OCUPADA',
      message: 'No hay un aula disponible en ese horario. Por favor, elija otro horario.',
    })
  })

  it('aula inexistente → 404 NO_ENCONTRADO', async () => {
    repository.crearBloques.mockRejectedValue(new NotFoundError('Aula no encontrada'))
    const res = await pedir(BODY)
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
    const res = await pedir(body)
    expect(res.status).toBe(400)
    expect(profesoresRepository.buscarParaBloque).not.toHaveBeenCalled()
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir(BODY)).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir(BODY)).status).toBe(403)
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })

  it('declara el endpoint con todos sus status codes', () => {
    const responses = doc.paths['/api/v1/bloques']?.post?.responses ?? {}
    expect(Object.keys(responses).sort()).toEqual(['201', '400', '401', '403', '404', '409'])
  })

  it('registra los componentes de bloques', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining(['BloqueCrear', 'BloqueCreado', 'BloquesCreados']),
    )
  })
})
