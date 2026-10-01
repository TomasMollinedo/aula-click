import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { ocurrenciasRoutes } from '../ocurrencias.routes'

// Contrato HTTP de `ocurrencias` (T-43): validación de Zod, auth y OpenAPI. Sin base ni variables
// de entorno: el repository y Better Auth se reemplazan por mocks. Las reglas se prueban en
// `ocurrencias.reglas.test.ts` y `ocurrencias.service.test.ts`.

const { repository, profesoresRepository, getSession } = vi.hoisted(() => ({
  repository: {
    buscarOcurrencia: vi.fn(),
    buscarDatosAdicionales: vi.fn(),
    buscarFinalizacion: vi.fn(),
    buscarPago: vi.fn(),
    leerOcurrenciasDelAlumno: vi.fn(),
    resolverUsuarioAuditoria: vi.fn(),
    leerPrioridades: vi.fn(),
  },
  profesoresRepository: { buscarIdPorUsuario: vi.fn() },
  getSession: vi.fn(),
}))
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
  serie: { fechaInicio: '2099-01-05', fechaFin: null, finEfectivo: null },
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
    response: { user: { id: userId, role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.buscarDatosAdicionales.mockResolvedValue(DATOS_ADICIONALES)
  repository.buscarFinalizacion.mockResolvedValue(null)
  repository.leerPrioridades.mockResolvedValue(new Map())
  repository.leerOcurrenciasDelAlumno.mockResolvedValue([])
})

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
    ['rango fuera de la ventana', '?alumnoId=12&desde=2026-01-01&hasta=2026-01-02'],
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
