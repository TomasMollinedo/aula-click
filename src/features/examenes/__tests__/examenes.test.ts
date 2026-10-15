import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import { interpretarErrorExamen, interpretarErrorNota, mensajeErrorAccion } from '../errores-api'
import {
  MENSAJE_FECHA_OBLIGATORIA,
  MENSAJE_MATERIA_OBLIGATORIA,
  MENSAJE_TIPO_OBLIGATORIO,
  OBSERVACIONES_MAX,
  MENSAJE_NOTA_FORMATO,
  MENSAJE_NOTA_OBLIGATORIA,
  aBodyCrear,
  aBodyEditar,
  aBodyNota,
  notaFormSchema,
  valoresInicialesNota,
  examenFormSchema,
  valoresIniciales,
} from '../examenes.schema'
import type { ExamenItem } from '../examenes.types'
import {
  leerPaginaPasados,
  paginar,
  paramsConPaginaPasados,
  textoMostrando,
} from '../pagina-pasados'
import {
  esFechaPasada,
  etiquetaTipo,
  fechaExamen,
  resumenExamen,
  textoCargadoPor,
  textoDiasRestantes,
  textoModificadoPor,
  textoNota,
  textoNotaCargadaPor,
  textoNotaModificadaPor,
  textoRendidosSinNota,
  tramoNota,
} from '../formato-examenes'

const examen: ExamenItem = {
  id: 5,
  materia: { id: 3, nombre: 'Matemática' },
  fecha: '2026-10-15',
  tipo: 'PARCIAL',
  observaciones: 'Trae calculadora',
  pasado: false,
  diasRestantes: 10,
  administrable: true,
  createdAt: '2026-09-22T13:45:00.000Z',
  updatedAt: '2026-09-22T13:45:00.000Z',
  createdBy: { id: 'usr_prof_01', nombre: 'Luis', apellido: 'Gómez', role: 'PROFESOR' },
  updatedBy: { id: 'usr_prof_01', nombre: 'Luis', apellido: 'Gómez', role: 'PROFESOR' },
  cargarNota: false,
  resultado: null,
  nota: null,
  notaCreatedAt: null,
  notaUpdatedAt: null,
  notaCreatedBy: null,
  notaUpdatedBy: null,
}

describe('examenFormSchema', () => {
  const valido = { materiaId: '3', fecha: '2026-10-15', tipo: 'PARCIAL', observaciones: '' }

  it('acepta materia, fecha y tipo, sin observaciones', () => {
    expect(examenFormSchema.safeParse(valido).success).toBe(true)
  })

  it('acepta una fecha pasada: es solo un aviso', () => {
    expect(examenFormSchema.safeParse({ ...valido, fecha: '2020-01-01' }).success).toBe(true)
  })

  it('exige materia, fecha y tipo', () => {
    const resultado = examenFormSchema.safeParse(valoresIniciales())
    expect(resultado.success).toBe(false)
    const mensajes = resultado.error?.issues.map((i) => i.message)
    expect(mensajes).toEqual(
      expect.arrayContaining([
        MENSAJE_MATERIA_OBLIGATORIA,
        MENSAJE_FECHA_OBLIGATORIA,
        MENSAJE_TIPO_OBLIGATORIO,
      ]),
    )
  })

  it('rechaza una fecha que no existe', () => {
    expect(examenFormSchema.safeParse({ ...valido, fecha: '2026-02-30' }).success).toBe(false)
  })

  it(`rechaza observaciones de más de ${OBSERVACIONES_MAX} caracteres`, () => {
    const largas = 'a'.repeat(OBSERVACIONES_MAX + 1)
    expect(examenFormSchema.safeParse({ ...valido, observaciones: largas }).success).toBe(false)
    expect(examenFormSchema.safeParse({ ...valido, observaciones: largas.slice(1) }).success).toBe(
      true,
    )
  })
})

