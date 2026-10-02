import { describe, expect, it } from 'vitest'
import { encabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import { contarPaginas, idioma, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import { nombreArchivoPdf } from '@/server/shared/pdf/respuesta'
import { nombreArchivoAgenda, type AgendaDocumento } from '../agendas.documentos'
import { renderizarAgendaPdf, textoFiltrosDeAgenda } from '../agendas.pdf'

// El PDF de la agenda diaria de un profesor, con un render real (fuentes y logo del repo). No se
// compara el dibujo: se comprueba que sale un PDF, cuántas hojas ocupa y sus metadatos.

const encabezado = encabezadoDeDocumento(
  { name: 'Laura', apellido: 'Gómez' },
  () => new Date('2026-10-02T13:57:00.000Z'),
)

function agenda(cantidad: number, cambios: Partial<AgendaDocumento> = {}): AgendaDocumento {
  return {
    fecha: '2026-10-02',
    profesor: { nombre: 'Bautista', apellido: 'Cornejo' },
    incluyeCancelados: false,
    prioridad: null,
    turnos: Array.from({ length: cantidad }, (_, i) => ({
      turnoId: 100 + i,
      fecha: '2026-10-02',
      horaInicio: `${String(8 + (i % 12)).padStart(2, '0')}:00`,
      horaFin: `${String(9 + (i % 12)).padStart(2, '0')}:00`,
      alumno: { nombre: 'Pilar', apellido: 'Alderete' },
      profesor: { nombre: 'Bautista', apellido: 'Cornejo' },
      materia: { nombre: 'Estadística' },
      aula: { nombre: 'Aula 4' },
      estado: i % 7 === 0 ? 'CANCELADO' : 'AGENDADO',
    })),
    ...cambios,
  }
}

describe('textoFiltrosDeAgenda', () => {
  const profesor = { nombre: 'Bautista', apellido: 'Cornejo' }

  it('sólo el profesor si no hay filtros', () => {
    expect(textoFiltrosDeAgenda({ profesor, incluyeCancelados: false, prioridad: null })).toBe(
      'Profesor: Bautista Cornejo',
    )
  })

  it('con cancelados y prioridad, en ese orden y separados por un punto medio', () => {
    expect(textoFiltrosDeAgenda({ profesor, incluyeCancelados: true, prioridad: 'ALTA' })).toBe(
      'Profesor: Bautista Cornejo · Incluye cancelados · Prioridad: Alta',
    )
    expect(textoFiltrosDeAgenda({ profesor, incluyeCancelados: false, prioridad: 'MEDIA' })).toBe(
      'Profesor: Bautista Cornejo · Prioridad: Media',
    )
  })
})

describe('nombreArchivoAgenda', () => {
  it('fecha, apellido y nombre del profesor; saneado, sin tildes ni espacios', () => {
    const nombre = nombreArchivoAgenda({
      fecha: '2026-10-02',
      profesor: { nombre: 'Nicolás', apellido: 'Villagrán Sosa' },
    })
    expect(nombreArchivoPdf(nombre)).toBe('agenda-2026-10-02-villagran-sosa-nicolas')
  })
})

describe('renderizarAgendaPdf', { timeout: 60_000 }, () => {
  it('unos pocos turnos: un PDF de una hoja, con el título del documento', async () => {
    const pdf = await renderizarAgendaPdf({ documento: agenda(3), ...encabezado })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Agenda')
    expect(metadato(pdf, 'Author')).toBe('Nexo Académico')
    expect(idioma(pdf)).toBe('es')
  })

  it('un día con muchos turnos ocupa varias hojas', async () => {
    const pdf = await renderizarAgendaPdf({
      documento: agenda(80, { incluyeCancelados: true, prioridad: 'ALTA' }),
      ...encabezado,
    })
    expect(contarPaginas(pdf)).toBeGreaterThan(1)
  })

  it('sin turnos, renderiza el documento con el aviso y el nombre del profesor', async () => {
    const pdf = await renderizarAgendaPdf({ documento: agenda(0), ...encabezado })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
  })
})
