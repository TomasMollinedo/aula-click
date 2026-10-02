import { describe, expect, it } from 'vitest'

import { aCobrar } from '../a-cobrar'
import {
  SELECCION_VACIA,
  alternar,
  estaSeleccionada,
  ordenarComoSeMuestran,
  ordenarPorFecha,
  podar,
  quitar,
  quitarTodos,
  resumenSeleccion,
  seleccionarTodos,
} from '../seleccion'
import { ADEUDADOS, CUENTA } from './fixtures'

// adeudados: turno 41 el 21/09 y el 28/09; próximos: turno 41 el 05/10 y turno 57 el 07/10.
const [ADEUDADO_21, ADEUDADO_28] = CUENTA.adeudados
const [PROXIMO_05, PROXIMO_07] = CUENTA.proximos
const MOSTRADA = [...CUENTA.adeudados, ...CUENTA.proximos]

describe('alternar', () => {
  it('tilda y, la segunda vez, destilda la misma ocurrencia', () => {
    const una = alternar(SELECCION_VACIA, ADEUDADO_21)
    expect(estaSeleccionada(una, ADEUDADO_21)).toBe(true)
    expect(una.size).toBe(1)

    const ninguna = alternar(una, ADEUDADO_21)
    expect(estaSeleccionada(ninguna, ADEUDADO_21)).toBe(false)
    expect(ninguna.size).toBe(0)
  })

  it('dos ocurrencias del mismo turno en fechas distintas son dos entradas', () => {
    const sel = alternar(alternar(SELECCION_VACIA, ADEUDADO_21), ADEUDADO_28)
    expect(sel.size).toBe(2)
    expect(estaSeleccionada(sel, ADEUDADO_21)).toBe(true)
    expect(estaSeleccionada(sel, ADEUDADO_28)).toBe(true)

    const sinLa21 = alternar(sel, ADEUDADO_21)
    expect(estaSeleccionada(sinLa21, ADEUDADO_21)).toBe(false)
    expect(estaSeleccionada(sinLa21, ADEUDADO_28)).toBe(true)
  })

  it('guarda la copia a cobrar (sin estado) y no modifica la selección anterior', () => {
    const antes = SELECCION_VACIA
    const sel = alternar(antes, ADEUDADO_21)
    expect(antes.size).toBe(0)
    expect([...sel.values()]).toEqual([aCobrar(ADEUDADO_21)])
  })
})

describe('seleccionarTodos', () => {
  it('suma los adeudados y conserva los próximos ya tildados', () => {
    const conProximo = alternar(SELECCION_VACIA, PROXIMO_07)
    const sel = seleccionarTodos(conProximo, CUENTA.adeudados)
    expect(sel.size).toBe(3)
    expect(estaSeleccionada(sel, PROXIMO_07)).toBe(true)
    expect(estaSeleccionada(sel, ADEUDADO_21)).toBe(true)
    expect(estaSeleccionada(sel, ADEUDADO_28)).toBe(true)
  })

  it('no destilda ni duplica los que ya estaban', () => {
    const conUno = alternar(SELECCION_VACIA, ADEUDADO_21)
    expect(seleccionarTodos(conUno, CUENTA.adeudados).size).toBe(2)
  })
})

describe('quitar', () => {
  it('saca solo las ocurrencias de la solicitud y deja lo demás tildado', () => {
    const sel = seleccionarTodos(SELECCION_VACIA, MOSTRADA)
    const resto = quitar(sel, [aCobrar(ADEUDADO_21), aCobrar(PROXIMO_07)])
    expect(resto.size).toBe(2)
    expect(estaSeleccionada(resto, ADEUDADO_21)).toBe(false)
    expect(estaSeleccionada(resto, PROXIMO_07)).toBe(false)
    expect(estaSeleccionada(resto, ADEUDADO_28)).toBe(true)
    expect(estaSeleccionada(resto, PROXIMO_05)).toBe(true)
  })

  it('la acción de una fila no tildada no cambia la selección (misma referencia)', () => {
    const sel = alternar(SELECCION_VACIA, ADEUDADO_28)
    expect(quitar(sel, [aCobrar(ADEUDADO_21)])).toBe(sel)
  })

  it('el mismo turno en otra fecha no se toca', () => {
    const sel = seleccionarTodos(SELECCION_VACIA, CUENTA.adeudados)
    const resto = quitar(sel, [aCobrar(ADEUDADO_21)])
    expect(estaSeleccionada(resto, ADEUDADO_28)).toBe(true)
    expect(resto.size).toBe(1)
  })
})

describe('quitarTodos', () => {
  it('vacía la selección', () => {
    expect(quitarTodos().size).toBe(0)
  })
})

