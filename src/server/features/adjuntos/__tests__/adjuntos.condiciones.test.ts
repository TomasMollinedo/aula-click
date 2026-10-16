import { beforeEach, describe, expect, it } from 'vitest'
import { ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import {
  ultimoAdjunto,
  ultimoAdjuntoDeLiquidacion,
  vincularAdjunto,
  vincularAdjuntoALiquidacion,
  type ClienteAdjuntos,
} from '../adjuntos.condiciones'

// Condiciones del comprobante adjunto (T-95, T-123) contra una tabla en memoria que aplica el
// `where` que arman (`updateMany` y `findFirst`): se prueba la condición, no una copia de ella.
// Sin base.

const mesa: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
const otraMesa: Actor = { userId: 'usr_mesa_2', role: 'MESA_ENTRADAS' }
const gerente: Actor = { userId: 'usr_gerente', role: 'GERENTE' }

const MENSAJE_LIQUIDACION =
  'El comprobante de la transferencia no existe o ya se usó: volvé a subirlo'

type Fila = {
  id: number
  pagoId: number | null
  liquidacionId: number | null
  estado: 'ACTIVO' | 'INACTIVO'
  createdById: string
  updatedById: string
  createdAt: Date
}

const USUARIOS: Record<string, { id: string; nombre: string; apellido: string }> = {
  usr_mesa: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
  usr_mesa_2: { id: 'usr_mesa_2', nombre: 'Luis', apellido: 'Pérez' },
  usr_gerente: { id: 'usr_gerente', nombre: 'Marcelo', apellido: 'Ríos' },
}

let tabla: Fila[]

function cumple(fila: Fila, where: Partial<Fila>) {
  return Object.entries(where).every(([campo, valor]) => fila[campo as keyof Fila] === valor)
}

const cliente = {
  comprobanteAdjunto: {
    async updateMany({ where, data }: { where: Partial<Fila>; data: Partial<Fila> }) {
      const filas = tabla.filter((fila) => cumple(fila, where))
      filas.forEach((fila) => Object.assign(fila, data))
      return { count: filas.length }
    },
    async findFirst({ where }: { where: Partial<Fila> }) {
      const fila = tabla
        .filter((f) => cumple(f, where))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)[0]
      // Como Prisma: sin filas, `null` (no `undefined`).
      if (!fila) return null
      return (
        fila && {
          id: fila.id,
          archivoKey: `adjuntos/${fila.id}.pdf`,
          nombreArchivo: `adjunto-${fila.id}.pdf`,
          mimeType: 'application/pdf',
          bytes: 1000 + fila.id,
          createdAt: fila.createdAt,
          createdBy: USUARIOS[fila.createdById],
        }
      )
    },
  },
} as unknown as ClienteAdjuntos

function adjunto(parcial: Partial<Fila> & Pick<Fila, 'id'>): Fila {
  return {
    pagoId: null,
    liquidacionId: null,
    estado: 'ACTIVO',
    createdById: 'usr_mesa',
    updatedById: 'usr_mesa',
    createdAt: new Date('2026-10-14T13:00:00.000Z'),
    ...parcial,
  }
}

beforeEach(() => {
  tabla = [adjunto({ id: 1 })]
})

async function errorDe(promesa: Promise<unknown>) {
  return promesa.then(
    () => expect.fail('Se esperaba un error'),
    (error: unknown) => error as ValidationError,
  )
}

describe('vincularAdjunto', () => {
  it('vincula el adjunto al pago y deja quién lo modificó', async () => {
    await vincularAdjunto(cliente, { adjuntoId: 1, pagoId: 30, actor: mesa })

    expect(tabla[0]).toMatchObject({ pagoId: 30, updatedById: 'usr_mesa' })
  })

  it('vincularlo dos veces → 400 ADJUNTO_INVALIDO en comprobanteAdjuntoId, y queda en el primero', async () => {
    await vincularAdjunto(cliente, { adjuntoId: 1, pagoId: 30, actor: mesa })

    const error = await errorDe(vincularAdjunto(cliente, { adjuntoId: 1, pagoId: 31, actor: mesa }))

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.statusCode).toBe(400)
    expect(error.code).toBe('ADJUNTO_INVALIDO')
    expect(error.details).toEqual([expect.objectContaining({ path: ['comprobanteAdjuntoId'] })])
    expect(tabla[0]?.pagoId).toBe(30)
  })

  it.each([
    ['no existe', 99, mesa],
    ['lo subió otro usuario', 1, otraMesa],
  ])('si %s → 400 ADJUNTO_INVALIDO, sin vincular nada', async (_caso, adjuntoId, actor) => {
    const error = await errorDe(vincularAdjunto(cliente, { adjuntoId, pagoId: 30, actor }))

    expect(error.code).toBe('ADJUNTO_INVALIDO')
    expect(tabla[0]?.pagoId).toBeNull()
  })

  it('uno dado de baja (INACTIVO) no se puede vincular', async () => {
    tabla = [adjunto({ id: 1, estado: 'INACTIVO' })]

    const error = await errorDe(vincularAdjunto(cliente, { adjuntoId: 1, pagoId: 30, actor: mesa }))

    expect(error.code).toBe('ADJUNTO_INVALIDO')
  })
})

