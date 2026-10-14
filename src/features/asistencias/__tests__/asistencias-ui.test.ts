import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import { filaAsistenciaSchema, type FilaAsistenciaForm } from '../asistencias.schema'
import type { ClaseAsistencia, FilaAsistencia, HoraAsistencia } from '../asistencias.types'
import { mensajeErrorCarga, mensajeErrorRegistro } from '../errores-asistencias'
import { paramsDeFecha, parsearFechaAsistencia } from '../fecha-asistencia'
import { textoContador, textoHorarioFila, textoPendientes } from '../formato-asistencias'
import {
  esFilaSinRegistrar,
  registrosDeFila,
  registrosMarcarTodos,
  valoresIniciales,
} from '../registro-asistencia'

const HOY = '2026-10-14'

function hora(turnoId: number, inicio: string, asistencia: HoraAsistencia['asistencia'] = null) {
  const fin = `${String(Number(inicio.slice(0, 2)) + 1).padStart(2, '0')}:00`
  return {
    turnoId,
    fecha: HOY,
    horaInicio: inicio,
    horaFin: fin,
    estado: asistencia ? (asistencia.estado === 'PRESENTE' ? 'REALIZADO' : 'AUSENTE') : 'AGENDADO',
    asistencia,
  } satisfies HoraAsistencia
}

function fila(ocurrencias: HoraAsistencia[], alumnoId = 12): FilaAsistencia {
  return {
    alumno: { id: alumnoId, apellido: 'Pérez', nombre: 'Juan', fotoUrl: null },
    materia: { id: 3, nombre: 'Matemática' },
    temas: null,
    horaInicio: ocurrencias[0]?.horaInicio ?? '08:00',
    horaFin: ocurrencias.at(-1)?.horaFin ?? '09:00',
    horas: ocurrencias.length,
    ocurrencias,
    indicacionesAnteriores: null,
  }
}

const presente = (trabajado: string | null = null, indicaciones: string | null = null) => ({
  estado: 'PRESENTE' as const,
  trabajado,
  indicaciones,
  observacion: null,
})
const ausente = (observacion: string | null = null) => ({
  estado: 'AUSENTE' as const,
  trabajado: null,
  indicaciones: null,
  observacion,
})

const tresHoras = () => fila([hora(41, '08:00'), hora(42, '09:00'), hora(43, '10:00')])
const ocurrencias = (...ids: number[]) => ids.map((turnoId) => ({ turnoId, fecha: HOY }))

describe('fecha en la URL', () => {
  it.each([
    [null, HOY],
    ['2026-10-10', '2026-10-10'],
    ['2026-10-15', HOY],
    ['2026-02-30', HOY],
    ['ayer', HOY],
  ])('?fecha=%s → %s (sin fecha, inválida o futura: hoy)', (valor, esperado) => {
    expect(parsearFechaAsistencia(valor, HOY)).toBe(esperado)
  })

  it('hoy no se escribe y los demás parámetros se conservan', () => {
    const params = new URLSearchParams('fecha=2026-10-10&otro=1')
    expect(paramsDeFecha(params, HOY, HOY).toString()).toBe('otro=1')
    expect(paramsDeFecha(params, '2026-10-12', HOY).toString()).toBe('fecha=2026-10-12&otro=1')
  })
})

describe('textos', () => {
  it('el horario de una fila: "8:00 a 11:00 (3 h)"', () => {
    expect(textoHorarioFila('08:00', '11:00', 3)).toBe('8:00 a 11:00 (3 h)')
  })

  it('el aviso de pendientes con la fecha límite de la API', () => {
    expect(
      textoPendientes({ cantidad: 3, masAntiguo: { fecha: '2026-10-05', vence: '2026-10-12' } }),
    ).toBe(
      'Tenés 3 turnos sin registrar de días anteriores. El más antiguo se puede registrar hasta el 12/10',
    )
    expect(
      textoPendientes({ cantidad: 1, masAntiguo: { fecha: '2026-10-05', vence: '2026-10-12' } }),
    ).toBe('Tenés 1 turno sin registrar de días anteriores. Se puede registrar hasta el 12/10')
    expect(textoPendientes({ cantidad: 0, masAntiguo: null })).toBeNull()
  })

  it('el contador', () => {
    expect(textoContador('hola', 1000)).toBe('4/1000')
  })
})

describe('registrosDeFila', () => {
  const base: FilaAsistenciaForm = {
    estado: 'PRESENTE',
    trabajado: 'Despeje',
    indicaciones: 'Repasar',
    observacion: '',
    ajustarPorHora: false,
    porHora: [
      { estado: null, observacion: '' },
      { estado: null, observacion: '' },
      { estado: null, observacion: '' },
    ],
  }

  it('un alumno de tres horas: un solo registro con las tres y los mismos textos', () => {
    expect(registrosDeFila(tresHoras(), base)).toEqual([
      {
        ocurrencias: ocurrencias(41, 42, 43),
        estado: 'PRESENTE',
        trabajado: 'Despeje',
        indicaciones: 'Repasar',
      },
    ])
  })

  it('ausente: sólo la observación', () => {
    expect(
      registrosDeFila(tresHoras(), { ...base, estado: 'AUSENTE', observacion: 'Enfermo' }),
    ).toEqual([{ ocurrencias: ocurrencias(41, 42, 43), estado: 'AUSENTE', observacion: 'Enfermo' }])
  })

  it('ajustar por hora (se retiró después de la primera): un registro por hora', () => {
    const valores: FilaAsistenciaForm = {
      ...base,
      ajustarPorHora: true,
      porHora: [
        { estado: 'PRESENTE', observacion: '' },
        { estado: 'AUSENTE', observacion: 'Se retiró' },
        { estado: 'AUSENTE', observacion: 'Se retiró' },
      ],
    }

    expect(registrosDeFila(tresHoras(), valores)).toEqual([
      {
        ocurrencias: ocurrencias(41),
        estado: 'PRESENTE',
        trabajado: 'Despeje',
        indicaciones: 'Repasar',
      },
      { ocurrencias: ocurrencias(42), estado: 'AUSENTE', observacion: 'Se retiró' },
      { ocurrencias: ocurrencias(43), estado: 'AUSENTE', observacion: 'Se retiró' },
    ])
  })
})

