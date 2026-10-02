import { describe, expect, it } from 'vitest'
import { nombreArchivoPdf } from '@/server/shared/pdf/respuesta'
import {
  nombreArchivoTurno,
  nombreArchivoTurnosDelAlumno,
  type TurnosDelAlumnoDocumento,
} from '../ocurrencias.documentos'
import { textoRangoDeTurnos } from '../ocurrencias.pdf'
import { claveDeSeleccion, filtrarParaDocumento } from '../ocurrencias.reglas'
import {
  MAX_SELECCION,
  MENSAJE_SELECCION_EXCEDIDA,
  MENSAJE_SELECCION_FORMATO,
  MENSAJE_SELECCION_REPETIDA,
  turnosDelAlumnoPdfQuerySchema,
} from '../ocurrencias.validation'

// Qué turnos van en el PDF de los turnos de un alumno (selección, estado o todos), la validación
// de `seleccion` y los textos y nombres de archivo de los documentos de `ocurrencias`.

const turnos = [
  { turnoId: 1, fecha: '2026-10-05', estado: 'SIN_REGISTRAR' },
  { turnoId: 1, fecha: '2026-10-12', estado: 'AGENDADO' },
  { turnoId: 2, fecha: '2026-10-13', estado: 'CANCELADO' },
  { turnoId: 2, fecha: '2026-10-20', estado: 'AGENDADO' },
] as const

const claves = (lista: readonly { turnoId: number; fecha: string }[]) => lista.map(claveDeSeleccion)

describe('filtrarParaDocumento', () => {
  it('sin selección ni estado, todos, en el mismo orden', () => {
    expect(filtrarParaDocumento(turnos, {})).toEqual(turnos)
  })

  it('con estado, sólo los de ese estado', () => {
    expect(claves(filtrarParaDocumento(turnos, { estado: 'AGENDADO' }))).toEqual([
      '1:2026-10-12',
      '2:2026-10-20',
    ])
    expect(claves(filtrarParaDocumento(turnos, { estado: 'CANCELADO' }))).toEqual(['2:2026-10-13'])
  })

  it('con selección, sólo esos, en el orden de la lista y no en el de la selección', () => {
    const seleccion = ['2:2026-10-20', '1:2026-10-05']
    expect(claves(filtrarParaDocumento(turnos, { seleccion }))).toEqual([
      '1:2026-10-05',
      '2:2026-10-20',
    ])
  })

  it('con selección se ignora el estado: una selección explícita ya dice qué imprimir', () => {
    const seleccion = ['2:2026-10-13', '1:2026-10-12']
    expect(claves(filtrarParaDocumento(turnos, { seleccion, estado: 'AGENDADO' }))).toEqual([
      '1:2026-10-12',
      '2:2026-10-13',
    ])
  })

  it('una clave que no está en el rango no agrega nada', () => {
    const seleccion = ['1:2026-10-12', '1:2026-11-02', '99:2026-10-12']
    expect(claves(filtrarParaDocumento(turnos, { seleccion }))).toEqual(['1:2026-10-12'])
    expect(filtrarParaDocumento(turnos, { seleccion: ['99:2026-10-12'] })).toEqual([])
  })

  it('sin turnos, vacío con cualquier filtro', () => {
    expect(filtrarParaDocumento([], {})).toEqual([])
    expect(filtrarParaDocumento([], { estado: 'AGENDADO' })).toEqual([])
    expect(filtrarParaDocumento([], { seleccion: ['1:2026-10-12'] })).toEqual([])
  })

  it('no modifica la lista que recibe', () => {
    const copia = [...turnos]
    expect(filtrarParaDocumento(copia, {})).not.toBe(copia)
  })
})

