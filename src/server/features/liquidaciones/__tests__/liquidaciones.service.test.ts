import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { UltimoAdjunto } from '@/server/features/adjuntos/adjuntos.condiciones'
import type { Actor } from '@/server/shared/actor'
import type { EstadoLiquidacion, Liquidacion } from '../liquidaciones.condiciones'
import { crearLiquidacionesService } from '../liquidaciones.service'

// Service de liquidaciones (T-124) con el repository mockeado y el reloj fijo. El cálculo (devengo,
// ajustes, estados) es del motor y está testeado en T-121: acá las liquidaciones son datos.

const reloj = () => new Date('2026-10-15T15:00:00.000Z') // hoy: 2026-10-15 en Salta

const marta = { id: 'usr_gerente', nombre: 'Marta', apellido: 'Ríos' }
const GOMEZ = { id: 4, nombre: 'Ana', apellido: 'Gómez' }
const PAZ = { id: 7, nombre: 'Julián', apellido: 'Paz' } // inactivo: el motor lo trae igual
const RUIZ = { id: 9, nombre: 'Carla', apellido: 'Ruiz' }

function liquidacion({
  profesor = GOMEZ,
  mes = '2026-09',
  estado = 'PENDIENTE_DE_PAGO',
  importe = 8000,
  parteProfesor = 6800,
  totalAjustes = 0,
  cerrada = null,
}: {
  profesor?: typeof GOMEZ
  mes?: string
  estado?: EstadoLiquidacion
  importe?: number
  parteProfesor?: number
  totalAjustes?: number
  cerrada?: Liquidacion['cerrada']
} = {}): Liquidacion {
  return {
    profesor,
    mes,
    estado,
    turnos: [
      {
        pagoTurnoId: 1,
        turnoId: 2,
        fecha: `${mes}-08`,
        horaInicio: 900,
        horaFin: 960,
        alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
        materia: { id: 2, nombre: 'Matemática' },
        numeroComprobante: 123,
        importe,
        porcentaje: 15,
        fechaDevengo: `${mes}-08`,
        parteCentro: importe - parteProfesor,
        parteProfesor,
      },
    ],
    ajustes:
      totalAjustes === 0
        ? []
        : [
            {
              tipo: 'SALDO_ANTERIOR',
              texto: 'Saldo de la liquidación de agosto de 2026',
              importe: totalAjustes,
              mesOrigen: '2026-08',
            },
          ],
    totalCobrado: importe,
    parteCentro: importe - parteProfesor,
    parteProfesor,
    totalAjustes,
    total: parteProfesor + totalAjustes,
    cerrada,
  }
}

const cerradaPagada = {
  id: 31,
  fechaTransferencia: '2026-10-05',
  numeroOperacion: '0004829137',
  observaciones: 'Transferencia de octubre',
  descontadaEnMes: null,
  registradaPor: marta,
  registradaEl: '2026-10-05T14:03:00.000Z',
}

const adjunto: UltimoAdjunto = {
  id: 44,
  archivoKey: 'adjuntos/secreto.pdf',
  nombre: 'transferencia.pdf',
  tipo: 'application/pdf',
  bytes: 248312,
  adjuntadoPor: marta,
  adjuntadoEl: '2026-10-05T14:02:00.000Z',
}

const repository = {
  delMes: vi.fn(),
  deProfesor: vi.fn(),
  leerProfesor: vi.fn(),
  ultimoAdjunto: vi.fn(),
  pagar: vi.fn(),
}
const service = crearLiquidacionesService({ repository, reloj })

beforeEach(() => {
  vi.resetAllMocks()
  repository.delMes.mockResolvedValue([])
  repository.deProfesor.mockResolvedValue(null)
  repository.leerProfesor.mockResolvedValue(GOMEZ)
  repository.ultimoAdjunto.mockResolvedValue(adjunto)
  repository.pagar.mockResolvedValue({ liquidacionId: 31, total: 6800 })
})

async function errorDe(promesa: Promise<unknown>) {
  return promesa.then(
    () => expect.fail('debía lanzar'),
    (error: unknown) => error,
  )
}

const pagina = { page: 1, pageSize: 10 }

