import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ORDEN_VIGENTE, porcentajeVigente } from '../reparto.condiciones'

// `porcentajeVigente` (T-120) con un cliente mockeado: sin base.

const findFirst = vi.fn()
const cliente = { porcentajeCentro: { findFirst } } as unknown as Parameters<
  typeof porcentajeVigente
>[0]

beforeEach(() => {
  findFirst.mockReset()
})

describe('porcentajeVigente', () => {
  it('devuelve el último como número', async () => {
    findFirst.mockResolvedValue({ porcentaje: { toNumber: () => 18.5 } })

    expect(await porcentajeVigente(cliente)).toBe(18.5)
  })

  it('pide el más reciente por createdAt y, de empate, por id', async () => {
    findFirst.mockResolvedValue({ porcentaje: { toNumber: () => 15 } })

    await porcentajeVigente(cliente)

    expect(ORDEN_VIGENTE).toEqual([{ createdAt: 'desc' }, { id: 'desc' }])
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ orderBy: ORDEN_VIGENTE }))
  })

  it('sin filas → error de configuración, nunca un valor por defecto', async () => {
    findFirst.mockResolvedValue(null)

    await expect(porcentajeVigente(cliente)).rejects.toThrow(
      'No hay un porcentaje del centro configurado (PorcentajeCentro vacío)',
    )
  })
})