describe('ultimoAdjunto', () => {
  it('sin adjuntos del pago → null', async () => {
    expect(await ultimoAdjunto(cliente, 30)).toBeNull()
  })

  it('devuelve el más reciente de los activos, con quién lo adjuntó y cuándo (ISO)', async () => {
    tabla = [
      adjunto({ id: 1, pagoId: 30, createdAt: new Date('2026-10-10T10:00:00.000Z') }),
      adjunto({
        id: 2,
        pagoId: 30,
        createdById: 'usr_mesa_2',
        createdAt: new Date('2026-10-12T10:00:00.000Z'),
      }),
      adjunto({ id: 3, pagoId: 31, createdAt: new Date('2026-10-13T10:00:00.000Z') }),
    ]

    expect(await ultimoAdjunto(cliente, 30)).toEqual({
      id: 2,
      archivoKey: 'adjuntos/2.pdf',
      nombre: 'adjunto-2.pdf',
      tipo: 'application/pdf',
      bytes: 1002,
      adjuntadoPor: { id: 'usr_mesa_2', nombre: 'Luis', apellido: 'Pérez' },
      adjuntadoEl: '2026-10-12T10:00:00.000Z',
    })
  })

  it('ignora los dados de baja: si el último se quitó, no muestra uno anterior inactivo', async () => {
    tabla = [
      adjunto({ id: 1, pagoId: 30, estado: 'INACTIVO' }),
      adjunto({ id: 2, pagoId: 30, estado: 'INACTIVO' }),
    ]

    expect(await ultimoAdjunto(cliente, 30)).toBeNull()
  })

  it('con el mismo instante, desempata por id (el mayor)', async () => {
    tabla = [adjunto({ id: 4, pagoId: 30 }), adjunto({ id: 5, pagoId: 30 })]

    expect((await ultimoAdjunto(cliente, 30))?.id).toBe(5)
  })
})

