import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import { type FilaAsistenciaForm, filaAsistenciaSchema } from '../asistencias.schema'
import type { AsistenciasDelDia, FilaAsistencia, HoraAsistencia } from '../asistencias.types'
import { mensajeErrorCarga, mensajeErrorRegistro } from '../errores-asistencias'
import { paramsDeFecha, parsearFechaAsistencia } from '../fecha-asistencia'
import { textoContador, textoOtrasHoras, textoPendientes } from '../formato-asistencias'
import {
  type FilaDeHora,
  clasesPorHora,
  otrasHorasSinRegistrar,
  registrosDeFila,
  registrosMarcarTodos,
  seVeCompacta,
  textosRegistrados,
  valoresIniciales,
} from '../registro-asistencia'

const HOY = '2026-10-14'

const finDe = (inicio: string) => `${String(Number(inicio.slice(0, 2)) + 1).padStart(2, '0')}:00`

function hora(turnoId: number, inicio: string, asistencia: HoraAsistencia['asistencia'] = null) {
  return {
    turnoId,
    fecha: HOY,
    horaInicio: inicio,
    horaFin: finDe(inicio),
    estado: asistencia ? (asistencia.estado === 'PRESENTE' ? 'REALIZADO' : 'AUSENTE') : 'AGENDADO',
    asistencia,
  } satisfies HoraAsistencia
}