describe('listar', () => {
  it('sin mes, el mes anterior al de hoy', async () => {
    const resultado = await service.listar(pagina)

    expect(repository.delMes).toHaveBeenCalledWith({ mes: '2026-09', hoy: '2026-10-15' })
    expect(resultado.mes).toBe('2026-09')
  })

  it('sólo los profesores que devuelve el motor, un inactivo incluido, en su orden', async () => {
    repository.delMes.mockResolvedValue([
      liquidacion({ profesor: GOMEZ }),
      liquidacion({ profesor: PAZ }),
    ])

    const { data } = await service.listar({ ...pagina, mes: '2026-09' })

    expect(data.map((fila) => fila.profesor)).toEqual([GOMEZ, PAZ])
  })

  it('el mes en curso se puede pedir', async () => {
    repository.delMes.mockResolvedValue([liquidacion({ mes: '2026-10', estado: 'EN_CURSO' })])

    const resultado = await service.listar({ ...pagina, mes: '2026-10' })

    expect(resultado.mes).toBe('2026-10')
    expect(resultado.data[0]!.estado).toBe('EN_CURSO')
  })

  it('mes futuro → 400 en mes, sin leer', async () => {
    const error = await errorDe(service.listar({ ...pagina, mes: '2026-11' }))

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).details).toEqual([
      { path: ['mes'], message: 'El mes no puede ser futuro' },
    ])
    expect(repository.delMes).not.toHaveBeenCalled()
  })

  it('totales de todo el listado aunque la página traiga una fila', async () => {
    repository.delMes.mockResolvedValue([
      liquidacion({ profesor: GOMEZ, importe: 8000.1, parteProfesor: 6800.1 }),
      liquidacion({ profesor: PAZ, importe: 8000.2, parteProfesor: 6800.2 }),
      liquidacion({
        profesor: RUIZ,
        estado: 'SALDO_A_DESCONTAR',
        importe: 8000,
        parteProfesor: 6800,
        totalAjustes: -6800,
      }),
    ])

    const resultado = await service.listar({ page: 2, pageSize: 1, mes: '2026-09' })

    expect(resultado.data.map((fila) => fila.profesor.id)).toEqual([PAZ.id])
    expect(resultado.meta).toEqual({ page: 2, pageSize: 1, total: 3, totalPages: 3 })
    expect(resultado.totales).toEqual({
      cantidadTurnos: 3,
      totalCobrado: 24000.3,
      parteCentro: 3600,
      parteProfesor: 20400.3,
      totalAjustes: -6800,
      total: 13600.3,
    })
  })

  it('sin movimientos → data vacía y totales en 0', async () => {
    const resultado = await service.listar(pagina)

    expect(resultado).toEqual({
      mes: '2026-09',
      totales: {
        cantidadTurnos: 0,
        totalCobrado: 0,
        parteCentro: 0,
        parteProfesor: 0,
        totalAjustes: 0,
        total: 0,
      },
      data: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    })
  })

  it('fechaTransferencia sólo en PAGADA y descontadaEnMes sólo en DESCONTADA', async () => {
    repository.delMes.mockResolvedValue([
      liquidacion({ profesor: GOMEZ, estado: 'PAGADA', cerrada: cerradaPagada }),
      liquidacion({
        profesor: PAZ,
        estado: 'DESCONTADA',
        cerrada: {
          ...cerradaPagada,
          id: 32,
          fechaTransferencia: null,
          numeroOperacion: null,
          descontadaEnMes: '2026-10',
        },
      }),
      liquidacion({ profesor: RUIZ }),
    ])

    const { data } = await service.listar(pagina)

    expect(data.map((f) => [f.estado, f.fechaTransferencia, f.descontadaEnMes])).toEqual([
      ['PAGADA', '2026-10-05', null],
      ['DESCONTADA', null, '2026-10'],
      ['PENDIENTE_DE_PAGO', null, null],
    ])
    expect(data[2]).toEqual({
      profesor: RUIZ,
      estado: 'PENDIENTE_DE_PAGO',
      cantidadTurnos: 1,
      totalCobrado: 8000,
      parteCentro: 1200,
      parteProfesor: 6800,
      totalAjustes: 0,
      total: 6800,
      fechaTransferencia: null,
      descontadaEnMes: null,
    })
  })
})

