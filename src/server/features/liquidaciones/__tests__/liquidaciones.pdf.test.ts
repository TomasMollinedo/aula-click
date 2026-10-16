import { describe, expect, it } from 'vitest'
import { encabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import { contarPaginas, idioma, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import type { LiquidacionDocumento, TurnoDelDocumento } from '../liquidaciones.documentos'
import { renderizarLiquidacionPdf } from '../liquidaciones.pdf'

// El documento PDF de una liquidación (T-125), con un render real (fuentes y logo del repo). No se
// compara el dibujo: se comprueba que sale un PDF, cuántas hojas ocupa y sus metadatos.

const encabezado = encabezadoDeDocumento(
  { name: 'Marta', apellido: 'Ríos' },
  () => new Date('2026-10-15T13:56:00.000Z'),
)

function turno(dia: number, cambios: Partial<TurnoDelDocumento> = {}): TurnoDelDocumento {
  return {
    fecha: `2026-09-${String(dia).padStart(2, '0')}`,
    horaInicio: '16:00',
    horaFin: '17:00',
    alumno: { nombre: 'Juan', apellido: 'Pérez' },
    materia: 'Matemática',
    numeroComprobante: 100 + dia,
    importe: 8000,
    porcentaje: 15,
    parteProfesor: 6800,
    ...cambios,
  }
}

function documento(cambios: Partial<LiquidacionDocumento> = {}): LiquidacionDocumento {
  return {
    profesor: { id: 4, nombre: 'Ana', apellido: 'Gómez' },
    mes: '2026-09',
    estado: 'PAGADA',
    conComprobante: true,
    turnos: [turno(7), turno(14)],
    ajustes: [
      { texto: 'Ajuste por anulación del comprobante N.º 98 (1 turno)', importe: -6800 },
      { texto: 'Saldo de la liquidación de agosto de 2026', importe: -400 },
    ],
    totalCobrado: 16000,
    parteCentro: 2400,
    parteProfesor: 13600,
    totalAjustes: -7200,
    total: 6400,
    transferencia: { fecha: '2026-10-05', numeroOperacion: '0004829137' },
    descontadaEnMes: null,
    ...cambios,
  }
}

describe('renderizarLiquidacionPdf', { timeout: 60_000 }, () => {
  it('una pagada: turnos, ajustes, totales y transferencia en una hoja, con sus metadatos', async () => {
    const pdf = await renderizarLiquidacionPdf({ documento: documento(), ...encabezado })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Liquidación Septiembre de 2026')
    expect(metadato(pdf, 'Author')).toBe('Nexo Académico')
    expect(idioma(pdf)).toBe('es')
  })

  it('la del profesor, sin la columna del comprobante, renderiza', async () => {
    const pdf = await renderizarLiquidacionPdf({
      documento: documento({
        conComprobante: false,
        turnos: [turno(7, { numeroComprobante: null })],
      }),
      ...encabezado,
    })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
  })

  it('una pendiente, sin ajustes ni transferencia, renderiza', async () => {
    const pdf = await renderizarLiquidacionPdf({
      documento: documento({ estado: 'PENDIENTE_DE_PAGO', ajustes: [], transferencia: null }),
      ...encabezado,
    })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('sin movimientos: el aviso, en una hoja', async () => {
    const pdf = await renderizarLiquidacionPdf({
      documento: documento({
        estado: null,
        turnos: [],
        ajustes: [],
        totalCobrado: 0,
        parteCentro: 0,
        parteProfesor: 0,
        totalAjustes: 0,
        total: 0,
        transferencia: null,
      }),
      ...encabezado,
    })

    expect(contarPaginas(pdf)).toBe(1)
  })

  it('un mes con muchos turnos ocupa varias hojas', async () => {
    const turnos = Array.from({ length: 80 }, (_, i) => turno((i % 28) + 1))
    const pdf = await renderizarLiquidacionPdf({ documento: documento({ turnos }), ...encabezado })

    expect(contarPaginas(pdf)).toBeGreaterThan(1)
  })
})
