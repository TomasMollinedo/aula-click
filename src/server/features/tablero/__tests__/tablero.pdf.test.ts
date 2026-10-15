import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { DATOS_CENTRO, LogoCentroPdf } from '@/server/features/centro/centro.condiciones'
import { contarPaginas, idioma, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import { renderizarTableroAsistenciaPdf, renderizarTableroPdf } from '../tablero.pdf'
import type { Tablero, TableroAsistenciaCompleta } from '../tablero.validation'

// Las dos plantillas del tablero en PDF (General y Asistencia), con un render real (fuentes y logo
// del repo). No se compara el dibujo: se comprueba que sale un PDF, sus metadatos, las hojas que
// ocupa y que no falla con los casos de borde.

const TABLERO: Tablero = {
  periodo: { desde: '2026-09-28', hasta: '2026-10-04' },
  hoy: '2026-10-02',
  turnos: {
    total: 48,
    cancelados: { cantidad: 6, porcentaje: 12.5 },
    sinRegistrar: { cantidad: 6, porcentaje: 12.5 },
    agendados: { cantidad: 16, porcentaje: 33.3 },
    asistio: { cantidad: 17, porcentaje: 85 },
    noAsistio: { cantidad: 3, porcentaje: 15 },
  },
  ocupacion: { turnos: 42, capacidad: 64, porcentaje: 65.6 },
  alumnos: { nuevos: 3, atendidos: 14 },
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
  pagos: {
    totalCobrado: 96000,
    cobradoPorForma: { EFECTIVO: 40000, TRANSFERENCIA: 38000, DEBITO: 18000 },
    totalAdeudado: 296000.5,
  },
}

const ENCABEZADO = {
  centro: DATOS_CENTRO,
  logo: createElement(LogoCentroPdf),
  emitidoPor: 'Ricardo Gerente',
  fechaEmision: '02/10/2026 11:30',
}

function renderizar(cambios: Partial<Tablero> = {}) {
  return renderizarTableroPdf({ tablero: { ...TABLERO, ...cambios }, ...ENCABEZADO })
}

describe('renderizarTableroPdf (General)', { timeout: 60_000 }, () => {
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
        asistio: { cantidad: 0, porcentaje: 0 },
        noAsistio: { cantidad: 0, porcentaje: 0 },
      },
      ocupacion: { turnos: 0, capacidad: 0, porcentaje: 0 },
      alumnos: { nuevos: 0, atendidos: 0 },
      materiasConMasDemanda: [],
      profesoresConMasTurnos: [],
      pagos: {
        totalCobrado: 0,
        cobradoPorForma: { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0 },
        totalAdeudado: 0,
      },
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

  it('con montos y cantidades grandes, y con toda la asistencia en una de las dos partes, sale en una hoja', async () => {
    const pdf = await renderizar({
      turnos: {
        ...TABLERO.turnos,
        total: 12345,
        asistio: { cantidad: 9876, porcentaje: 100 },
        noAsistio: { cantidad: 0, porcentaje: 0 },
      },
      alumnos: { nuevos: 1234, atendidos: 5678 },
      pagos: {
        totalCobrado: 99_999_999.99,
        cobradoPorForma: { EFECTIVO: 99_999_999.99, TRANSFERENCIA: 0, DEBITO: 0 },
        totalAdeudado: 12_345_678.9,
      },
    })

    expect(contarPaginas(pdf)).toBe(1)
  })
})

const ASISTENCIA: TableroAsistenciaCompleta = {
  periodo: { desde: '2026-09-28', hasta: '2026-10-04' },
  hoy: '2026-10-02',
  resumen: {
    porcentajeAsistencia: 85,
    cerradosSinRegistrar: 5,
    profesoresSinRegistrar: 2,
    alumnosBajoElUmbral: 3,
  },
  profesores: [
    {
      profesor: { id: 5, nombre: 'Luis', apellido: 'Pérez' },
      clasesRealizadas: 6,
      ausencias: 1,
      porcentajeAsistencia: 85.7,
      cerradosSinRegistrar: 3,
      dentroDelPlazo: 1,
      porcentajeSinRegistrar: 27.3,
      noRegistraAsistencia: true,
    },
    {
      profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
      clasesRealizadas: 6,
      ausencias: 1,
      porcentajeAsistencia: 85.7,
      cerradosSinRegistrar: 0,
      dentroDelPlazo: 2,
      porcentajeSinRegistrar: 0,
      noRegistraAsistencia: false,
    },
  ],
  materias: [
    {
      materia: { id: 2, nombre: 'Matemática' },
      clasesRealizadas: 8,
      ausencias: 1,
      porcentajeAsistencia: 88.9,
      cerradosSinRegistrar: 3,
      dentroDelPlazo: 1,
      porcentajeSinRegistrar: 23.1,
    },
  ],
}

