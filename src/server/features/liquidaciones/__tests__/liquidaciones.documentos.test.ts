import { describe, expect, it } from 'vitest'
import type { Liquidacion } from '../liquidaciones.condiciones'
import { documentoDeLiquidacion, nombreArchivoLiquidacion } from '../liquidaciones.documentos'
import {
  textoEstadoLiquidacion,
  textoMesDelDocumento,
  textoNumeroComprobante,
  textoPorcentaje,
} from '../liquidaciones.formato'

// Lo que no es dibujo del PDF de una liquidación (T-125): la forma del documento, el nombre del
// archivo y sus textos. Funciones puras.

const GOMEZ = { id: 4, nombre: 'Ana', apellido: 'Gómez' }

function liquidacion(cambios: Partial<Liquidacion> = {}): Liquidacion {
  return {
    profesor: GOMEZ,
    mes: '2026-09',
    estado: 'PAGADA',
    turnos: [
      {
        pagoTurnoId: 1,
        turnoId: 2,
        fecha: '2026-09-08',
        horaInicio: 960,
        horaFin: 1020,
        alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
        materia: { id: 2, nombre: 'Matemática' },
        numeroComprobante: 123,
        importe: 8000,
        porcentaje: 15,
        fechaDevengo: '2026-09-08',
        parteCentro: 1200,
        parteProfesor: 6800,
      },
    ],
    ajustes: [
      {
        tipo: 'SALDO_ANTERIOR',
        texto: 'Saldo de la liquidación de agosto de 2026',
        importe: -400,
        mesOrigen: '2026-08',
      },
    ],
    totalCobrado: 8000,
    parteCentro: 1200,
    parteProfesor: 6800,
    totalAjustes: -400,
    total: 6400,
    cerrada: {
      id: 31,
      fechaTransferencia: '2026-10-05',
      numeroOperacion: '0004829137',
      observaciones: 'Interna del gerente',
      descontadaEnMes: null,
      registradaPor: { id: 'usr_gerente', nombre: 'Marta', apellido: 'Ríos' },
      registradaEl: '2026-10-05T14:03:00.000Z',
    },
    ...cambios,
  }
}

describe('documentoDeLiquidacion', () => {
  it('el del gerente: con el comprobante, los ajustes, los totales y la transferencia', () => {
    const documento = documentoDeLiquidacion(GOMEZ, '2026-09', liquidacion(), {
      conComprobante: true,
    })
    expect(documento).toEqual({
      profesor: GOMEZ,
      mes: '2026-09',
      estado: 'PAGADA',
      conComprobante: true,
      turnos: [
        {
          fecha: '2026-09-08',
          horaInicio: '16:00',
          horaFin: '17:00',
          alumno: { nombre: 'Juan', apellido: 'Pérez' },
          materia: 'Matemática',
          numeroComprobante: 123,
          importe: 8000,
          porcentaje: 15,
          parteProfesor: 6800,
        },
      ],
      ajustes: [{ texto: 'Saldo de la liquidación de agosto de 2026', importe: -400 }],
      totalCobrado: 8000,
      parteCentro: 1200,
      parteProfesor: 6800,
      totalAjustes: -400,
      total: 6400,
      transferencia: { fecha: '2026-10-05', numeroOperacion: '0004829137' },
      descontadaEnMes: null,
    })
  })

  it('el del profesor: sin el número de comprobante (decisión T-171)', () => {
    const documento = documentoDeLiquidacion(GOMEZ, '2026-09', liquidacion(), {
      conComprobante: false,
    })
    expect(documento.conComprobante).toBe(false)
    expect(documento.turnos[0]?.numeroComprobante).toBeNull()
  })

  it('no lleva las observaciones, quién registró el pago ni el adjunto', () => {
    const texto = JSON.stringify(
      documentoDeLiquidacion(GOMEZ, '2026-09', liquidacion(), { conComprobante: true }),
    )
    for (const dato of ['Interna del gerente', 'Marta', 'registradaPor', 'observaciones']) {
      expect(texto).not.toContain(dato)
    }
  })

  it('una abierta no tiene transferencia', () => {
    const documento = documentoDeLiquidacion(
      GOMEZ,
      '2026-09',
      liquidacion({ estado: 'PENDIENTE_DE_PAGO', cerrada: null }),
      { conComprobante: true },
    )
    expect(documento.transferencia).toBeNull()
  })

  it('sin movimientos: la vacía', () => {
    expect(documentoDeLiquidacion(GOMEZ, '2026-07', null, { conComprobante: true })).toMatchObject({
      estado: null,
      turnos: [],
      ajustes: [],
      total: 0,
      transferencia: null,
    })
  })
})

describe('nombreArchivoLiquidacion', () => {
  it('"liquidacion", el profesor y el mes, con guiones', () => {
    expect(nombreArchivoLiquidacion({ profesor: GOMEZ, mes: '2026-09' })).toBe(
      'liquidacion-Gómez-Ana-2026-09',
    )
  })
})

describe('textos', () => {
  it('el estado, como el badge de la pantalla', () => {
    const base = { transferencia: null, descontadaEnMes: null }
    expect(
      textoEstadoLiquidacion({
        estado: 'PAGADA',
        transferencia: { fecha: '2026-10-05', numeroOperacion: null },
        descontadaEnMes: null,
      }),
    ).toBe('Pagada el 05/10/2026')
    expect(
      textoEstadoLiquidacion({
        estado: 'DESCONTADA',
        transferencia: null,
        descontadaEnMes: '2026-11',
      }),
    ).toBe('Descontada en la liquidación de noviembre de 2026')
    expect(textoEstadoLiquidacion({ estado: 'PENDIENTE_DE_PAGO', ...base })).toBe(
      'Pendiente de pago',
    )
    expect(textoEstadoLiquidacion({ estado: null, ...base })).toBe('Sin movimientos')
  })

  it('el mes, el porcentaje y el comprobante', () => {
    expect(textoMesDelDocumento('2026-09')).toBe('Septiembre de 2026')
    expect(textoPorcentaje(15)).toBe('15 %')
    expect(textoPorcentaje(15.5)).toBe('15,5 %')
    expect(textoNumeroComprobante(123)).toBe('N.º 123')
  })
})
