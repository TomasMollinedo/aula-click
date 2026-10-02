import { describe, expect, it } from 'vitest'
import {
  esAdeudado,
  esProximo,
  importeVigente,
  paginarEnMemoria,
  rangosDelPeriodo,
  totalDe,
  type OcurrenciaCuenta,
} from '../cuentas.reglas'

// Reglas puras de la cuenta (T-53). Hoy: lunes 05/10/2026; hoy + 56 = lunes 30/11/2026.

const HOY = '2026-10-05'

function ocurrencia(
  fecha: string,
  estado: OcurrenciaCuenta['estado'],
  pago: 'PENDIENTE' | 'PAGADO' = 'PENDIENTE',
): OcurrenciaCuenta {
  return { fecha, estado, pago: { estado: pago } }
}

describe('esAdeudado', () => {
  it('pasada, sin registrar e impaga → adeuda; ayer es el borde', () => {
    expect(esAdeudado(ocurrencia('2026-09-01', 'SIN_REGISTRAR'), HOY)).toBe(true)
    expect(esAdeudado(ocurrencia('2026-10-04', 'SIN_REGISTRAR'), HOY)).toBe(true)
  })

  it('hoy no adeuda (es próxima)', () => {
    expect(esAdeudado(ocurrencia(HOY, 'AGENDADO'), HOY)).toBe(false)
    expect(esAdeudado(ocurrencia(HOY, 'SIN_REGISTRAR'), HOY)).toBe(false)
  })

  it('cancelada o pagada → no adeuda', () => {
    expect(esAdeudado(ocurrencia('2026-10-04', 'CANCELADO'), HOY)).toBe(false)
    expect(esAdeudado(ocurrencia('2026-10-04', 'SIN_REGISTRAR', 'PAGADO'), HOY)).toBe(false)
  })
})

describe('esProximo', () => {
  it('hoy y hoy + 56, agendadas e impagas → próximas', () => {
    expect(esProximo(ocurrencia(HOY, 'AGENDADO'), HOY)).toBe(true)
    expect(esProximo(ocurrencia('2026-11-30', 'AGENDADO'), HOY)).toBe(true)
  })

  it('hoy + 57 → ninguna; ayer → no es próxima', () => {
    expect(esProximo(ocurrencia('2026-12-01', 'AGENDADO'), HOY)).toBe(false)
    expect(esProximo(ocurrencia('2026-10-04', 'SIN_REGISTRAR'), HOY)).toBe(false)
  })

  it('cancelada o pagada → no es próxima', () => {
    expect(esProximo(ocurrencia('2026-10-12', 'CANCELADO'), HOY)).toBe(false)
    expect(esProximo(ocurrencia('2026-10-12', 'AGENDADO', 'PAGADO'), HOY)).toBe(false)
  })

  it('ninguna ocurrencia es adeudada y próxima a la vez', () => {
    for (const fecha of ['2026-10-04', HOY, '2026-11-30', '2026-12-01']) {
      for (const estado of ['SIN_REGISTRAR', 'AGENDADO', 'CANCELADO'] as const) {
        const o = ocurrencia(fecha, estado)
        expect(esAdeudado(o, HOY) && esProximo(o, HOY)).toBe(false)
      }
    }
  })
})

describe('importeVigente y totalDe', () => {
  it('precio de la materia; null si no tiene o no está', () => {
    const precios = new Map<number, number | null>([
      [2, 8000],
      [7, null],
    ])
    expect(importeVigente(precios, 2)).toBe(8000)
    expect(importeVigente(precios, 7)).toBeNull()
    expect(importeVigente(precios, 99)).toBeNull()
  })

  it('suma en centavos, sin los null', () => {
    expect(totalDe([{ importe: 10000.5 }, { importe: 10000.5 }, { importe: 10000.5 }])).toBe(
      30001.5,
    )
    expect(totalDe([{ importe: 0.1 }, { importe: 0.2 }, { importe: null }])).toBe(0.3)
    expect(totalDe([])).toBe(0)
  })
})

