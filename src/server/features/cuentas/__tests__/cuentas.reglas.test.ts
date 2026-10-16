import { describe, expect, it } from 'vitest'
import {
  DIAS_DEUDA_VENCIDA,
  esAdeudado,
  esDeudaVencida,
  esProximo,
  importeVigente,
  opcionesDeLaCuenta,
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

  // T-76: con asistencia también adeuda (HU-22: el lugar del alumno estuvo reservado).
  it.each([
    ['SIN_REGISTRAR', 'PENDIENTE', '2026-09-28', true],
    ['REALIZADO', 'PENDIENTE', '2026-09-28', true],
    ['AUSENTE', 'PENDIENTE', '2026-09-28', true],
    ['CANCELADO', 'PENDIENTE', '2026-09-28', false],
    ['REALIZADO', 'PAGADO', '2026-09-28', false],
    ['REALIZADO', 'PENDIENTE', HOY, false],
  ] as const)('%s, pago %s, del %s → %s', (estado, pago, fecha, esperado) => {
    expect(esAdeudado(ocurrencia(fecha, estado, pago), HOY)).toBe(esperado)
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

  // T-76: la fecha separa las secciones; un turno de hoy con asistencia sigue siendo próximo.
  it.each([
    ['REALIZADO', 'PENDIENTE', HOY, true],
    ['AUSENTE', 'PENDIENTE', HOY, true],
    ['CANCELADO', 'PENDIENTE', HOY, false],
    ['AGENDADO', 'PENDIENTE', '2026-10-12', true],
    ['AGENDADO', 'PAGADO', '2026-10-12', false],
    ['AGENDADO', 'PENDIENTE', '2026-12-01', false], // después del tope (hoy + 57)
  ] as const)('%s, pago %s, del %s → %s', (estado, pago, fecha, esperado) => {
    expect(esProximo(ocurrencia(fecha, estado, pago), HOY)).toBe(esperado)
  })
})

describe('esDeudaVencida', () => {
  // Hoy - 30 = sábado 05/09; hoy - 29 = domingo 06/09; hoy - 40 = miércoles 26/08.
  it('es de 30 días', () => {
    expect(DIAS_DEUDA_VENCIDA).toBe(30)
  })

  it.each([
    ['SIN_REGISTRAR', 'PENDIENTE', '2026-09-05', true], // hoy - 30
    ['SIN_REGISTRAR', 'PENDIENTE', '2026-09-06', false], // hoy - 29
    ['REALIZADO', 'PENDIENTE', '2026-08-26', true],
    ['REALIZADO', 'PAGADO', '2026-08-26', false],
    ['CANCELADO', 'PENDIENTE', '2026-08-26', false],
  ] as const)('%s, pago %s, del %s → %s', (estado, pago, fecha, esperado) => {
    expect(esDeudaVencida(ocurrencia(fecha, estado, pago), HOY)).toBe(esperado)
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

describe('opcionesDeLaCuenta (decisión T-177)', () => {
  const item = (
    materia: { id: number; nombre: string },
    profesor: { id: number; nombre: string; apellido: string },
  ) => ({ ocurrencia: { materia, profesor } })

  it('sin repetir: materias por nombre y profesores por apellido y nombre, con el estado pasado', () => {
    const opciones = opcionesDeLaCuenta(
      [
        item({ id: 2, nombre: 'Matemática' }, { id: 3, nombre: 'Ana', apellido: 'Gómez' }),
        item({ id: 7, nombre: 'Física' }, { id: 5, nombre: 'Juan', apellido: 'Ruiz' }),
        item({ id: 2, nombre: 'Matemática' }, { id: 9, nombre: 'Bruno', apellido: 'Gómez' }),
        item({ id: 5, nombre: 'Álgebra' }, { id: 3, nombre: 'Ana', apellido: 'Gómez' }),
      ],
      new Map([[2, 'INACTIVO' as const]]),
    )

    expect(opciones).toEqual({
      materias: [
        { id: 5, nombre: 'Álgebra', estado: 'ACTIVO' },
        { id: 7, nombre: 'Física', estado: 'ACTIVO' },
        { id: 2, nombre: 'Matemática', estado: 'INACTIVO' },
      ],
      profesores: [
        { id: 3, nombre: 'Ana', apellido: 'Gómez' },
        { id: 9, nombre: 'Bruno', apellido: 'Gómez' },
        { id: 5, nombre: 'Juan', apellido: 'Ruiz' },
      ],
    })
  })

  it('sin ocurrencias: las dos listas vacías', () => {
    expect(opcionesDeLaCuenta([], new Map())).toEqual({ materias: [], profesores: [] })
  })
})
