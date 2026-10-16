import { describe, expect, it } from 'vitest'
import { encabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import { contarPaginas, idioma, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import type { HistorialDocumento } from '../historiales.documentos'
import { renderizarHistorialPdf } from '../historiales.pdf'
import type { BloqueDelHistorial, GrupoDelHistorial } from '../historiales.validation'

// El documento PDF del historial académico (T-110), con un render real (fuentes y logo del repo).
// No se compara el dibujo: se comprueba que sale un PDF, cuántas hojas ocupa y sus metadatos.

const encabezado = encabezadoDeDocumento(
  { name: 'Laura', apellido: 'Gómez' },
  () => new Date('2026-10-15T13:56:00.000Z'),
)

/** Un bloque de dos horas seguidas, con sus textos una sola vez. */
function bloque(fecha: string, cambios: Partial<BloqueDelHistorial> = {}): BloqueDelHistorial {
  const hora = (turnoId: number, horaInicio: string, horaFin: string) => ({
    turnoId,
    fecha,
    horaInicio,
    horaFin,
    estado: 'REALIZADO' as const,
    plazoAsistencia: { vence: '2026-10-20', vencido: false },
    cerradaPorSistema: false,
    textosPropios: null,
    observacion: null,
    cancelacion: null,
  })
  return {
    fecha,
    horaInicio: '08:00',
    horaFin: '10:00',
    horas: 2,
    textos: {
      trabajado: 'Ecuaciones de primer grado',
      indicaciones: 'Practicar los ejercicios 4 a 10 de la guía',
    },
    clases: [
      hora(31, '08:00', '09:00'),
      {
        ...hora(32, '09:00', '10:00'),
        textosPropios: { trabajado: 'Repaso de la guía', indicaciones: null },
      },
    ],
    ...cambios,
  }
}

function grupo(bloques: BloqueDelHistorial[], cambios: Partial<GrupoDelHistorial> = {}) {
  return {
    materia: { id: 3, nombre: 'Matemática' },
    profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
    resumen: { realizadas: 3, ausencias: 1, porcentaje: 75 },
    bloques,
    ...cambios,
  }
}

function documento(cambios: Partial<HistorialDocumento> = {}): HistorialDocumento {
  return {
    alumno: {
      nombre: 'Lucía',
      apellido: 'González',
      dni: '40123456',
      nivelEscolaridad: 'SECUNDARIO',
    },
    mes: '2026-10',
    desde: '2026-10-01',
    hasta: '2026-10-31',
    filtros: { materiaId: null, profesorId: null, materia: null, profesor: null },
    grupos: [
      grupo([bloque('2026-10-13'), bloque('2026-10-06')]),
      grupo([bloque('2026-10-07')], {
        materia: { id: 7, nombre: 'Álgebra' },
        profesor: { id: 5, nombre: 'Nicolás', apellido: 'Villagrán' },
        resumen: { realizadas: 1, ausencias: 2, porcentaje: 33.3 },
      }),
    ],
    cancelados: [
      {
        turnoId: 40,
        fecha: '2026-10-09',
        horaInicio: '16:00',
        horaFin: '17:00',
        materia: 'Matemática',
        profesor: { nombre: 'Ana', apellido: 'Pérez' },
        motivo: 'CANCELACION_ALUMNO',
        detalle: 'Viaje familiar',
      },
    ],
    examenes: [
      {
        id: 7,
        materiaId: 3,
        materiaNombre: 'Matemática',
        fecha: '2026-10-20',
        tipo: 'PARCIAL',
        resultado: 'CON_NOTA',
        nota: 7.5,
      },
      {
        id: 8,
        materiaId: 7,
        materiaNombre: 'Álgebra',
        fecha: '2026-10-22',
        tipo: 'TRABAJO_PRACTICO',
        resultado: null,
        nota: null,
      },
    ],
    ...cambios,
  }
}

describe('renderizarHistorialPdf', { timeout: 60_000 }, () => {
  it('un mes corto: un PDF de una hoja, con el título del documento y los metadatos', async () => {
    const pdf = await renderizarHistorialPdf({
      documento: documento({
        grupos: [grupo([bloque('2026-10-13')])],
        cancelados: [],
        examenes: [],
      }),
      ...encabezado,
    })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Historial académico 01/10/2026 al 31/10/2026')
    expect(metadato(pdf, 'Author')).toBe('Nexo Académico')
    expect(idioma(pdf)).toBe('es')
  })

  it('un período que no es un mes se rotula "Período" y renderiza', async () => {
    const pdf = await renderizarHistorialPdf({
      documento: documento({ mes: null, desde: '2026-09-05', hasta: '2026-10-12' }),
      ...encabezado,
    })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(metadato(pdf, 'Title')).toBe('Historial académico 05/09/2026 al 12/10/2026')
  })

  it('un mes con dos materias, cancelados y exámenes renderiza todo el documento', async () => {
    const pdf = await renderizarHistorialPdf({ documento: documento(), ...encabezado })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBeGreaterThanOrEqual(1)
  })

  it('un mes sin clases renderiza el aviso, en una hoja', async () => {
    const pdf = await renderizarHistorialPdf({
      documento: documento({ grupos: [], cancelados: [], examenes: [] }),
      ...encabezado,
    })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
  })

  it('un mes con muchas clases ocupa varias hojas', async () => {
    const bloques = Array.from({ length: 40 }, (_, i) =>
      bloque(`2026-10-${String((i % 28) + 1).padStart(2, '0')}`),
    )
    const pdf = await renderizarHistorialPdf({
      documento: documento({ grupos: [grupo(bloques)] }),
      ...encabezado,
    })

    expect(contarPaginas(pdf)).toBeGreaterThan(1)
  })

  it('con filtros, sin nivel de escolaridad y con una hora cerrada por el sistema, renderiza', async () => {
    const cerrada = bloque('2026-10-13', {
      textos: null,
      clases: [
        {
          turnoId: 33,
          fecha: '2026-10-13',
          horaInicio: '08:00',
          horaFin: '09:00',
          estado: 'SIN_REGISTRAR',
          plazoAsistencia: { vence: '2026-10-20', vencido: true },
          cerradaPorSistema: true,
          textosPropios: null,
          observacion: null,
          cancelacion: null,
        },
      ],
      horas: 1,
      horaFin: '09:00',
    })
    const pdf = await renderizarHistorialPdf({
      documento: documento({
        alumno: {
          nombre: 'Lucía',
          apellido: 'González',
          dni: '40123456',
          nivelEscolaridad: null,
        },
        filtros: {
          materiaId: 3,
          profesorId: 4,
          materia: 'Matemática',
          profesor: { nombre: 'Ana', apellido: 'Pérez' },
        },
        grupos: [grupo([cerrada])],
        cancelados: [],
      }),
      ...encabezado,
    })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
  })
})
