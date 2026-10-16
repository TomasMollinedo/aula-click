import { describe, expect, it } from 'vitest'

import { formatoEstadoLiquidacion, nombreDeProfesor } from '../formato-liquidaciones'
import type { EstadoAMostrar } from '../formato-liquidaciones'

const SIN_DATOS = { fechaTransferencia: null, descontadaEnMes: null }

const texto = (liquidacion: EstadoAMostrar) => formatoEstadoLiquidacion(liquidacion).texto

describe('formatoEstadoLiquidacion', () => {
  it('los estados abiertos', () => {
    expect(texto({ estado: 'EN_CURSO', ...SIN_DATOS })).toBe('En curso')
    expect(texto({ estado: 'PENDIENTE_DE_PAGO', ...SIN_DATOS })).toBe('Pendiente de pago')
    expect(texto({ estado: 'SALDO_A_DESCONTAR', ...SIN_DATOS })).toBe(
      'Saldo a descontar el mes próximo',
    )
  })

  it('pagada: con la fecha de la transferencia, sin correrse de día', () => {
    expect(texto({ ...SIN_DATOS, estado: 'PAGADA', fechaTransferencia: '2026-10-05' })).toBe(
      'Pagada el 05/10/2026',
    )
  })

  it('descontada: con el mes de la liquidación que absorbió el saldo', () => {
    expect(texto({ ...SIN_DATOS, estado: 'DESCONTADA', descontadaEnMes: '2026-11' })).toBe(
      'Descontada en la liquidación de noviembre de 2026',
    )
  })

  it('variantes: pendiente de pago y pagada se distinguen del resto', () => {
    expect(formatoEstadoLiquidacion({ estado: 'PENDIENTE_DE_PAGO', ...SIN_DATOS }).variante).toBe(
      'pendiente',
    )
    expect(
      formatoEstadoLiquidacion({ ...SIN_DATOS, estado: 'PAGADA', fechaTransferencia: '2026-10-05' })
        .variante,
    ).toBe('confirmado')
  })
})

describe('nombreDeProfesor', () => {
  it('apellido, nombre', () => {
    expect(nombreDeProfesor({ nombre: 'Ana', apellido: 'Gómez' })).toBe('Gómez, Ana')
  })
})
