import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { contarPaginas, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import { historialesRoutes } from '../historiales.routes'

// Contrato HTTP de `historiales` (T-108): validación de Zod, auth, roles y el orden de las rutas
// del portal. Sin base ni variables de entorno: el repository y Better Auth se reemplazan por
// mocks. Las reglas se prueban en `historiales.reglas.test.ts` y `historiales.service.test.ts`.

const { repository, profesoresRepository, alumnosRepository, getSession } = vi.hoisted(() => ({
  repository: {
    leerOcurrenciasDelAlumno: vi.fn(),
    buscarFechaDelPrimerTurno: vi.fn(),
    profesorTieneAlumno: vi.fn(),
    buscarUltimasIndicaciones: vi.fn(),
    leerExamenesDelPeriodo: vi.fn(),
  },
  profesoresRepository: { buscarIdPorUsuario: vi.fn() },
  alumnosRepository: { buscarPorId: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../historiales.repository', () => ({ historialesRepository: repository }))
vi.mock('@/server/features/alumnos/alumnos.repository', () => ({ alumnosRepository }))
vi.mock('@/server/features/profesores/profesores.repository', () => ({ profesoresRepository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/historiales', historialesRoutes)

/** Una ocurrencia del motor, con los campos internos (`busqueda`) que no deben salir. */
const OCURRENCIA = {
  turnoId: 31,
  fecha: '2020-01-06',
  bloqueAgendaId: 10,
  diaSemana: 1,
  horaInicio: 480,
  horaFin: 540,
  profesorId: 4,
  aulaId: 3,
  alumnoId: 12,
  materiaId: 3,
  tipo: 'RECURRENTE',
  estado: 'REALIZADO',
  pago: { estado: 'PENDIENTE' },
  asistencia: {
    estado: 'PRESENTE',
    trabajado: 'Ecuaciones',
    indicaciones: 'Practicar la guía',
    observacion: null,
    createdById: 'usr_ana',
    createdAt: '2020-01-06T12:00:00.000Z',
    updatedById: 'usr_ana',
    updatedAt: '2020-01-06T12:00:00.000Z',
  },
  plazoAsistencia: { vence: '2020-01-13', vencido: true },
  serie: { serieId: null, fechaInicio: '2020-01-06', fechaFin: null, finEfectivo: null },
  alumno: { id: 12, nombre: 'Lucía', apellido: 'González', busqueda: 'gonzalez lucia 40123456' },
  profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez', busqueda: 'perez ana 30111222' },
  materia: { id: 3, nombre: 'Matemática' },
  aula: { id: 3, nombre: 'Aula 3' },
}

function pedir(path: string) {
  return app.request(`/api/v1/historiales${path}`)
}

function sesion(role = 'MESA_ENTRADAS', userId = 'usr_mesa', alumnoId: number | null = null) {
  return {
    headers: new Headers(),
    response: {
      user: { id: userId, role, estado: 'ACTIVO', name: 'Laura', apellido: 'Gómez', alumnoId },
      session: { id: 's-1' },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.leerOcurrenciasDelAlumno.mockResolvedValue([])
  repository.buscarFechaDelPrimerTurno.mockResolvedValue('2020-01-06')
  repository.profesorTieneAlumno.mockResolvedValue(true)
  repository.buscarUltimasIndicaciones.mockResolvedValue(null)
  repository.leerExamenesDelPeriodo.mockResolvedValue([])
  profesoresRepository.buscarIdPorUsuario.mockResolvedValue(4)
  alumnosRepository.buscarPorId.mockResolvedValue({
    id: 12,
    nombre: 'Lucía',
    apellido: 'González',
    dni: '40123456',
    nivelEscolaridad: 'SECUNDARIO',
  })
})

async function esperarError(res: Response, status: number, code: string) {
  expect(res.status).toBe(status)
  expect((await res.json()).error.code).toBe(code)
}

// ---------------------------------------------------------------------------------------------
// GET /historiales/alumnos/{alumnoId}
// ---------------------------------------------------------------------------------------------

describe('GET /historiales/alumnos/{alumnoId}', () => {
  it('responde 200 con el historial que arma el service, sin `busqueda`', async () => {
    repository.leerOcurrenciasDelAlumno.mockResolvedValue([OCURRENCIA])

    const res = await pedir('/alumnos/12?desde=2020-01-01&hasta=2020-01-31')
    const texto = await res.text()

    expect(res.status).toBe(200)
    expect(texto).not.toContain('busqueda')
    const cuerpo = JSON.parse(texto)
    expect(cuerpo.alumno).toEqual({
      id: 12,
      nombre: 'Lucía',
      apellido: 'González',
      dni: '40123456',
    })
    expect(cuerpo.desde).toBe('2020-01-01')
    expect(cuerpo.hasta).toBe('2020-01-31')
    expect(cuerpo.grupos[0].materia).toEqual({ id: 3, nombre: 'Matemática' })
    expect(cuerpo.grupos[0].resumen).toEqual({ realizadas: 1, ausencias: 0, porcentaje: 100 })
    expect(cuerpo.grupos[0].bloques[0].textos).toEqual({
      trabajado: 'Ecuaciones',
      indicaciones: 'Practicar la guía',
    })
    expect(cuerpo.opciones.materias).toEqual([{ id: 3, nombre: 'Matemática' }])
  })

  it('`alumnoId` que no es un número: 400', async () => {
    await esperarError(await pedir('/alumnos/abc'), 400, 'VALIDACION')
  })

  it('una fecha inválida: 400', async () => {
    await esperarError(await pedir('/alumnos/12?desde=2020-02-30'), 400, 'VALIDACION')
  })

  it('`hasta` anterior a `desde`: 400 con `details` sobre `hasta`', async () => {
    const res = await pedir('/alumnos/12?desde=2020-01-31&hasta=2020-01-01')
    expect(res.status).toBe(400)
    expect((await res.json()).error.details).toEqual([
      { path: ['hasta'], message: 'La fecha hasta no puede ser anterior a la fecha desde' },
    ])
  })

  it('un alumno que no existe: 404', async () => {
    alumnosRepository.buscarPorId.mockResolvedValue(null)
    await esperarError(await pedir('/alumnos/99'), 404, 'NO_ENCONTRADO')
  })

  it('el profesor lo consulta si el alumno es suyo, y recibe 403 si no', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR', 'usr_ana'))
    expect((await pedir('/alumnos/12')).status).toBe(200)

    repository.profesorTieneAlumno.mockResolvedValue(false)
    await esperarError(await pedir('/alumnos/12'), 403, 'SIN_PERMISO')
  })

  it('el gerente y el alumno no lo consultan: 403', async () => {
    getSession.mockResolvedValue(sesion('GERENTE', 'usr_ger'))
    await esperarError(await pedir('/alumnos/12'), 403, 'SIN_PERMISO')

    getSession.mockResolvedValue(sesion('ALUMNO', 'usr_lucia', 12))
    await esperarError(await pedir('/alumnos/12'), 403, 'SIN_PERMISO')
  })

  it('sin sesión: 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    await esperarError(await pedir('/alumnos/12'), 401, 'NO_AUTENTICADO')
  })
})

// ---------------------------------------------------------------------------------------------
// GET /historiales/alumnos/{alumnoId}/pdf (HU-32, T-110)
// ---------------------------------------------------------------------------------------------

/** Los headers del contrato común de los documentos PDF (docs/contrato-api.md → Documentos PDF). */
function esperarHeadersDePdf(res: Response, archivo: string) {
  expect(res.headers.get('content-type')).toBe('application/pdf')
  expect(res.headers.get('content-disposition')).toBe(
    `inline; filename="${archivo}"; filename*=UTF-8''${archivo}`,
  )
  expect(res.headers.get('cache-control')).toBe('no-store')
  expect(res.headers.get('x-content-type-options')).toBe('nosniff')
}

describe('GET /historiales/alumnos/{alumnoId}/pdf', { timeout: 30_000 }, () => {
  it('responde 200 con el PDF, sus headers y el nombre del archivo', async () => {
    repository.leerOcurrenciasDelAlumno.mockResolvedValue([OCURRENCIA])

    const res = await pedir('/alumnos/12/pdf?mes=2020-01')

    expect(res.status).toBe(200)
    esperarHeadersDePdf(res, 'historial-academico-gonzalez-lucia-2020-01.pdf')
    const pdf = Buffer.from(await res.arrayBuffer())
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Historial académico 01/01/2020 al 31/01/2020')
  })

  it('no cae en `/alumnos/{alumnoId}`: sin `mes`, el documento es del mes en curso', async () => {
    const res = await pedir('/alumnos/12/pdf')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
  })

  it('un `mes` con formato inválido: 400, en JSON', async () => {
    const res = await pedir('/alumnos/12/pdf?mes=2020-13')

    expect(res.headers.get('content-type')).toContain('application/json')
    await esperarError(res, 400, 'VALIDACION')
    await esperarError(await pedir('/alumnos/12/pdf?mes=enero'), 400, 'VALIDACION')
  })

  it('un `materiaId` que no es un número: 400', async () => {
    await esperarError(await pedir('/alumnos/12/pdf?materiaId=abc'), 400, 'VALIDACION')
  })

  it('un alumno que no existe: 404', async () => {
    alumnosRepository.buscarPorId.mockResolvedValue(null)
    await esperarError(await pedir('/alumnos/99/pdf'), 404, 'NO_ENCONTRADO')
  })

  it('sólo mesa de entradas: el profesor, el gerente y el alumno reciben 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR', 'usr_ana'))
    await esperarError(await pedir('/alumnos/12/pdf'), 403, 'SIN_PERMISO')

    getSession.mockResolvedValue(sesion('GERENTE', 'usr_ger'))
    await esperarError(await pedir('/alumnos/12/pdf'), 403, 'SIN_PERMISO')

    getSession.mockResolvedValue(sesion('ALUMNO', 'usr_lucia', 12))
    await esperarError(await pedir('/alumnos/12/pdf'), 403, 'SIN_PERMISO')
  })

  it('sin sesión: 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    await esperarError(await pedir('/alumnos/12/pdf'), 401, 'NO_AUTENTICADO')
  })
})

// ---------------------------------------------------------------------------------------------
// Portal: GET /historiales/mis-materias y /mis-materias/{materiaId}/{profesorId}
// ---------------------------------------------------------------------------------------------

describe('GET /historiales/mis-materias', () => {
  it('responde 200 con las materias del alumno de la sesión, sin `busqueda`', async () => {
    getSession.mockResolvedValue(sesion('ALUMNO', 'usr_lucia', 12))
    repository.leerOcurrenciasDelAlumno.mockResolvedValue([OCURRENCIA])

    const res = await pedir('/mis-materias')
    const texto = await res.text()

    expect(res.status).toBe(200)
    expect(texto).not.toContain('busqueda')
    expect(JSON.parse(texto)[0]).toMatchObject({
      materia: { id: 3, nombre: 'Matemática' },
      profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
      porcentaje: 100,
    })
  })

  it('mesa de entradas no es el portal: 403', async () => {
    await esperarError(await pedir('/mis-materias'), 403, 'SIN_PERMISO')
  })

  it('una cuenta de alumno sin alumno vinculado: 403', async () => {
    getSession.mockResolvedValue(sesion('ALUMNO', 'usr_lucia'))
    await esperarError(await pedir('/mis-materias'), 403, 'SIN_PERMISO')
  })
})

describe('GET /historiales/mis-materias/{materiaId}/{profesorId}', () => {
  beforeEach(() => {
    getSession.mockResolvedValue(sesion('ALUMNO', 'usr_lucia', 12))
  })

  it('responde 200 con el mes pedido, sin la observación ni el motivo de la cancelación', async () => {
    repository.leerOcurrenciasDelAlumno.mockResolvedValue([OCURRENCIA])

    const res = await pedir('/mis-materias/3/4?mes=2020-01')
    const texto = await res.text()

    expect(res.status).toBe(200)
    expect(texto).not.toContain('busqueda')
    expect(texto).not.toContain('observacion')
    expect(texto).not.toContain('cancelacion')
    const cuerpo = JSON.parse(texto)
    expect(cuerpo.mes).toBe('2020-01')
    expect(cuerpo.resumen).toEqual({ realizadas: 1, ausencias: 0, porcentaje: 100 })
    expect(cuerpo.bloques[0].clases[0]).toEqual({
      turnoId: 31,
      fecha: '2020-01-06',
      horaInicio: '08:00',
      horaFin: '09:00',
      estado: 'REALIZADO',
      textosPropios: null,
    })
  })

  it('no cae en `/alumnos/{alumnoId}`: resuelve la ruta del portal, con sus dos params', async () => {
    repository.leerOcurrenciasDelAlumno.mockResolvedValue([OCURRENCIA])

    expect((await pedir('/mis-materias/3/4')).status).toBe(200)
    expect(repository.leerOcurrenciasDelAlumno).toHaveBeenCalledWith(
      expect.objectContaining({ materiaId: 3, profesorId: 4 }),
      undefined,
    )
    // El historial de la ficha no se consultó: el alumno nunca llega a ese endpoint.
    expect(alumnosRepository.buscarPorId).not.toHaveBeenCalled()
  })

  it('un `mes` con formato inválido: 400', async () => {
    await esperarError(await pedir('/mis-materias/3/4?mes=2020-13'), 400, 'VALIDACION')
    await esperarError(await pedir('/mis-materias/3/4?mes=enero'), 400, 'VALIDACION')
  })

  it('un `profesorId` que no es un número: 400', async () => {
    await esperarError(await pedir('/mis-materias/3/abc'), 400, 'VALIDACION')
  })

  it('una materia y profesor en los que no cursa: 404', async () => {
    repository.leerOcurrenciasDelAlumno.mockResolvedValue([])
    await esperarError(await pedir('/mis-materias/7/9'), 404, 'NO_ENCONTRADO')
  })

  it('mesa de entradas no es el portal: 403', async () => {
    getSession.mockResolvedValue(sesion())
    await esperarError(await pedir('/mis-materias/3/4'), 403, 'SIN_PERMISO')
  })
})

// ---------------------------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------------------------

describe('OpenAPI', () => {
  function documento() {
    return app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
  }

  it('declara todos los status codes de cada endpoint', () => {
    const doc = documento()

    expect(
      Object.keys(
        doc.paths?.['/api/v1/historiales/alumnos/{alumnoId}']?.get?.responses ?? {},
      ).sort(),
    ).toEqual(['200', '400', '401', '403', '404'])
    expect(
      Object.keys(
        doc.paths?.['/api/v1/historiales/alumnos/{alumnoId}/pdf']?.get?.responses ?? {},
      ).sort(),
    ).toEqual(['200', '400', '401', '403', '404'])
    expect(
      Object.keys(doc.paths?.['/api/v1/historiales/mis-materias']?.get?.responses ?? {}).sort(),
    ).toEqual(['200', '401', '403'])
    expect(
      Object.keys(
        doc.paths?.['/api/v1/historiales/mis-materias/{materiaId}/{profesorId}']?.get?.responses ??
          {},
      ).sort(),
    ).toEqual(['200', '400', '401', '403', '404'])
  })

  it('el 200 del PDF se declara como `application/pdf` binario', () => {
    const contenido =
      documento().paths?.['/api/v1/historiales/alumnos/{alumnoId}/pdf']?.get?.responses?.['200']
        ?.content
    expect(Object.keys(contenido ?? {})).toEqual(['application/pdf'])
    expect(contenido?.['application/pdf']?.schema).toMatchObject({
      type: 'string',
      format: 'binary',
    })
  })

  it('el historial declara sus filtros en el query, y el portal sólo `mes`', () => {
    const doc = documento()
    const enQuery = (path: string) =>
      (doc.paths?.[`/api/v1/historiales${path}`]?.get?.parameters ?? [])
        .flatMap((p) => ('in' in p && p.in === 'query' ? [p.name] : []))
        .sort()

    expect(enQuery('/alumnos/{alumnoId}')).toEqual(['desde', 'hasta', 'materiaId', 'profesorId'])
    expect(enQuery('/alumnos/{alumnoId}/pdf')).toEqual(['materiaId', 'mes', 'profesorId'])
    expect(enQuery('/mis-materias')).toEqual([])
    expect(enQuery('/mis-materias/{materiaId}/{profesorId}')).toEqual(['mes'])
  })
})