describe('podar', () => {
  it('saca lo que ya no está en la lista (una fila cobrada desaparece)', () => {
    const sel = seleccionarTodos(SELECCION_VACIA, MOSTRADA)
    const sinLa21 = MOSTRADA.filter((o) => o !== ADEUDADO_21)
    const podada = podar(sel, sinLa21)
    expect(podada.size).toBe(3)
    expect(estaSeleccionada(podada, ADEUDADO_21)).toBe(false)
    // el mismo turno en otra fecha sigue
    expect(estaSeleccionada(podada, ADEUDADO_28)).toBe(true)
  })

  it('si no cambió nada, devuelve la misma selección', () => {
    const sel = alternar(SELECCION_VACIA, PROXIMO_05)
    expect(podar(sel, MOSTRADA)).toBe(sel)
  })

  it('filtrar es podar: lo que el filtro saca de la vista sale y no vuelve al quitar el filtro', () => {
    const sel = seleccionarTodos(SELECCION_VACIA, MOSTRADA)
    // Filtro por materia: de la cuenta solo se ve el próximo de Física.
    const soloFisica = MOSTRADA.filter((o) => o.materia.id === PROXIMO_07.materia.id)
    const filtrada = podar(sel, soloFisica)
    expect([...filtrada.values()]).toEqual([aCobrar(PROXIMO_07)])

    // Se quita el filtro: vuelven las cuatro filas, pero tildada queda solo la que se veía.
    const sinFiltro = podar(filtrada, MOSTRADA)
    expect(sinFiltro).toBe(filtrada)
    expect(sinFiltro.size).toBe(1)
  })

  it('una sección que no aplica al período (llega `null`) deja la selección sin sus filas', () => {
    const sel = seleccionarTodos(SELECCION_VACIA, MOSTRADA)
    // Período pasado: `proximos: null`, así que solo se ven los adeudados.
    const podada = podar(sel, CUENTA.adeudados)
    expect([...podada.values()]).toEqual(CUENTA.adeudados.map(aCobrar))
  })

  it('con la lista vacía queda vacía', () => {
    expect(podar(seleccionarTodos(SELECCION_VACIA, MOSTRADA), []).size).toBe(0)
  })
})

describe('ordenarComoSeMuestran', () => {
  it('adeudados y próximos mezclados salen en el orden de la lista, no en el de tildado', () => {
    let sel = alternar(SELECCION_VACIA, PROXIMO_07)
    sel = alternar(sel, ADEUDADO_28)
    sel = alternar(sel, PROXIMO_05)
    sel = alternar(sel, ADEUDADO_21)
    expect(ordenarComoSeMuestran(sel, MOSTRADA)).toEqual(
      [ADEUDADO_21, ADEUDADO_28, PROXIMO_05, PROXIMO_07].map(aCobrar),
    )
  })

  it('solo lo tildado', () => {
    const sel = alternar(alternar(SELECCION_VACIA, PROXIMO_07), ADEUDADO_21)
    expect(ordenarComoSeMuestran(sel, MOSTRADA)).toEqual([ADEUDADO_21, PROXIMO_07].map(aCobrar))
  })
})

describe('ordenarPorFecha', () => {
  it('por fecha, hora de inicio y turnoId, aunque se hayan tildado en otras páginas', () => {
    const [LUCIA_21, TOMAS_22] = ADEUDADOS.data
    const mismaFechaMasTemprano = {
      ...TOMAS_22,
      turnoId: 70,
      fecha: '2026-09-21',
      horaInicio: '08:00',
    }
    const mismaFechaYHora = { ...LUCIA_21, turnoId: 12 }
    let sel = alternar(SELECCION_VACIA, TOMAS_22)
    sel = alternar(sel, LUCIA_21)
    sel = alternar(sel, mismaFechaMasTemprano)
    sel = alternar(sel, mismaFechaYHora)
    expect(ordenarPorFecha(sel).map((o) => [o.turnoId, o.fecha, o.horaInicio])).toEqual([
      [70, '2026-09-21', '08:00'],
      [12, '2026-09-21', '09:00'],
      [41, '2026-09-21', '09:00'],
      [63, '2026-09-22', '18:00'],
    ])
  })
})

describe('resumenSeleccion', () => {
  it('cantidad y total con los importes de la API', () => {
    expect(resumenSeleccion(seleccionarTodos(SELECCION_VACIA, MOSTRADA))).toEqual({
      cantidad: 4,
      total: 33000,
      sinPrecio: 0,
    })
  })

  it('con decimales', () => {
    expect(resumenSeleccion(seleccionarTodos(SELECCION_VACIA, ADEUDADOS.data))).toEqual({
      cantidad: 2,
      total: 17000.5,
      sinPrecio: 0,
    })
  })

  it('con un importe null: sin total', () => {
    const sel = seleccionarTodos(SELECCION_VACIA, [ADEUDADO_21, { ...PROXIMO_07, importe: null }])
    expect(resumenSeleccion(sel)).toEqual({ cantidad: 2, total: null, sinPrecio: 1 })
  })

  it('vacía', () => {
    expect(resumenSeleccion(SELECCION_VACIA)).toEqual({ cantidad: 0, total: 0, sinPrecio: 0 })
  })
})
