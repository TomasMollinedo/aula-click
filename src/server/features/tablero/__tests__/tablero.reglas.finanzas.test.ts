import { describe, expect, it } from 'vitest'
import { repartoDeTurno } from '@/server/features/reparto/reparto.condiciones'
import {
  COLUMNAS_FINANZAS,
  ORDEN_FINANZAS_POR_DEFECTO,
  evolucionMensual,
  filasDeFinanzasPorProfesor,
  mesesDeEvolucion,
  ordenarFinanzas,
  repartoParaElTablero,
  resumenDeFinanzas,
  type CobroTablero,
  type FilaFinanzasProfesor,
  type LiquidacionPagada,
  type SaldoDeProfesor,
} from '../tablero.reglas'

// Reglas puras de la pestaña "Finanzas" del tablero (HU-47, T-128). El reparto de cada cobro, el
// devengo y los saldos los decide el motor de liquidaciones: acá se parte de ellos.

const PROFESORES: Record<number, { nombre: string; apellido: string }> = {
  1: { nombre: 'Ana', apellido: 'Gómez' },
  2: { nombre: 'Luis', apellido: 'Pérez' },
  3: { nombre: 'Marta', apellido: 'Álvarez' },
  4: { nombre: 'Juan', apellido: 'Pérez' },
}

const profesor = (id: number) => ({ id, ...(PROFESORES[id] ?? { nombre: 'X', apellido: 'X' }) })

function cobro(
  importe: number,
  {
    profesorId = 1,
    porcentaje = 15,
    fechaPago = '2026-10-05',
    cerradaSinRegistrar = false,
  }: {
    profesorId?: number
    porcentaje?: number
    fechaPago?: string
    cerradaSinRegistrar?: boolean
  } = {},
): CobroTablero {
  return {
    fechaPago,
    cerradaSinRegistrar,
    profesor: profesor(profesorId),
    reparto: repartoDeTurno(importe, porcentaje),
  }
}

const pagada = (
  total: number,
  { profesorId = 1, fechaTransferencia = '2026-10-05' } = {},
): LiquidacionPagada => ({ profesor: profesor(profesorId), fechaTransferencia, total })

const saldo = (profesorId: number, importe: number): SaldoDeProfesor => ({
  profesor: profesor(profesorId),
  saldo: importe,
})

describe('repartoParaElTablero', () => {
  it('un cobro normal: el reparto del cobro tal cual', () => {
    expect(repartoParaElTablero(cobro(8000))).toEqual({
      importe: 8000,
      parteCentro: 1200,
      parteProfesor: 6800,
    })
  })

  it('un cerrado sin registrar: el importe completo al centro', () => {
    expect(repartoParaElTablero(cobro(8000, { cerradaSinRegistrar: true }))).toEqual({
      importe: 8000,
      parteCentro: 8000,
      parteProfesor: 0,
    })
  })
})