/** Una tabla de `filas` filas: cada una con su profesor y su materia. */
function conFilas(filas: number): TableroAsistenciaCompleta {
  return {
    ...ASISTENCIA,
    profesores: Array.from({ length: filas }, (_, i) => ({
      ...(ASISTENCIA.profesores[i % 2] as TableroAsistenciaCompleta['profesores'][number]),
      profesor: { id: i + 1, nombre: `Nombre${i}`, apellido: `Apellido${i}` },
    })),
    materias: Array.from({ length: filas }, (_, i) => ({
      ...(ASISTENCIA.materias[0] as TableroAsistenciaCompleta['materias'][number]),
      materia: { id: i + 1, nombre: `Materia ${i}` },
    })),
  }
}

const renderizarAsistencia = (tablero: TableroAsistenciaCompleta) =>
  renderizarTableroAsistenciaPdf({ tablero, ...ENCABEZADO })

describe('renderizarTableroAsistenciaPdf (Asistencia)', { timeout: 60_000 }, () => {
  it('devuelve un PDF con el título según el período y el centro como autor', async () => {
    const pdf = await renderizarAsistencia(ASISTENCIA)

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(metadato(pdf, 'Title')).toBe('Asistencia semanal')
    expect(metadato(pdf, 'Author')).toBe('Nexo Académico')
    expect(idioma(pdf)).toBe('es')
    expect(contarPaginas(pdf)).toBe(1)
  })

  it('el título cambia con el tipo de período', async () => {
    const diario = await renderizarAsistencia({
      ...ASISTENCIA,
      periodo: { desde: '2026-10-02', hasta: '2026-10-02' },
    })
    const otro = await renderizarAsistencia({
      ...ASISTENCIA,
      periodo: { desde: '2026-10-02', hasta: '2026-10-20' },
    })

    expect(metadato(diario, 'Title')).toBe('Asistencia diaria')
    expect(metadato(otro, 'Title')).toBe('Asistencia del período')
  })

  it('un período sin nada (resumen en 0 y las dos tablas vacías) también sale, en una hoja', async () => {
    const pdf = await renderizarAsistencia({
      ...ASISTENCIA,
      resumen: {
        porcentajeAsistencia: 0,
        cerradosSinRegistrar: 0,
        profesoresSinRegistrar: 0,
        alumnosBajoElUmbral: 0,
      },
      profesores: [],
      materias: [],
    })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
  })

  it('las tablas salen completas: con más filas de las que caben en una página ocupa más hojas', async () => {
    // Una pantalla pagina de a 10; el documento no. 45 profesores y 45 materias no entran en una
    // hoja ni en dos: si el PDF se quedara con la primera página de la tabla, saldría una sola.
    const chico = await renderizarAsistencia(conFilas(10))
    const grande = await renderizarAsistencia(conFilas(45))
    const aunMasGrande = await renderizarAsistencia(conFilas(90))

    expect(contarPaginas(chico)).toBeLessThanOrEqual(2)
    expect(contarPaginas(grande)).toBeGreaterThanOrEqual(3)
    expect(contarPaginas(aunMasGrande)).toBeGreaterThan(contarPaginas(grande))
  })

  it('nombres largos de profesor y de materia no rompen el documento', async () => {
    const pdf = await renderizarAsistencia({
      ...ASISTENCIA,
      profesores: [
        {
          ...(ASISTENCIA.profesores[0] as TableroAsistenciaCompleta['profesores'][number]),
          profesor: {
            id: 1,
            nombre: 'María de los Ángeles Concepción',
            apellido: 'Fernández de la Vega y Rodríguez',
          },
        },
      ],
      materias: [
        {
          ...(ASISTENCIA.materias[0] as TableroAsistenciaCompleta['materias'][number]),
          materia: { id: 1, nombre: 'Introducción al Análisis Matemático y Álgebra Lineal' },
        },
      ],
    })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