describe('detalle', () => {
  const params = { profesorId: GOMEZ.id, mes: '2026-09' }

  it('abierta PENDIENTE_DE_PAGO → registrarPago y horas HH:mm, sin ids internos', async () => {
    repository.deProfesor.mockResolvedValue(liquidacion({ totalAjustes: -1000 }))

    const detalle = await service.detalle(params)

    expect(repository.deProfesor).toHaveBeenCalledWith({ ...params, hoy: '2026-10-15' })
    expect(repository.ultimoAdjunto).not.toHaveBeenCalled()
    expect(detalle).toEqual({
      profesor: GOMEZ,
      mes: '2026-09',
      estado: 'PENDIENTE_DE_PAGO',
      turnos: [
        {
          fecha: '2026-09-08',
          horaInicio: '15:00',
          horaFin: '16:00',
          alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
          materia: { id: 2, nombre: 'Matemática' },
          numeroComprobante: 123,
          importe: 8000,
          porcentaje: 15,
          parteProfesor: 6800,
        },
      ],
      ajustes: [
        {
          tipo: 'SALDO_ANTERIOR',
          texto: 'Saldo de la liquidación de agosto de 2026',
          importe: -1000,
        },
      ],
      cantidadTurnos: 1,
      totalCobrado: 8000,
      parteCentro: 1200,
      parteProfesor: 6800,
      totalAjustes: -1000,
      total: 5800,
      cerrada: null,
      acciones: { registrarPago: true },
    })
  })

  it.each<EstadoLiquidacion>(['EN_CURSO', 'SALDO_A_DESCONTAR'])(
    '%s → registrarPago false',
    async (estado) => {
      repository.deProfesor.mockResolvedValue(liquidacion({ estado }))

      expect((await service.detalle(params)).acciones).toEqual({ registrarPago: false })
    },
  )

  it('pagada: datos del cierre, adjunto sin archivoKey y quién la registró', async () => {
    repository.deProfesor.mockResolvedValue(
      liquidacion({ estado: 'PAGADA', cerrada: cerradaPagada }),
    )

    const detalle = await service.detalle(params)

    expect(repository.ultimoAdjunto).toHaveBeenCalledWith(31)
    expect(detalle.acciones).toEqual({ registrarPago: false })
    expect(detalle.cerrada).toEqual({
      liquidacionId: 31,
      fechaTransferencia: '2026-10-05',
      numeroOperacion: '0004829137',
      observaciones: 'Transferencia de octubre',
      descontadaEnMes: null,
      comprobanteAdjunto: {
        id: 44,
        nombre: 'transferencia.pdf',
        tipo: 'application/pdf',
        bytes: 248312,
        adjuntadoPor: marta,
        adjuntadoEl: '2026-10-05T14:02:00.000Z',
      },
      registradaPor: marta,
      registradaEl: '2026-10-05T14:03:00.000Z',
    })
    expect(detalle.cerrada?.comprobanteAdjunto).not.toHaveProperty('archivoKey')
  })

  it('pagada sin comprobante → comprobanteAdjunto null', async () => {
    repository.deProfesor.mockResolvedValue(
      liquidacion({ estado: 'PAGADA', cerrada: cerradaPagada }),
    )
    repository.ultimoAdjunto.mockResolvedValue(null)

    expect((await service.detalle(params)).cerrada?.comprobanteAdjunto).toBeNull()
  })

  it('profesor inexistente → 404', async () => {
    repository.leerProfesor.mockResolvedValue(null)

    const error = await errorDe(service.detalle(params))

    expect(error).toBeInstanceOf(NotFoundError)
    expect((error as NotFoundError).message).toBe('Profesor no encontrado')
  })

  it('profesor sin movimientos → 200 con la liquidación vacía', async () => {
    expect(await service.detalle(params)).toEqual({
      profesor: GOMEZ,
      mes: '2026-09',
      estado: null,
      turnos: [],
      ajustes: [],
      cantidadTurnos: 0,
      totalCobrado: 0,
      parteCentro: 0,
      parteProfesor: 0,
      totalAjustes: 0,
      total: 0,
      cerrada: null,
      acciones: { registrarPago: false },
    })
  })

  it('mes futuro → 400 en mes, sin leer', async () => {
    const error = await errorDe(service.detalle({ ...params, mes: '2026-11' }))

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).details).toEqual([
      { path: ['mes'], message: 'El mes no puede ser futuro' },
    ])
    expect(repository.leerProfesor).not.toHaveBeenCalled()
    expect(repository.deProfesor).not.toHaveBeenCalled()
  })
})

