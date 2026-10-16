import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from '@/server/errors'
import type { CajaRepository } from '../caja.repository'
import type { AnulacionLeida, CobroLeido, PagoProfesorLeido } from '../caja.reglas'
import { crearCajaService } from '../caja.service'

// Service de la caja (T-127) con el repository mockeado y reloj fijo: jueves 15/10/2026 al
// mediodía en Salta. Los bordes de cada cuenta se prueban en `caja.reglas`; acá, lo del service: la
// fecha por defecto y la futura, qué le pide al repository y que los filtros no tocan el resumen.

const reloj = () => new Date('2026-10-15T15:00:00Z')
const HOY = '2026-10-15'

const repository = {
  cobrosDelDia: vi.fn<CajaRepository['cobrosDelDia']>(),
  anulacionesDelDia: vi.fn<CajaRepository['anulacionesDelDia']>(),
  pagosAProfesoresDelDia: vi.fn<CajaRepository['pagosAProfesoresDelDia']>(),
}
const service = crearCajaService({ repository, reloj })

const EFECTIVO = { codigo: 'EFECTIVO', nombre: 'Efectivo' } as const
const TRANSFERENCIA = { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' } as const

const COBRO: CobroLeido = {
  pagoId: 31,
  numeroComprobante: 1024,
  registradoEl: '2026-10-15T13:00:00.000Z',
  alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
  formaPago: EFECTIVO,
  importe: 8000,
  turnos: [{ importe: 8000, porcentaje: 15 }],
  estado: 'ANULADO',
}
const ANULACION: AnulacionLeida = {
  ...COBRO,
  registradoEl: '2026-10-15T14:00:00.000Z',
  motivo: 'ERROR_CARGA',
  detalle: null,
}
const PAGO_PROFESOR: PagoProfesorLeido = {
  profesor: { id: 4, nombre: 'Ana', apellido: 'Gómez' },
  mes: '2026-09',
  numeroOperacion: '0048213',
  formaPago: TRANSFERENCIA,
  importe: 6800,
  registradoEl: '2026-10-15T15:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  repository.cobrosDelDia.mockResolvedValue([COBRO])
  repository.anulacionesDelDia.mockResolvedValue([ANULACION])
  repository.pagosAProfesoresDelDia.mockResolvedValue([PAGO_PROFESOR])
})

describe('obtener', () => {
  it('sin fecha, la caja de hoy', async () => {
    const caja = await service.obtener({})

    expect(caja.fecha).toBe(HOY)
    expect(repository.cobrosDelDia).toHaveBeenCalledExactlyOnceWith(HOY)
    expect(repository.anulacionesDelDia).toHaveBeenCalledExactlyOnceWith(HOY)
    expect(repository.pagosAProfesoresDelDia).toHaveBeenCalledExactlyOnceWith(HOY)
  })

  it('con una fecha pasada, esa fecha en las tres lecturas', async () => {
    const caja = await service.obtener({ fecha: '2026-10-10' })

    expect(caja.fecha).toBe('2026-10-10')
    expect(repository.cobrosDelDia).toHaveBeenCalledExactlyOnceWith('2026-10-10')
    expect(repository.anulacionesDelDia).toHaveBeenCalledExactlyOnceWith('2026-10-10')
    expect(repository.pagosAProfesoresDelDia).toHaveBeenCalledExactlyOnceWith('2026-10-10')
  })

  it('hoy mismo se puede pedir', async () => {
    await expect(service.obtener({ fecha: HOY })).resolves.toMatchObject({ fecha: HOY })
  })

  it('una fecha futura → 400 en `fecha`, sin leer nada', async () => {
    const error = await service.obtener({ fecha: '2026-10-16' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).statusCode).toBe(400)
    expect((error as ValidationError).details).toEqual([
      { path: ['fecha'], message: 'No se puede consultar la caja de una fecha futura' },
    ])
    expect(repository.cobrosDelDia).not.toHaveBeenCalled()
    expect(repository.anulacionesDelDia).not.toHaveBeenCalled()
    expect(repository.pagosAProfesoresDelDia).not.toHaveBeenCalled()
  })

  it('el cobro y su anulación del mismo día figuran los dos y el neto es 0', async () => {
    const { movimientos, resumen } = await service.obtener({})

    expect(movimientos.map((m) => m.tipo)).toEqual(['COBRO', 'ANULACION', 'PAGO_PROFESOR'])
    expect(resumen.ingresos.total).toBe(0)
    expect(resumen.egresos).toBe(6800)
    expect(resumen.saldo).toBe(-6800)
  })

  it('los filtros recortan los movimientos y no el resumen', async () => {
    const { movimientos, resumen } = await service.obtener({ tipo: 'PAGO_PROFESOR' })
    const completo = await service.obtener({})

    expect(movimientos.map((m) => m.tipo)).toEqual(['PAGO_PROFESOR'])
    expect(resumen).toStrictEqual(completo.resumen)
  })

  it('formaPago TRANSFERENCIA deja el pago al profesor', async () => {
    const { movimientos } = await service.obtener({ formaPago: 'TRANSFERENCIA' })

    expect(movimientos.map((m) => m.tipo)).toEqual(['PAGO_PROFESOR'])
  })

  it('un día sin movimientos → listas vacías y el resumen en 0', async () => {
    repository.cobrosDelDia.mockResolvedValue([])
    repository.anulacionesDelDia.mockResolvedValue([])
    repository.pagosAProfesoresDelDia.mockResolvedValue([])

    expect(await service.obtener({ fecha: '2026-10-14' })).toStrictEqual({
      fecha: '2026-10-14',
      movimientos: [],
      resumen: {
        ingresos: {
          porForma: { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0 },
          total: 0,
          parteCentro: 0,
          parteProfesores: 0,
        },
        egresos: 0,
        saldo: 0,
      },
    })
  })

  it('un error del repository (por ejemplo, un 500 de configuración) se propaga', async () => {
    repository.cobrosDelDia.mockRejectedValue(new Error('falta el seed'))

    await expect(service.obtener({})).rejects.toThrow('falta el seed')
  })
})

describe('paraDocumento', () => {
  it('es la caja completa del día: los mismos movimientos y el mismo resumen que sin filtros', async () => {
    expect(await service.paraDocumento({ fecha: HOY })).toStrictEqual(await service.obtener({}))
  })

  it('sin fecha, la de hoy; con una futura, 400', async () => {
    expect((await service.paraDocumento({})).fecha).toBe(HOY)
    await expect(service.paraDocumento({ fecha: '2026-10-16' })).rejects.toBeInstanceOf(
      ValidationError,
    )
  })
})