/** Una fila de la API: las horas seguidas de un alumno. */
function grupo(apellido: string, ocurrencias: HoraAsistencia[]): FilaAsistencia {
  return {
    alumno: { id: apellido.length, apellido, nombre: 'X', fotoUrl: null },
    materia: { id: 3, nombre: 'Matemática' },
    temas: 'Fracciones',
    horaInicio: ocurrencias[0]?.horaInicio ?? '16:00',
    horaFin: ocurrencias.at(-1)?.horaFin ?? '17:00',
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

const clase = (bloqueAgendaId: number, horaInicio: string, filas: FilaAsistencia[]) => ({
  bloqueAgendaId,
  horaInicio,
  horaFin: finDe(horaInicio),
  aula: { id: 1, nombre: 'Aula 1' },
  filas,
})

function dia(clases: AsistenciasDelDia['clases']): AsistenciasDelDia {
  return { fecha: HOY, plazo: { vence: '2026-10-21', vencido: false }, editable: true, clases }
}

/** Como la manda la API: Pérez (16 a 18) va en la clase de las 16; la de las 17, sólo con Arias. */
const diaDePrueba = () =>
  dia([
    clase(1, '16:00', [
      grupo('Pérez', [hora(41, '16:00'), hora(42, '17:00')]),
      grupo('Gómez', [hora(51, '16:00', presente('Despeje'))]),
    ]),
    clase(2, '17:00', [grupo('Arias', [hora(61, '17:00')])]),
  ])

function filaDe(apellido: string, enLaClase = 0): FilaDeHora {
  const fila = clasesPorHora(diaDePrueba())[enLaClase]?.filas.find(
    (f) => f.alumno.apellido === apellido,
  )
  if (!fila) throw new Error(`falta la fila de ${apellido}`)
  return fila
}

/** La única fila de un día con un alumno de una hora con esa asistencia. */
function filaCon(asistencia: HoraAsistencia['asistencia']): FilaDeHora {
  const fila = clasesPorHora(
    dia([clase(1, '16:00', [grupo('Pérez', [hora(41, '16:00', asistencia)])])]),
  )[0]?.filas[0]
  if (!fila) throw new Error('falta la fila')
  return fila
}

const ocurrencias = (...ids: number[]) => ids.map((turnoId) => ({ turnoId, fecha: HOY }))

describe('clasesPorHora', () => {
  it('cada clase lista a todos los alumnos de esa hora: el de 16 a 18 aparece en las dos', () => {
    const [a16, a17] = clasesPorHora(diaDePrueba())

    expect(a16?.filas.map((f) => [f.alumno.apellido, f.hora.turnoId])).toEqual([
      ['Gómez', 51],
      ['Pérez', 41],
    ])
    expect(a17?.filas.map((f) => [f.alumno.apellido, f.hora.turnoId])).toEqual([
      ['Arias', 61],
      ['Pérez', 42],
    ])
  })

  it('cada fila sabe las otras horas seguidas del alumno', () => {
    expect(filaDe('Pérez').otrasHoras.map((h) => h.turnoId)).toEqual([42])
    expect(filaDe('Pérez', 1).otrasHoras.map((h) => h.turnoId)).toEqual([41])
    expect(filaDe('Gómez').otrasHoras).toEqual([])
  })
})

describe('registrosDeFila', () => {
  const valores = (parcial: Partial<FilaAsistenciaForm>): FilaAsistenciaForm => ({
    estado: 'PRESENTE',
    trabajado: 'Despeje',
    indicaciones: 'Repasar',
    observacion: '',
    otrasHoras: [],
    ...parcial,
  })
  const presenteEn = (turnoId: number) => ({
    ocurrencias: ocurrencias(turnoId),
    estado: 'PRESENTE',
    trabajado: 'Despeje',
    indicaciones: 'Repasar',
  })

  it('presente: sólo esa hora, con sus textos', () => {
    expect(registrosDeFila(filaDe('Pérez'), valores({}))).toEqual([presenteEn(41)])
  })

  it('"Aplicar también a…": esa hora y cada otra tildada, en orden, con los mismos textos', () => {
    expect(registrosDeFila(filaDe('Pérez', 1), valores({ otrasHoras: [41] }))).toEqual([
      presenteEn(41),
      presenteEn(42),
    ])
  })

  it('ausente: sólo la observación', () => {
    expect(
      registrosDeFila(filaDe('Pérez'), valores({ estado: 'AUSENTE', observacion: 'Enfermo' })),
    ).toEqual([{ ocurrencias: ocurrencias(41), estado: 'AUSENTE', observacion: 'Enfermo' }])
  })

  it('sin estado no arma nada', () => {
    expect(registrosDeFila(filaDe('Pérez'), valores({ estado: null }))).toEqual([])
  })

  it('corregir abre con lo registrado de esa hora', () => {
    expect(valoresIniciales(filaDe('Gómez'))).toEqual({
      estado: 'PRESENTE',
      trabajado: 'Despeje',
      indicaciones: '',
      observacion: '',
      otrasHoras: [],
    })
  })
})

describe('otras horas de 16 a 19 (Julieta)', () => {
  // 16 ya registrada (presente); 17 y 18 sin registrar.
  const julieta = (enLaClase: number) => {
    const fila = clasesPorHora(
      dia([
        clase(1, '16:00', [
          grupo('Julieta', [hora(71, '16:00', presente()), hora(72, '17:00'), hora(73, '18:00')]),
        ]),
        clase(2, '17:00', []),
        clase(3, '18:00', []),
      ]),
    )[enLaClase]?.filas[0]
    if (!fila) throw new Error('falta la fila')
    return fila
  }

  it('desde las 17 sólo se ofrece la de las 18: la de las 16 ya está registrada', () => {
    expect(otrasHorasSinRegistrar(julieta(1)).map((h) => h.turnoId)).toEqual([73])
  })

  it('una hora ya registrada no se manda aunque venga tildada', () => {
    expect(
      registrosDeFila(julieta(1), {
        estado: 'PRESENTE',
        trabajado: '',
        indicaciones: '',
        observacion: '',
        otrasHoras: [71, 73],
      }).map((r) => r.ocurrencias[0]?.turnoId),
    ).toEqual([72, 73])
  })
})

describe('registrosMarcarTodos', () => {
  it('un PRESENTE por cada alumno de esa hora sin registrar; los registrados no se mandan', () => {
    const [a16] = clasesPorHora(diaDePrueba())
    expect(a16 && registrosMarcarTodos(a16)).toEqual([
      { ocurrencias: ocurrencias(41), estado: 'PRESENTE' },
    ])
  })
})

describe('vista compacta', () => {
  it('toda hora registrada (con o sin textos) se ve compacta, con "Corregir"', () => {
    expect(seVeCompacta(filaCon(ausente()))).toBe(true)
    expect(seVeCompacta(filaCon(presente('Despeje')))).toBe(true)
    expect(seVeCompacta(filaCon(presente()))).toBe(true)
  })

  it('sin registrar: formulario abierto', () => {
    expect(seVeCompacta(filaCon(null))).toBe(false)
  })

  it('sólo muestra los textos que tienen algo', () => {
    expect(textosRegistrados(filaCon(presente('Despeje')))).toEqual([['Qué se trabajó', 'Despeje']])
    expect(textosRegistrados(filaCon(ausente()))).toEqual([])
    expect(textosRegistrados(filaCon(ausente('Enfermo')))).toEqual([['Observación', 'Enfermo']])
  })
})

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
  it('las otras horas del alumno', () => {
    expect(textoOtrasHoras([{ horaInicio: '17:00', horaFin: '18:00' }])).toBe('17:00 a 18:00')
    expect(
      textoOtrasHoras([
        { horaInicio: '16:00', horaFin: '17:00' },
        { horaInicio: '18:00', horaFin: '19:00' },
      ]),
    ).toBe('16:00 a 17:00 y 18:00 a 19:00')
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

describe('schema del formulario de una fila', () => {
  const valores = (parcial: Partial<FilaAsistenciaForm>): FilaAsistenciaForm => ({
    estado: 'PRESENTE',
    trabajado: '',
    indicaciones: '',
    observacion: '',
    otrasHoras: [],
    ...parcial,
  })

  it('exige elegir Presente o Ausente', () => {
    expect(filaAsistenciaSchema.safeParse(valores({ estado: null })).success).toBe(false)
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
