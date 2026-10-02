import { describe, expect, it } from 'vitest'

import type { CalendarioItem } from '../agendas.types'
import {
  agruparClases,
  armarSemana,
  cantidadCancelados,
  cantidadPorPrioridad,
  claveDeCelda,
  disponibilidadDeClase,
  etiquetaDeHora,
  FILTROS_GRILLA_VACIOS,
  type FiltrosGrilla,
  filtrarOcurrencias,
  filtrosDelOrigen,
  hayFiltrosGrilla,
  horaDe,
  opcionesDeFiltros,
  paramsDeSemana,
  paramsDelCalendario,
  textoAlumnos,
  textoDisponibilidad,
  tituloDeSemana,
} from '../calendario'

const MATEMATICA = { id: 1, nombre: 'Matemática' }
const FISICA = { id: 2, nombre: 'Física' }
const ANA = { id: 3, apellido: 'Pérez', nombre: 'Ana' }

function item(parcial: Partial<CalendarioItem> & { turnoId: number }): CalendarioItem {
  return {
    fecha: '2026-10-07',
    bloqueAgendaId: 10,
    diaSemana: 3,
    horaInicio: '14:00',
    horaFin: '15:00',
    alumno: { id: parcial.turnoId, apellido: 'Gómez', nombre: `Alumno ${parcial.turnoId}` },
    materia: MATEMATICA,
    aula: { id: 1, nombre: 'Aula 1' },
    tipo: 'RECURRENTE',
    estado: 'AGENDADO',
    estadoPago: 'PENDIENTE',
    prioridad: null,
    examen: null,
    cupo: { ocupados: 1, capacidad: 4 },
    ...parcial,
  }
}

describe('agruparClases', () => {
  it('tres alumnos en la misma hora son una sola clase', () => {
    const clases = agruparClases([item({ turnoId: 1 }), item({ turnoId: 2 }), item({ turnoId: 3 })])

    expect(clases).toHaveLength(1)
    expect(clases[0].turnos.map((t) => t.turnoId)).toEqual([1, 2, 3])
  })

  it('el mismo bloque en otra fecha, o otro bloque a la misma hora, es otra clase', () => {
    const clases = agruparClases([
      item({ turnoId: 1 }),
      item({ turnoId: 1, fecha: '2026-10-14' }),
      item({ turnoId: 2, bloqueAgendaId: 11, aula: { id: 2, nombre: 'Aula 2' } }),
    ])

    expect(clases.map((c) => c.clave)).toEqual(['2026-10-07|10', '2026-10-14|10', '2026-10-07|11'])
  })

  it('conserva el orden en que llegan las clases', () => {
    const clases = agruparClases([
      item({ turnoId: 1, bloqueAgendaId: 12, horaInicio: '09:00', horaFin: '10:00' }),
      item({ turnoId: 2, bloqueAgendaId: 10 }),
    ])

    expect(clases.map((c) => c.bloqueAgendaId)).toEqual([12, 10])
  })

  it('junta las materias distintas de la clase, sin repetir', () => {
    const [clase] = agruparClases([
      item({ turnoId: 1 }),
      item({ turnoId: 2, materia: FISICA }),
      item({ turnoId: 3 }),
    ])

    expect(clase.materias).toEqual([MATEMATICA, FISICA])
  })

  it('toma el profesor de la agenda del centro y es null en las demás', () => {
    expect(agruparClases([item({ turnoId: 1, profesor: ANA })])[0].profesor).toEqual(ANA)
    expect(agruparClases([item({ turnoId: 1 })])[0].profesor).toBeNull()
  })

  it('ordena los alumnos por apellido y nombre, y cada uno conserva su estado y su prioridad', () => {
    const [clase] = agruparClases([
      item({ turnoId: 1, alumno: { id: 1, apellido: 'Zárate', nombre: 'Luz' }, prioridad: 'ALTA' }),
      item({
        turnoId: 2,
        alumno: { id: 2, apellido: 'Álvarez', nombre: 'Tomás' },
        estado: 'CANCELADO',
      }),
      item({ turnoId: 3, alumno: { id: 3, apellido: 'Álvarez', nombre: 'Bruno' } }),
    ])

    expect(clase.turnos.map((t) => t.turnoId)).toEqual([3, 2, 1])
    expect(clase.turnos.map((t) => t.estado)).toEqual(['AGENDADO', 'CANCELADO', 'AGENDADO'])
    expect(clase.turnos.map((t) => t.prioridad)).toEqual([null, null, 'ALTA'])
  })

  it('sin ocurrencias no hay clases', () => {
    expect(agruparClases([])).toEqual([])
  })
})

