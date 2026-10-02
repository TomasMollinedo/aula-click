import { describe, expect, it } from 'vitest'
import { PRIORIDADES } from '@/server/features/examenes/examenes.condiciones'
import {
  etiquetaEstado,
  etiquetaPrioridad,
  textoPeriodoSerie,
  textoTipo,
} from '../ocurrencias.condiciones'
import { ESTADOS_OCURRENCIA } from '../turnos.reglas'
import { TIPOS_TURNO } from '../turnos.validation'

// Los mismos strings que muestra el frontend (`ESTADO_TURNO` y `ETIQUETA_PRIORIDAD` de
// `src/components/turno/indicadores-turno.ts`, y la hoja del turno): si uno cambia, cambia el otro.
// Se importan de `ocurrencias.condiciones`, que es de donde los toman las otras features.

describe('etiquetaEstado', () => {
  it.each([
    ['AGENDADO', 'Agendado'],
    ['CANCELADO', 'Cancelado'],
    ['SIN_REGISTRAR', 'Sin registrar'],
  ] as const)('%s → %s', (estado, etiqueta) => {
    expect(etiquetaEstado(estado)).toBe(etiqueta)
  })

  it('todos los estados de una ocurrencia tienen etiqueta', () => {
    expect(ESTADOS_OCURRENCIA.map(etiquetaEstado).every(Boolean)).toBe(true)
  })
})

describe('etiquetaPrioridad', () => {
  it.each([
    ['ALTA', 'Alta'],
    ['MEDIA', 'Media'],
    ['BAJA', 'Baja'],
  ] as const)('%s → %s', (prioridad, etiqueta) => {
    expect(etiquetaPrioridad(prioridad)).toBe(etiqueta)
  })

  it('todas las prioridades de `examenes` tienen etiqueta', () => {
    expect(PRIORIDADES.map(etiquetaPrioridad).every(Boolean)).toBe(true)
  })
})

describe('textoTipo', () => {
  it('recurrente o sesión única', () => {
    expect(textoTipo('RECURRENTE')).toBe('Recurrente')
    expect(textoTipo('SESION_UNICA')).toBe('Sesión única')
    expect(TIPOS_TURNO.map(textoTipo)).toEqual(['Recurrente', 'Sesión única'])
  })
})

describe('textoPeriodoSerie', () => {
  it('con fecha de fin: las dos fechas, sin el año', () => {
    expect(textoPeriodoSerie({ fechaInicio: '2026-09-03', fechaFin: '2026-10-08' })).toBe(
      '03/09 – 08/10',
    )
  })

  it('sin fecha de fin: "sin fin"', () => {
    expect(textoPeriodoSerie({ fechaInicio: '2026-10-01', fechaFin: null })).toBe('01/10 – sin fin')
  })
})
