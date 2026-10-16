import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { DATOS_CENTRO, LogoCentroPdf } from '@/server/features/centro/centro.condiciones'
import { contarPaginas, idioma, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import { renderizarCajaPdf } from '../caja.pdf'
import type { Caja } from '../caja.validation'

// La plantilla de la caja en PDF (T-127), con un render real (fuentes y logo del repo). No se
// compara el dibujo: se comprueba que sale un PDF, sus metadatos, las hojas que ocupa y que no
// falla con los casos de borde.

const EFECTIVO = { codigo: 'EFECTIVO', nombre: 'Efectivo' } as const
const TRANSFERENCIA = { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' } as const

const CAJA: Caja = {
  fecha: '2026-10-15',
  movimientos: [
    {
      tipo: 'COBRO',
      registradoEl: '2026-10-15T12:10:00.000Z',
      pagoId: 31,
      numeroComprobante: 1024,
      alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
      formaPago: EFECTIVO,
      importe: 16000,
      estado: 'ANULADO',
    },
    {
      tipo: 'ANULACION',
      registradoEl: '2026-10-15T14:20:00.000Z',
      pagoId: 31,
      numeroComprobante: 1024,
      alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
      formaPago: EFECTIVO,
      importe: 16000,
      motivo: 'ERROR_CARGA',
      detalle: null,
    },
    {
      tipo: 'PAGO_PROFESOR',
      registradoEl: '2026-10-15T15:05:00.000Z',
      profesor: { id: 4, nombre: 'Ana', apellido: 'Gómez' },
      mes: '2026-09',
      numeroOperacion: '0048213',
      formaPago: TRANSFERENCIA,
      importe: 6800,
      liquidacion: { profesorId: 4, mes: '2026-09' },
    },
  ],
  resumen: {
    ingresos: {
      porForma: { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0 },
      total: 0,
      parteCentro: 0,
      parteProfesores: 0,
    },
    egresos: 6800,
    saldo: -6800,
  },
}

const ENCABEZADO = {
  centro: DATOS_CENTRO,
  logo: createElement(LogoCentroPdf),
  emitidoPor: 'Ricardo Gerente',
  fechaEmision: '15/10/2026 18:30',
}

const renderizar = (caja: Caja = CAJA) => renderizarCajaPdf({ caja, ...ENCABEZADO })

describe('renderizarCajaPdf', { timeout: 60_000 }, () => {
  it('devuelve un PDF de una hoja, con el centro como autor y el día en el título', async () => {
    const pdf = await renderizar()

    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Caja diaria 15/10/2026')
    expect(metadato(pdf, 'Author')).toBe('Nexo Académico')
    expect(idioma(pdf)).toBe('es')
  })

  it('un día sin movimientos (resumen en 0) también sale, en una hoja', async () => {
    const pdf = await renderizar({
      ...CAJA,
      movimientos: [],
      resumen: {
        ingresos: {
          porForma: { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0 },
          total: 0,
          parteCentro: 0,
          parteProfesores: 0,
        },
        egresos: 0,
        saldo: 0,
      },
    })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
  })

  it('con muchos movimientos la lista completa ocupa más de una hoja', async () => {
    const [cobro] = CAJA.movimientos
    const movimientos = Array.from({ length: 120 }, () => cobro!)

    expect(contarPaginas(await renderizar({ ...CAJA, movimientos }))).toBeGreaterThan(1)
  })

  it('un cobro registrado otro día y una caja con saldos negativos no fallan', async () => {
    const pdf = await renderizar({
      ...CAJA,
      movimientos: [
        {
          tipo: 'COBRO',
          registradoEl: '2026-10-16T12:12:00.000Z',
          pagoId: 40,
          numeroComprobante: 1030,
          alumno: { id: 15, nombre: 'Lucía', apellido: 'González' },
          formaPago: TRANSFERENCIA,
          importe: 8000,
          estado: 'VIGENTE',
        },
      ],
    })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