describe('resumenDeFinanzas', () => {
  it('cada número del resumen', () => {
    const resumen = resumenDeFinanzas({
      totalCobrado: 24000,
      cobros: [cobro(8000), cobro(8000, { profesorId: 2 }), cobro(8000, { profesorId: 2 })],
      pagadas: [pagada(40800), pagada(13600.5, { profesorId: 2 })],
      saldos: [saldo(1, 27200), saldo(2, 6800)],
    })

    expect(resumen).toEqual({
      totalCobrado: 24000,
      margenCentro: { importe: 3600, porcentaje: 15 },
      incluyeSinRegistrar: 0,
      pagadoAProfesores: 54400.5,
      saldoAPagarAProfesores: 34000,
    })
  })

  it('`totalCobrado` es el que llega (el de "General"), no la suma de los cobros', () => {
    expect(
      resumenDeFinanzas({ totalCobrado: 99, cobros: [cobro(8000)], pagadas: [], saldos: [] })
        .totalCobrado,
    ).toBe(99)
  })

  it('margen con un cerrado sin registrar: entra entero, sin sumar dos veces su parte del centro', () => {
    const resumen = resumenDeFinanzas({
      totalCobrado: 12000,
      cobros: [cobro(8000), cobro(4000, { cerradaSinRegistrar: true })],
      pagadas: [],
      saldos: [],
    })

    // 1.200 del normal + 4.000 del cerrado (no 4.000 + los 600 de su reparto).
    expect(resumen.margenCentro).toEqual({ importe: 5200, porcentaje: 43.3 })
    expect(resumen.incluyeSinRegistrar).toBe(4000)
  })

  it('`incluyeSinRegistrar` suma el importe de todos los cerrados; 0 si no hay', () => {
    const cerrados = [
      cobro(8000, { cerradaSinRegistrar: true }),
      cobro(5600, { cerradaSinRegistrar: true, profesorId: 2 }),
    ]
    const sin = { totalCobrado: 0, pagadas: [], saldos: [] }

    expect(resumenDeFinanzas({ ...sin, cobros: cerrados }).incluyeSinRegistrar).toBe(13600)
    expect(resumenDeFinanzas({ ...sin, cobros: [cobro(8000)] }).incluyeSinRegistrar).toBe(0)
  })

  it('porcentaje con total cobrado 0 → 0, sin dividir por cero', () => {
    const resumen = resumenDeFinanzas({ totalCobrado: 0, cobros: [], pagadas: [], saldos: [] })

    expect(resumen).toEqual({
      totalCobrado: 0,
      margenCentro: { importe: 0, porcentaje: 0 },
      incluyeSinRegistrar: 0,
      pagadoAProfesores: 0,
      saldoAPagarAProfesores: 0,
    })
  })

  it('el saldo suma sólo los positivos: un profesor negativo no resta', () => {
    const resumen = resumenDeFinanzas({
      totalCobrado: 0,
      cobros: [],
      pagadas: [],
      saldos: [saldo(1, 27200), saldo(2, -6800), saldo(3, 0.1), saldo(4, 0.2)],
    })

    expect(resumen.saldoAPagarAProfesores).toBe(27200.3)
  })

  it('reparto con dos porcentajes: cada cobro con el suyo, sumado en centavos', () => {
    const resumen = resumenDeFinanzas({
      totalCobrado: 12000,
      cobros: [cobro(8000, { porcentaje: 15 }), cobro(4000, { porcentaje: 20 })],
      pagadas: [],
      saldos: [],
    })

    // 1.200 + 800.
    expect(resumen.margenCentro).toEqual({ importe: 2000, porcentaje: 16.7 })
  })
})

describe('filasDeFinanzasPorProfesor', () => {
  it('una fila por profesor con sus cobros, su pagado y su saldo; las partes suman lo cobrado', () => {
    const filas = filasDeFinanzasPorProfesor({
      cobros: [
        cobro(8000),
        cobro(8000, { porcentaje: 18.5 }),
        cobro(4000, { profesorId: 2, cerradaSinRegistrar: true }),
      ],
      pagadas: [pagada(13600), pagada(6800)],
      saldos: [saldo(1, 6800), saldo(2, 0)],
    })

    expect(filas).toEqual([
      {
        profesor: profesor(1),
        turnosCobrados: 2,
        totalCobrado: 16000,
        parteCentro: 2680,
        parteProfesor: 13320,
        pagado: 20400,
        saldoPendiente: 6800,
      },
      {
        profesor: profesor(2),
        turnosCobrados: 1,
        totalCobrado: 4000,
        parteCentro: 4000,
        parteProfesor: 0,
        pagado: 0,
        saldoPendiente: 0,
      },
    ])
  })

  it('el saldo negativo se ve tal cual en la tabla, y el resumen es la suma de los positivos', () => {
    const datos = {
      cobros: [cobro(8000), cobro(8000, { profesorId: 2 })],
      pagadas: [],
      saldos: [saldo(1, 27200), saldo(2, -6800), saldo(3, 20400)],
    }
    const filas = filasDeFinanzasPorProfesor(datos)
    const resumen = resumenDeFinanzas({ ...datos, totalCobrado: 16000 })

    expect(filas.find((f) => f.profesor.id === 2)?.saldoPendiente).toBe(-6800)
    const positivos = filas.map((f) => f.saldoPendiente).filter((s) => s > 0)
    expect(resumen.saldoAPagarAProfesores).toBe(positivos.reduce((a, b) => a + b, 0))
  })

  it('Σ parte del centro de la tabla = margen del resumen, y las dos partes suman lo cobrado', () => {
    const datos = {
      cobros: [
        cobro(8000),
        cobro(7333.33, { profesorId: 2, porcentaje: 18.5 }),
        cobro(5000, { profesorId: 3, cerradaSinRegistrar: true }),
      ],
      pagadas: [],
      saldos: [],
    }
    const filas = filasDeFinanzasPorProfesor(datos)
    const resumen = resumenDeFinanzas({ ...datos, totalCobrado: 20333.33 })
    const centavos = (n: number) => Math.round(n * 100)

    expect(filas.reduce((s, f) => s + centavos(f.parteCentro), 0)).toBe(
      centavos(resumen.margenCentro.importe),
    )
    for (const fila of filas) {
      expect(centavos(fila.parteCentro) + centavos(fila.parteProfesor)).toBe(
        centavos(fila.totalCobrado),
      )
    }
  })

  it('un profesor sólo con pagado, o sólo con saldo, aparece con el resto en 0', () => {
    const filas = filasDeFinanzasPorProfesor({
      cobros: [],
      pagadas: [pagada(13600, { profesorId: 3 })],
      saldos: [saldo(4, -1200)],
    })

    expect(filas).toEqual([
      {
        profesor: profesor(3),
        turnosCobrados: 0,
        totalCobrado: 0,
        parteCentro: 0,
        parteProfesor: 0,
        pagado: 13600,
        saldoPendiente: 0,
      },
      {
        profesor: profesor(4),
        turnosCobrados: 0,
        totalCobrado: 0,
        parteCentro: 0,
        parteProfesor: 0,
        pagado: 0,
        saldoPendiente: -1200,
      },
    ])
  })

  it('un profesor con todo en 0 no tiene fila', () => {
    expect(filasDeFinanzasPorProfesor({ cobros: [], pagadas: [], saldos: [saldo(1, 0)] })).toEqual(
      [],
    )
  })
})

