import { describe, expect, it } from 'vitest'
import { encabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import { contarPaginas, idioma, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import type { TurnosDelAlumnoDocumento } from '../ocurrencias.documentos'
import { renderizarTurnoPdf, renderizarTurnosDelAlumnoPdf } from '../ocurrencias.pdf'
import type { OcurrenciaDelAlumnoItem, OcurrenciaDetalle } from '../ocurrencias.validation'

// Los documentos PDF de `ocurrencias`, con un render real (fuentes y logo del repo). No se compara
// el dibujo: se comprueba que sale un PDF, cuántas hojas ocupa y sus metadatos.

const encabezado = encabezadoDeDocumento(
  { name: 'Laura', apellido: 'Gómez' },
  () => new Date('2026-10-02T13:56:00.000Z'),
)

function detalle(cambios: Partial<OcurrenciaDetalle> = {}): OcurrenciaDetalle {
  const usuario = { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' }
  return {
    turnoId: 31,
    fecha: '2026-10-01',
    alumno: { id: 12, nombre: 'Renata', apellido: 'Colque', dni: '52037631' },
    materia: { id: 3, nombre: 'Álgebra' },
    profesor: { id: 4, nombre: 'Nicolás', apellido: 'Villagrán' },
    aula: { id: 8, nombre: 'Aula 8' },
    horaInicio: '08:00',
    horaFin: '09:00',
    tipo: 'RECURRENTE',
    serie: { fechaInicio: '2026-09-03', fechaFin: '2026-10-08', finalizacion: null },
    estado: 'AGENDADO',
    observaciones: null,
    temas: 'Preparación del próximo examen',
    cancelacion: null,
    pago: null,
    prioridad: 'BAJA',
    examen: null,
    acciones: {
      cancelar: { visible: false, habilitada: false },
      finalizar: { visible: false },
      reprogramar: { visible: false },
      registrarPago: { visible: false },
    },
    createdAt: '2026-08-01T13:00:00.000Z',
    updatedAt: '2026-08-01T13:00:00.000Z',
    createdBy: usuario,
    updatedBy: usuario,
    ...cambios,
  }
}

function turnosDelAlumno(
  cantidad: number,
  cambios: Partial<TurnosDelAlumnoDocumento> = {},
): TurnosDelAlumnoDocumento {
  const turnos: OcurrenciaDelAlumnoItem[] = Array.from({ length: cantidad }, (_, i) => ({
    turnoId: 40 + i,
    fecha: '2026-10-06',
    diaSemana: 2,
    horaInicio: '16:00',
    horaFin: '17:00',
    profesor: { id: 5, nombre: 'Franco', apellido: 'Zerpa' },
    materia: { id: 7, nombre: 'Economía' },
    tipo: 'RECURRENTE',
    estado: i % 5 === 0 ? 'CANCELADO' : 'AGENDADO',
    estadoPago: 'PENDIENTE',
    prioridad: i % 5 === 0 ? null : 'BAJA',
    cancelable: true,
  }))
  return {
    alumno: { nombre: 'Joaquín', apellido: 'Alderete', dni: '36090692' },
    desde: '2026-10-01',
    hasta: '2026-10-31',
    porSeleccion: false,
    estado: null,
    turnos,
    ...cambios,
  }
}

describe('renderizarTurnoPdf', { timeout: 30_000 }, () => {
  it('un turno recurrente: un PDF de una hoja, con el título del documento', async () => {
    const pdf = await renderizarTurnoPdf({ turno: detalle(), ...encabezado })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Detalle del turno')
    expect(metadato(pdf, 'Author')).toBe('Nexo Académico')
    expect(idioma(pdf)).toBe('es')
  })

  it('una sesión única sin temas (sin período de la serie) también renderiza', async () => {
    const pdf = await renderizarTurnoPdf({
      turno: detalle({
        tipo: 'SESION_UNICA',
        serie: { fechaInicio: '2026-10-01', fechaFin: '2026-10-01', finalizacion: null },
        temas: null,
      }),
      ...encabezado,
    })
    expect(contarPaginas(pdf)).toBe(1)
  })

  it('un recurrente sin fin renderiza', async () => {
    const pdf = await renderizarTurnoPdf({
      turno: detalle({
        serie: { fechaInicio: '2026-09-03', fechaFin: null, finalizacion: null },
      }),
      ...encabezado,
    })
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})

describe('renderizarTurnosDelAlumnoPdf', { timeout: 60_000 }, () => {
  it('unos pocos turnos: un PDF de una hoja', async () => {
    const pdf = await renderizarTurnosDelAlumnoPdf({ documento: turnosDelAlumno(8), ...encabezado })

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Turnos del alumno')
  })

  it('un año de turnos ocupa varias hojas', async () => {
    const pdf = await renderizarTurnosDelAlumnoPdf({
      documento: turnosDelAlumno(150, { desde: '2026-01-01', hasta: '2026-12-31' }),
      ...encabezado,
    })
    expect(contarPaginas(pdf)).toBeGreaterThan(1)
  })

  it('sin turnos, renderiza el documento con el aviso', async () => {
    const pdf = await renderizarTurnosDelAlumnoPdf({
      documento: turnosDelAlumno(0, { estado: 'CANCELADO' }),
      ...encabezado,
    })
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
  })

  it('una selección renderiza', async () => {
    const pdf = await renderizarTurnosDelAlumnoPdf({
      documento: turnosDelAlumno(3, { porSeleccion: true }),
      ...encabezado,
    })
    expect(contarPaginas(pdf)).toBe(1)
  })
})