describe('`seleccion` del query del PDF', () => {
  const parsear = (seleccion: string) =>
    turnosDelAlumnoPdfQuerySchema.safeParse({ alumnoId: '12', seleccion })

  function mensajeDe(seleccion: string) {
    const resultado = parsear(seleccion)
    if (resultado.success) return null
    expect(resultado.error.issues.map((issue) => issue.path)).toEqual([['seleccion']])
    return resultado.error.issues[0]?.message
  }

  it('una lista válida sale como sus claves', () => {
    const resultado = parsear('31:2026-09-28,31:2026-10-05,7:2026-10-05')
    expect(resultado.success && resultado.data.seleccion).toEqual([
      '31:2026-09-28',
      '31:2026-10-05',
      '7:2026-10-05',
    ])
  })

  it('sin `seleccion`, queda sin definir (no es una selección vacía)', () => {
    const resultado = turnosDelAlumnoPdfQuerySchema.safeParse({ alumnoId: '12' })
    expect(resultado.success && resultado.data.seleccion).toBeUndefined()
  })

  it.each([
    ['vacía', ''],
    ['sin fecha', '31'],
    ['con otro separador', '31-2026-09-28'],
    ['id que no es un entero positivo', '0:2026-09-28'],
    ['id con ceros a la izquierda', '031:2026-09-28'],
    ['id negativo', '-3:2026-09-28'],
    ['fecha con otro formato', '31:28/09/2026'],
    ['fecha inexistente', '31:2026-02-30'],
    ['con espacios', '31:2026-09-28, 32:2026-09-28'],
    ['coma de más', '31:2026-09-28,'],
    ['una parte de más', '31:2026-09-28:1'],
  ])('%s → error de formato en `seleccion`', (_caso, seleccion) => {
    expect(mensajeDe(seleccion)).toBe(MENSAJE_SELECCION_FORMATO)
  })

  it('un turno repetido → error en `seleccion`', () => {
    expect(mensajeDe('31:2026-09-28,7:2026-09-28,31:2026-09-28')).toBe(MENSAJE_SELECCION_REPETIDA)
  })

  it(`hasta ${MAX_SELECCION} claves; una más → error en \`seleccion\``, () => {
    const lista = (cantidad: number) =>
      Array.from({ length: cantidad }, (_, i) => `${i + 1}:2026-09-28`).join(',')

    expect(parsear(lista(MAX_SELECCION)).success).toBe(true)
    expect(mensajeDe(lista(MAX_SELECCION + 1))).toBe(MENSAJE_SELECCION_EXCEDIDA)
  })

  it('`estado` sólo acepta los estados de una ocurrencia', () => {
    const parsearEstado = (estado: string) =>
      turnosDelAlumnoPdfQuerySchema.safeParse({ alumnoId: '12', estado }).success

    expect(['AGENDADO', 'CANCELADO', 'SIN_REGISTRAR'].map(parsearEstado)).toEqual([
      true,
      true,
      true,
    ])
    expect(parsearEstado('PAGADO')).toBe(false)
  })
})

describe('textoRangoDeTurnos', () => {
  const documento: TurnosDelAlumnoDocumento = {
    alumno: { nombre: 'Joaquín', apellido: 'Alderete', dni: '36090692' },
    desde: '2026-10-01',
    hasta: '2026-10-31',
    porSeleccion: false,
    estado: null,
    turnos: [],
  }

  it('sin filtro, sólo el rango', () => {
    expect(textoRangoDeTurnos(documento)).toBe('01/10 – 31/10')
  })

  it('con estado, lo dice con su etiqueta', () => {
    expect(textoRangoDeTurnos({ ...documento, estado: 'SIN_REGISTRAR' })).toBe(
      '01/10 – 31/10 · Estado: Sin registrar',
    )
  })

  it('con selección, dice cuántos turnos quedaron', () => {
    expect(textoRangoDeTurnos({ ...documento, porSeleccion: true })).toBe(
      '01/10 – 31/10 · Selección (0)',
    )
  })
})

describe('nombres de archivo', () => {
  it('turno: fecha, apellido y nombre del alumno', () => {
    const nombre = nombreArchivoTurno({
      fecha: '2026-10-01',
      alumno: { nombre: 'Renata', apellido: 'Colque' },
    })
    expect(nombre).toBe('turno-2026-10-01-Colque-Renata')
    expect(nombreArchivoPdf(nombre)).toBe('turno-2026-10-01-colque-renata')
  })

  it('turnos del alumno: apellido, nombre y el rango, ya saneado sin tildes ni espacios', () => {
    const nombre = nombreArchivoTurnosDelAlumno({
      alumno: { nombre: 'María José', apellido: 'Núñez Peña', dni: '1' },
      desde: '2026-10-01',
      hasta: '2026-10-31',
    })
    expect(nombreArchivoPdf(nombre)).toBe('turnos-nunez-pena-maria-jose-2026-10-01_2026-10-31')
  })
})
