import { beforeEach, describe, expect, it } from 'vitest'
import { AppError, ConflictError, ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { crearCancelacionesService } from '../cancelaciones.service'
import { cancelarTurnosSchema, type CancelarTurnos } from '../cancelaciones.validation'
import { crearCancelacionesEnMemoria, type OcurrenciaEnBase } from './cancelaciones-en-memoria'

// Service de cancelaciones (T-45) contra el repository en memoria (`cancelaciones-en-memoria.ts`),
// que ejecuta el `verificar` real bajo una cola como el lock del alumno. Reloj fijo: lunes
// 05/10/2026 al mediodía en Salta.

const reloj = () => new Date('2026-10-05T15:00:00Z')
const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

function ocurrencia(parcial: Partial<OcurrenciaEnBase> = {}): OcurrenciaEnBase {
  return {
    turnoId: 41,
    fecha: '2026-10-12',
    alumnoId: 12,
    estado: 'AGENDADO',
    pago: { estado: 'PENDIENTE' },
    ...parcial,
  }
}

let base: OcurrenciaEnBase[]
let memoria: ReturnType<typeof crearCancelacionesEnMemoria>
let service: ReturnType<typeof crearCancelacionesService>

beforeEach(() => {
  base = [
    ocurrencia(),
    ocurrencia({ fecha: '2026-10-19' }),
    ocurrencia({ turnoId: 57, fecha: '2026-10-07' }),
  ]
  memoria = crearCancelacionesEnMemoria(base)
  service = crearCancelacionesService({ repository: memoria.repository, reloj })
})

function pedido(parcial: Partial<CancelarTurnos> = {}): CancelarTurnos {
  return {
    ocurrencias: [{ turnoId: 41, fecha: '2026-10-12' }],
    motivo: 'CANCELACION_ALUMNO',
    ...parcial,
  }
}

async function errorDe(promesa: Promise<unknown>): Promise<AppError> {
  try {
    await promesa
  } catch (error) {
    return error as AppError
  }
  throw new Error('Debía fallar')
}

describe('cancelar', () => {
  it('una ocurrencia: cantidad 1 y sólo esa fecha queda cancelada (la serie sigue)', async () => {
    const res = await service.cancelar(pedido({ detalle: 'Viaja' }), actor)

    expect(res).toEqual({ cantidad: 1 })
    expect([...memoria.canceladas.keys()]).toEqual(['41|2026-10-12'])
    expect(memoria.canceladas.get('41|2026-10-12')).toEqual({
      motivo: 'CANCELACION_ALUMNO',
      detalle: 'Viaja',
    })
  })

  it('varias ocurrencias del mismo alumno (de dos turnos): las cancela todas', async () => {
    const res = await service.cancelar(
      pedido({
        ocurrencias: [
          { turnoId: 41, fecha: '2026-10-12' },
          { turnoId: 41, fecha: '2026-10-19' },
          { turnoId: 57, fecha: '2026-10-07' },
        ],
      }),
      actor,
    )

    expect(res).toEqual({ cantidad: 3 })
    expect(memoria.canceladas.size).toBe(3)
  })

  it('la de hoy se puede cancelar', async () => {
    base.push(ocurrencia({ turnoId: 60, fecha: '2026-10-05' }))

    expect(
      await service.cancelar(
        pedido({ ocurrencias: [{ turnoId: 60, fecha: '2026-10-05' }] }),
        actor,
      ),
    ).toEqual({ cantidad: 1 })
  })

  it('una pagada entre varias → 409 PAGADO y no cancela ninguna', async () => {
    base[1] = ocurrencia({ fecha: '2026-10-19', pago: { estado: 'PAGADO', pagoId: 29 } })

    const error = await errorDe(
      service.cancelar(
        pedido({
          ocurrencias: [
            { turnoId: 41, fecha: '2026-10-12' },
            { turnoId: 41, fecha: '2026-10-19' },
          ],
        }),
        actor,
      ),
    )

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('TURNOS_NO_CANCELABLES')
    expect(error.details).toEqual([
      {
        path: ['ocurrencias', 1],
        message: 'El turno está pagado: no se puede cancelar',
        turnoId: 41,
        fecha: '2026-10-19',
        motivo: 'PAGADO',
        pagoId: 29,
      },
    ])
    expect(memoria.canceladas.size).toBe(0)
    expect(memoria.repository.cancelar).not.toHaveBeenCalled()
  })

  it('una pasada → 409 PASADO', async () => {
    base.push(ocurrencia({ turnoId: 60, fecha: '2026-10-01', estado: 'SIN_REGISTRAR' }))

    const error = await errorDe(
      service.cancelar(pedido({ ocurrencias: [{ turnoId: 60, fecha: '2026-10-01' }] }), actor),
    )

    expect(error.code).toBe('TURNOS_NO_CANCELABLES')
    expect(error.details).toEqual([expect.objectContaining({ motivo: 'PASADO', turnoId: 60 })])
  })

  it('una ya cancelada → 409 YA_CANCELADO', async () => {
    base[0] = ocurrencia({ estado: 'CANCELADO' })

    const error = await errorDe(service.cancelar(pedido(), actor))

    expect(error.details).toEqual([expect.objectContaining({ motivo: 'YA_CANCELADO' })])
  })

  it('una que no existe → 409 NO_EXISTE, sin tomar el lock', async () => {
    const error = await errorDe(
      service.cancelar(pedido({ ocurrencias: [{ turnoId: 41, fecha: '2026-10-13' }] }), actor),
    )

    expect(error.code).toBe('TURNOS_NO_CANCELABLES')
    expect(error.details).toEqual([expect.objectContaining({ motivo: 'NO_EXISTE' })])
    expect(memoria.repository.cancelar).not.toHaveBeenCalled()
  })

  it('informa un detalle por cada ocurrencia que no se puede cancelar', async () => {
    base[0] = ocurrencia({ estado: 'CANCELADO' })
    base[1] = ocurrencia({ fecha: '2026-10-19', pago: { estado: 'PAGADO', pagoId: 29 } })

    const error = await errorDe(
      service.cancelar(
        pedido({
          ocurrencias: [
            { turnoId: 41, fecha: '2026-10-12' },
            { turnoId: 41, fecha: '2026-10-19' },
            { turnoId: 57, fecha: '2026-10-07' },
            { turnoId: 57, fecha: '2026-10-14' },
          ],
        }),
        actor,
      ),
    )

    expect(error.details).toEqual([
      expect.objectContaining({ path: ['ocurrencias', 0], motivo: 'YA_CANCELADO' }),
      expect.objectContaining({ path: ['ocurrencias', 1], motivo: 'PAGADO' }),
      expect.objectContaining({ path: ['ocurrencias', 3], motivo: 'NO_EXISTE' }),
    ])
  })

  it('ocurrencias de otro alumno → 400 con la posición de la ajena', async () => {
    base[2] = ocurrencia({ turnoId: 57, fecha: '2026-10-07', alumnoId: 99 })

    const error = await errorDe(
      service.cancelar(
        pedido({
          ocurrencias: [
            { turnoId: 41, fecha: '2026-10-12' },
            { turnoId: 57, fecha: '2026-10-07' },
          ],
        }),
        actor,
      ),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([expect.objectContaining({ path: ['ocurrencias', 1] })])
    expect(memoria.canceladas.size).toBe(0)
  })

  it('carrera con un pago simultáneo: el lock serializa y la cancelación ve el pago → 409', async () => {
    // El chequeo previo (sin lock) ve la ocurrencia pendiente; el pago entra antes que la cancelación.
    const cancelacion = service.cancelar(pedido(), actor) // el chequeo previo ya leyó PENDIENTE
    const pago = memoria.pagar(41, '2026-10-12')
    const error = await errorDe(cancelacion)
    await pago

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('TURNOS_NO_CANCELABLES')
    expect(error.details).toEqual([expect.objectContaining({ motivo: 'PAGADO' })])
    expect(memoria.canceladas.size).toBe(0)
  })

  it('dos cancelaciones simultáneas de la misma fecha: gana una y la otra → 409 YA_CANCELADO', async () => {
    const resultados = await Promise.allSettled([
      service.cancelar(pedido(), actor),
      service.cancelar(pedido(), actor),
    ])

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rechazo = resultados.find((r) => r.status === 'rejected')
    const error = (rechazo as PromiseRejectedResult).reason as AppError
    expect(error.code).toBe('TURNOS_NO_CANCELABLES')
    expect(error.details).toEqual([expect.objectContaining({ motivo: 'YA_CANCELADO' })])
    expect(memoria.canceladas.size).toBe(1)
  })
})

describe('validación del body (Zod)', () => {
  const valido = {
    ocurrencias: [{ turnoId: 41, fecha: '2026-10-12' }],
    motivo: 'OTRO',
    detalle: 'Feriado del instituto',
  }

  it('OTRO con detalle es válido', () => {
    expect(cancelarTurnosSchema.safeParse(valido).success).toBe(true)
  })

  it.each([
    ['sin detalle', undefined],
    ['con detalle vacío', ''],
    ['con detalle de espacios', '   '],
    ['con detalle null', null],
  ])('OTRO %s → 400 en detalle', (_, detalle) => {
    const res = cancelarTurnosSchema.safeParse({ ...valido, detalle })

    expect(res.success).toBe(false)
    expect(res.error?.issues).toEqual([
      expect.objectContaining({
        path: ['detalle'],
        message: expect.stringContaining('obligatorio'),
      }),
    ])
  })

  it('otro motivo sin detalle es válido; un detalle vacío queda en null', () => {
    const res = cancelarTurnosSchema.safeParse({
      ...valido,
      motivo: 'CANCELACION_PROFESOR',
      detalle: ' ',
    })

    expect(res.success).toBe(true)
    expect(res.data?.detalle).toBeNull()
  })

  it('detalle de más de 500 caracteres → 400', () => {
    expect(cancelarTurnosSchema.safeParse({ ...valido, detalle: 'x'.repeat(501) }).success).toBe(
      false,
    )
  })

  it('motivo fuera del enum o ausente → 400', () => {
    expect(cancelarTurnosSchema.safeParse({ ...valido, motivo: 'PORQUE_SI' }).success).toBe(false)
    expect(cancelarTurnosSchema.safeParse({ ...valido, motivo: undefined }).success).toBe(false)
  })
})