describe('bodies del alta y la edición', () => {
  const valores = {
    materiaId: '3',
    fecha: '2026-10-15',
    tipo: 'PARCIAL',
    observaciones: 'Trae calculadora',
  } as const

  it('valoresIniciales: vacío en el alta, los del examen en la edición', () => {
    expect(valoresIniciales()).toEqual({ materiaId: '', fecha: '', tipo: '', observaciones: '' })
    expect(valoresIniciales(examen)).toEqual(valores)
    expect(valoresIniciales({ ...examen, observaciones: null }).observaciones).toBe('')
  })

  it('aBodyCrear: materia como número y observaciones recortadas', () => {
    expect(aBodyCrear(12, { ...valores, observaciones: '  Trae calculadora ' })).toEqual({
      alumnoId: 12,
      materiaId: 3,
      fecha: '2026-10-15',
      tipo: 'PARCIAL',
      observaciones: 'Trae calculadora',
    })
  })

  it('aBodyCrear: sin observaciones no manda el campo', () => {
    expect(aBodyCrear(12, { ...valores, observaciones: '   ' })).not.toHaveProperty('observaciones')
  })

  it('aBodyEditar: null si no cambió nada', () => {
    expect(aBodyEditar(examen, valores)).toBeNull()
  })

  it('aBodyEditar: manda solo lo que cambió', () => {
    expect(aBodyEditar(examen, { ...valores, fecha: '2026-10-20' })).toEqual({
      fecha: '2026-10-20',
    })
    expect(aBodyEditar(examen, { ...valores, materiaId: '4', tipo: 'FINAL' })).toEqual({
      materiaId: 4,
      tipo: 'FINAL',
    })
  })

  it("aBodyEditar: las observaciones vaciadas viajan como ''", () => {
    expect(aBodyEditar(examen, { ...valores, observaciones: ' ' })).toEqual({ observaciones: '' })
  })
})

describe('formato', () => {
  it('textoDiasRestantes: hoy, mañana y en N días', () => {
    expect(textoDiasRestantes(0)).toBe('hoy')
    expect(textoDiasRestantes(1)).toBe('mañana')
    expect(textoDiasRestantes(5)).toBe('en 5 días')
  })

  it('etiquetaTipo, fechaExamen y resumenExamen', () => {
    expect(etiquetaTipo('TRABAJO_PRACTICO')).toBe('Trabajo práctico')
    expect(fechaExamen('2026-10-15')).toBe('jueves 15/10/2026')
    expect(resumenExamen({ tipo: 'PARCIAL', fecha: '2026-10-15' })).toBe(
      'Parcial del jueves 15/10/2026',
    )
  })

  it('textoCargadoPor: nombre, rol y el instante', () => {
    expect(textoCargadoPor(examen)).toMatch(
      /^Cargado por Luis Gómez \(Profesor\) el \d{2}\/09\/2026, \d{2}:\d{2}$/,
    )
    expect(
      textoCargadoPor({
        ...examen,
        createdBy: { id: 'u', nombre: 'Ana', apellido: 'Ruiz', role: 'MESA_ENTRADAS' },
      }),
    ).toContain('Ana Ruiz (Mesa de entradas)')
    expect(textoCargadoPor({ ...examen, createdBy: null })).toContain('Cargado por Sistema el')
  })

  it('textoModificadoPor: null si nunca se modificó', () => {
    expect(textoModificadoPor(examen)).toBeNull()
    expect(
      textoModificadoPor({
        ...examen,
        updatedAt: '2026-09-23T10:00:00.000Z',
        updatedBy: { id: 'u', nombre: 'Ana', apellido: 'Ruiz', role: 'MESA_ENTRADAS' },
      }),
    ).toMatch(/^Última modificación por Ana Ruiz \(Mesa de entradas\) el /)
  })

  it('esFechaPasada: solo antes de hoy, y nunca con una fecha incompleta', () => {
    expect(esFechaPasada('2026-09-30', '2026-10-01')).toBe(true)
    expect(esFechaPasada('2026-10-01', '2026-10-01')).toBe(false)
    expect(esFechaPasada('2026-10-02', '2026-10-01')).toBe(false)
    expect(esFechaPasada('', '2026-10-01')).toBe(false)
  })
})

