import { describe, expect, it } from 'vitest'

import type { AsistenciaDeOcurrencia, HoraSeguida } from '@/types/ocurrencia'

import type { FilaAsistenciaForm } from '../asistencias.schema'
import {
  horasOfrecidasDelDetalle,
  registrosDeHoras,
  tieneAsistenciaRegistrada,
  valoresDeAsistencia,
} from '../registro-asistencia'

const FECHA = '2026-10-05'
const hora = (turnoId: number, horaInicio: string) => ({ turnoId, fecha: FECHA, horaInicio })

const PRESENTE: FilaAsistenciaForm = {
  estado: 'PRESENTE',
  trabajado: 'Fracciones',
  indicaciones: 'Guía 3',
  observacion: '',
  otrasHoras: [],
}

describe('registrosDeHoras', () => {
  it('un registro por hora, con el mismo estado y los mismos textos, en orden de hora', () => {
    expect(registrosDeHoras(hora(32, '09:00'), [hora(31, '08:00')], PRESENTE)).toEqual([
      {
        ocurrencias: [{ turnoId: 31, fecha: FECHA }],
        estado: 'PRESENTE',
        trabajado: 'Fracciones',
        indicaciones: 'Guía 3',
      },
      {
        ocurrencias: [{ turnoId: 32, fecha: FECHA }],
        estado: 'PRESENTE',
        trabajado: 'Fracciones',
        indicaciones: 'Guía 3',
      },
    ])
  })

  it('ausente: solo la observación', () => {
    const ausente = { ...PRESENTE, estado: 'AUSENTE' as const, observacion: 'Enfermo' }
    expect(registrosDeHoras(hora(31, '08:00'), [], ausente)).toEqual([
      { ocurrencias: [{ turnoId: 31, fecha: FECHA }], estado: 'AUSENTE', observacion: 'Enfermo' },
    ])
  })

  it('sin estado, nada', () => {
    expect(registrosDeHoras(hora(31, '08:00'), [], { ...PRESENTE, estado: null })).toEqual([])
  })
})

const REGISTRADA: AsistenciaDeOcurrencia = {
  estado: 'PRESENTE',
  trabajado: 'Fracciones',
  indicaciones: null,
  observacion: null,
  registradaPor: { id: 'u1', nombre: 'Ana', apellido: 'Pérez' },
  registradaEl: '2026-10-05T12:10:00.000Z',
  modificadaPor: { id: 'u1', nombre: 'Ana', apellido: 'Pérez' },
  modificadaEl: '2026-10-05T12:10:00.000Z',
  cerradaPorSistema: false,
}

const CERRADA: AsistenciaDeOcurrencia = {
  ...REGISTRADA,
  estado: null,
  trabajado: null,
  observacion: 'Cierre automático del sistema',
  registradaPor: null,
  registradaEl: null,
  modificadaPor: null,
  modificadaEl: null,
  cerradaPorSistema: true,
}

describe('valoresDeAsistencia', () => {
  it('abre con lo registrado de esa hora; los textos nulos, vacíos', () => {
    expect(valoresDeAsistencia(REGISTRADA)).toEqual({
      estado: 'PRESENTE',
      trabajado: 'Fracciones',
      indicaciones: '',
      observacion: '',
      otrasHoras: [],
    })
  })

  it('sin asistencia, vacío', () => {
    expect(valoresDeAsistencia(null)).toEqual({
      estado: null,
      trabajado: '',
      indicaciones: '',
      observacion: '',
      otrasHoras: [],
    })
  })
})

describe('tieneAsistenciaRegistrada', () => {
  it('presente o ausente: sí; sin asistencia o cerrada por el sistema: no', () => {
    expect(tieneAsistenciaRegistrada(REGISTRADA)).toBe(true)
    expect(tieneAsistenciaRegistrada({ ...REGISTRADA, estado: 'AUSENTE' })).toBe(true)
    expect(tieneAsistenciaRegistrada(null)).toBe(false)
    expect(tieneAsistenciaRegistrada(CERRADA)).toBe(false)
  })
})

function horaSeguida(
  turnoId: number,
  horaInicio: string,
  extra: Partial<HoraSeguida> = {},
): HoraSeguida {
  return {
    turnoId,
    fecha: FECHA,
    horaInicio,
    horaFin: `${String(Number(horaInicio.slice(0, 2)) + 1).padStart(2, '0')}:00`,
    estado: 'SIN_REGISTRAR',
    plazoAsistencia: { vence: '2026-10-12', vencido: false },
    actual: false,
    registrable: true,
    textosPropios: null,
    observacion: null,
    ...extra,
  }
}

describe('horasOfrecidasDelDetalle', () => {
  it('las registrables que no son la del detalle, tal como las marca la API', () => {
    const grupo = {
      ocurrencias: [
        horaSeguida(31, '08:00', { actual: true }),
        horaSeguida(32, '09:00'),
        horaSeguida(33, '10:00', { estado: 'REALIZADO', registrable: false }),
        horaSeguida(34, '11:00'),
      ],
    }
    expect(horasOfrecidasDelDetalle(grupo)).toEqual([
      { turnoId: 32, fecha: FECHA, horaInicio: '09:00', horaFin: '10:00' },
      { turnoId: 34, fecha: FECHA, horaInicio: '11:00', horaFin: '12:00' },
    ])
  })

  it('sin horas seguidas, ninguna', () => {
    expect(horasOfrecidasDelDetalle(null)).toEqual([])
  })
})
