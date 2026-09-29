import { describe, expect, it } from 'vitest'
import { ConflictError, ValidationError } from '@/server/errors'
import {
  calcularVuelto,
  formatearPesos,
  limiteDeCobro,
  planificarPago,
  sumarImportes,
  type OcurrenciaCobro,
  type PedidoPago,
  type SnapshotPago,
} from '../pagos.reglas'

// Reglas puras del cobro (T-51). Hoy: lunes 05/10/2026; hoy + 56 = lunes 30/11/2026.

const HOY = '2026-10-05'

function ocurrencia(parcial: Partial<OcurrenciaCobro> = {}): OcurrenciaCobro {
  return {
    turnoId: 41,
    fecha: '2026-10-12',
    alumnoId: 12,
    materiaId: 2,
    estado: 'AGENDADO',
    pago: { estado: 'PENDIENTE' },
    ...parcial,
  }
}

function snapshot(
  ocurrencias: OcurrenciaCobro[],
  precios: [number, number | null][] = [[2, 8000]],
): SnapshotPago {
  return { ocurrencias, precios: new Map(precios) }
}

function pedido(
  ocurrencias: { turnoId: number; fecha: string }[],
  montoRecibido: number | null = null,
): PedidoPago {
  return { alumnoId: 12, ocurrencias, montoRecibido }
}

function errorDe(fn: () => unknown): ConflictError & ValidationError {
  try {
    fn()
  } catch (error) {
    return error as ConflictError & ValidationError
  }
  throw new Error('No lanzó')
}

describe('limiteDeCobro', () => {
  it('es hoy + 56 días', () => {
    expect(limiteDeCobro(HOY)).toBe('2026-11-30')
  })
})

describe('sumarImportes y calcularVuelto', () => {
  it('suma en centavos: 3 × 10.000,50 = 30.001,50 exacto', () => {
    expect(sumarImportes([10000.5, 10000.5, 10000.5])).toBe(30001.5)
    expect(sumarImportes([0.1, 0.2])).toBe(0.3)
  })

  it('vuelto en centavos; null sin monto recibido', () => {
    expect(calcularVuelto(35000, 32000)).toBe(3000)
    expect(calcularVuelto(0.3, 0.1)).toBe(0.2)
    expect(calcularVuelto(32000, 32000)).toBe(0)
    expect(calcularVuelto(null, 32000)).toBeNull()
  })
})

describe('formatearPesos', () => {
  it('formato de Argentina, sin depender del ICU', () => {
    expect(formatearPesos(30000)).toBe('$ 30.000')
    expect(formatearPesos(32000)).toBe('$ 32.000')
    expect(formatearPesos(30000.5)).toBe('$ 30.000,50')
    expect(formatearPesos(999)).toBe('$ 999')
    expect(formatearPesos(1234567.05)).toBe('$ 1.234.567,05')
  })
})