describe('ordenarFinanzas', () => {
  const fila = (id: number, cifras: Partial<FilaFinanzasProfesor> = {}): FilaFinanzasProfesor => ({
    profesor: profesor(id),
    turnosCobrados: 0,
    totalCobrado: 0,
    parteCentro: 0,
    parteProfesor: 0,
    pagado: 0,
    saldoPendiente: 0,
    ...cifras,
  })
  // Gómez: más cobrado; Pérez L. y Pérez J. empatan; Álvarez: saldo negativo.
  const filas = [
    fila(2, { totalCobrado: 8000, saldoPendiente: 100 }),
    fila(3, { totalCobrado: 0, saldoPendiente: -6800 }),
    fila(1, { totalCobrado: 16000, saldoPendiente: 50 }),
    fila(4, { totalCobrado: 8000, saldoPendiente: 100 }),
  ]
  const nombres = (lista: readonly FilaFinanzasProfesor[]) =>
    lista.map((f) => `${f.profesor.apellido} ${f.profesor.nombre}`)

  it('por defecto: total cobrado de mayor a menor; en empate, apellido, nombre e id', () => {
    expect(ORDEN_FINANZAS_POR_DEFECTO).toEqual({ orden: 'totalCobrado', direccion: 'desc' })
    expect(nombres(ordenarFinanzas(filas, ORDEN_FINANZAS_POR_DEFECTO))).toEqual([
      'Gómez Ana',
      'Pérez Juan',
      'Pérez Luis',
      'Álvarez Marta',
    ])
  })

  it('ascendente invierte el criterio principal pero no el desempate', () => {
    expect(nombres(ordenarFinanzas(filas, { orden: 'totalCobrado', direccion: 'asc' }))).toEqual([
      'Álvarez Marta',
      'Pérez Juan',
      'Pérez Luis',
      'Gómez Ana',
    ])
  })

  it('`profesor` ordena por apellido y nombre, en las dos direcciones', () => {
    expect(nombres(ordenarFinanzas(filas, { orden: 'profesor', direccion: 'asc' }))).toEqual([
      'Álvarez Marta',
      'Gómez Ana',
      'Pérez Juan',
      'Pérez Luis',
    ])
    expect(nombres(ordenarFinanzas(filas, { orden: 'profesor', direccion: 'desc' }))).toEqual([
      'Pérez Luis',
      'Pérez Juan',
      'Gómez Ana',
      'Álvarez Marta',
    ])
  })

  it('un saldo negativo ordena por debajo de 0', () => {
    expect(nombres(ordenarFinanzas(filas, { orden: 'saldoPendiente', direccion: 'desc' }))).toEqual(
      ['Pérez Juan', 'Pérez Luis', 'Gómez Ana', 'Álvarez Marta'],
    )
  })

  it.each(COLUMNAS_FINANZAS.filter((c) => c !== 'profesor'))(
    'ordena por `%s` en las dos direcciones',
    (columna) => {
      const conValores = [fila(1, { [columna]: 3 }), fila(2, { [columna]: 1 }), fila(3)]
      expect(
        ordenarFinanzas(conValores, { orden: columna, direccion: 'desc' }).map(
          (f) => f.profesor.id,
        ),
      ).toEqual([1, 2, 3])
      expect(
        ordenarFinanzas(conValores, { orden: columna, direccion: 'asc' }).map((f) => f.profesor.id),
      ).toEqual([3, 2, 1])
    },
  )

  it('no toca la entrada', () => {
    const copia = [...filas]
    ordenarFinanzas(filas, ORDEN_FINANZAS_POR_DEFECTO)
    expect(filas).toEqual(copia)
  })
})

