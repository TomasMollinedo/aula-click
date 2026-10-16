import { describe, expect, it } from 'vitest'
import {
  etiquetaMotivoCancelacion,
  etiquetaNivelEscolaridad,
  fechaDelBloque,
  horarioDelBloque,
  nombreProfesor,
  textoEstadoDeLaHora,
  textoFiltrosDelHistorial,
  textoMesDelHistorial,
  textoMotivoDeCancelado,
  textoNotaDelExamen,
  textoPorcentaje,
  textoResumen,
  textosDelBloque,
  tituloGrupo,
} from '../historiales.formato'
import type { BloqueDelHistorial } from '../historiales.validation'

// Los textos del PDF del historial (T-110). Funciones puras: las mismas palabras que la pantalla.

describe('etiquetas', () => {
  it('el motivo de una cancelación', () => {
    expect(etiquetaMotivoCancelacion('CANCELACION_ALUMNO')).toBe('Cancelación por el alumno')
    expect(etiquetaMotivoCancelacion('CANCELACION_PROFESOR')).toBe('Cancelación por el profesor')
    expect(etiquetaMotivoCancelacion('PROBLEMA_ADMINISTRATIVO')).toBe('Problema administrativo')
    expect(etiquetaMotivoCancelacion('OTRO')).toBe('Otro')
  })

  it('el nivel de escolaridad, y null si el alumno no tiene uno cargado', () => {
    expect(etiquetaNivelEscolaridad('SECUNDARIO')).toBe('Secundario')
    expect(etiquetaNivelEscolaridad('UNIVERSITARIO')).toBe('Universitario')
    expect(etiquetaNivelEscolaridad(null)).toBeNull()
  })

  it('el profesor, como apellido y nombre', () => {
    expect(nombreProfesor({ nombre: 'Ana', apellido: 'Pérez' })).toBe('Pérez, Ana')
  })
})

describe('mes y filtros', () => {
  it('el mes con sus dos bordes', () => {
    expect(textoMesDelHistorial('2026-10-01', '2026-10-31')).toBe('01/10/2026 al 31/10/2026')
    expect(textoMesDelHistorial('2026-02-01', '2026-02-28')).toBe('01/02/2026 al 28/02/2026')
  })

  it('sin filtros, null', () => {
    expect(
      textoFiltrosDelHistorial({
        materiaId: null,
        profesorId: null,
        materia: null,
        profesor: null,
      }),
    ).toBeNull()
  })

  it('la materia, el profesor o los dos', () => {
    expect(
      textoFiltrosDelHistorial({
        materiaId: 3,
        profesorId: null,
        materia: 'Álgebra',
        profesor: null,
      }),
    ).toBe('Materia: Álgebra')
    expect(
      textoFiltrosDelHistorial({
        materiaId: 3,
        profesorId: 4,
        materia: 'Álgebra',
        profesor: { nombre: 'Ana', apellido: 'Pérez' },
      }),
    ).toBe('Materia: Álgebra · Profesor: Pérez, Ana')
  })

  it('un id que no está en el historial del alumno se escribe como id', () => {
    expect(
      textoFiltrosDelHistorial({
        materiaId: 99,
        profesorId: 98,
        materia: null,
        profesor: null,
      }),
    ).toBe('Materia: #99 · Profesor: #98')
  })
})

