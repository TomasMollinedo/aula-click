import { format, parseISO } from 'date-fns'
import { describe, expect, it } from 'vitest'

import {
  NOMBRE_FORMA_PAGO,
  NOMBRE_TIPO_MOVIMIENTO,
  apellidoYNombre,
  esIngreso,
  signoDelTipo,
  textoHoraDeRegistro,
  textoImporteConSigno,
  textoMesLiquidado,
  textoMotivoAnulacion,
  textoNumeroComprobante,
  textoOperacion,
  textoSinMovimientos,
  textoSinResultados,
} from '../formato-caja'

// Los textos de la caja diaria. Son los mismos que los del PDF que arma la API
// (`src/server/features/caja/caja.formato.ts`). Las horas se muestran en la hora local del
// navegador, así que los casos de `textoHoraDeRegistro` no fijan una hora: comparan con `date-fns`
// y verifican de qué día se muestra la fecha (un día de diferencia es mayor que cualquier huso).

describe('esIngreso y signoDelTipo', () => {
  it('el cobro suma y la anulación y el pago a profesor restan', () => {
    expect(esIngreso('COBRO')).toBe(true)
    expect(esIngreso('ANULACION')).toBe(false)
    expect(esIngreso('PAGO_PROFESOR')).toBe(false)
  })

  it('usa el signo menos, no el guion', () => {
    expect(signoDelTipo('COBRO')).toBe('+')
    expect(signoDelTipo('ANULACION')).toBe('−')
    expect(signoDelTipo('PAGO_PROFESOR')).toBe('−')
  })
})

describe('textoImporteConSigno', () => {
  it('el importe llega positivo y el signo lo pone el tipo', () => {
    expect(textoImporteConSigno({ tipo: 'COBRO', importe: 8000 })).toBe('+ $ 8.000,00')
    expect(textoImporteConSigno({ tipo: 'ANULACION', importe: 8000 })).toBe('− $ 8.000,00')
    expect(textoImporteConSigno({ tipo: 'PAGO_PROFESOR', importe: 6800 })).toBe('− $ 6.800,00')
  })
})

describe('textoHoraDeRegistro', () => {
  const instante = '2026-10-15T14:30:00.000Z'
  const dia = format(parseISO(instante), 'yyyy-MM-dd')

  it('sólo la hora si se registró el día de la caja', () => {
    expect(textoHoraDeRegistro(instante, dia)).toBe(format(parseISO(instante), 'HH:mm'))
  })

  it('con su fecha si se registró otro día (un pago cargado hacia atrás)', () => {
    expect(textoHoraDeRegistro(instante, '2026-10-13')).toBe(
      format(parseISO(instante), 'dd/MM HH:mm'),
    )
  })
})

describe('textos de un movimiento', () => {
  it('apellido y nombre, y el comprobante', () => {
    expect(apellidoYNombre({ nombre: 'Juan', apellido: 'Pérez' })).toBe('Pérez, Juan')
    expect(textoNumeroComprobante(1024)).toBe('Comprobante N° 1024')
  })

  it('el motivo de la anulación, con el detalle si lo hay', () => {
    expect(textoMotivoAnulacion({ motivo: 'ERROR_CARGA', detalle: 'Se cargó dos veces' })).toBe(
      'Error de carga: Se cargó dos veces',
    )
    expect(textoMotivoAnulacion({ motivo: 'FORMA_PAGO_EQUIVOCADA', detalle: null })).toBe(
      'Forma de pago equivocada',
    )
  })

  it('la operación de la transferencia, o nada si no se cargó', () => {
    expect(textoOperacion('0048213')).toBe('Operación 0048213')
    expect(textoOperacion(null)).toBeNull()
  })

  it('el mes liquidado', () => {
    expect(textoMesLiquidado('2026-09')).toBe('septiembre de 2026')
  })

  it('las etiquetas de tipo y de forma de pago', () => {
    expect(NOMBRE_TIPO_MOVIMIENTO.PAGO_PROFESOR).toBe('Pago a profesor')
    expect(NOMBRE_TIPO_MOVIMIENTO.ANULACION).toBe('Anulación')
    expect(NOMBRE_FORMA_PAGO.DEBITO).toBe('Tarjeta de débito')
  })
})

describe('avisos de lista vacía', () => {
  it('un día sin movimientos, con la fecha que se está viendo', () => {
    expect(textoSinMovimientos('2026-10-15')).toBe('No hubo movimientos de caja el 15/10')
  })

  it('con filtros puestos, el aviso dice que es por los filtros', () => {
    expect(textoSinResultados('2026-10-15')).toBe(
      'Ningún movimiento del 15/10 coincide con los filtros',
    )
  })
})
