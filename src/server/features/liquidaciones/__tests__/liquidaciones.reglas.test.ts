import { describe, expect, it } from 'vitest'
import {
  armarCierre,
  armarLiquidaciones,
  estaDevengado,
  fechaDevengo,
  saldoDelProfesor,
  textoAjusteAnulacion,
  textoMes,
  type AnulacionPendiente,
  type Devengado,
  type Liquidacion,
  type MesCerrado,
} from '../liquidaciones.reglas'

const HOY = '2026-12-10'
const GOMEZ = { id: 1, nombre: 'Ana', apellido: 'Gómez' }
const ALVAREZ = { id: 2, nombre: 'Bruno', apellido: 'Álvarez' }

let siguienteId = 0

function devengado(datos: Partial<Devengado> & { fechaDevengo: string }): Devengado {
  siguienteId += 1
  return {
    pagoTurnoId: siguienteId,
    turnoId: siguienteId,
    fecha: datos.fechaDevengo,
    horaInicio: 540,
    horaFin: 600,
    alumno: { id: 1, nombre: 'Juan', apellido: 'Pérez' },
    materia: { id: 1, nombre: 'Matemática' },
    profesor: GOMEZ,
    numeroComprobante: 1000 + siguienteId,
    importe: 10000,
    porcentaje: 15,
    ...datos,
  }
}

function anulacion(datos: Partial<AnulacionPendiente> = {}): AnulacionPendiente {
  siguienteId += 1
  return {
    liquidacionTurnoId: siguienteId,
    profesor: GOMEZ,
    mesOrigen: '2026-09',
    numeroComprobante: 123,
    parteProfesor: 2000,
    ...datos,
  }
}

function armar({
  devengados = [],
  cerradas = [],
  anulaciones = [],
  hoy = HOY,
}: {
  devengados?: Devengado[]
  cerradas?: MesCerrado[]
  anulaciones?: AnulacionPendiente[]
  hoy?: string
}): Liquidacion[] {
  return armarLiquidaciones({
    devengados,
    liquidacionesCerradas: cerradas,
    anulacionesPendientes: anulaciones,
    hoy,
  })
}

const delMes = (liquidaciones: Liquidacion[], mes: string) => {
  const liquidacion = liquidaciones.find((l) => l.mes === mes)
  if (!liquidacion) throw new Error(`No hay liquidación de ${mes}`)
  return liquidacion
}

const centavos = (importe: number) => Math.round(importe * 100)

describe('fechaDevengo', () => {
  it('clase dada en octubre y pagada en noviembre → noviembre (el pago es lo más tardío)', () => {
    expect(
      fechaDevengo({
        asistenciaRegistradaEl: new Date('2026-10-20T15:00:00Z'),
        pagoRegistradoEl: new Date('2026-11-03T14:00:00Z'),
      }),
    ).toBe('2026-11-03')
  })

  it('pagada por adelantado en octubre y dada en noviembre → noviembre (la asistencia)', () => {
    expect(
      fechaDevengo({
        pagoRegistradoEl: new Date('2026-10-25T14:00:00Z'),
        asistenciaRegistradaEl: new Date('2026-11-04T15:00:00Z'),
      }),
    ).toBe('2026-11-04')
  })

  it('asistencia registrada el 31/10 a las 22:00 de Salta → 31/10, aunque en UTC sea 1/11', () => {
    expect(
      fechaDevengo({
        pagoRegistradoEl: new Date('2026-10-30T12:00:00Z'),
        asistenciaRegistradaEl: new Date('2026-11-01T01:00:00Z'),
      }),
    ).toBe('2026-10-31')
  })
})

describe('estaDevengado', () => {
  it('ausente pagado → se debe', () => {
    expect(estaDevengado({ pagoVigente: true, asistencia: 'AUSENTE' })).toBe(true)
  })

  it('presente pagado → se debe', () => {
    expect(estaDevengado({ pagoVigente: true, asistencia: 'PRESENTE' })).toBe(true)
  })

  it('cobrado sin asistencia (dentro del plazo o cerrado sin registrar) → no se debe', () => {
    expect(estaDevengado({ pagoVigente: true, asistencia: null })).toBe(false)
  })

  it('con el pago anulado → no se debe', () => {
    expect(estaDevengado({ pagoVigente: false, asistencia: 'PRESENTE' })).toBe(false)
  })

  it('cancelado (sin pago vigente ni asistencia) → no se debe', () => {
    expect(estaDevengado({ pagoVigente: false, asistencia: null })).toBe(false)
  })
})

