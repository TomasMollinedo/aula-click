import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { DATOS_CENTRO, LogoCentroPdf } from '@/server/features/centro/centro.condiciones'
import { contarPaginas, idioma, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import { renderizarComprobantePdf } from '../pagos.pdf'
import type { Comprobante } from '../pagos.validation'

// El comprobante en PDF, con un render real (fuentes y logo del repo). No se compara el dibujo:
// se comprueba que sale un PDF, cuántas hojas ocupa y sus metadatos.

function comprobante(cantidad: number, cambios: Partial<Comprobante> = {}): Comprobante {
  const turnos = Array.from({ length: cantidad }, (_, i) => ({
    turnoId: 41 + i,
    fecha: '2026-10-05',
    horaInicio: '09:00',
    horaFin: '10:00',
    materia: { id: 2, nombre: 'Matemática' },
    profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
    importe: 8000.5,
  }))
  return {
    id: 31,
    numeroComprobante: 1024,
    fechaPago: '2026-10-05',
    alumno: { id: 12, nombre: 'Lucía', apellido: 'Álvarez', dni: '52345678' },
    turnos,
    total: 8000.5 * cantidad,
    montoRecibido: 8000.5 * cantidad + 1000,
    vuelto: 1000,
    formaPago: { id: 1, nombre: 'Efectivo' },
    observaciones: null,
    registradoPor: { id: 'usr_mesa_01', nombre: 'Laura', apellido: 'Gómez' },
    registradoEl: '2026-10-05T14:30:00.000Z',
    ...cambios,
  }
}

function renderizar(datos: Comprobante) {
  return renderizarComprobantePdf({
    comprobante: datos,
    centro: DATOS_CENTRO,
    logo: createElement(LogoCentroPdf),
    emitidoPor: 'Laura Gómez',
    fechaEmision: '05/10/2026 11:30',
  })
}

describe('renderizarComprobantePdf', { timeout: 60_000 }, () => {
  it('devuelve un PDF de una hoja, con el número en el título y el centro como autor', async () => {
    const pdf = await renderizar(comprobante(2))

    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Comprobante de pago N° 1024')
    expect(metadato(pdf, 'Author')).toBe('Nexo Académico')
    expect(idioma(pdf)).toBe('es')
  })

  it('con 200 turnos (el máximo de un pago) no falla y ocupa varias hojas', async () => {
    const pdf = await renderizar(comprobante(200))

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBeGreaterThan(1)
  })

  it('con observaciones de varias líneas y sin monto recibido (pago anterior a T-112)', async () => {
    const pdf = await renderizar(
      comprobante(1, {
        observaciones: 'Paga el mes de octubre\nQueda pendiente noviembre',
        montoRecibido: null,
        vuelto: null,
      }),
    )
    expect(contarPaginas(pdf)).toBe(1)
  })
})
