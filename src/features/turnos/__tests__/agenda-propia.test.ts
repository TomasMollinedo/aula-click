import { describe, expect, it } from 'vitest'

import {
  agruparPorFecha,
  esRangoActual,
  etiquetaDelRango,
  moverRango,
  normalizarFecha,
  paramsDeRango,
  parsearFecha,
  parsearVista,
  rangoDeVista,
} from '../agenda-propia'
import type { AgendaPropiaItem } from '../turnos.types'

// Vista por día o por semana de la agenda propia (HU-10). Lunes 28/09/2026 a domingo 04/10/2026;
// el 30/09 es miércoles. Ninguna función usa "hoy" del sistema: se le pasa.

const LUNES = '2026-09-28'
const MIERCOLES = '2026-09-30'
const DOMINGO = '2026-10-04'

const turno = (turnoId: number, fecha: string, horaInicio = '09:00'): AgendaPropiaItem => ({
  turnoId,
  fecha,
  diaSemana: 1,
  horaInicio,
  horaFin: '10:00',
  alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
  materia: { id: 3, nombre: 'Matemática' },
  aula: { id: 3, nombre: 'Aula 3' },
  tipo: 'RECURRENTE',
  estado: 'ACTIVO',
})

describe('parsearVista', () => {
  it('reconoce las dos vistas', () => {
    expect(parsearVista('dia')).toBe('dia')
    expect(parsearVista('semana')).toBe('semana')
  })

  it('cualquier otra cosa cae en la vista por día', () => {
    expect(parsearVista(null)).toBe('dia')
    expect(parsearVista('')).toBe('dia')
    expect(parsearVista('mes')).toBe('dia')
  })

  it('con otra vista por defecto, cualquier otra cosa cae en esa', () => {
    expect(parsearVista(null, 'semana')).toBe('semana')
    expect(parsearVista('mes', 'semana')).toBe('semana')
    expect(parsearVista('dia', 'semana')).toBe('dia')
  })
})

describe('normalizarFecha', () => {
  it('en la vista por día deja la fecha como está', () => {
    expect(normalizarFecha('dia', MIERCOLES)).toBe(MIERCOLES)
  })

  it('en la vista por semana usa el lunes de esa semana', () => {
    expect(normalizarFecha('semana', MIERCOLES)).toBe(LUNES)
    expect(normalizarFecha('semana', DOMINGO)).toBe(LUNES)
    expect(normalizarFecha('semana', LUNES)).toBe(LUNES)
  })
})

describe('rangoDeVista', () => {
  it('por día, el rango es esa sola fecha', () => {
    expect(rangoDeVista('dia', MIERCOLES)).toEqual({ desde: MIERCOLES, hasta: MIERCOLES })
  })

  it('por semana, de lunes a domingo aunque se pida un miércoles', () => {
    expect(rangoDeVista('semana', MIERCOLES)).toEqual({ desde: LUNES, hasta: DOMINGO })
  })
})

describe('moverRango', () => {
  it('por día se mueve de a un día', () => {
    expect(moverRango('dia', MIERCOLES, 1)).toBe('2026-10-01')
    expect(moverRango('dia', MIERCOLES, -1)).toBe('2026-09-29')
  })

  it('por semana se mueve de a siete días, desde el lunes del rango', () => {
    expect(moverRango('semana', MIERCOLES, 1)).toBe('2026-10-05')
    expect(moverRango('semana', MIERCOLES, -1)).toBe('2026-09-21')
  })
})

describe('esRangoActual', () => {
  it('por día, solo la fecha de hoy', () => {
    expect(esRangoActual('dia', MIERCOLES, MIERCOLES)).toBe(true)
    expect(esRangoActual('dia', LUNES, MIERCOLES)).toBe(false)
  })

  it('por semana, cualquier día de la semana de hoy', () => {
    expect(esRangoActual('semana', LUNES, MIERCOLES)).toBe(true)
    expect(esRangoActual('semana', DOMINGO, MIERCOLES)).toBe(true)
    expect(esRangoActual('semana', '2026-10-05', MIERCOLES)).toBe(false)
  })
})