describe('vincularAdjuntoALiquidacion', () => {
  beforeEach(() => {
    tabla = [adjunto({ id: 1, createdById: 'usr_gerente', updatedById: 'usr_gerente' })]
  })

  it('vincula el adjunto a la liquidación y deja quién lo modificó', async () => {
    await vincularAdjuntoALiquidacion(cliente, { adjuntoId: 1, liquidacionId: 7, actor: gerente })

    expect(tabla[0]).toMatchObject({ liquidacionId: 7, pagoId: null, updatedById: 'usr_gerente' })
  })

  it('vincularlo dos veces → 400 ADJUNTO_INVALIDO en comprobanteAdjuntoId, y queda en la primera', async () => {
    await vincularAdjuntoALiquidacion(cliente, { adjuntoId: 1, liquidacionId: 7, actor: gerente })

    const error = await errorDe(
      vincularAdjuntoALiquidacion(cliente, { adjuntoId: 1, liquidacionId: 8, actor: gerente }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.statusCode).toBe(400)
    expect(error.code).toBe('ADJUNTO_INVALIDO')
    expect(error.message).toBe(MENSAJE_LIQUIDACION)
    expect(error.details).toEqual([
      { path: ['comprobanteAdjuntoId'], message: MENSAJE_LIQUIDACION },
    ])
    expect(tabla[0]?.liquidacionId).toBe(7)
  })

  it.each([
    ['no existe', 99, gerente, {}],
    ['está dado de baja', 1, gerente, { estado: 'INACTIVO' as const }],
    ['lo subió otro usuario', 1, { userId: 'usr_gerente_2', role: 'GERENTE' } as Actor, {}],
  ])('si %s → 400 ADJUNTO_INVALIDO, sin vincular nada', async (_caso, adjuntoId, actor, fila) => {
    Object.assign(tabla[0]!, fila)

    const error = await errorDe(
      vincularAdjuntoALiquidacion(cliente, { adjuntoId, liquidacionId: 7, actor }),
    )

    expect(error.code).toBe('ADJUNTO_INVALIDO')
    expect(tabla[0]?.liquidacionId).toBeNull()
  })
})

describe('un adjunto es de un pago o de una liquidación', () => {
  it('uno ya vinculado a un pago no se vincula a una liquidación', async () => {
    tabla = [adjunto({ id: 1, pagoId: 30, createdById: 'usr_gerente' })]

    const error = await errorDe(
      vincularAdjuntoALiquidacion(cliente, { adjuntoId: 1, liquidacionId: 7, actor: gerente }),
    )

    expect(error.code).toBe('ADJUNTO_INVALIDO')
    expect(tabla[0]).toMatchObject({ pagoId: 30, liquidacionId: null })
  })

  it('uno vinculado a una liquidación no se vincula a un pago', async () => {
    tabla = [adjunto({ id: 1, liquidacionId: 7 })]

    const error = await errorDe(vincularAdjunto(cliente, { adjuntoId: 1, pagoId: 30, actor: mesa }))

    expect(error.code).toBe('ADJUNTO_INVALIDO')
    expect(tabla[0]).toMatchObject({ pagoId: null, liquidacionId: 7 })
  })

  it('uno subido por la mesa no lo vincula el gerente a una liquidación', async () => {
    const error = await errorDe(
      vincularAdjuntoALiquidacion(cliente, { adjuntoId: 1, liquidacionId: 7, actor: gerente }),
    )

    expect(error.code).toBe('ADJUNTO_INVALIDO')
    expect(tabla[0]?.liquidacionId).toBeNull()
  })

  it('uno subido por el gerente no lo vincula la mesa a un pago', async () => {
    tabla = [adjunto({ id: 1, createdById: 'usr_gerente' })]

    const error = await errorDe(vincularAdjunto(cliente, { adjuntoId: 1, pagoId: 30, actor: mesa }))

    expect(error.code).toBe('ADJUNTO_INVALIDO')
    expect(tabla[0]?.pagoId).toBeNull()
  })
})

describe('ultimoAdjuntoDeLiquidacion', () => {
  it('sin adjunto de la liquidación → null', async () => {
    expect(await ultimoAdjuntoDeLiquidacion(cliente, 7)).toBeNull()
  })

  it('devuelve el último activo por createdAt e id, y no uno de un pago', async () => {
    tabla = [
      adjunto({ id: 1, liquidacionId: 7, createdAt: new Date('2026-10-10T10:00:00.000Z') }),
      adjunto({ id: 2, liquidacionId: 7, createdAt: new Date('2026-10-12T10:00:00.000Z') }),
      adjunto({ id: 3, liquidacionId: 7, createdAt: new Date('2026-10-12T10:00:00.000Z') }),
      adjunto({ id: 4, liquidacionId: 7, estado: 'INACTIVO' }),
      adjunto({ id: 5, pagoId: 7, createdAt: new Date('2026-10-13T10:00:00.000Z') }),
    ]

    expect((await ultimoAdjuntoDeLiquidacion(cliente, 7))?.id).toBe(3)
  })

  it('no devuelve el adjunto de un pago con el mismo id', async () => {
    tabla = [adjunto({ id: 1, pagoId: 7 })]

    expect(await ultimoAdjuntoDeLiquidacion(cliente, 7)).toBeNull()
  })

  it('el gerente sube, lo vincula a la liquidación y se lee con quién lo adjuntó', async () => {
    tabla = [
      adjunto({
        id: 9,
        createdById: 'usr_gerente',
        updatedById: 'usr_gerente',
        createdAt: new Date('2026-11-03T15:00:00.000Z'),
      }),
    ]

    await vincularAdjuntoALiquidacion(cliente, { adjuntoId: 9, liquidacionId: 7, actor: gerente })

    expect(await ultimoAdjuntoDeLiquidacion(cliente, 7)).toEqual({
      id: 9,
      archivoKey: 'adjuntos/9.pdf',
      nombre: 'adjunto-9.pdf',
      tipo: 'application/pdf',
      bytes: 1009,
      adjuntadoPor: { id: 'usr_gerente', nombre: 'Marcelo', apellido: 'Ríos' },
      adjuntadoEl: '2026-11-03T15:00:00.000Z',
    })
  })
})
