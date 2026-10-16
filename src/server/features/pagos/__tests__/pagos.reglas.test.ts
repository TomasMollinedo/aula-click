import { describe, expect, it } from 'vitest'
import { AppError, ConflictError, ValidationError } from '@/server/errors'
import {
  accionesDelPago,
  agruparPorMateria,
  errorFormasDePago,
  calcularVuelto,
  formatearPesos,
  limiteDeCobro,
  planificarPago,
  repartoDelPago,
  sumarImportes,
  type OcurrenciaCobro,
  type PedidoPago,
  type SnapshotPago,
} from '../pagos.reglas'
import type { TurnoGuardado } from '../pagos.validation'

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

/** Por defecto, un monto recibido que alcanza para cualquier total (el tope de un importe). */
function pedido(
  ocurrencias: { turnoId: number; fecha: string }[],
  montoRecibido = 99_999_999.99,
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
  it('formato de Argentina con dos decimales siempre, sin depender del ICU', () => {
    expect(formatearPesos(30000)).toBe('$ 30.000,00')
    expect(formatearPesos(32000)).toBe('$ 32.000,00')
    expect(formatearPesos(30000.5)).toBe('$ 30.000,50')
    expect(formatearPesos(999)).toBe('$ 999,00')
    expect(formatearPesos(0.5)).toBe('$ 0,50')
    expect(formatearPesos(1234567.05)).toBe('$ 1.234.567,05')
  })

  it('espacio normal entre `$` y el número (viaja en JSON), no el duro de la UI', () => {
    expect(formatearPesos(7500)).toBe('$ 7.500,00')
    expect(formatearPesos(7500)).not.toContain(String.fromCharCode(0xa0))
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
      pedido(
        [
          { turnoId: 57, fecha: '2026-10-07' },
          { turnoId: 41, fecha: '2026-10-12' },
        ],
        20000,
      ),
      HOY,
    )

    expect(plan).toEqual({
      lineas: [
        { turnoId: 57, fecha: '2026-10-07', importe: 9500.25 },
        { turnoId: 41, fecha: '2026-10-12', importe: 8000 },
      ],
      total: 17500.25,
      vuelto: 2499.75,
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
    expect(error.message).toBe('El monto recibido ($ 30.000,00) es menor al total ($ 32.000,00)')
    expect(error.details).toEqual([
      {
        path: ['montoRecibido'],
        message: 'El monto recibido ($ 30.000,00) es menor al total ($ 32.000,00)',
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

describe('errorFormasDePago', () => {
  it('falta una forma activa: 500 que la nombra y pide correr el seed', () => {
    const error = errorFormasDePago('TRANSFERENCIA')
    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(500)
    expect(error.message).toBe('Falta la forma de pago TRANSFERENCIA activa: corré `pnpm db:seed`')
  })

  it('una forma sin código: el mismo 500, con su texto', () => {
    expect(errorFormasDePago().message).toBe(
      'Hay una forma de pago sin código: corré `pnpm db:seed`',
    )
  })
})

describe('agruparPorMateria', () => {
  const MATEMATICA = { id: 2, nombre: 'Matemática' }
  const INGLES = { id: 5, nombre: 'Inglés' }
  const turno = (fecha: string, materia: { id: number; nombre: string }, importe: number) => ({
    fecha,
    materia,
    importe,
  })

  it('una materia: un solo grupo con todos sus turnos y el subtotal igual al total', () => {
    const turnos = [turno('2026-09-21', MATEMATICA, 8000), turno('2026-09-28', MATEMATICA, 8000)]
    expect(agruparPorMateria(turnos)).toEqual([{ materia: MATEMATICA, turnos, subtotal: 16000 }])
  })

  it('Inglés y Matemática: un grupo por materia, por nombre, con el subtotal de cada una', () => {
    const turnos = [
      turno('2026-09-21', MATEMATICA, 8000),
      turno('2026-09-22', INGLES, 9000.5),
      turno('2026-09-28', MATEMATICA, 8000),
      turno('2026-09-29', INGLES, 9000.5),
    ]

    const grupos = agruparPorMateria(turnos)

    expect(grupos.map((g) => [g.materia.nombre, g.subtotal])).toEqual([
      ['Inglés', 18001],
      ['Matemática', 16000],
    ])
    // Dentro de cada materia, en el orden del comprobante (fecha y hora).
    expect(grupos[0]?.turnos.map((t) => t.fecha)).toEqual(['2026-09-22', '2026-09-29'])
    expect(grupos[1]?.turnos.map((t) => t.fecha)).toEqual(['2026-09-21', '2026-09-28'])
  })

  it('un importe null (materia sin precio, en una cuenta) no suma al subtotal', () => {
    const conNull = [
      { fecha: '2026-09-21', materia: MATEMATICA, importe: 8000 },
      { fecha: '2026-09-28', materia: MATEMATICA, importe: null },
    ]
    expect(agruparPorMateria(conNull)).toEqual([
      { materia: MATEMATICA, turnos: conNull, subtotal: 8000 },
    ])
  })

  it('sin turnos: sin grupos', () => {
    expect(agruparPorMateria([])).toEqual([])
  })
})

// T-98 (HU-36): las acciones del detalle de un pago. Tienen que coincidir con lo que aceptan
// `POST /anulaciones` y `PUT`/`DELETE /adjuntos/pagos/{pagoId}` (T-95): anulado o efectivo → 409;
// quitar en transferencia → 409.
describe('accionesDelPago', () => {
  const ninguna = { anular: false, reemplazarAdjunto: false, quitarAdjunto: false }

  // Mesa de entradas, pago vigente: [forma, tiene adjunto, turnos dictados, anular, reemplazar,
  // quitar]. Un turno ya dictado sólo apaga `anular` (T-179): el adjunto se sigue manejando igual.
  it.each([
    ['EFECTIVO', false, false, true, false, false],
    ['TRANSFERENCIA', true, false, true, true, false],
    ['TRANSFERENCIA', false, false, true, true, false],
    ['DEBITO', true, false, true, true, true],
    // En un débito sin adjunto, "reemplazar" es adjuntar uno; no hay nada que quitar.
    ['DEBITO', false, false, true, true, false],
    ['EFECTIVO', false, true, false, false, false],
    ['TRANSFERENCIA', true, true, false, true, false],
    ['TRANSFERENCIA', false, true, false, true, false],
    ['DEBITO', true, true, false, true, true],
    ['DEBITO', false, true, false, true, false],
  ] as const)(
    'mesa de entradas, vigente, %s con adjunto=%s y dictados=%s → anular %s, reemplazar %s, quitar %s',
    (formaPago, tieneAdjunto, tieneTurnosDictados, anular, reemplazarAdjunto, quitarAdjunto) => {
      expect(
        accionesDelPago({
          rol: 'MESA_ENTRADAS',
          estado: 'VIGENTE',
          formaPago,
          tieneAdjunto,
          tieneTurnosDictados,
        }),
      ).toEqual({ anular, reemplazarAdjunto, quitarAdjunto })
    },
  )

  const FORMAS = ['EFECTIVO', 'TRANSFERENCIA', 'DEBITO'] as const
  const combinaciones = FORMAS.flatMap((formaPago) =>
    [true, false].flatMap((tieneAdjunto) =>
      [true, false].map(
        (tieneTurnosDictados) => [formaPago, tieneAdjunto, tieneTurnosDictados] as const,
      ),
    ),
  )

  it.each(combinaciones)(
    'un pago anulado (%s, adjunto=%s, dictados=%s): todas en false, también para la mesa',
    (formaPago, tieneAdjunto, tieneTurnosDictados) => {
      expect(
        accionesDelPago({
          rol: 'MESA_ENTRADAS',
          estado: 'ANULADO',
          formaPago,
          tieneAdjunto,
          tieneTurnosDictados,
        }),
      ).toEqual(ninguna)
    },
  )

  it.each(['GERENTE', 'PROFESOR', 'ALUMNO'] as const)(
    '%s: todas en false en cualquier pago (sólo lectura)',
    (rol) => {
      for (const [formaPago, tieneAdjunto, tieneTurnosDictados] of combinaciones) {
        for (const estado of ['VIGENTE', 'ANULADO'] as const) {
          expect(
            accionesDelPago({ rol, estado, formaPago, tieneAdjunto, tieneTurnosDictados }),
          ).toEqual(ninguna)
        }
      }
    },
  )

  it('quitarAdjunto sólo con débito y adjunto', () => {
    const conQuitar = combinaciones.filter(
      ([formaPago, tieneAdjunto, tieneTurnosDictados]) =>
        accionesDelPago({
          rol: 'MESA_ENTRADAS',
          estado: 'VIGENTE',
          formaPago,
          tieneAdjunto,
          tieneTurnosDictados,
        }).quitarAdjunto,
    )
    expect(conQuitar).toEqual([
      ['DEBITO', true, true],
      ['DEBITO', true, false],
    ])
  })

  it('anular sólo sin turnos dictados', () => {
    const conAnular = combinaciones.filter(
      ([formaPago, tieneAdjunto, tieneTurnosDictados]) =>
        accionesDelPago({
          rol: 'MESA_ENTRADAS',
          estado: 'VIGENTE',
          formaPago,
          tieneAdjunto,
          tieneTurnosDictados,
        }).anular,
    )
    expect(conAnular.every(([, , tieneTurnosDictados]) => !tieneTurnosDictados)).toBe(true)
    expect(conAnular).toHaveLength(6)
  })
})

// T-122 (HU-43): el reparto del pago arma filas y totales con `repartoDeTurno` y `sumarReparto`.
describe('repartoDelPago', () => {
  const ANA = { id: 3, nombre: 'Ana', apellido: 'Gómez' }
  const JUAN = { id: 5, nombre: 'Juan', apellido: 'Ruiz' }

  function turno(parcial: Partial<TurnoGuardado> = {}): TurnoGuardado {
    return {
      turnoId: 41,
      fecha: '2026-10-12',
      horaInicio: '09:00',
      horaFin: '10:00',
      materia: { id: 2, nombre: 'Matemática' },
      profesor: ANA,
      importe: 8000,
      porcentaje: 15,
      ...parcial,
    }
  }

  it('dos turnos de profesores y porcentajes distintos: una fila por turno, en orden, y los totales', () => {
    expect(
      repartoDelPago([
        turno(),
        turno({ turnoId: 57, fecha: '2026-10-14', profesor: JUAN, importe: 9000, porcentaje: 18 }),
      ]),
    ).toEqual({
      turnos: [
        {
          turnoId: 41,
          fecha: '2026-10-12',
          profesor: ANA,
          importe: 8000,
          porcentaje: 15,
          parteCentro: 1200,
          parteProfesor: 6800,
        },
        {
          turnoId: 57,
          fecha: '2026-10-14',
          profesor: JUAN,
          importe: 9000,
          porcentaje: 18,
          parteCentro: 1620,
          parteProfesor: 7380,
        },
      ],
      totales: { importe: 17000, parteCentro: 2820, parteProfesor: 14180 },
    })
  })

  it('importes con centavos: los totales suman en centavos, sin error de coma flotante', () => {
    const { turnos, totales } = repartoDelPago([
      turno({ importe: 0.1, porcentaje: 15 }),
      turno({ turnoId: 57, importe: 0.2, porcentaje: 15 }),
      turno({ turnoId: 58, importe: 8000.55, porcentaje: 17.5 }),
    ])

    // $ 0,10 al 15 % → $ 0,02 (mitad hacia arriba); $ 8.000,55 al 17,5 % → $ 1.400,10.
    expect(turnos.map((t) => [t.parteCentro, t.parteProfesor])).toEqual([
      [0.02, 0.08],
      [0.03, 0.17],
      [1400.1, 6600.45],
    ])
    expect(totales).toEqual({ importe: 8000.85, parteCentro: 1400.15, parteProfesor: 6600.7 })
  })
})