describe('textos', () => {
  it('textoMes → "octubre de 2026"', () => {
    expect(textoMes('2026-10')).toBe('octubre de 2026')
  })

  it('el ajuste por anulación dice "turno" en singular y "turnos" en plural', () => {
    expect(textoAjusteAnulacion(123, 1)).toBe(
      'Ajuste por anulación del comprobante N.º 123 (1 turno)',
    )
    expect(textoAjusteAnulacion(7, 2)).toBe('Ajuste por anulación del comprobante N.º 7 (2 turnos)')
  })
})

describe('armarLiquidaciones', () => {
  it('cada turno va al mes de su devengo: el terminado queda pendiente y el actual en curso', () => {
    const noviembre = devengado({ fechaDevengo: '2026-11-05' })
    const diciembre = devengado({ fechaDevengo: '2026-12-03' })

    const liquidaciones = armar({ devengados: [diciembre, noviembre] })

    expect(liquidaciones.map((l) => [l.mes, l.estado])).toEqual([
      ['2026-11', 'PENDIENTE_DE_PAGO'],
      ['2026-12', 'EN_CURSO'],
    ])
    expect(delMes(liquidaciones, '2026-11').turnos.map((t) => t.pagoTurnoId)).toEqual([
      noviembre.pagoTurnoId,
    ])
    expect(delMes(liquidaciones, '2026-11')).toMatchObject({
      totalCobrado: 10000,
      parteCentro: 1500,
      parteProfesor: 8500,
      totalAjustes: 0,
      total: 8500,
      ajustes: [],
      cerrada: null,
    })
    expect(delMes(liquidaciones, '2026-11').turnos[0]).not.toHaveProperty('profesor')
  })

  it('con dos porcentajes (12 y 15) en la misma liquidación, las partes suman lo cobrado en centavos', () => {
    const liquidaciones = armar({
      devengados: [
        devengado({ fechaDevengo: '2026-11-05', importe: 10000.55, porcentaje: 12 }),
        devengado({ fechaDevengo: '2026-11-06', importe: 7333.33, porcentaje: 15 }),
      ],
    })

    const noviembre = delMes(liquidaciones, '2026-11')
    expect(noviembre.turnos.map((t) => [t.parteCentro, t.parteProfesor])).toEqual([
      [1200.07, 8800.48],
      [1100, 6233.33],
    ])
    expect(noviembre).toMatchObject({
      totalCobrado: 17333.88,
      parteCentro: 2300.07,
      parteProfesor: 15033.81,
      total: 15033.81,
    })
    expect(centavos(noviembre.parteCentro) + centavos(noviembre.parteProfesor)).toBe(
      centavos(noviembre.totalCobrado),
    )
  })

  it('ordena los turnos por fecha, hora de inicio y turno', () => {
    const tarde = devengado({ fechaDevengo: '2026-11-10', fecha: '2026-11-03', horaInicio: 900 })
    const temprano = devengado({ fechaDevengo: '2026-11-04', fecha: '2026-11-03', horaInicio: 540 })
    const antes = devengado({ fechaDevengo: '2026-11-20', fecha: '2026-11-02', horaInicio: 1000 })

    const [noviembre] = armar({ devengados: [tarde, temprano, antes] })

    expect(noviembre.turnos.map((t) => t.turnoId)).toEqual([
      antes.turnoId,
      temprano.turnoId,
      tarde.turnoId,
    ])
  })

  describe('ajuste por anulación', () => {
    it('va a la primera liquidación sin cerrar posterior a la que incluyó el turno', () => {
      const liquidaciones = armar({
        devengados: [devengado({ fechaDevengo: '2026-11-05' })],
        cerradas: [{ profesorId: GOMEZ.id, mes: '2026-10' }],
        anulaciones: [anulacion({ mesOrigen: '2026-10', parteProfesor: 2000 })],
      })

      expect(delMes(liquidaciones, '2026-11')).toMatchObject({
        totalAjustes: -2000,
        total: 6500,
        estado: 'PENDIENTE_DE_PAGO',
      })
    })

    it('con un mes intermedio pendiente, va a ese mes (origen agosto → septiembre, no octubre)', () => {
      const liquidaciones = armar({
        devengados: [
          devengado({ fechaDevengo: '2026-09-05' }),
          devengado({ fechaDevengo: '2026-10-05' }),
        ],
        cerradas: [{ profesorId: GOMEZ.id, mes: '2026-08' }],
        anulaciones: [anulacion({ mesOrigen: '2026-08' })],
      })

      expect(delMes(liquidaciones, '2026-09').ajustes).toHaveLength(1)
      expect(delMes(liquidaciones, '2026-10').ajustes).toEqual([])
    })

    it('sin ningún mes con turnos, va al mes en curso, que se crea sólo con el ajuste', () => {
      const liquidaciones = armar({
        cerradas: [{ profesorId: GOMEZ.id, mes: '2026-10' }],
        anulaciones: [anulacion({ mesOrigen: '2026-10', parteProfesor: 2000 })],
      })

      expect(liquidaciones).toHaveLength(1)
      expect(liquidaciones[0]).toMatchObject({
        mes: '2026-12',
        estado: 'EN_CURSO',
        turnos: [],
        totalCobrado: 0,
        totalAjustes: -2000,
        total: -2000,
      })
    })

    it('agrupa por comprobante: una línea con la suma por comprobante, ordenadas por número', () => {
      const primero = anulacion({ numeroComprobante: 123, parteProfesor: 3400 })
      const segundo = anulacion({ numeroComprobante: 123, parteProfesor: 3400.5 })
      const otro = anulacion({ numeroComprobante: 77, parteProfesor: 1000 })

      const [noviembre] = armar({
        devengados: [devengado({ fechaDevengo: '2026-11-05' })],
        anulaciones: [segundo, otro, primero],
      })

      expect(noviembre.ajustes).toEqual([
        {
          tipo: 'ANULACION',
          texto: 'Ajuste por anulación del comprobante N.º 77 (1 turno)',
          importe: -1000,
          numeroComprobante: 77,
          turnos: [{ liquidacionTurnoId: otro.liquidacionTurnoId, parteProfesor: 1000 }],
        },
        {
          tipo: 'ANULACION',
          texto: 'Ajuste por anulación del comprobante N.º 123 (2 turnos)',
          importe: -6800.5,
          numeroComprobante: 123,
          turnos: [
            { liquidacionTurnoId: primero.liquidacionTurnoId, parteProfesor: 3400 },
            { liquidacionTurnoId: segundo.liquidacionTurnoId, parteProfesor: 3400.5 },
          ],
        },
      ])
      expect(noviembre.totalAjustes).toBe(-7800.5)
    })
  })

  describe('saldo anterior', () => {
    it('un mes terminado negativo queda a descontar y entra entero en el siguiente', () => {
      const liquidaciones = armar({
        devengados: [
          devengado({ fechaDevengo: '2026-10-05', importe: 1000 }),
          devengado({ fechaDevengo: '2026-11-05' }),
        ],
        anulaciones: [anulacion({ mesOrigen: '2026-09', parteProfesor: 2000 })],
      })

      expect(delMes(liquidaciones, '2026-10')).toMatchObject({
        estado: 'SALDO_A_DESCONTAR',
        total: -1150,
      })
      const noviembre = delMes(liquidaciones, '2026-11')
      expect(noviembre.ajustes).toEqual([
        {
          tipo: 'SALDO_ANTERIOR',
          texto: 'Saldo de la liquidación de octubre de 2026',
          importe: -1150,
          mesOrigen: '2026-10',
        },
      ])
      expect(noviembre).toMatchObject({ estado: 'PENDIENTE_DE_PAGO', total: 7350 })
    })

    it('un total de exactamente 0 también se arrastra (ajuste de 0)', () => {
      const liquidaciones = armar({
        devengados: [
          devengado({ fechaDevengo: '2026-10-05', importe: 1000 }),
          devengado({ fechaDevengo: '2026-11-05' }),
        ],
        anulaciones: [anulacion({ mesOrigen: '2026-09', parteProfesor: 850 })],
      })

      expect(delMes(liquidaciones, '2026-10')).toMatchObject({
        estado: 'SALDO_A_DESCONTAR',
        total: 0,
      })
      expect(delMes(liquidaciones, '2026-11').ajustes).toMatchObject([
        { tipo: 'SALDO_ANTERIOR', importe: 0, mesOrigen: '2026-10' },
      ])
    })

    it('se encadena: octubre y noviembre negativos llegan a diciembre con la suma', () => {
      const liquidaciones = armar({
        devengados: [
          devengado({ fechaDevengo: '2026-10-05', importe: 1000 }),
          devengado({ fechaDevengo: '2026-11-05', importe: 1000 }),
          devengado({ fechaDevengo: '2026-12-05' }),
        ],
        anulaciones: [anulacion({ mesOrigen: '2026-09', parteProfesor: 2000 })],
      })

      expect(liquidaciones.map((l) => [l.mes, l.estado, l.total])).toEqual([
        ['2026-10', 'SALDO_A_DESCONTAR', -1150],
        ['2026-11', 'SALDO_A_DESCONTAR', -300],
        ['2026-12', 'EN_CURSO', 8200],
      ])
      expect(delMes(liquidaciones, '2026-12').ajustes).toMatchObject([
        { tipo: 'SALDO_ANTERIOR', importe: -300, mesOrigen: '2026-11' },
      ])
    })

    it('el mes que recibe el saldo se crea aunque no tenga turnos, y se evalúa con el ajuste', () => {
      const liquidaciones = armar({
        devengados: [devengado({ fechaDevengo: '2026-10-05', importe: 1000 })],
        anulaciones: [anulacion({ mesOrigen: '2026-09', parteProfesor: 2000 })],
      })

      expect(liquidaciones.map((l) => [l.mes, l.estado, l.total])).toEqual([
        ['2026-10', 'SALDO_A_DESCONTAR', -1150],
        ['2026-11', 'SALDO_A_DESCONTAR', -1150],
        ['2026-12', 'EN_CURSO', -1150],
      ])
    })

    it('el mes en curso negativo queda en curso y no arrastra nada', () => {
      const liquidaciones = armar({
        devengados: [devengado({ fechaDevengo: '2026-12-05', importe: 1000 })],
        cerradas: [{ profesorId: GOMEZ.id, mes: '2026-11' }],
        anulaciones: [anulacion({ mesOrigen: '2026-11', parteProfesor: 2000 })],
      })

      expect(liquidaciones.map((l) => [l.mes, l.estado, l.total])).toEqual([
        ['2026-12', 'EN_CURSO', -1150],
      ])
    })

    it('salta los meses cerrados: octubre negativo con noviembre cerrado va a diciembre', () => {
      const liquidaciones = armar({
        devengados: [devengado({ fechaDevengo: '2026-10-05', importe: 1000 })],
        cerradas: [
          { profesorId: GOMEZ.id, mes: '2026-09' },
          { profesorId: GOMEZ.id, mes: '2026-11' },
        ],
        anulaciones: [anulacion({ mesOrigen: '2026-09', parteProfesor: 2000 })],
      })

      expect(liquidaciones.map((l) => l.mes)).toEqual(['2026-10', '2026-12'])
      expect(delMes(liquidaciones, '2026-12').ajustes).toMatchObject([
        { tipo: 'SALDO_ANTERIOR', importe: -1150, mesOrigen: '2026-10' },
      ])
    })
  })

  it('dos profesores no se mezclan y salen ordenados por apellido', () => {
    const deGomez = devengado({ fechaDevengo: '2026-11-05' })
    const deAlvarez = devengado({ fechaDevengo: '2026-11-06', profesor: ALVAREZ, importe: 5000 })

    const liquidaciones = armar({
      devengados: [deGomez, deAlvarez],
      anulaciones: [anulacion({ mesOrigen: '2026-10', parteProfesor: 1000 })],
    })

    expect(liquidaciones.map((l) => [l.profesor.apellido, l.mes, l.total])).toEqual([
      ['Álvarez', '2026-11', 4250],
      ['Gómez', '2026-11', 7500],
    ])
    expect(liquidaciones[0].turnos.map((t) => t.pagoTurnoId)).toEqual([deAlvarez.pagoTurnoId])
  })
})