describe('armarSemana', () => {
  const HOY = '2026-10-07'

  it('muestra solo los días con clases, de lunes a domingo, y marca hoy', () => {
    const semana = armarSemana(
      [
        item({ turnoId: 1, fecha: '2026-10-09' }),
        item({ turnoId: 2, fecha: '2026-10-05' }),
        item({ turnoId: 3, fecha: '2026-10-07' }),
      ],
      HOY,
    )

    expect(semana.dias).toEqual([
      { fecha: '2026-10-05', diaSemana: 1, esHoy: false, esPasado: true },
      { fecha: '2026-10-07', diaSemana: 3, esHoy: true, esPasado: false },
      { fecha: '2026-10-09', diaSemana: 5, esHoy: false, esPasado: false },
    ])
  })

  it('las horas van de la primera a la última clase sin saltear ninguna', () => {
    const semana = armarSemana(
      [
        item({ turnoId: 1, horaInicio: '09:00', horaFin: '10:00', bloqueAgendaId: 1 }),
        item({ turnoId: 2, horaInicio: '14:00', horaFin: '15:00', bloqueAgendaId: 2 }),
      ],
      HOY,
    )

    expect(semana.horas).toEqual([9, 10, 11, 12, 13, 14])
  })

  it('apila en una celda las clases de distintos profesores a la misma hora', () => {
    const semana = armarSemana(
      [
        item({ turnoId: 1, bloqueAgendaId: 10, profesor: ANA }),
        item({
          turnoId: 2,
          bloqueAgendaId: 11,
          profesor: { id: 4, apellido: 'Luna', nombre: 'Rosa' },
        }),
        item({
          turnoId: 3,
          bloqueAgendaId: 11,
          profesor: { id: 4, apellido: 'Luna', nombre: 'Rosa' },
        }),
      ],
      HOY,
    )

    const celda = semana.celdas.get(claveDeCelda('2026-10-07', 14))
    expect(celda?.map((c) => c.bloqueAgendaId)).toEqual([10, 11])
    expect(semana.totalClases).toBe(2)
    expect(semana.totalTurnos).toBe(3)
  })

  it('una semana sin ocurrencias no tiene días ni horas', () => {
    expect(armarSemana([], HOY)).toMatchObject({ dias: [], horas: [], totalClases: 0 })
  })
})

describe('textos de la clase', () => {
  it('textoAlumnos', () => {
    expect(textoAlumnos(1)).toBe('1 alumno')
    expect(textoAlumnos(3)).toBe('3 alumnos')
  })

  it('cantidadCancelados', () => {
    const [clase] = agruparClases([
      item({ turnoId: 1, estado: 'CANCELADO' }),
      item({ turnoId: 2 }),
      item({ turnoId: 3, estado: 'SIN_REGISTRAR' }),
    ])
    expect(cantidadCancelados(clase)).toBe(1)
  })

  it('cantidadPorPrioridad cuenta alta y media; baja, sin prioridad y cancelados no suman', () => {
    const [clase] = agruparClases([
      item({ turnoId: 1, prioridad: 'ALTA' }),
      item({ turnoId: 2, prioridad: 'ALTA' }),
      item({ turnoId: 3, prioridad: 'MEDIA' }),
      item({ turnoId: 4, prioridad: 'BAJA' }),
      item({ turnoId: 5, prioridad: null }),
      item({ turnoId: 6, estado: 'CANCELADO', prioridad: null }),
    ])
    expect(cantidadPorPrioridad(clase)).toEqual({ alta: 2, media: 1 })
  })

  it('horaDe y etiquetaDeHora', () => {
    expect(horaDe('08:00')).toBe(8)
    expect(horaDe('14:00')).toBe(14)
    expect(etiquetaDeHora(8)).toBe('8:00')
  })
})