describe('mesesDeEvolucion', () => {
  it('los 6 meses que terminan en el de `hasta`, del más viejo al más nuevo', () => {
    expect(mesesDeEvolucion('2026-10-31')).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ])
  })

  it('cruza el cambio de año', () => {
    expect(mesesDeEvolucion('2027-02-10')).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ])
  })
})

describe('evolucionMensual', () => {
  const meses = mesesDeEvolucion('2027-01-15')

  it('por mes: cobrado y margen por fecha de pago, pagado por fecha de transferencia', () => {
    const evolucion = evolucionMensual({
      meses,
      hasta: '2027-01-15',
      cobros: [
        cobro(8000, { fechaPago: '2026-12-31' }),
        cobro(8000, { fechaPago: '2026-12-01', cerradaSinRegistrar: true }),
        cobro(4000, { fechaPago: '2027-01-02' }),
      ],
      pagadas: [pagada(6800, { fechaTransferencia: '2027-01-05' })],
    })

    expect(evolucion).toEqual([
      { mes: '2026-08', totalCobrado: 0, margenCentro: 0, pagadoAProfesores: 0 },
      { mes: '2026-09', totalCobrado: 0, margenCentro: 0, pagadoAProfesores: 0 },
      { mes: '2026-10', totalCobrado: 0, margenCentro: 0, pagadoAProfesores: 0 },
      { mes: '2026-11', totalCobrado: 0, margenCentro: 0, pagadoAProfesores: 0 },
      { mes: '2026-12', totalCobrado: 16000, margenCentro: 9200, pagadoAProfesores: 0 },
      { mes: '2027-01', totalCobrado: 4000, margenCentro: 600, pagadoAProfesores: 6800 },
    ])
  })

  it('el último mes se corta en `hasta`; los anteriores son completos', () => {
    const evolucion = evolucionMensual({
      meses,
      hasta: '2027-01-15',
      cobros: [
        cobro(8000, { fechaPago: '2026-08-01' }),
        cobro(4000, { fechaPago: '2027-01-15' }),
        cobro(2000, { fechaPago: '2027-01-16' }),
      ],
      pagadas: [
        pagada(1000, { fechaTransferencia: '2027-01-15' }),
        pagada(500, { fechaTransferencia: '2027-01-20' }),
      ],
    })

    expect(evolucion[0]).toEqual({
      mes: '2026-08',
      totalCobrado: 8000,
      margenCentro: 1200,
      pagadoAProfesores: 0,
    })
    expect(evolucion[5]).toEqual({
      mes: '2027-01',
      totalCobrado: 4000,
      margenCentro: 600,
      pagadoAProfesores: 1000,
    })
  })

  it('sin movimientos: siempre 6 filas en 0', () => {
    const evolucion = evolucionMensual({ meses, hasta: '2027-01-15', cobros: [], pagadas: [] })

    expect(evolucion).toHaveLength(6)
    for (const mes of evolucion) {
      expect(mes).toMatchObject({ totalCobrado: 0, margenCentro: 0, pagadoAProfesores: 0 })
    }
  })

  it('lo anterior al primer mes no entra', () => {
    const evolucion = evolucionMensual({
      meses,
      hasta: '2027-01-15',
      cobros: [cobro(8000, { fechaPago: '2026-07-31' })],
      pagadas: [pagada(1000, { fechaTransferencia: '2026-07-31' })],
    })

    expect(evolucion.every((m) => m.totalCobrado === 0 && m.pagadoAProfesores === 0)).toBe(true)
  })
})