describe('saldoDelProfesor', () => {
  it('suma la pendiente y la en curso', () => {
    const liquidaciones = armar({
      devengados: [
        devengado({ fechaDevengo: '2026-11-05' }),
        devengado({ fechaDevengo: '2026-12-05' }),
      ],
    })

    expect(saldoDelProfesor(liquidaciones)).toBe(17000)
  })

  it('no cuenta dos veces un saldo a descontar: ya está en la del mes siguiente', () => {
    // Octubre: 850 − 1.350 = −500, a descontar. Noviembre: 2.000 − 500 = 1.500.
    const liquidaciones = armar({
      devengados: [
        devengado({ fechaDevengo: '2026-10-05', importe: 850, porcentaje: 0 }),
        devengado({ fechaDevengo: '2026-11-05', importe: 2000, porcentaje: 0 }),
      ],
      anulaciones: [anulacion({ mesOrigen: '2026-09', parteProfesor: 1350 })],
    })

    expect(liquidaciones.map((l) => l.total)).toEqual([-500, 1500])
    expect(saldoDelProfesor(liquidaciones)).toBe(1500)
  })

  it('puede dar negativo si sólo hay un mes en curso negativo', () => {
    const liquidaciones = armar({
      cerradas: [{ profesorId: GOMEZ.id, mes: '2026-11' }],
      anulaciones: [anulacion({ mesOrigen: '2026-11', parteProfesor: 1350 })],
    })

    expect(saldoDelProfesor(liquidaciones)).toBe(-1350)
  })
})