describe('filtros del calendario', () => {
  const filtros = { profesorId: 7, incluirCancelados: true, prioridad: null } as const
  const rango = { desde: '2026-10-05', hasta: '2026-10-11' }

  it('el centro filtra por profesor; las agendas de un profesor, no', () => {
    expect(filtrosDelOrigen({ tipo: 'centro' }, filtros).profesorId).toBe(7)
    expect(filtrosDelOrigen({ tipo: 'profesor', profesorId: 3 }, filtros).profesorId).toBeNull()
    expect(filtrosDelOrigen({ tipo: 'propia' }, filtros).profesorId).toBeNull()
  })

  it('manda a la API el rango y solo los filtros puestos', () => {
    expect(paramsDelCalendario({ tipo: 'centro' }, rango, filtros)).toEqual({
      origen: { tipo: 'centro' },
      ...rango,
      profesorId: 7,
      incluirCancelados: true,
      prioridad: undefined,
    })
  })

  it('un ?profesorId= en la URL no llega a la agenda de un profesor', () => {
    const params = paramsDelCalendario({ tipo: 'propia' }, rango, filtros)
    expect(params.profesorId).toBeUndefined()
    expect(params.incluirCancelados).toBe(true)
  })
})

describe('paramsDeSemana', () => {
  const HOY = '2026-10-07' // miércoles: su semana empieza el lunes 2026-10-05

  it('guarda el lunes de la semana elegida y conserva los demás parámetros', () => {
    const params = paramsDeSemana(
      new URLSearchParams('modo=calendario&incluirCancelados=true'),
      '2026-10-15',
      HOY,
    )
    expect(params.toString()).toBe('modo=calendario&incluirCancelados=true&fecha=2026-10-12')
  })

  it('la semana de hoy no se escribe y saca la fecha que había', () => {
    const params = paramsDeSemana(
      new URLSearchParams('modo=calendario&fecha=2026-10-12'),
      '2026-10-09',
      HOY,
    )
    expect(params.toString()).toBe('modo=calendario')
  })

  it('no toca la vista de la lista', () => {
    const params = paramsDeSemana(new URLSearchParams('vista=dia'), '2026-10-15', HOY)
    expect(params.get('vista')).toBe('dia')
  })
})

describe('tituloDeSemana', () => {
  it('una semana dentro de un mes', () => {
    expect(tituloDeSemana('2026-10-05')).toBe('5 – 11 oct 2026')
  })

  it('una semana que cruza de mes', () => {
    expect(tituloDeSemana('2026-09-28')).toBe('28 sep – 4 oct 2026')
  })

  it('una semana que cruza de año', () => {
    expect(tituloDeSemana('2026-12-28')).toBe('28 dic 2026 – 3 ene 2027')
  })
})

describe('cupo de la clase', () => {
  it('la clase lleva el cupo que manda la API, completo aunque se vean pocos turnos', () => {
    const [clase] = agruparClases([item({ turnoId: 1, cupo: { ocupados: 3, capacidad: 4 } })])
    expect(clase.cupo).toEqual({ ocupados: 3, capacidad: 4 })
  })

  it.each([
    [{ ocupados: 4, capacidad: 4 }, 'llena', 0, 'Llena'],
    [{ ocupados: 5, capacidad: 4 }, 'llena', 0, 'Llena'],
    [{ ocupados: 3, capacidad: 4 }, 'casi', 1, '1 cupo libre'],
    [{ ocupados: 5, capacidad: 8 }, 'normal', 3, '3 cupos libres'],
    [{ ocupados: 6, capacidad: 8 }, 'casi', 2, '2 cupos libres'],
    [{ ocupados: 2, capacidad: 6 }, 'normal', 4, '4 cupos libres'],
    [{ ocupados: 0, capacidad: 2 }, 'normal', 2, '2 cupos libres'],
  ] as const)('disponibilidad de %j', (cupo, nivel, libres, texto) => {
    const disponibilidad = disponibilidadDeClase(cupo)
    expect(disponibilidad).toEqual({ nivel, libres })
    expect(textoDisponibilidad(disponibilidad)).toBe(texto)
  })
})