describe('interpretarErrorExamen', () => {
  it('409 EXAMEN_PENDIENTE: trae el existente (details es un objeto)', () => {
    const existente = { id: 5, tipo: 'PARCIAL', fecha: '2026-10-15' }
    const error = new ApiError(409, 'EXAMEN_PENDIENTE', 'Ya hay un examen pendiente', existente)
    expect(interpretarErrorExamen(error)).toEqual({
      tipo: 'pendiente',
      mensaje: 'Ya hay un examen pendiente',
      existente,
    })
  })

  it('409 EXAMEN_PENDIENTE sin la forma esperada: mensaje general', () => {
    const error = new ApiError(409, 'EXAMEN_PENDIENTE', 'Ya hay un examen pendiente', [{ id: 5 }])
    expect(interpretarErrorExamen(error)).toEqual({
      tipo: 'general',
      mensaje: 'Ya hay un examen pendiente',
    })
  })

  it('409 MATERIA_INACTIVA: marca la materia', () => {
    const error = new ApiError(409, 'MATERIA_INACTIVA', 'La materia está inactiva', [
      { path: ['materiaId'], message: 'La materia está inactiva' },
    ])
    expect(interpretarErrorExamen(error)).toEqual({
      tipo: 'campos',
      camposMarcados: [{ campo: 'materiaId', mensaje: 'La materia está inactiva' }],
      mensaje: null,
    })
  })

  it('409 MATERIA_SIN_TURNOS: marca la materia', () => {
    const mensaje = 'El alumno no tiene turnos próximos de esa materia'
    const error = new ApiError(409, 'MATERIA_SIN_TURNOS', mensaje, [
      { path: ['materiaId'], message: mensaje },
    ])
    expect(interpretarErrorExamen(error)).toEqual({
      tipo: 'campos',
      camposMarcados: [{ campo: 'materiaId', mensaje }],
      mensaje: null,
    })
  })

  it('400 VALIDACION: por campo, y lo que no es de un campo va al mensaje', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['fecha'], message: 'Fecha inválida' },
      { path: ['alumnoId'], message: 'Debe ser mayor a 0' },
    ])
    expect(interpretarErrorExamen(error)).toEqual({
      tipo: 'campos',
      camposMarcados: [{ campo: 'fecha', mensaje: 'Fecha inválida' }],
      mensaje: 'Debe ser mayor a 0',
    })
  })

  it('403: texto propio, también al eliminar', () => {
    const error = new ApiError(403, 'SIN_PERMISO', 'No dicta esa materia a este alumno')
    const resultado = interpretarErrorExamen(error)
    expect(resultado.tipo).toBe('general')
    expect(resultado.mensaje).toContain('No tenés permiso')
    expect(mensajeErrorAccion(error)).toBe(resultado.mensaje)
  })

  it('otro error: el message de la API', () => {
    const error = new ApiError(404, 'NO_ENCONTRADO', 'Examen no encontrado')
    expect(interpretarErrorExamen(error)).toEqual({
      tipo: 'general',
      mensaje: 'Examen no encontrado',
    })
    expect(mensajeErrorAccion(error)).toBe('Examen no encontrado')
  })
})

describe('nota del examen (HU-34)', () => {
  const profesor = {
    id: 'usr_prof_01',
    nombre: 'Luis',
    apellido: 'Gómez',
    role: 'PROFESOR',
  } as const
  const mesa = { id: 'usr_mesa', nombre: 'Ana', apellido: 'Pérez', role: 'MESA_ENTRADAS' } as const

  it('el formulario acepta la nota con coma o punto y hasta dos decimales', () => {
    for (const nota of ['7', '7,5', '7,25', '10', '7.5']) {
      expect(notaFormSchema.safeParse({ resultado: 'CON_NOTA', nota }).success).toBe(true)
    }
    expect(notaFormSchema.safeParse({ resultado: 'AUSENTE', nota: '' }).success).toBe(true)
  })

  it('con nota, la exige y con formato: el rango lo valida la API', () => {
    const mensaje = (nota: string) =>
      notaFormSchema.safeParse({ resultado: 'CON_NOTA', nota }).error?.issues[0]?.message
    expect(mensaje('')).toBe(MENSAJE_NOTA_OBLIGATORIA)
    expect(mensaje('7,555')).toBe(MENSAJE_NOTA_FORMATO)
    expect(mensaje('siete')).toBe(MENSAJE_NOTA_FORMATO)
    // 11 tiene formato válido: el 400 del rango lo da la API.
    expect(notaFormSchema.safeParse({ resultado: 'CON_NOTA', nota: '11' }).success).toBe(true)
  })

  it('el body: la nota con coma pasa a número; un ausente, sin nota', () => {
    expect(aBodyNota({ resultado: 'CON_NOTA', nota: ' 7,5 ' })).toEqual({
      resultado: 'CON_NOTA',
      nota: 7.5,
    })
    expect(aBodyNota({ resultado: 'AUSENTE', nota: '8' })).toEqual({ resultado: 'AUSENTE' })
  })

  it('corregir abre con la nota que tiene, con coma', () => {
    expect(valoresInicialesNota({ resultado: 'CON_NOTA', nota: 7.25 })).toEqual({
      resultado: 'CON_NOTA',
      nota: '7,25',
    })
    expect(valoresInicialesNota({ resultado: null, nota: null })).toEqual({
      resultado: '',
      nota: '',
    })
  })

  it('la nota en la lista: la nota, "Ausente" o "Sin nota"', () => {
    expect(textoNota({ resultado: 'CON_NOTA', nota: 7.5 })).toBe('7,5')
    expect(textoNota({ resultado: 'AUSENTE', nota: null })).toBe('Ausente')
    expect(textoNota({ resultado: null, nota: null })).toBe('Sin nota')
  })

  it('la trazabilidad de la nota con el rol', () => {
    const conNota = {
      notaCreatedBy: profesor,
      notaCreatedAt: '2026-10-02T14:00:00.000Z',
      notaUpdatedBy: mesa,
      notaUpdatedAt: '2026-10-03T15:30:00.000Z',
    }
    expect(textoNotaCargadaPor(conNota)).toMatch(/^Nota cargada por Luis Gómez \(Profesor\) el /)
    expect(textoNotaModificadaPor(conNota)).toMatch(
      /^Nota modificada por Ana Pérez \(Mesa de entradas\) el /,
    )
    expect(textoNotaModificadaPor({ ...conNota, notaUpdatedAt: conNota.notaCreatedAt })).toBeNull()
    expect(textoNotaCargadaPor({ notaCreatedBy: null, notaCreatedAt: null })).toBeNull()
  })

  it('el aviso de rendidos sin nota', () => {
    expect(textoRendidosSinNota(2)).toBe('2 exámenes rendidos sin nota')
    expect(textoRendidosSinNota(1)).toBe('1 examen rendido sin nota')
    expect(textoRendidosSinNota(0)).toBeNull()
  })

  it('errores: el 400 del rango va en el campo; el 409 EXAMEN_FUTURO y el 403, como mensaje', () => {
    const rango = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['nota'], message: 'La nota tiene que ser de 1 a 10, con hasta dos decimales' },
    ])
    expect(interpretarErrorNota(rango)).toEqual({
      campos: [
        { campo: 'nota', mensaje: 'La nota tiene que ser de 1 a 10, con hasta dos decimales' },
      ],
      mensaje: null,
    })
    expect(
      interpretarErrorNota(new ApiError(409, 'EXAMEN_FUTURO', 'Un examen futuro no admite nota')),
    ).toEqual({ campos: [], mensaje: 'Un examen futuro no admite nota' })
    expect(interpretarErrorNota(new ApiError(403, 'SIN_PERMISO', 'x')).mensaje).toMatch(
      /^No tenés permiso para cargar esta nota/,
    )
  })
})