describe('armarCierre', () => {
  // Octubre −1.150 y noviembre −300 a descontar; diciembre, ya terminado, 8.200 a pagar.
  const cadena = () =>
    armar({
      devengados: [
        devengado({ fechaDevengo: '2026-10-05', importe: 1000 }),
        devengado({ fechaDevengo: '2026-11-05', importe: 1000 }),
        devengado({ fechaDevengo: '2026-12-05' }),
      ],
      anulaciones: [anulacion({ mesOrigen: '2026-09', parteProfesor: 2000 })],
      hoy: '2027-01-10',
    })

  it('devuelve null si la liquidación no está pendiente de pago (en curso, a descontar o sin movimientos)', () => {
    const conEnCurso = armar({ devengados: [devengado({ fechaDevengo: '2026-12-05' })] })
    expect(armarCierre(conEnCurso, { profesorId: GOMEZ.id, mes: '2026-12' })).toBeNull()
    expect(armarCierre(cadena(), { profesorId: GOMEZ.id, mes: '2026-10' })).toBeNull()
    expect(armarCierre(cadena(), { profesorId: GOMEZ.id, mes: '2026-08' })).toBeNull()
  })

  it('una pendiente simple → una escritura PAGADA con sus turnos y un ajuste por turno anulado', () => {
    const turno = devengado({ fechaDevengo: '2026-11-05' })
    const primero = anulacion({ mesOrigen: '2026-10', numeroComprobante: 50, parteProfesor: 1000 })
    const segundo = anulacion({ mesOrigen: '2026-10', numeroComprobante: 50, parteProfesor: 500 })
    const liquidaciones = armar({
      devengados: [turno],
      cerradas: [{ profesorId: GOMEZ.id, mes: '2026-10' }],
      anulaciones: [primero, segundo],
    })

    const cierre = armarCierre(liquidaciones, { profesorId: GOMEZ.id, mes: '2026-11' })

    expect(cierre?.liquidacion).toBe(delMes(liquidaciones, '2026-11'))
    expect(cierre?.escrituras).toEqual([
      {
        mes: '2026-11',
        estado: 'PAGADA',
        descontadaEnMes: null,
        totalCobrado: 10000,
        parteCentro: 1500,
        parteProfesor: 8500,
        totalAjustes: -1500,
        total: 7000,
        turnos: [
          {
            pagoTurnoId: turno.pagoTurnoId,
            fechaDevengo: '2026-11-05',
            importe: 10000,
            porcentaje: 15,
            parteProfesor: 8500,
          },
        ],
        ajustes: [
          { tipo: 'ANULACION', liquidacionTurnoId: primero.liquidacionTurnoId, importe: -1000 },
          { tipo: 'ANULACION', liquidacionTurnoId: segundo.liquidacionTurnoId, importe: -500 },
        ],
      },
    ])
  })

  it('con una cadena de dos saldos → tres escrituras, de la más vieja a la pagada', () => {
    const cierre = armarCierre(cadena(), { profesorId: GOMEZ.id, mes: '2026-12' })

    expect(
      cierre?.escrituras.map((e) => [e.mes, e.estado, e.descontadaEnMes, e.total, e.ajustes]),
    ).toEqual([
      [
        '2026-10',
        'DESCONTADA',
        '2026-11',
        -1150,
        expect.arrayContaining([expect.objectContaining({ tipo: 'ANULACION', importe: -2000 })]),
      ],
      [
        '2026-11',
        'DESCONTADA',
        '2026-12',
        -300,
        [{ tipo: 'SALDO_ANTERIOR', mesOrigen: '2026-10', importe: -1150 }],
      ],
      [
        '2026-12',
        'PAGADA',
        null,
        8200,
        [{ tipo: 'SALDO_ANTERIOR', mesOrigen: '2026-11', importe: -300 }],
      ],
    ])
  })
})