describe('grupo y bloque', () => {
  function bloque(cambios: Partial<BloqueDelHistorial> = {}): BloqueDelHistorial {
    return {
      fecha: '2026-10-13',
      horaInicio: '08:00',
      horaFin: '10:00',
      horas: 2,
      textos: null,
      clases: [
        {
          turnoId: 1,
          fecha: '2026-10-13',
          horaInicio: '08:00',
          horaFin: '09:00',
          estado: 'REALIZADO',
          plazoAsistencia: { vence: '2026-10-20', vencido: false },
          cerradaPorSistema: false,
          textosPropios: null,
          observacion: null,
          cancelacion: null,
        },
        {
          turnoId: 2,
          fecha: '2026-10-13',
          horaInicio: '09:00',
          horaFin: '10:00',
          estado: 'SIN_REGISTRAR',
          plazoAsistencia: { vence: '2026-10-20', vencido: false },
          cerradaPorSistema: false,
          textosPropios: null,
          observacion: null,
          cancelacion: null,
        },
      ],
      ...cambios,
    }
  }

  it('el título de un grupo y su resumen', () => {
    expect(
      tituloGrupo({
        materia: { id: 3, nombre: 'Matemática' },
        profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
      }),
    ).toBe('Matemática — Prof. Pérez')
    expect(textoResumen({ realizadas: 3, ausencias: 1, porcentaje: 75 })).toBe(
      '3 realizadas · 1 ausencia · 75 %',
    )
    expect(textoResumen({ realizadas: 1, ausencias: 2, porcentaje: 33.3 })).toBe(
      '1 realizadas · 2 ausencias · 33,3 %',
    )
    expect(textoPorcentaje(0)).toBe('0 %')
  })

  it('la fecha con su día y el horario con la cantidad de horas', () => {
    expect(fechaDelBloque(bloque())).toBe('martes 13/10')
    expect(horarioDelBloque(bloque())).toBe('8:00 a 10:00 · 2 h')
    expect(horarioDelBloque({ horaInicio: '16:00', horaFin: '17:00', horas: 1 })).toBe(
      '16:00 a 17:00 · 1 h',
    )
  })

  it('el estado de cada hora, con el plazo de un "Sin registrar"', () => {
    const [realizada, sinRegistrar] = bloque().clases

    expect(textoEstadoDeLaHora(realizada)).toBe('8:00 a 9:00 · Realizado')
    expect(textoEstadoDeLaHora(sinRegistrar)).toBe('9:00 a 10:00 · Sin registrar · vence el 20/10')
    expect(
      textoEstadoDeLaHora({
        ...sinRegistrar,
        plazoAsistencia: { vence: '2026-10-20', vencido: true },
      }),
    ).toBe('9:00 a 10:00 · Sin registrar · cerrado por el sistema')
    expect(textoEstadoDeLaHora({ ...realizada, estado: 'CANCELADO', plazoAsistencia: null })).toBe(
      '8:00 a 9:00 · Cancelado',
    )
  })

  it('los textos del bloque van una sola vez, y los propios de una hora aparte', () => {
    const conTextos = bloque({
      textos: { trabajado: 'Ecuaciones', indicaciones: 'Practicar la guía' },
    })

    expect(textosDelBloque(conTextos)).toEqual([
      'Qué se trabajó: Ecuaciones',
      'Indicaciones: Practicar la guía',
    ])

    const conPropios = bloque({
      textos: { trabajado: 'Ecuaciones', indicaciones: null },
      clases: conTextos.clases.map((clase, i) =>
        i === 1 ? { ...clase, textosPropios: { trabajado: 'Repaso', indicaciones: null } } : clase,
      ),
    })

    expect(textosDelBloque(conPropios)).toEqual([
      'Qué se trabajó: Ecuaciones',
      '9:00 a 10:00 — Qué se trabajó: Repaso',
    ])
  })

  it('un bloque sin ningún texto no genera renglones', () => {
    expect(textosDelBloque(bloque())).toEqual([])
  })
})

describe('cancelados y exámenes', () => {
  it('el motivo de un cancelado, con su detalle si lo tiene', () => {
    expect(
      textoMotivoDeCancelado({ motivo: 'CANCELACION_ALUMNO', detalle: 'Viaje familiar' }),
    ).toBe('Cancelación por el alumno — Viaje familiar')
    expect(textoMotivoDeCancelado({ motivo: 'OTRO', detalle: null })).toBe('Otro')
  })

  it('la nota de un examen: el número con coma, "Ausente" o "Sin nota"', () => {
    expect(textoNotaDelExamen({ resultado: 'CON_NOTA', nota: 7.5 })).toBe('7,5')
    expect(textoNotaDelExamen({ resultado: 'CON_NOTA', nota: 10 })).toBe('10')
    expect(textoNotaDelExamen({ resultado: 'AUSENTE', nota: null })).toBe('Ausente')
    expect(textoNotaDelExamen({ resultado: null, nota: null })).toBe('Sin nota')
  })
})
