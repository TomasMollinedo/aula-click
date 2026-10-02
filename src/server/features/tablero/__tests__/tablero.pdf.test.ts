import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { DATOS_CENTRO, LogoCentroPdf } from '@/server/features/centro/centro.condiciones'
import { contarPaginas, idioma, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import { renderizarTableroPdf } from '../tablero.pdf'
import type { Tablero } from '../tablero.validation'

// El tablero en PDF, con un render real (fuentes y logo del repo). No se compara el dibujo: se
// comprueba que sale un PDF de una hoja, sus metadatos y que no falla con los casos de borde.

const TABLERO: Tablero = {
  periodo: { desde: '2026-09-28', hasta: '2026-10-04' },
  hoy: '2026-10-02',
  turnos: {
    total: 48,
    cancelados: { cantidad: 6, porcentaje: 12.5 },
    sinRegistrar: { cantidad: 26, porcentaje: 54.2 },
    agendados: { cantidad: 16, porcentaje: 33.3 },
    asistio: { disponible: false },
    noAsistio: { disponible: false },
  },
  ocupacion: { turnos: 42, capacidad: 64, porcentaje: 65.6 },
  alumnos: { nuevos: 3, atendidos: { disponible: false } },
  materiasConMasDemanda: [
    { materia: { id: 2, nombre: 'Matemática' }, cantidad: 15 },
    { materia: { id: 7, nombre: 'Física' }, cantidad: 9 },
    { materia: { id: 4, nombre: 'Inglés' }, cantidad: 8 },
    { materia: { id: 5, nombre: 'Química' }, cantidad: 6 },
    { materia: { id: 9, nombre: 'Lengua' }, cantidad: 4 },
  ],
  profesoresConMasTurnos: [
    { profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' }, cantidad: 14 },
    { profesor: { id: 5, nombre: 'Luis', apellido: 'Pérez' }, cantidad: 11 },
    { profesor: { id: 8, nombre: 'Marta', apellido: 'Ruiz' }, cantidad: 9 },
  ],
  pagos: { totalCobrado: 96000, totalAdeudado: 296000.5 },
}

function renderizar(cambios: Partial<Tablero> = {}) {
  return renderizarTableroPdf({
    tablero: { ...TABLERO, ...cambios },
    centro: DATOS_CENTRO,
    logo: createElement(LogoCentroPdf),
    emitidoPor: 'Ricardo Gerente',
    fechaEmision: '02/10/2026 11:30',
  })
}

describe('renderizarTableroPdf', { timeout: 60_000 }, () => {
  it('devuelve un PDF de una hoja, con el centro como autor', async () => {
    const pdf = await renderizar()

    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Tablero semanal')
    expect(metadato(pdf, 'Author')).toBe('Nexo Académico')
    expect(idioma(pdf)).toBe('es')
  })

  it('un período sin nada (todo en 0, tops vacíos) también sale, en una hoja', async () => {
    const pdf = await renderizar({
      turnos: {
        ...TABLERO.turnos,
        total: 0,
        cancelados: { cantidad: 0, porcentaje: 0 },
        sinRegistrar: { cantidad: 0, porcentaje: 0 },
        agendados: null,
      },
      ocupacion: { turnos: 0, capacidad: 0, porcentaje: 0 },
      alumnos: { nuevos: 0, atendidos: { disponible: false } },
      materiasConMasDemanda: [],
      profesoresConMasTurnos: [],
      pagos: { totalCobrado: 0, totalAdeudado: 0 },
    })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
  })

  it('con todos los turnos cancelados (un segmento completo) y la ocupación por encima de 100 no falla', async () => {
    const pdf = await renderizar({
      turnos: { ...TABLERO.turnos, total: 4, cancelados: { cantidad: 4, porcentaje: 100 } },
      ocupacion: { turnos: 0, capacidad: 0, porcentaje: 0 },
    })
    expect(contarPaginas(pdf)).toBe(1)

    const sobreocupado = await renderizar({
      ocupacion: { turnos: 70, capacidad: 64, porcentaje: 109.4 },
    })
    expect(contarPaginas(sobreocupado)).toBe(1)
  })
})