describe('pagar', () => {
  const gerente: Actor = { userId: 'usr_gerente', role: 'GERENTE' }
  const params = { profesorId: GOMEZ.id, mes: '2026-09' }
  const datos = {
    fechaTransferencia: '2026-10-05',
    numeroOperacion: '0004829137',
    comprobanteAdjuntoId: 44,
    observaciones: null,
    totalConfirmado: 6800,
  }

  async function error400(cambios: Partial<typeof datos>, p = params) {
    const error = await errorDe(service.pagar(p, { ...datos, ...cambios }, gerente))
    expect(error).toBeInstanceOf(ValidationError)
    expect(repository.pagar).not.toHaveBeenCalled()
    return (error as ValidationError).details
  }

  it('con todo válido llama a pagar con los datos y el hoy del reloj, y arma la 201', async () => {
    const resultado = await service.pagar(params, datos, gerente)

    expect(repository.pagar).toHaveBeenCalledWith(
      {
        profesor: GOMEZ,
        mes: '2026-09',
        hoy: '2026-10-15',
        fechaTransferencia: '2026-10-05',
        numeroOperacion: '0004829137',
        observaciones: null,
        comprobanteAdjuntoId: 44,
        totalConfirmado: 6800,
      },
      gerente,
    )
    expect(resultado).toEqual({
      liquidacionId: 31,
      profesor: GOMEZ,
      mes: '2026-09',
      total: 6800,
      fechaTransferencia: '2026-10-05',
    })
  })

  it('sin comprobante ni observaciones → null', async () => {
    const { comprobanteAdjuntoId: _, ...sinAdjunto } = datos
    void _

    await service.pagar(params, { ...sinAdjunto, observaciones: undefined }, gerente)

    expect(repository.pagar).toHaveBeenCalledWith(
      expect.objectContaining({ comprobanteAdjuntoId: null, observaciones: null }),
      gerente,
    )
  })

  it('el último día del mes y hoy son válidos', async () => {
    await service.pagar(params, { ...datos, fechaTransferencia: '2026-09-30' }, gerente)
    await service.pagar(params, { ...datos, fechaTransferencia: '2026-10-15' }, gerente)

    expect(repository.pagar).toHaveBeenCalledTimes(2)
  })

  it('fecha de transferencia futura → 400 en fechaTransferencia', async () => {
    expect(await error400({ fechaTransferencia: '2026-10-16' })).toEqual([
      {
        path: ['fechaTransferencia'],
        message: 'La fecha de la transferencia no puede ser futura',
      },
    ])
  })

  it('anterior al último día del mes → 400 en fechaTransferencia', async () => {
    expect(await error400({ fechaTransferencia: '2026-09-29' })).toEqual([
      {
        path: ['fechaTransferencia'],
        message: 'La transferencia no puede ser anterior al 30/09/2026',
      },
    ])
  })

  it('profesor inexistente → 404 antes que el resto', async () => {
    repository.leerProfesor.mockResolvedValue(null)

    const error = await errorDe(
      service.pagar(
        { ...params, mes: '2026-12' },
        { ...datos, fechaTransferencia: '2027-01-01' },
        gerente,
      ),
    )

    expect(error).toBeInstanceOf(NotFoundError)
    expect(repository.pagar).not.toHaveBeenCalled()
  })

  it.each([
    ['en curso', '2026-10', 'octubre'],
    ['futuro', '2026-11', 'noviembre'],
  ])('mes %s → 409 CONFLICTO, antes que la fecha', async (_caso, mes, nombre) => {
    const error = await errorDe(
      service.pagar({ ...params, mes }, { ...datos, fechaTransferencia: '2027-01-01' }, gerente),
    )

    expect(error).toBeInstanceOf(ConflictError)
    expect((error as ConflictError).code).toBe('CONFLICTO')
    expect((error as ConflictError).message).toBe(
      `La liquidación de ${nombre} de 2026 todavía no se puede pagar: el mes no terminó`,
    )
    expect(repository.pagar).not.toHaveBeenCalled()
  })

  it('los 409 de la transacción se propagan', async () => {
    repository.pagar.mockRejectedValue(new ConflictError('No hay importe a pagar'))

    await expect(service.pagar(params, datos, gerente)).rejects.toThrow('No hay importe a pagar')
  })
})
