import { describe, expect, it, vi } from 'vitest'
import { leerPagoDeOcurrencia } from '../pagos.condiciones'

// `leerPagoDeOcurrencia`: lo que el detalle de una ocurrencia pagada muestra de su pago. Sin base:
// el cliente es un falso con el `findUnique` de `pago`.

type Cliente = Parameters<typeof leerPagoDeOcurrencia>[0]

function cliente(fila: unknown) {
  const findUnique = vi.fn(async () => fila)
  return { client: { pago: { findUnique } } as unknown as Cliente, findUnique }
}

describe('leerPagoDeOcurrencia', () => {
  it('arma los datos del pago: fecha `YYYY-MM-DD`, instante ISO, forma de pago y quién lo registró', async () => {
    const { client, findUnique } = cliente({
      numeroComprobante: 1024,
      fechaPago: new Date('2026-10-01T00:00:00.000Z'),
      createdAt: new Date('2026-10-01T14:30:00.000Z'),
      formaPago: { id: 1, nombre: 'Efectivo' },
      createdBy: { id: 'usr_mesa', nombre: 'Marta', apellido: 'Ruiz' },
    })

    await expect(leerPagoDeOcurrencia(client, 31)).resolves.toEqual({
      numeroComprobante: 1024,
      fechaPago: '2026-10-01',
      formaPago: { id: 1, nombre: 'Efectivo' },
      registradoPor: { id: 'usr_mesa', nombre: 'Marta', apellido: 'Ruiz' },
      registradoEl: '2026-10-01T14:30:00.000Z',
    })
    expect(findUnique).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ where: { id: 31 } }),
    )
  })

  it('no lee importes: el de la ocurrencia es su `importeAplicado`, que ya trae el motor', async () => {
    const { client, findUnique } = cliente(null)
    await leerPagoDeOcurrencia(client, 31)

    const select = (findUnique.mock.calls[0] as unknown as [{ select: object }])[0].select
    expect(Object.keys(select).sort()).toEqual([
      'createdAt',
      'createdBy',
      'fechaPago',
      'formaPago',
      'numeroComprobante',
    ])
  })

  it('el pago no existe → `null`', async () => {
    const { client } = cliente(null)
    await expect(leerPagoDeOcurrencia(client, 99)).resolves.toBeNull()
  })
})
