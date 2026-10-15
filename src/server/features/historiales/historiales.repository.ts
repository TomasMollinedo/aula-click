import { prisma } from '@/lib/prisma'
import {
  ultimasIndicaciones,
  type IndicacionesAnteriores,
} from '@/server/features/asistencias/asistencias.condiciones'
import {
  leerOcurrencias,
  materiasDelProfesorConAlumno,
  type FiltroOcurrencias,
  type Ocurrencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import { dateAFecha, type Reloj } from '@/server/shared/fechas'

// Único lugar de la feature que usa Prisma. `historiales` no tiene tabla propia (HU-31, HU-33): es
// una lectura sobre el motor de ocurrencias de `turnos` (T-74) más las indicaciones de la última
// clase de `asistencias` (T-81). Un repository no puede importar otro repository (ESLint): la fecha
// del primer turno del alumno, que no publica ninguna otra feature, se consulta acá directo.

export type { IndicacionesAnteriores, Ocurrencia }

export const historialesRepository = {
  /**
   * Ocurrencias del alumno en `[desde, hasta]` (motor de T-30 y T-74), **incluidas las
   * canceladas**, con su estado, su asistencia, su plazo y su cancelación. El service recorta
   * `hasta` a hoy cuando quiere sólo clases ya dadas.
   */
  async leerOcurrenciasDelAlumno(filtro: FiltroOcurrencias, reloj?: Reloj): Promise<Ocurrencia[]> {
    return leerOcurrencias(prisma, filtro, reloj)
  },

  /**
   * `fechaInicio` del primer turno `ACTIVO` del alumno (`_min`, una consulta), o `null` si no
   * tiene ninguno: el borde desde el que se lee su **historial completo** (filtros de la pantalla y
   * porcentajes de "Mis materias"), sin inventar una ventana fija. Los turnos `CANCELADO` no
   * generan ocurrencias (decisión T-56), así que no cuentan.
   */
  async buscarFechaDelPrimerTurno(alumnoId: number): Promise<string | null> {
    const { _min } = await prisma.turno.aggregate({
      where: { alumnoId, estado: 'ACTIVO' },
      _min: { fechaInicio: true },
    })
    return _min.fechaInicio ? dateAFecha(_min.fechaInicio) : null
  },

  /**
   * Si el alumno tiene o tuvo turnos con el profesor (`materiasDelProfesorConAlumno` del motor no
   * vacío): el criterio de "Mis alumnos", con el que el profesor ve el historial **completo** de su
   * alumno, también las clases de otras materias y profesores (HU-31).
   */
  async profesorTieneAlumno(profesorId: number, alumnoId: number): Promise<boolean> {
    const materias = await materiasDelProfesorConAlumno(prisma, { profesorId, alumnoId })
    return materias.length > 0
  },

  /**
   * Las indicaciones de la última clase `PRESENTE` del alumno en esa materia (de cualquier
   * profesor) anterior a `antesDe`, o `null` si no hay: "Indicaciones para la próxima clase" del
   * portal (HU-33). Una sola consulta, la de `asistencias` (T-81).
   */
  async buscarUltimasIndicaciones(consulta: {
    alumnoId: number
    materiaId: number
    antesDe: string
  }): Promise<IndicacionesAnteriores | null> {
    const [indicaciones] = await ultimasIndicaciones(prisma, [consulta])
    return indicaciones ?? null
  },
}

export type HistorialesRepository = typeof historialesRepository
