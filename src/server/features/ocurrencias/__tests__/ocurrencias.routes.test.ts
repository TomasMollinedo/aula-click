import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { contarPaginas, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import { ocurrenciasRoutes } from '../ocurrencias.routes'

// Contrato HTTP de `ocurrencias` (T-43): validación de Zod, auth y OpenAPI. Sin base ni variables
// de entorno: el repository y Better Auth se reemplazan por mocks. Las reglas se prueban en
// `ocurrencias.reglas.test.ts` y `ocurrencias.service.test.ts`.

const { repository, profesoresRepository, alumnosRepository, getSession } = vi.hoisted(() => ({
  repository: {
    buscarOcurrencia: vi.fn(),
    buscarDatosAdicionales: vi.fn(),
    leerFilasDeLaHora: vi.fn(),
    buscarFinalizacion: vi.fn(),
    buscarPago: vi.fn(),
    leerOcurrenciasDelAlumno: vi.fn(),
    resolverUsuarioAuditoria: vi.fn(),
    leerPrioridades: vi.fn(),
  },
  profesoresRepository: { buscarIdPorUsuario: vi.fn() },
  alumnosRepository: { buscarPorId: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('@/server/features/alumnos/alumnos.repository', () => ({ alumnosRepository }))
vi.mock('../ocurrencias.repository', () => ({ ocurrenciasRepository: repository }))
vi.mock('@/server/features/profesores/profesores.repository', () => ({ profesoresRepository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/ocurrencias', ocurrenciasRoutes)

/** Una ocurrencia del motor, con los campos internos (`busqueda`) que no deben salir. */
const OCURRENCIA = {
  turnoId: 31,
  fecha: '2099-01-05',
  bloqueAgendaId: 10,
  diaSemana: 1,
  horaInicio: 540,
  horaFin: 600,
  profesorId: 4,
  aulaId: 3,
  alumnoId: 12,
  materiaId: 3,
  tipo: 'RECURRENTE',
  estado: 'AGENDADO',
  pago: { estado: 'PENDIENTE' },
  serie: { serieId: null, fechaInicio: '2099-01-05', fechaFin: null, finEfectivo: null },
  alumno: { id: 12, nombre: 'Lucía', apellido: 'González', busqueda: 'gonzalez lucia 40123456' },
  profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez', busqueda: 'perez ana 30111222' },
  materia: { id: 3, nombre: 'Matemática' },
  aula: { id: 3, nombre: 'Aula 3' },
}

const DATOS_ADICIONALES = {
  alumnoDni: '40123456',
  observaciones: null,
  temas: null,
  precioVigente: 8000,
  createdAt: '2026-08-01T13:00:00.000Z',
  updatedAt: '2026-08-01T13:00:00.000Z',
  createdBy: { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' },
  updatedBy: { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' },
}

function pedir(path: string) {
  return app.request(`/api/v1/ocurrencias${path}`)
}

function sesion(role = 'MESA_ENTRADAS', userId = 'usr_mesa') {
  return {
    headers: new Headers(),
    response: {
      user: { id: userId, role, estado: 'ACTIVO', name: 'Laura', apellido: 'Gómez' },
      session: { id: 's-1' },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.buscarDatosAdicionales.mockResolvedValue(DATOS_ADICIONALES)
  repository.leerFilasDeLaHora.mockResolvedValue([
    { turnoId: 31, fechaFin: null, finalizadaDesde: null },
  ])
  repository.buscarFinalizacion.mockResolvedValue(null)
  repository.leerPrioridades.mockResolvedValue(new Map())
  repository.leerOcurrenciasDelAlumno.mockResolvedValue([])
  alumnosRepository.buscarPorId.mockResolvedValue({
    id: 12,
    nombre: 'Lucía',
    apellido: 'González',
    dni: '40123456',
  })
})

/** Los headers del contrato común de los documentos PDF (docs/contrato-api.md → Documentos PDF). */
function esperarHeadersDePdf(res: Response, archivo: string) {
  expect(res.headers.get('content-type')).toBe('application/pdf')
  expect(res.headers.get('content-disposition')).toBe(
    `inline; filename="${archivo}"; filename*=UTF-8''${archivo}`,
  )
  expect(res.headers.get('cache-control')).toBe('no-store')
  expect(res.headers.get('x-content-type-options')).toBe('nosniff')
}

async function esperarErrorJson(res: Response, status: number, code: string) {
  expect(res.status).toBe(status)
  expect(res.headers.get('content-type')).toContain('application/json')
  expect((await res.json()).error.code).toBe(code)
}

// ---------------------------------------------------------------------------------------------
// GET /ocurrencias/{turnoId}/{fecha}
// ---------------------------------------------------------------------------------------------

describe('GET /ocurrencias/{turnoId}/{fecha}', () => {
  it('responde 200 con el detalle que arma el service, sin `busqueda`', async () => {
    repository.buscarOcurrencia.mockResolvedValue(OCURRENCIA)

    const res = await pedir('/31/2099-01-05')
    const texto = await res.text()

    expect(res.status).toBe(200)
    expect(texto).not.toContain('busqueda')
    const cuerpo = JSON.parse(texto)
    expect(cuerpo.turnoId).toBe(31)
    expect(cuerpo.alumno).toEqual({
      id: 12,
      nombre: 'Lucía',
      apellido: 'González',
      dni: '40123456',
    })
    expect(cuerpo.pago).toEqual({ estado: 'PENDIENTE', importeVigente: 8000 })
    // El reloj acá es el real y la fecha es de 2099: queda después del tope de cobro (hoy + 56),
    // así que no se ofrece registrar el pago. El resto de la matriz, en `ocurrencias.reglas.test.ts`.
    expect(cuerpo.acciones).toEqual({
      cancelar: { visible: true, habilitada: true },
      finalizar: { visible: true },
      reprogramar: { visible: true },
      registrarPago: { visible: false },
    })
  })

  it('una pasada y pendiente ofrece registrar el pago', async () => {
    repository.buscarOcurrencia.mockResolvedValue({
      ...OCURRENCIA,
      fecha: '2020-01-06',
      estado: 'SIN_REGISTRAR',
    })

    const cuerpo = await (await pedir('/31/2020-01-06')).json()
    expect(cuerpo.acciones.registrarPago).toEqual({ visible: true })
  })

  it('una pagada sale con los datos de su pago y `cancelar` deshabilitada con su motivo', async () => {
    repository.buscarOcurrencia.mockResolvedValue({
      ...OCURRENCIA,
      pago: { estado: 'PAGADO', pagoId: 31, importeAplicado: 7500 },
    })
    repository.buscarPago.mockResolvedValue({
      numeroComprobante: 1024,
      fechaPago: '2026-10-01',
      formaPago: { id: 1, nombre: 'Efectivo' },
      registradoPor: { id: 'usr_mesa', nombre: 'Marta', apellido: 'Ruiz' },
      registradoEl: '2026-10-01T14:30:00.000Z',
    })

    const res = await pedir('/31/2099-01-05')
    const cuerpo = await res.json()

    expect(res.status).toBe(200)
    expect(repository.buscarPago).toHaveBeenCalledExactlyOnceWith(31)
    expect(cuerpo.pago).toEqual({
      estado: 'PAGADO',
      pagoId: 31,
      numeroComprobante: 1024,
      importe: 7500,
      formaPago: { id: 1, nombre: 'Efectivo' },
      fechaPago: '2026-10-01',
      registradoPor: { id: 'usr_mesa', nombre: 'Marta', apellido: 'Ruiz' },
      registradoEl: '2026-10-01T14:30:00.000Z',
    })
    expect(cuerpo.acciones.cancelar).toEqual({
      visible: true,
      habilitada: false,
      motivo: 'El turno está pagado: no se puede cancelar',
    })
    expect(cuerpo.acciones.registrarPago).toEqual({ visible: false })
  })

  it('el turno no existe, o la fecha no es una de sus ocurrencias → 404', async () => {
    repository.buscarOcurrencia.mockResolvedValue(null)
    expect((await pedir('/31/2099-01-05')).status).toBe(404)
  })

  it.each([
    ['turnoId no numérico', '/abc/2099-01-05'],
    ['turnoId cero', '/0/2099-01-05'],
    ['fecha con formato inválido', '/31/05-01-2099'],
    ['fecha inexistente', '/31/2099-02-30'],
  ])('%s → 400 VALIDACION', async (_caso, path) => {
    const res = await pedir(path)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/31/2099-01-05')).status).toBe(401)
  })

  it('con un rol que no es mesa de entradas ni profesor → 403', async () => {
    getSession.mockResolvedValue(sesion('ALUMNO'))
    expect((await pedir('/31/2099-01-05')).status).toBe(403)
  })

  it('profesor ajeno al turno → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR', 'usr_otro'))
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(99)
    repository.buscarOcurrencia.mockResolvedValue(OCURRENCIA)

    expect((await pedir('/31/2099-01-05')).status).toBe(403)
  })

  it('profesor dueño del turno → 200, con `pago: null`', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR', 'usr_ana'))
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(4)
    repository.buscarOcurrencia.mockResolvedValue(OCURRENCIA)

    const res = await pedir('/31/2099-01-05')
    expect(res.status).toBe(200)
    expect((await res.json()).pago).toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------
// GET /ocurrencias?alumnoId&desde?&hasta?
// ---------------------------------------------------------------------------------------------

describe('GET /ocurrencias', () => {
  it('responde 200 con el arreglo que arma el service, sin envolver en { data } y sin `busqueda`', async () => {
    repository.leerOcurrenciasDelAlumno.mockResolvedValue([OCURRENCIA])

    const res = await pedir('?alumnoId=12')
    const texto = await res.text()

    expect(res.status).toBe(200)
    expect(texto).not.toContain('busqueda')
    expect(JSON.parse(texto)).toEqual([
      {
        turnoId: 31,
        fecha: '2099-01-05',
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '10:00',
        profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
        materia: { id: 3, nombre: 'Matemática' },
        tipo: 'RECURRENTE',
        estado: 'AGENDADO',
        estadoPago: 'PENDIENTE',
        prioridad: null,
        cancelable: true,
      },
    ])
  })

  it.each([
    ['sin alumnoId', ''],
    ['alumnoId inválido', '?alumnoId=abc'],
    ['hasta anterior a desde', '?alumnoId=12&desde=2026-09-22&hasta=2026-09-21'],
    ['rango fuera de la ventana', '?alumnoId=12&desde=2025-12-01&hasta=2025-12-31'],
  ])('%s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedir(query)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('?alumnoId=12')).status).toBe(401)
  })

  it('con un rol que no es mesa de entradas → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('?alumnoId=12')).status).toBe(403)
    expect(repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------------------------
// GET /ocurrencias/{turnoId}/{fecha}/pdf
// ---------------------------------------------------------------------------------------------

describe('GET /ocurrencias/{turnoId}/{fecha}/pdf', { timeout: 30_000 }, () => {
  it('200 con el PDF del turno y los headers del contrato común', async () => {
    repository.buscarOcurrencia.mockResolvedValue(OCURRENCIA)

    const res = await pedir('/31/2099-01-05/pdf')

    expect(res.status).toBe(200)
    esperarHeadersDePdf(res, 'turno-2099-01-05-gonzalez-lucia.pdf')
    const pdf = Buffer.from(await res.arrayBuffer())
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Detalle del turno')
    // El mismo detalle que el JSON: una sola lectura de la ocurrencia.
    expect(repository.buscarOcurrencia).toHaveBeenCalledExactlyOnceWith(31, '2099-01-05', undefined)
  })

  it('el turno no existe, o la fecha no es una de sus ocurrencias → 404 en JSON', async () => {
    repository.buscarOcurrencia.mockResolvedValue(null)
    await esperarErrorJson(await pedir('/31/2099-01-05/pdf'), 404, 'NO_ENCONTRADO')
  })

  it.each(['/abc/2099-01-05/pdf', '/0/2099-01-05/pdf', '/31/2099-02-30/pdf', '/31/05-01-2099/pdf'])(
    '%s → 400 VALIDACION en JSON',
    async (path) => {
      await esperarErrorJson(await pedir(path), 400, 'VALIDACION')
      expect(repository.buscarOcurrencia).not.toHaveBeenCalled()
    },
  )

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    await esperarErrorJson(await pedir('/31/2099-01-05/pdf'), 401, 'NO_AUTENTICADO')
  })

  it.each(['GERENTE', 'ALUMNO'])('con el rol %s → 403', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    await esperarErrorJson(await pedir('/31/2099-01-05/pdf'), 403, 'SIN_PERMISO')
    expect(repository.buscarOcurrencia).not.toHaveBeenCalled()
  })

  it('profesor ajeno al turno → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR', 'usr_otro'))
    repository.buscarOcurrencia.mockResolvedValue(OCURRENCIA)
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(99)

    await esperarErrorJson(await pedir('/31/2099-01-05/pdf'), 403, 'SIN_PERMISO')
  })

  it('profesor dueño del turno → 200 con el PDF', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR', 'usr_ana'))
    repository.buscarOcurrencia.mockResolvedValue(OCURRENCIA)
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(4)

    const res = await pedir('/31/2099-01-05/pdf')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
  })
})

// ---------------------------------------------------------------------------------------------
// GET /ocurrencias/pdf
// ---------------------------------------------------------------------------------------------

describe('GET /ocurrencias/pdf', { timeout: 30_000 }, () => {
  // El reloj acá es el real: el rango tiene que caer en el año en curso (la ventana del listado).
  const ANIO = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Salta',
    year: 'numeric',
  }).format(new Date())
  const RANGO = `desde=${ANIO}-03-01&hasta=${ANIO}-03-31`
  const EN_MARZO = { ...OCURRENCIA, fecha: `${ANIO}-03-09` }

  it('200 con el PDF de los turnos del alumno y los headers del contrato común', async () => {
    repository.leerOcurrenciasDelAlumno.mockResolvedValue([EN_MARZO])

    const res = await pedir(`/pdf?alumnoId=12&${RANGO}`)

    expect(res.status).toBe(200)
    esperarHeadersDePdf(res, `turnos-gonzalez-lucia-${ANIO}-03-01_${ANIO}-03-31.pdf`)
    const pdf = Buffer.from(await res.arrayBuffer())
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(metadato(pdf, 'Title')).toBe('Turnos del alumno')
    expect(repository.leerOcurrenciasDelAlumno).toHaveBeenCalledExactlyOnceWith(
      { desde: `${ANIO}-03-01`, hasta: `${ANIO}-03-31`, alumnoId: 12 },
      undefined,
    )
  })

  it('sin rango usa el año en curso, y con `estado` o `seleccion` responde 200', async () => {
    repository.leerOcurrenciasDelAlumno.mockResolvedValue([EN_MARZO])

    const sinRango = await pedir('/pdf?alumnoId=12')
    esperarHeadersDePdf(sinRango, `turnos-gonzalez-lucia-${ANIO}-01-01_${ANIO}-12-31.pdf`)
    expect((await pedir(`/pdf?alumnoId=12&${RANGO}&estado=CANCELADO`)).status).toBe(200)
    expect(
      (await pedir(`/pdf?alumnoId=12&${RANGO}&seleccion=31:${ANIO}-03-09,31:${ANIO}-03-16`)).status,
    ).toBe(200)
  })

  it('un alumno inexistente → 404 en JSON (el listado JSON no lo verifica; el PDF sí)', async () => {
    alumnosRepository.buscarPorId.mockResolvedValue(null)
    await esperarErrorJson(await pedir(`/pdf?alumnoId=99&${RANGO}`), 404, 'NO_ENCONTRADO')
    expect(repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })

  it.each([
    ['sin alumnoId', '', 'alumnoId'],
    ['alumnoId inválido', 'alumnoId=abc', 'alumnoId'],
    ['estado inválido', 'alumnoId=12&estado=PAGADO', 'estado'],
    ['seleccion con formato inválido', 'alumnoId=12&seleccion=31-2026-03-09', 'seleccion'],
    ['seleccion con una fecha inexistente', 'alumnoId=12&seleccion=31:2026-02-30', 'seleccion'],
    ['seleccion vacía', 'alumnoId=12&seleccion=', 'seleccion'],
    ['seleccion repetida', 'alumnoId=12&seleccion=31:2026-03-09,31:2026-03-09', 'seleccion'],
    [
      'seleccion excedida',
      `alumnoId=12&seleccion=${Array.from({ length: 401 }, (_, i) => `${i + 1}:2026-03-09`).join(',')}`,
      'seleccion',
    ],
    ['hasta anterior a desde', `alumnoId=12&desde=${ANIO}-09-22&hasta=${ANIO}-09-21`, 'hasta'],
    ['rango fuera de la ventana', 'alumnoId=12&desde=2020-12-01&hasta=2020-12-31', 'hasta'],
  ])('%s → 400 VALIDACION en `%s`', async (_caso, query, campo) => {
    const res = await pedir(`/pdf?${query}`)

    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error.code).toBe('VALIDACION')
    expect(error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: [campo] })]),
    )
    expect(repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })

  it('400 selecciones de 400 claves se aceptan', async () => {
    const seleccion = Array.from({ length: 400 }, (_, i) => `${i + 1}:${ANIO}-03-09`).join(',')
    expect((await pedir(`/pdf?alumnoId=12&${RANGO}&seleccion=${seleccion}`)).status).toBe(200)
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    await esperarErrorJson(await pedir('/pdf?alumnoId=12'), 401, 'NO_AUTENTICADO')
  })

  it.each(['PROFESOR', 'GERENTE', 'ALUMNO'])('con el rol %s → 403', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    await esperarErrorJson(await pedir('/pdf?alumnoId=12'), 403, 'SIN_PERMISO')
    expect(alumnosRepository.buscarPorId).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------------------------

describe('OpenAPI de ocurrencias', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })
  const codigos = (path: string) =>
    Object.keys(doc.paths[`/api/v1/ocurrencias${path}`]?.get?.responses ?? {}).sort()

  it('declara los endpoints con todos sus status codes', () => {
    expect(codigos('/{turnoId}/{fecha}')).toEqual(['200', '400', '401', '403', '404'])
    expect(codigos('')).toEqual(['200', '400', '401', '403'])
  })

  it('registra los componentes de `ocurrencias`', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'OcurrenciaDetalle',
        'OcurrenciaDelAlumnoItem',
        'Acciones',
        'AccionCancelar',
        'AccionSimple',
        'Serie',
        'Cancelacion',
        'Finalizacion',
        'PagoDeOcurrenciaPendiente',
        'PagoDeOcurrenciaPagado',
      ]),
    )
  })

  it('publica `pago` como la unión de pendiente y pagado, y el `motivo` de `cancelar`', () => {
    const schemas = doc.components?.schemas ?? {}
    const detalle = JSON.stringify(schemas.OcurrenciaDetalle)
    expect(detalle).toContain('"pago"')
    expect(detalle).toContain('PagoDeOcurrenciaPendiente')
    expect(detalle).toContain('PagoDeOcurrenciaPagado')
    expect(JSON.stringify(schemas.AccionCancelar)).toContain('"motivo"')
    expect(JSON.stringify(schemas.OcurrenciaDelAlumnoItem)).toContain('"estadoPago"')
  })

  it('conserva los ejemplos del OpenAPI', () => {
    const ejemplo = (path: string) =>
      (
        doc.paths[`/api/v1/ocurrencias${path}`]?.get?.responses?.['200'] as {
          content: Record<string, { example?: unknown }>
        }
      ).content['application/json']?.example
    expect(ejemplo('/{turnoId}/{fecha}')).toBeDefined()
    expect(ejemplo('')).toBeDefined()
  })
})