describe('etiquetaDelRango', () => {
  it('por día, el nombre del día', () => {
    expect(etiquetaDelRango('dia', MIERCOLES)).toBe('Miércoles')
  })

  it('por semana, el rango de lunes a domingo', () => {
    expect(etiquetaDelRango('semana', MIERCOLES)).toBe('Semana del 28/09 al 04/10')
  })
})

describe('agruparPorFecha', () => {
  it('sin turnos, no hay días', () => {
    expect(agruparPorFecha([])).toEqual([])
  })

  it('agrupa las ocurrencias por fecha conservando el orden', () => {
    const items = [
      turno(31, LUNES, '09:00'),
      turno(32, LUNES, '11:00'),
      turno(40, MIERCOLES, '08:00'),
    ]

    expect(
      agruparPorFecha(items).map((dia) => [dia.fecha, dia.turnos.map((t) => t.turnoId)]),
    ).toEqual([
      [LUNES, [31, 32]],
      [MIERCOLES, [40]],
    ])
  })

  it('un recurrente repite su turnoId en cada fecha y queda en el día que corresponde', () => {
    const items = [turno(31, LUNES), turno(31, '2026-10-05')]

    expect(agruparPorFecha(items)).toHaveLength(2)
  })
})

describe('parsearFecha', () => {
  it('acepta una fecha de calendario real', () => {
    expect(parsearFecha(MIERCOLES, LUNES)).toBe(MIERCOLES)
  })

  it('cualquier otra cosa cae en la fecha por defecto', () => {
    expect(parsearFecha(null, LUNES)).toBe(LUNES)
    expect(parsearFecha('basura', LUNES)).toBe(LUNES)
    expect(parsearFecha('30-09-2026', LUNES)).toBe(LUNES)
    expect(parsearFecha('2026-02-30', LUNES)).toBe(LUNES)
    expect(parsearFecha('2026-13-01', LUNES)).toBe(LUNES)
  })
})

describe('paramsDeRango', () => {
  const MI_AGENDA = { vistaPorDefecto: 'dia' as const, hoy: MIERCOLES }
  const FICHA = { vistaPorDefecto: 'semana' as const, hoy: MIERCOLES }
  const SIGUIENTE_LUNES = '2026-10-05'

  it('conserva tab y cualquier otro parámetro', () => {
    const actuales = new URLSearchParams('tab=agenda&otro=1')
    const params = paramsDeRango(actuales, { vista: 'dia', fecha: SIGUIENTE_LUNES }, FICHA)
    expect(params.toString()).toBe('tab=agenda&otro=1&vista=dia&fecha=2026-10-05')
  })

  it('omite la vista cuando es la de por defecto (día en Mi agenda, semana en la ficha)', () => {
    const vacios = new URLSearchParams()
    expect(paramsDeRango(vacios, { vista: 'dia', fecha: MIERCOLES }, MI_AGENDA).has('vista')).toBe(
      false,
    )
    expect(paramsDeRango(vacios, { vista: 'semana', fecha: LUNES }, FICHA).has('vista')).toBe(false)
    expect(paramsDeRango(vacios, { vista: 'semana', fecha: LUNES }, MI_AGENDA).get('vista')).toBe(
      'semana',
    )
    expect(paramsDeRango(vacios, { vista: 'dia', fecha: LUNES }, FICHA).get('vista')).toBe('dia')
  })

  it('omite la fecha cuando es el rango actual, y la saca si ya estaba', () => {
    const actuales = new URLSearchParams('tab=agenda&vista=dia&fecha=2026-10-05')
    // Vuelta a la semana actual desde otro día de la misma semana: el rango es el de hoy.
    const params = paramsDeRango(actuales, { vista: 'semana', fecha: DOMINGO }, FICHA)
    expect(params.toString()).toBe('tab=agenda')
  })

  it('normaliza la fecha al lunes en la vista por semana', () => {
    const params = paramsDeRango(
      new URLSearchParams(),
      { vista: 'semana', fecha: '2026-10-07' },
      MI_AGENDA,
    )
    expect(params.get('fecha')).toBe(SIGUIENTE_LUNES)
  })

  it('no muta los parámetros que recibe', () => {
    const actuales = new URLSearchParams('tab=agenda&vista=dia')
    paramsDeRango(actuales, { vista: 'semana', fecha: SIGUIENTE_LUNES }, FICHA)
    expect(actuales.toString()).toBe('tab=agenda&vista=dia')
  })
})
