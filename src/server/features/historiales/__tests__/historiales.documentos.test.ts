import { describe, expect, it } from 'vitest'
import { nombreArchivoPdf } from '@/server/shared/pdf/respuesta'
import { canceladosDeLosGrupos, nombreArchivoHistorial } from '../historiales.documentos'
import type { BloqueDelHistorial, GrupoDelHistorial } from '../historiales.validation'

// Lo propio del PDF del historial que no es dibujo (T-110): la lista de cancelados que sale de los
// grupos del historial y el nombre del archivo. Funciones puras, sin reloj ni base.

/** Una clase (una hora) del bloque; con `motivo`, una cancelada. */
function clase(
  datos: { turnoId: number; fecha: string; horaInicio: string; horaFin: string },
  motivo?: NonNullable<BloqueDelHistorial['clases'][number]['cancelacion']>['motivo'],
): BloqueDelHistorial['clases'][number] {
  return {
    ...datos,
    estado: motivo ? 'CANCELADO' : 'REALIZADO',
    plazoAsistencia: null,
    cerradaPorSistema: false,
    textosPropios: null,
    observacion: null,
    cancelacion: motivo ? { motivo, detalle: 'Viaje familiar' } : null,
  }
}

function bloque(clases: BloqueDelHistorial['clases']): BloqueDelHistorial {
  const primera = clases[0]
  const ultima = clases[clases.length - 1]
  return {
    fecha: primera.fecha,
    horaInicio: primera.horaInicio,
    horaFin: ultima.horaFin,
    horas: clases.length,
    textos: null,
    clases,
  }
}

function grupo(
  materia: { id: number; nombre: string },
  bloques: BloqueDelHistorial[],
): GrupoDelHistorial {
  return {
    materia,
    profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
    resumen: { realizadas: 1, ausencias: 0, porcentaje: 100 },
    bloques,
  }
}

describe('canceladosDeLosGrupos', () => {
  it('sólo las horas canceladas, con la materia y el profesor de su grupo', () => {
    const grupos = [
      grupo({ id: 3, nombre: 'Matemática' }, [
        bloque([clase({ turnoId: 1, fecha: '2026-10-13', horaInicio: '08:00', horaFin: '09:00' })]),
        bloque([
          clase(
            { turnoId: 2, fecha: '2026-10-06', horaInicio: '09:00', horaFin: '10:00' },
            'CANCELACION_PROFESOR',
          ),
        ]),
      ]),
    ]

    expect(canceladosDeLosGrupos(grupos)).toEqual([
      {
        turnoId: 2,
        fecha: '2026-10-06',
        horaInicio: '09:00',
        horaFin: '10:00',
        materia: 'Matemática',
        profesor: { nombre: 'Ana', apellido: 'Pérez' },
        motivo: 'CANCELACION_PROFESOR',
        detalle: 'Viaje familiar',
      },
    ])
  })

  it('de la fecha y la hora más recientes a las más antiguas, entre todos los grupos', () => {
    const grupos = [
      grupo({ id: 3, nombre: 'Matemática' }, [
        bloque([
          clase(
            { turnoId: 1, fecha: '2026-10-06', horaInicio: '08:00', horaFin: '09:00' },
            'CANCELACION_ALUMNO',
          ),
        ]),
      ]),
      grupo({ id: 7, nombre: 'Álgebra' }, [
        bloque([
          clase({ turnoId: 2, fecha: '2026-10-20', horaInicio: '08:00', horaFin: '09:00' }, 'OTRO'),
        ]),
        bloque([
          clase(
            { turnoId: 3, fecha: '2026-10-06', horaInicio: '16:00', horaFin: '17:00' },
            'PROBLEMA_ADMINISTRATIVO',
          ),
        ]),
      ]),
    ]

    expect(canceladosDeLosGrupos(grupos).map((c) => [c.fecha, c.horaInicio])).toEqual([
      ['2026-10-20', '08:00'],
      ['2026-10-06', '16:00'],
      ['2026-10-06', '08:00'],
    ])
  })

  it('un mes sin cancelados (o sin clases) da una lista vacía', () => {
    const sinCancelados = [
      grupo({ id: 3, nombre: 'Matemática' }, [
        bloque([clase({ turnoId: 1, fecha: '2026-10-13', horaInicio: '08:00', horaFin: '09:00' })]),
      ]),
    ]

    expect(canceladosDeLosGrupos(sinCancelados)).toEqual([])
    expect(canceladosDeLosGrupos([])).toEqual([])
  })
})

describe('nombreArchivoHistorial', () => {
  it('"historial-academico", el alumno (apellido y nombre) y el mes, con guiones (T-162)', () => {
    const nombre = nombreArchivoHistorial({
      alumno: { nombre: 'Juan', apellido: 'Pérez', dni: '30123456', nivelEscolaridad: null },
      mes: '2026-10',
    })

    expect(nombre).toBe('historial-academico-Pérez-Juan-2026-10')
    // Ya saneado: sin tildes, en minúsculas y sin `_` (que T-123 reserva para un rango).
    expect(nombreArchivoPdf(nombre)).toBe('historial-academico-perez-juan-2026-10')
  })

  it('un apellido compuesto y con espacios también queda en ASCII y con guiones', () => {
    const nombre = nombreArchivoHistorial({
      alumno: {
        nombre: 'María José',
        apellido: 'Núñez Peña',
        dni: '30123456',
        nivelEscolaridad: 'SECUNDARIO',
      },
      mes: '2026-09',
    })

    expect(nombreArchivoPdf(nombre)).toBe('historial-academico-nunez-pena-maria-jose-2026-09')
  })
})