describe('valoresIniciales (corregir)', () => {
  it('sin registrar: sin estado, textos vacíos', () => {
    expect(valoresIniciales(tresHoras())).toMatchObject({
      estado: null,
      trabajado: '',
      ajustarPorHora: false,
    })
  })

  it('todas iguales: el estado y los textos de la fila', () => {
    const f = fila([
      hora(41, '08:00', presente('Despeje', 'Repasar')),
      hora(42, '09:00', presente('Despeje', 'Repasar')),
    ])
    expect(valoresIniciales(f)).toMatchObject({
      estado: 'PRESENTE',
      trabajado: 'Despeje',
      indicaciones: 'Repasar',
      ajustarPorHora: false,
    })
  })

  it('estados distintos: abre ajustado por hora, con la observación de cada ausente', () => {
    const f = fila([
      hora(41, '08:00', presente('Despeje')),
      hora(42, '09:00', ausente('Se retiró')),
    ])
    expect(valoresIniciales(f)).toEqual({
      estado: null,
      trabajado: 'Despeje',
      indicaciones: '',
      observacion: 'Se retiró',
      ajustarPorHora: true,
      porHora: [
        { estado: 'PRESENTE', observacion: '' },
        { estado: 'AUSENTE', observacion: 'Se retiró' },
      ],
    })
  })
})

describe('registrosMarcarTodos', () => {
  it('un PRESENTE por cada fila sin registrar; las registradas no se mandan', () => {
    const clase: ClaseAsistencia = {
      bloqueAgendaId: 7,
      horaInicio: '08:00',
      horaFin: '09:00',
      aula: { id: 1, nombre: 'Aula 1' },
      filas: [
        fila([hora(41, '08:00'), hora(42, '09:00')], 12),
        fila([hora(51, '08:00', ausente())], 20),
        fila([hora(61, '08:00')], 21),
      ],
    }

    expect(registrosMarcarTodos(clase)).toEqual([
      { ocurrencias: ocurrencias(41, 42), estado: 'PRESENTE' },
      { ocurrencias: ocurrencias(61), estado: 'PRESENTE' },
    ])
    expect(esFilaSinRegistrar(clase.filas[1] as FilaAsistencia)).toBe(false)
  })
})

describe('schema del formulario de una fila', () => {
  const valores = (parcial: Partial<FilaAsistenciaForm>): FilaAsistenciaForm => ({
    estado: 'PRESENTE',
    trabajado: '',
    indicaciones: '',
    observacion: '',
    ajustarPorHora: false,
    porHora: [{ estado: null, observacion: '' }],
    ...parcial,
  })

  it('exige elegir Presente o Ausente (de la fila, o de cada hora al ajustar)', () => {
    expect(filaAsistenciaSchema.safeParse(valores({ estado: null })).success).toBe(false)
    expect(filaAsistenciaSchema.safeParse(valores({ ajustarPorHora: true })).success).toBe(false)
  })

  it('los largos: 1000 para los textos de presente y 500 para la observación', () => {
    const largo = (n: number) => 'x'.repeat(n)
    expect(filaAsistenciaSchema.safeParse(valores({ trabajado: largo(1000) })).success).toBe(true)
    expect(filaAsistenciaSchema.safeParse(valores({ trabajado: largo(1001) })).success).toBe(false)
    expect(filaAsistenciaSchema.safeParse(valores({ observacion: largo(501) })).success).toBe(false)
  })
})

describe('errores', () => {
  it('los 409 de la API se muestran con su mensaje, en la fila', () => {
    const fuera = new ApiError(
      409,
      'FUERA_DE_PLAZO',
      'El plazo para registrar esta asistencia venció el 12/10',
    )
    expect(mensajeErrorRegistro(fuera)).toBe(
      'El plazo para registrar esta asistencia venció el 12/10',
    )
    expect(mensajeErrorRegistro(new ApiError(403, 'SIN_PERMISO', 'x'))).toBe(
      'No tenés permiso para registrar esta asistencia',
    )
  })

  it('la carga: 403 y 404 con su texto, el resto con el mensaje', () => {
    expect(mensajeErrorCarga(new ApiError(403, 'SIN_PERMISO', 'x'))).toBe(
      'No tenés permiso para ver la asistencia',
    )
    expect(mensajeErrorCarga(new ApiError(404, 'NO_ENCONTRADO', 'x'))).toBe(
      'Tu usuario no tiene ficha de profesor',
    )
    expect(mensajeErrorCarga(new ApiError(500, 'ERROR_INTERNO', 'Falló'))).toBe('Falló')
  })
})