describe('rangosDelPeriodo', () => {
  const AYER = '2026-10-04'
  const TOPE = '2026-11-30'

  it('sin período: adeudados hasta ayer (sin desde) y próximos de hoy al tope', () => {
    const rangos = rangosDelPeriodo({}, HOY)

    expect(rangos).toEqual({
      adeudados: { hasta: AYER },
      proximos: { desde: HOY, hasta: TOPE },
    })
    expect(rangos.adeudados).not.toHaveProperty('desde')
  })

  it('sólo `desde` en el pasado: adeudados desde ahí hasta ayer; próximos como siempre', () => {
    expect(rangosDelPeriodo({ desde: '2026-09-01' }, HOY)).toEqual({
      adeudados: { desde: '2026-09-01', hasta: AYER },
      proximos: { desde: HOY, hasta: TOPE },
    })
  })

  it('sólo `hasta` en el pasado: adeudados hasta ahí (sin desde); próximos no aplican', () => {
    const rangos = rangosDelPeriodo({ hasta: '2026-09-15' }, HOY)

    expect(rangos).toEqual({ adeudados: { hasta: '2026-09-15' }, proximos: null })
    expect(rangos.adeudados).not.toHaveProperty('desde')
  })

  it('un período que cruza hoy se parte: adeudados hasta ayer y próximos desde hoy', () => {
    expect(rangosDelPeriodo({ desde: '2026-09-21', hasta: '2026-10-19' }, HOY)).toEqual({
      adeudados: { desde: '2026-09-21', hasta: AYER },
      proximos: { desde: HOY, hasta: '2026-10-19' },
    })
  })

  it('`desde` igual a hoy: los adeudados no aplican', () => {
    expect(rangosDelPeriodo({ desde: HOY, hasta: '2026-10-19' }, HOY)).toEqual({
      adeudados: null,
      proximos: { desde: HOY, hasta: '2026-10-19' },
    })
  })

  it('`desde` igual a ayer: los adeudados aplican, sólo ayer', () => {
    expect(rangosDelPeriodo({ desde: AYER }, HOY).adeudados).toEqual({ desde: AYER, hasta: AYER })
  })

  it('`hasta` igual a ayer: los próximos no aplican', () => {
    expect(rangosDelPeriodo({ desde: '2026-09-01', hasta: AYER }, HOY)).toEqual({
      adeudados: { desde: '2026-09-01', hasta: AYER },
      proximos: null,
    })
  })

  it('`hasta` igual a hoy: los próximos aplican, sólo hoy', () => {
    expect(rangosDelPeriodo({ desde: '2026-09-01', hasta: HOY }, HOY)).toEqual({
      adeudados: { desde: '2026-09-01', hasta: AYER },
      proximos: { desde: HOY, hasta: HOY },
    })
  })

  it('un período que pasa el tope: los próximos se recortan al tope', () => {
    expect(rangosDelPeriodo({ desde: '2026-10-12', hasta: '2027-03-31' }, HOY)).toEqual({
      adeudados: null,
      proximos: { desde: '2026-10-12', hasta: TOPE },
    })
  })

  it('un período que empieza después del tope: los próximos aplican con un rango vacío', () => {
    const { adeudados, proximos } = rangosDelPeriodo(
      { desde: '2026-12-01', hasta: '2026-12-31' },
      HOY,
    )

    expect(adeudados).toBeNull()
    expect(proximos).toEqual({ desde: '2026-12-01', hasta: TOPE })
    expect(proximos && proximos.hasta < proximos.desde).toBe(true)
  })
})

describe('paginarEnMemoria', () => {
  const items = [1, 2, 3, 4, 5]

  it('página 1 y 2 con su meta', () => {
    expect(paginarEnMemoria(items, { page: 1, pageSize: 2 })).toEqual({
      data: [1, 2],
      meta: { page: 1, pageSize: 2, total: 5, totalPages: 3 },
    })
    expect(paginarEnMemoria(items, { page: 3, pageSize: 2 }).data).toEqual([5])
  })

  it('fuera de rango → vacía con el meta correcto; sin items → totalPages 0', () => {
    expect(paginarEnMemoria(items, { page: 4, pageSize: 2 })).toEqual({
      data: [],
      meta: { page: 4, pageSize: 2, total: 5, totalPages: 3 },
    })
    expect(paginarEnMemoria([], { page: 1, pageSize: 20 }).meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    })
  })
})