describe('filtros de la grilla', () => {
  const FISICA_ = { id: 2, nombre: 'Física' }
  const AULA_2 = { id: 2, nombre: 'Aula 2' }
  const items = [
    item({ turnoId: 1, alumno: { id: 1, apellido: 'Paz', nombre: 'Ana' }, profesor: ANA }),
    item({
      turnoId: 2,
      alumno: { id: 2, apellido: 'Gómez', nombre: 'Luis' },
      materia: FISICA_,
      aula: AULA_2,
      profesor: ANA,
    }),
    item({
      turnoId: 3,
      alumno: { id: 3, apellido: 'Núñez', nombre: 'Rosa' },
      materia: FISICA_,
      profesor: { id: 9, apellido: 'Ibarra', nombre: 'Mario' },
    }),
  ]
  const ids = (resultado: readonly CalendarioItem[]) => resultado.map((i) => i.turnoId)

  it('sin filtros deja todo, en el mismo orden', () => {
    expect(ids(filtrarOcurrencias(items, FILTROS_GRILLA_VACIOS))).toEqual([1, 2, 3])
    expect(hayFiltrosGrilla(FILTROS_GRILLA_VACIOS)).toBe(false)
  })

  it('filtra por materia, por aula y por alumno, y se combinan', () => {
    const filtrar = (cambios: Partial<FiltrosGrilla>) =>
      ids(filtrarOcurrencias(items, { ...FILTROS_GRILLA_VACIOS, ...cambios }))
    expect(filtrar({ materia: FISICA_ })).toEqual([2, 3])
    expect(filtrar({ aula: AULA_2 })).toEqual([2])
    expect(filtrar({ alumno: { id: 3, nombre: 'Núñez, Rosa' } })).toEqual([3])
    expect(filtrar({ materia: FISICA_, aula: { id: 1, nombre: 'Aula 1' } })).toEqual([3])
    expect(filtrar({ materia: FISICA_, alumno: { id: 1, nombre: 'Paz, Ana' } })).toEqual([])
  })

  it('el alumno se filtra por su id: el profesor de la clase no cuenta', () => {
    // El alumno 1 se llama "Ana" igual que el profesor de las clases 1 y 2.
    expect(
      ids(
        filtrarOcurrencias(items, {
          ...FILTROS_GRILLA_VACIOS,
          alumno: { id: 1, nombre: 'Paz, Ana' },
        }),
      ),
    ).toEqual([1])
  })

  it('hayFiltrosGrilla', () => {
    expect(
      hayFiltrosGrilla({ ...FILTROS_GRILLA_VACIOS, alumno: { id: 1, nombre: 'Paz, Ana' } }),
    ).toBe(true)
    expect(hayFiltrosGrilla({ ...FILTROS_GRILLA_VACIOS, aula: AULA_2 })).toBe(true)
  })

  it('las opciones salen de las ocurrencias, sin repetir y por nombre', () => {
    expect(opcionesDeFiltros(items)).toEqual({
      materias: [FISICA_, MATEMATICA],
      aulas: [{ id: 1, nombre: 'Aula 1' }, AULA_2],
      alumnos: [
        { id: 2, nombre: 'Gómez, Luis' },
        { id: 3, nombre: 'Núñez, Rosa' },
        { id: 1, nombre: 'Paz, Ana' },
      ],
    })
  })
})
