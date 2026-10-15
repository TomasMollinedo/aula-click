import { describe, expect, it } from 'vitest'

import type {
  AsistenciaDeOcurrencia,
  HorasSeguidas,
  HorasSeguidasDelPortal,
} from '@/types/ocurrencia'
import { formatoInstante } from '@/utils/auditoria'

import {
  etiquetaHorasSeguidas,
  mostrarSeccionAsistencia,
  textoCierreSistema,
  textoCreacionTurno,
  textosDeTrabajo,
  vistaAsistenciaHora,
  vistaHorasSeguidas,
} from '../asistencia-detalle'

const ANA = { id: 'usr_prof_03', nombre: 'Ana', apellido: 'Pérez' }
const REGISTRADA = '2026-10-05T12:10:00.000Z'
const MODIFICADA = '2026-10-06T09:00:00.000Z'
const PLAZO = { vence: '2026-10-12', vencido: false }
const VENCIDO = { vence: '2026-10-12', vencido: true }

const AUDITORIA = {
  registradaPor: ANA,
  registradaEl: REGISTRADA,
  modificadaPor: ANA,
  modificadaEl: MODIFICADA,
}

const PRESENTE: AsistenciaDeOcurrencia = {
  estado: 'PRESENTE',
  trabajado: 'Suma y resta de fracciones',
  indicaciones: 'Hacer la guía 3',
  observacion: null,
  ...AUDITORIA,
  cerradaPorSistema: false,
}

const AUSENTE: AsistenciaDeOcurrencia = {
  estado: 'AUSENTE',
  trabajado: null,
  indicaciones: null,
  observacion: 'Avisó que estaba enfermo',
  ...AUDITORIA,
  cerradaPorSistema: false,
}

const CERRADA: AsistenciaDeOcurrencia = {
  estado: null,
  trabajado: null,
  indicaciones: null,
  observacion: 'No registrada por el profesor en el plazo de 7 días. Cierre automático del sistema',
  registradaPor: null,
  registradaEl: null,
  modificadaPor: null,
  modificadaEl: null,
  cerradaPorSistema: true,
}

const REGISTRO = [
  `Registrada por Ana Pérez, ${formatoInstante(REGISTRADA)}`,
  `Modificada por Ana Pérez, ${formatoInstante(MODIFICADA)}`,
]

describe('mostrarSeccionAsistencia', () => {
  it('sin asistencia, plazo ni horas seguidas (agendada a futuro o cancelada) no hay sección', () => {
    expect(
      mostrarSeccionAsistencia({ asistencia: null, plazoAsistencia: null, horasSeguidas: null }),
    ).toBe(false)
  })

  it.each([
    ['con asistencia', { asistencia: PRESENTE, plazoAsistencia: PLAZO, horasSeguidas: null }],
    [
      'sin registrar dentro del plazo',
      { asistencia: null, plazoAsistencia: PLAZO, horasSeguidas: null },
    ],
    ['con horas seguidas', { asistencia: null, plazoAsistencia: null, horasSeguidas: {} }],
  ])('%s hay sección', (_caso, datos) => {
    expect(mostrarSeccionAsistencia(datos)).toBe(true)
  })
})

describe('vistaAsistenciaHora', () => {
  it('presente: qué se trabajó, indicaciones y quién la registró y la modificó', () => {
    expect(vistaAsistenciaHora(PRESENTE, PLAZO, { conHorasSeguidas: false })).toEqual({
      cierre: null,
      textos: [
        ['Qué se trabajó', 'Suma y resta de fracciones'],
        ['Indicaciones para la próxima sesión', 'Hacer la guía 3'],
      ],
      registro: REGISTRO,
    })
  })

  it('presente: solo los textos que tienen algo', () => {
    const soloTrabajado = { ...PRESENTE, indicaciones: null }
    expect(vistaAsistenciaHora(soloTrabajado, PLAZO, { conHorasSeguidas: false }).textos).toEqual([
      ['Qué se trabajó', 'Suma y resta de fracciones'],
    ])
  })

  it('presente con horas seguidas: los textos van en el grupo, no acá', () => {
    expect(vistaAsistenciaHora(PRESENTE, PLAZO, { conHorasSeguidas: true })).toEqual({
      cierre: null,
      textos: [],
      registro: REGISTRO,
    })
  })

  it('ausente: la observación, también con horas seguidas', () => {
    for (const conHorasSeguidas of [false, true]) {
      expect(vistaAsistenciaHora(AUSENTE, PLAZO, { conHorasSeguidas })).toEqual({
        cierre: null,
        textos: [['Observación', 'Avisó que estaba enfermo']],
        registro: REGISTRO,
      })
    }
  })

  it('cerrada por el sistema: la fecha del plazo y su observación, sin persona', () => {
    expect(vistaAsistenciaHora(CERRADA, VENCIDO, { conHorasSeguidas: false })).toEqual({
      cierre: 'Cerrado por el sistema el 12/10',
      textos: [['Observación', CERRADA.observacion]],
      registro: [],
    })
  })

  it('sin asistencia (sin registrar dentro del plazo): nada, el badge ya lo dice', () => {
    expect(vistaAsistenciaHora(null, PLAZO, { conHorasSeguidas: false })).toEqual({
      cierre: null,
      textos: [],
      registro: [],
    })
  })

  it('la del portal (sin observación ni auditoría): solo los textos', () => {
    const portal = {
      estado: 'PRESENTE' as const,
      trabajado: 'Fracciones',
      indicaciones: null,
      cerradaPorSistema: false,
    }
    expect(vistaAsistenciaHora(portal, PLAZO, { conHorasSeguidas: false })).toEqual({
      cierre: null,
      textos: [['Qué se trabajó', 'Fracciones']],
      registro: [],
    })
    const cerradaPortal = { ...portal, estado: null, trabajado: null, cerradaPorSistema: true }
    expect(vistaAsistenciaHora(cerradaPortal, VENCIDO, { conHorasSeguidas: false })).toEqual({
      cierre: 'Cerrado por el sistema el 12/10',
      textos: [],
      registro: [],
    })
  })
})