describe('planificarPago', () => {
  it('camino feliz: una línea por ocurrencia con el precio vigente, en el orden del pedido', () => {
    const plan = planificarPago(
      snapshot(
        [ocurrencia(), ocurrencia({ turnoId: 57, fecha: '2026-10-07', materiaId: 7 })],
        [
          [2, 8000],
          [7, 9500.25],
        ],
      ),
      pedido([
        { turnoId: 57, fecha: '2026-10-07' },
        { turnoId: 41, fecha: '2026-10-12' },
      ]),
      HOY,
    )

    expect(plan).toEqual({
      lineas: [
        { turnoId: 57, fecha: '2026-10-07', importe: 9500.25 },
        { turnoId: 41, fecha: '2026-10-12', importe: 8000 },
      ],
      total: 17500.25,
      vuelto: null,
    })
  })

  it('SIN_REGISTRAR (pasada) se cobra, y una pasada no tiene tope', () => {
    const plan = planificarPago(
      snapshot([ocurrencia({ fecha: '2025-01-06', estado: 'SIN_REGISTRAR' })]),
      pedido([{ turnoId: 41, fecha: '2025-01-06' }]),
      HOY,
    )
    expect(plan.total).toBe(8000)
  })

  it('una materia inactiva con precio se cobra (el estado de la materia no importa)', () => {
    // El snapshot no trae el estado de la materia: sólo su precio.
    expect(
      planificarPago(snapshot([ocurrencia()]), pedido([{ turnoId: 41, fecha: '2026-10-12' }]), HOY)
        .total,
    ).toBe(8000)
  })

  it.each([
    ['NO_EXISTE', [], 'El turno no existe en esa fecha'],
    ['CANCELADO', [ocurrencia({ estado: 'CANCELADO' })], 'El turno está cancelado'],
    [
      'YA_PAGADO',
      [ocurrencia({ pago: { estado: 'PAGADO', pagoId: 29 } })],
      'El turno ya está pagado',
    ],
    ['SIN_PRECIO', [ocurrencia({ materiaId: 9 })], 'La materia no tiene precio cargado'],
  ] as const)('motivo %s', (motivo, ocurrencias, mensaje) => {
    const error = errorDe(() =>
      planificarPago(
        snapshot(
          [...ocurrencias],
          [
            [2, 8000],
            [9, null],
          ],
        ),
        pedido([{ turnoId: 41, fecha: '2026-10-12' }]),
        HOY,
      ),
    )

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('TURNOS_NO_COBRABLES')
    expect(error.details).toEqual([
      {
        path: ['ocurrencias', 0],
        message: mensaje,
        turnoId: 41,
        fecha: '2026-10-12',
        motivo,
        ...(motivo === 'YA_PAGADO' ? { pagoId: 29 } : {}),
      },
    ])
  })

  it('FUERA_DE_RANGO: hoy + 57 no se cobra; el borde hoy + 56 sí', () => {
    const borde = ocurrencia({ fecha: '2026-11-30' })
    const fuera = ocurrencia({ fecha: '2026-12-01' })

    expect(
      planificarPago(snapshot([borde]), pedido([{ turnoId: 41, fecha: '2026-11-30' }]), HOY).total,
    ).toBe(8000)
    const error = errorDe(() =>
      planificarPago(snapshot([fuera]), pedido([{ turnoId: 41, fecha: '2026-12-01' }]), HOY),
    )
    expect(error.details).toEqual([
      expect.objectContaining({
        motivo: 'FUERA_DE_RANGO',
        message: 'Sólo se pueden cobrar turnos de las próximas 8 semanas',
      }),
    ])
  })

  it('un solo motivo por ocurrencia, en el orden de la tabla', () => {
    // Cancelada, pagada, fuera de rango y sin precio a la vez: gana CANCELADO.
    const todo = ocurrencia({
      fecha: '2026-12-07',
      materiaId: 9,
      estado: 'CANCELADO',
      pago: { estado: 'PAGADO', pagoId: 3 },
    })
    // Pagada, fuera de rango y sin precio: gana YA_PAGADO.
    const pagada = ocurrencia({
      turnoId: 42,
      fecha: '2026-12-07',
      materiaId: 9,
      pago: { estado: 'PAGADO', pagoId: 3 },
    })
    // Fuera de rango y sin precio: gana FUERA_DE_RANGO.
    const lejana = ocurrencia({ turnoId: 43, fecha: '2026-12-07', materiaId: 9 })

    const error = errorDe(() =>
      planificarPago(
        snapshot([todo, pagada, lejana], [[9, null]]),
        pedido([
          { turnoId: 41, fecha: '2026-12-07' },
          { turnoId: 42, fecha: '2026-12-07' },
          { turnoId: 43, fecha: '2026-12-07' },
        ]),
        HOY,
      ),
    )
    expect((error.details as { motivo: string }[]).map((d) => d.motivo)).toEqual([
      'CANCELADO',
      'YA_PAGADO',
      'FUERA_DE_RANGO',
    ])
  })

  it('informa todas las que fallan (no sólo la primera), con su posición en el body', () => {
    const error = errorDe(() =>
      planificarPago(
        snapshot([ocurrencia(), ocurrencia({ fecha: '2026-10-19', estado: 'CANCELADO' })]),
        pedido([
          { turnoId: 99, fecha: '2026-10-12' },
          { turnoId: 41, fecha: '2026-10-12' },
          { turnoId: 41, fecha: '2026-10-19' },
        ]),
        HOY,
      ),
    )
    expect((error.details as { path: unknown[] }[]).map((d) => d.path)).toEqual([
      ['ocurrencias', 0],
      ['ocurrencias', 2],
    ])
  })

  it('de otro alumno → 400 en ocurrencias, antes que los motivos del 409', () => {
    const error = errorDe(() =>
      planificarPago(
        snapshot([
          ocurrencia({ alumnoId: 13 }),
          ocurrencia({ fecha: '2026-10-19', estado: 'CANCELADO' }),
        ]),
        pedido([
          { turnoId: 41, fecha: '2026-10-19' },
          { turnoId: 41, fecha: '2026-10-12' },
        ]),
        HOY,
      ),
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([
      {
        path: ['ocurrencias', 1],
        message: 'El turno no es del alumno',
        turnoId: 41,
        fecha: '2026-10-12',
      },
    ])
  })

  it('montoRecibido menor al total → 400 en montoRecibido con el texto exacto', () => {
    const cuatro = [0, 1, 2, 3].map((i) =>
      ocurrencia({ fecha: ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'][i] }),
    )
    const error = errorDe(() =>
      planificarPago(
        snapshot(cuatro),
        pedido(
          cuatro.map((o) => ({ turnoId: o.turnoId, fecha: o.fecha })),
          30000,
        ),
        HOY,
      ),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.message).toBe('El monto recibido ($ 30.000) es menor al total ($ 32.000)')
    expect(error.details).toEqual([
      {
        path: ['montoRecibido'],
        message: 'El monto recibido ($ 30.000) es menor al total ($ 32.000)',
      },
    ])
  })

  it('montoRecibido igual al total → vuelto 0; mayor → la diferencia', () => {
    const s = snapshot([ocurrencia()])
    const p = [{ turnoId: 41, fecha: '2026-10-12' }]
    expect(planificarPago(s, pedido(p, 8000), HOY).vuelto).toBe(0)
    expect(planificarPago(s, pedido(p, 10000), HOY).vuelto).toBe(2000)
  })

  it('total mayor al máximo de Decimal(10,2) → 400 en ocurrencias', () => {
    const error = errorDe(() =>
      planificarPago(
        snapshot([ocurrencia(), ocurrencia({ fecha: '2026-10-19' })], [[2, 99_999_999.99]]),
        pedido([
          { turnoId: 41, fecha: '2026-10-12' },
          { turnoId: 41, fecha: '2026-10-19' },
        ]),
        HOY,
      ),
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['ocurrencias'], message: expect.any(String) }])
  })
})
