import { describe, expect, it } from 'vitest'

import {
  agruparHorario,
  etiquetaProximaFecha,
  horaCorta,
  OPCIONES_HORA_FIN,
  OPCIONES_HORA_INICIO,
  rangoHoras,
  unaHoraDespues,
} from '../horario'
import type { BloqueHorario } from '../profesores.types'

const AULA_3 = { id: 3, nombre: 'Aula 3' }
const AULA_5 = { id: 5, nombre: 'Aula 5' }

function fila(
  id: number,
  diaSemana: number,
  horaInicio: string,
  horaFin: string,
  aula = AULA_3,
): BloqueHorario {
  return {
    id,
    diaSemana,
    horaInicio,
    horaFin,
    aula,
    capacidadEfectiva: 4,
    proximaFecha: '2026-09-28',
    ocupacion: 0,
  }
}

describe('agruparHorario', () => {
  it('junta las horas contiguas del mismo día y aula en un bloque', () => {
    const bloques = agruparHorario([
      fila(10, 1, '08:00', '09:00'),
      fila(11, 1, '09:00', '10:00'),
      fila(12, 1, '10:00', '11:00'),
      fila(13, 1, '11:00', '12:00'),
    ])

    expect(bloques).toHaveLength(1)
    expect(bloques[0]).toMatchObject({
      clave: '10-11-12-13',
      diaSemana: 1,
      aula: AULA_3,
      horaInicio: '08:00',
      horaFin: '12:00',
    })
    expect(bloques[0]?.horas.map((h) => h.id)).toEqual([10, 11, 12, 13])
  })

  it('separa si hay un hueco, si cambia el aula o si cambia el día', () => {
    const bloques = agruparHorario([
      fila(1, 1, '08:00', '09:00'),
      fila(2, 1, '10:00', '11:00'), // hueco de 9 a 10
      fila(3, 1, '11:00', '12:00', AULA_5), // otra aula
      fila(4, 2, '12:00', '13:00', AULA_5), // otro día
    ])

    expect(bloques.map((b) => b.horas.map((h) => h.id))).toEqual([[1], [2], [3], [4]])
  })

  it('no depende del orden en que llegan las filas', () => {
    const bloques = agruparHorario([
      fila(13, 1, '11:00', '12:00'),
      fila(20, 3, '14:00', '15:00'),
      fila(10, 1, '08:00', '09:00'),
      fila(12, 1, '10:00', '11:00'),
      fila(11, 1, '09:00', '10:00'),
    ])

    expect(bloques.map((b) => [b.diaSemana, b.horaInicio, b.horaFin])).toEqual([
      [1, '08:00', '12:00'],
      [3, '14:00', '15:00'],
    ])
    expect(bloques[0]?.horas.map((h) => h.id)).toEqual([10, 11, 12, 13])
  })

  it('ordena los días de lunes (1) a domingo (7)', () => {
    const bloques = agruparHorario([fila(1, 7, '08:00', '09:00'), fila(2, 1, '20:00', '21:00')])
    expect(bloques.map((b) => b.diaSemana)).toEqual([1, 7])
  })

  it('no modifica el arreglo recibido', () => {
    const filas = [fila(2, 1, '09:00', '10:00'), fila(1, 1, '08:00', '09:00')]
    agruparHorario(filas)
    expect(filas.map((f) => f.id)).toEqual([2, 1])
  })

  it('sin filas no hay bloques', () => {
    expect(agruparHorario([])).toEqual([])
  })
})

describe('opciones de hora', () => {
  it('el inicio va de 00:00 a 22:00 y el fin de 01:00 a 23:00, siempre en punto', () => {
    expect(OPCIONES_HORA_INICIO[0]).toBe('00:00')
    expect(OPCIONES_HORA_INICIO.at(-1)).toBe('22:00')
    expect(OPCIONES_HORA_INICIO).toHaveLength(23)
    expect(OPCIONES_HORA_FIN[0]).toBe('01:00')
    expect(OPCIONES_HORA_FIN.at(-1)).toBe('23:00')
    expect(OPCIONES_HORA_FIN).toHaveLength(23)
    expect([...OPCIONES_HORA_INICIO, ...OPCIONES_HORA_FIN].every((h) => /^\d{2}:00$/.test(h))).toBe(
      true,
    )
  })
})

describe('unaHoraDespues', () => {
  it.each([
    ['00:00', '01:00'],
    ['08:00', '09:00'],
    ['22:00', '23:00'],
  ])('%s → %s', (hora, esperada) => {
    expect(unaHoraDespues(hora)).toBe(esperada)
  })

  it.each(['23:00', '08:30', '', 'x'])('%o → null', (hora) => {
    expect(unaHoraDespues(hora)).toBeNull()
  })
})

describe('horaCorta y rangoHoras', () => {
  it('saca el cero adelante de la hora, no el de los minutos', () => {
    expect(horaCorta('08:00')).toBe('8:00')
    expect(horaCorta('00:00')).toBe('0:00')
    expect(horaCorta('14:00')).toBe('14:00')
    expect(horaCorta('10:05')).toBe('10:05')
  })

  it('arma el rango', () => {
    expect(rangoHoras('08:00', '12:00')).toBe('8:00 a 12:00')
  })
})

describe('etiquetaProximaFecha', () => {
  it('muestra el día y la fecha de la próxima ocurrencia', () => {
    expect(etiquetaProximaFecha('2026-09-28', 1, '2026-09-22')).toBe('próximo lunes 28/09')
  })

  it('si la próxima ocurrencia es hoy, lo dice', () => {
    expect(etiquetaProximaFecha('2026-09-22', 2, '2026-09-22')).toBe('hoy, martes 22/09')
  })

  it('no corre la fecha un día por la zona horaria (nada de new Date("YYYY-MM-DD"))', () => {
    expect(etiquetaProximaFecha('2027-01-03', 7, '2026-12-30')).toBe('próximo domingo 03/01')
  })
})