describe('textoCierreSistema y textosDeTrabajo', () => {
  it('el cierre sin plazo no inventa una fecha', () => {
    expect(textoCierreSistema(null)).toBe('Cerrado por el sistema')
  })

  it('sin textos, nada', () => {
    expect(textosDeTrabajo(null)).toEqual([])
    expect(textosDeTrabajo({ trabajado: '', indicaciones: null })).toEqual([])
  })
})

/** Lucas, de 8 a 9 (esta hora), de 9 a 10 (corregida con otros textos) y de 10 a 11 (ausente). */
const GRUPO: HorasSeguidas = {
  horaInicio: '08:00',
  horaFin: '11:00',
  horas: 3,
  textos: { trabajado: 'Suma y resta de fracciones', indicaciones: 'Hacer la guía 3' },
  ocurrencias: [
    {
      turnoId: 31,
      fecha: '2026-10-05',
      horaInicio: '08:00',
      horaFin: '09:00',
      estado: 'REALIZADO',
      plazoAsistencia: PLAZO,
      actual: true,
      registrable: false,
      textosPropios: null,
      observacion: null,
    },
    {
      turnoId: 32,
      fecha: '2026-10-05',
      horaInicio: '09:00',
      horaFin: '10:00',
      estado: 'REALIZADO',
      plazoAsistencia: PLAZO,
      actual: false,
      registrable: false,
      textosPropios: { trabajado: 'Multiplicación', indicaciones: null },
      observacion: null,
    },
    {
      turnoId: 33,
      fecha: '2026-10-05',
      horaInicio: '10:00',
      horaFin: '11:00',
      estado: 'AUSENTE',
      plazoAsistencia: PLAZO,
      actual: false,
      registrable: false,
      textosPropios: null,
      observacion: 'Se retiró antes',
    },
  ],
}

describe('vistaHorasSeguidas', () => {
  it('la etiqueta del grupo', () => {
    expect(etiquetaHorasSeguidas(GRUPO)).toBe('8:00 a 11:00 · 3 h')
  })

  it('los textos del grupo una vez y, aparte, los propios y la observación de cada hora', () => {
    expect(vistaHorasSeguidas(GRUPO)).toEqual({
      etiqueta: '8:00 a 11:00 · 3 h',
      textos: [
        ['Qué se trabajó', 'Suma y resta de fracciones'],
        ['Indicaciones para la próxima sesión', 'Hacer la guía 3'],
      ],
      horas: [
        {
          turnoId: 31,
          fecha: '2026-10-05',
          horario: '8:00 a 9:00',
          estado: 'REALIZADO',
          plazo: PLAZO,
          actual: true,
          textos: [],
        },
        {
          turnoId: 32,
          fecha: '2026-10-05',
          horario: '9:00 a 10:00',
          estado: 'REALIZADO',
          plazo: PLAZO,
          actual: false,
          textos: [['Qué se trabajó', 'Multiplicación']],
        },
        {
          turnoId: 33,
          fecha: '2026-10-05',
          horario: '10:00 a 11:00',
          estado: 'AUSENTE',
          plazo: PLAZO,
          actual: false,
          textos: [['Observación', 'Se retiró antes']],
        },
      ],
    })
  })

  it('sin horas presentes, sin textos del grupo', () => {
    expect(vistaHorasSeguidas({ ...GRUPO, textos: null }).textos).toEqual([])
  })

  it('las del portal (sin observación) muestran los textos propios', () => {
    const portal: HorasSeguidasDelPortal = {
      ...GRUPO,
      ocurrencias: GRUPO.ocurrencias.map((hora) => ({
        turnoId: hora.turnoId,
        fecha: hora.fecha,
        horaInicio: hora.horaInicio,
        horaFin: hora.horaFin,
        estado: hora.estado,
        plazoAsistencia: hora.plazoAsistencia,
        actual: hora.actual,
        textosPropios: hora.textosPropios,
      })),
    }
    expect(vistaHorasSeguidas(portal).horas.map((h) => h.textos)).toEqual([
      [],
      [['Qué se trabajó', 'Multiplicación']],
      [],
    ])
  })
})

describe('textoCreacionTurno', () => {
  const CREADO = '2026-08-01T13:00:00.000Z'

  it('lo sacó el alumno desde el portal', () => {
    expect(textoCreacionTurno({ ...ANA, rol: 'ALUMNO' }, CREADO)).toBe(
      `Registrado por el alumno desde el portal · ${formatoInstante(CREADO)}`,
    )
  })

  it.each([
    ['la mesa de entrada', { ...ANA, rol: 'MESA_ENTRADAS' as const }],
    ['el seed', null],
  ])('lo creó %s: la línea de siempre', (_caso, createdBy) => {
    expect(textoCreacionTurno(createdBy, CREADO)).toBeUndefined()
  })
})
