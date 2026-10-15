import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import type { FilaPorcentaje } from '../reparto.repository'
import { crearRepartoService } from '../reparto.service'

// Service del porcentaje del centro (T-120) con el repository mockeado.

const gerente: Actor = { userId: 'usr_gerente', role: 'GERENTE' }
const marta = { id: 'usr_gerente', nombre: 'Marta', apellido: 'Ríos' }

const fila = (id: number, porcentaje: number, createdAt: string): FilaPorcentaje => ({
  id,
  porcentaje,
  createdAt: new Date(createdAt),
  createdBy: marta,
})

const quince = fila(2, 15, '2026-09-01T03:00:00.000Z')
const doce = fila(1, 12, '2026-08-01T03:00:00.000Z')

const repository = { leerVigente: vi.fn(), leerHistorial: vi.fn(), crear: vi.fn() }
const service = crearRepartoService({ repository })

beforeEach(() => {
  vi.resetAllMocks()
  repository.leerVigente.mockResolvedValue(quince)
  repository.leerHistorial.mockResolvedValue({ filas: [quince, doce], total: 2 })
})

async function errorDe(promesa: Promise<unknown>) {
  return promesa.then(
    () => expect.fail('debía lanzar'),
    (error: unknown) => error,
  )
}

describe('leer', () => {
  it('arma el vigente y el historial con su meta', async () => {
    const resultado = await service.leer({ page: 2, pageSize: 5 })

    expect(repository.leerHistorial).toHaveBeenCalledWith({ skip: 5, take: 5 })
    expect(resultado).toEqual({
      vigente: { porcentaje: 15, desde: '2026-09-01T03:00:00.000Z', cambiadoPor: marta },
      historial: {
        data: [
          { id: 2, porcentaje: 15, desde: '2026-09-01T03:00:00.000Z', cambiadoPor: marta },
          { id: 1, porcentaje: 12, desde: '2026-08-01T03:00:00.000Z', cambiadoPor: marta },
        ],
        meta: { page: 2, pageSize: 5, total: 2, totalPages: 1 },
      },
    })
  })

  it('sin ninguna fila → error de configuración', async () => {
    repository.leerVigente.mockResolvedValue(null)

    await expect(service.leer({ page: 1, pageSize: 10 })).rejects.toThrow(
      'No hay un porcentaje del centro configurado',
    )
  })
})

describe('cambiar', () => {
  it('de 15 a 18 crea la fila con el actor y devuelve el nuevo vigente', async () => {
    repository.crear.mockResolvedValue(fila(3, 18, '2026-10-15T20:10:00.000Z'))

    const vigente = await service.cambiar({ porcentaje: 18 }, gerente)

    expect(repository.crear).toHaveBeenCalledWith({ porcentaje: 18, createdById: 'usr_gerente' })
    expect(vigente).toEqual({
      porcentaje: 18,
      desde: '2026-10-15T20:10:00.000Z',
      cambiadoPor: marta,
    })
  })

  it.each([15, 15.0])('%d igual al vigente 15 → 400 y no crea fila', async (porcentaje) => {
    const error = await errorDe(service.cambiar({ porcentaje }, gerente))

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).details).toEqual([
      { path: ['porcentaje'], message: 'El porcentaje ya es 15 %' },
    ])
    expect(repository.crear).not.toHaveBeenCalled()
  })

  it('con un vigente de 12,5 el mensaje lleva los decimales', async () => {
    repository.leerVigente.mockResolvedValue(fila(4, 12.5, '2026-10-01T03:00:00.000Z'))

    const error = await errorDe(service.cambiar({ porcentaje: 12.5 }, gerente))

    expect((error as ValidationError).details).toEqual([
      { path: ['porcentaje'], message: 'El porcentaje ya es 12,5 %' },
    ])
  })

  it('sin ninguna fila → error de configuración y no crea', async () => {
    repository.leerVigente.mockResolvedValue(null)

    await expect(service.cambiar({ porcentaje: 18 }, gerente)).rejects.toThrow(
      'No hay un porcentaje del centro configurado',
    )
    expect(repository.crear).not.toHaveBeenCalled()
  })
})