describe('tramoNota (color del badge, propuesta pendiente de las PO)', () => {
  it.each([
    [10, 'alta'],
    [7, 'alta'],
    [6.99, 'media'],
    [4, 'media'],
    [3.99, 'baja'],
    [1, 'baja'],
  ])('%s → %s', (nota, tramo) => {
    expect(tramoNota(nota)).toBe(tramo)
  })
})

describe('paginación de los pasados', () => {
  const lista = Array.from({ length: 23 }, (_, i) => i + 1)

  it('de a 10, con el total de páginas', () => {
    expect(paginar(lista, 1)).toEqual({ items: lista.slice(0, 10), page: 1, totalPages: 3 })
    expect(paginar(lista, 3)).toEqual({ items: [21, 22, 23], page: 3, totalPages: 3 })
  })

  it('una página fuera de rango cae en la última; sin ítems, una sola página vacía', () => {
    expect(paginar(lista, 9).page).toBe(3)
    expect(paginar([], 2)).toEqual({ items: [], page: 1, totalPages: 1 })
  })

  it('la página en la URL: inválida es la 1, la 1 no se escribe y el tab se conserva', () => {
    expect(leerPaginaPasados(new URLSearchParams('pagePasados=2'))).toBe(2)
    expect(leerPaginaPasados(new URLSearchParams('pagePasados=0'))).toBe(1)
    expect(leerPaginaPasados(new URLSearchParams('pagePasados=abc'))).toBe(1)
    const params = new URLSearchParams('tab=examenes&pagePasados=3')
    expect(paramsConPaginaPasados(params, 1).toString()).toBe('tab=examenes')
    expect(paramsConPaginaPasados(params, 2).toString()).toBe('tab=examenes&pagePasados=2')
  })
})

describe('pie de la paginación', () => {
  it('"Mostrando 1–10 de 28 exámenes", como los otros listados', () => {
    expect(textoMostrando(1, 28)).toBe('Mostrando 1–10 de 28 exámenes')
    expect(textoMostrando(3, 28)).toBe('Mostrando 21–28 de 28 exámenes')
    expect(textoMostrando(1, 1)).toBe('Mostrando 1–1 de 1 examen')
  })
})
