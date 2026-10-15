import type { AsistenciaDeOcurrencia, HorasSeguidas } from '@/types/ocurrencia'

import type { FilaAsistenciaForm } from './asistencias.schema'
import type {
  AsistenciasDelDia,
  ClaseAsistencia,
  FilaAsistencia,
  HoraAsistencia,
  RegistroAsistencia,
} from './asistencias.types'

// La pantalla muestra una fila por alumno **en cada hora** (cada clase lista a todos los que están
// en esa hora). La API agrupa las horas seguidas de un alumno en una fila (`FilaAsistencia`); acá
// esa fila se reparte en sus horas, y las otras horas del grupo quedan en `otrasHoras`, para
// "Aplicar también a…". Sin reglas: la API decide si se puede registrar.

/** Una fila de la pantalla: un alumno en una hora. */
export type FilaDeHora = {
  /** `turnoId|fecha` de la hora: identifica la fila. */
  clave: string
  alumno: FilaAsistencia['alumno']
  materia: FilaAsistencia['materia']
  temas: string | null
  hora: HoraAsistencia
  /** Las otras horas seguidas del alumno ese día (con el mismo profesor y materia), en orden. */
  otrasHoras: HoraAsistencia[]
  indicacionesAnteriores: FilaAsistencia['indicacionesAnteriores']
}

/** Una clase con sus filas por hora. */
export type ClaseDeHora = Omit<ClaseAsistencia, 'filas'> & { filas: FilaDeHora[] }

const claveDe = (hora: { turnoId: number; fecha: string }) => `${hora.turnoId}|${hora.fecha}`

const ocurrencia = (hora: { turnoId: number; fecha: string }) => ({
  turnoId: hora.turnoId,
  fecha: hora.fecha,
})

/**
 * Las clases del día con **todos** los alumnos de cada hora: cada hora de una fila de la API va a
 * la clase de esa hora (un profesor tiene una sola clase por hora). Dentro de cada clase, por
 * apellido y nombre.
 */
export function clasesPorHora(dia: AsistenciasDelDia): ClaseDeHora[] {
  const grupos = dia.clases.flatMap((c) => c.filas)
  return dia.clases.map((clase) => ({
    bloqueAgendaId: clase.bloqueAgendaId,
    horaInicio: clase.horaInicio,
    horaFin: clase.horaFin,
    aula: clase.aula,
    filas: grupos
      .flatMap((grupo) =>
        grupo.ocurrencias
          .filter((hora) => hora.horaInicio === clase.horaInicio)
          .map((hora) => ({
            clave: claveDe(hora),
            alumno: grupo.alumno,
            materia: grupo.materia,
            temas: grupo.temas,
            hora,
            otrasHoras: grupo.ocurrencias.filter((otra) => otra !== hora),
            indicacionesAnteriores: grupo.indicacionesAnteriores,
          })),
      )
      .sort(
        (a, b) =>
          a.alumno.apellido.localeCompare(b.alumno.apellido) ||
          a.alumno.nombre.localeCompare(b.alumno.nombre),
      ),
  }))
}

/** Lo que necesita un registro de una hora (`registrosDeHoras`). */
export type HoraARegistrar = { turnoId: number; fecha: string; horaInicio: string }

/** Una hora que ofrece "Aplicar también a…": se muestra con su horario. */
export type HoraOfrecida = HoraARegistrar & { horaFin: string }

/** Lo que el formulario usa de una asistencia ya registrada (la de la pantalla o la del detalle). */
type AsistenciaParaFormulario = Pick<
  AsistenciaDeOcurrencia,
  'estado' | 'trabajado' | 'indicaciones' | 'observacion'
>

/** Los valores con los que se abre el formulario a partir de una asistencia (o de ninguna). */
export function valoresDeAsistencia(a: AsistenciaParaFormulario | null): FilaAsistenciaForm {
  return {
    estado: a?.estado ?? null,
    trabajado: a?.trabajado ?? '',
    indicaciones: a?.indicaciones ?? '',
    observacion: a?.observacion ?? '',
    otrasHoras: [],
  }
}

/** Los valores con los que se abre el formulario: lo ya registrado de esa hora. */
export function valoresIniciales(fila: FilaDeHora): FilaAsistenciaForm {
  return valoresDeAsistencia(fila.hora.asistencia)
}

/**
 * Las otras horas del alumno que se ofrecen en "Aplicar también a…": las que todavía no están
 * registradas (una ya registrada se corrige desde su propia fila).
 */
export function otrasHorasSinRegistrar(fila: FilaDeHora): HoraAsistencia[] {
  return fila.otrasHoras.filter((h) => h.asistencia === null)
}

/**
 * Los registros de una fila: esa hora y, con "Aplicar también a…", cada otra hora sin registrar
 * tildada (`registrosDeHoras`).
 */
export function registrosDeFila(
  fila: FilaDeHora,
  valores: FilaAsistenciaForm,
): RegistroAsistencia[] {
  const tildadas = otrasHorasSinRegistrar(fila).filter((h) =>
    valores.otrasHoras.includes(h.turnoId),
  )
  return registrosDeHoras(fila.hora, tildadas, valores)
}

/**
 * Los registros de una hora y de las otras tildadas en "Aplicar también a…", con el mismo estado
 * y los mismos textos, en orden de hora. Un registro por hora, así se pueden tildar horas que no
 * son seguidas entre sí; el `PUT` es todo o nada. Un texto vacío viaja como `''` y la API lo guarda
 * como `null`. `[]` si falta el estado. Lo usan la pantalla "Asistencia" y el detalle del turno.
 */
export function registrosDeHoras(
  hora: HoraARegistrar,
  otrasTildadas: HoraARegistrar[],
  valores: FilaAsistenciaForm,
): RegistroAsistencia[] {
  if (valores.estado === null) return []
  const estado = valores.estado
  return [hora, ...otrasTildadas]
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    .map((hora) =>
      estado === 'PRESENTE'
        ? {
            ocurrencias: [ocurrencia(hora)],
            estado,
            trabajado: valores.trabajado,
            indicaciones: valores.indicaciones,
          }
        : { ocurrencias: [ocurrencia(hora)], estado, observacion: valores.observacion },
    )
}

/**
 * "Marcar todos presentes" de una clase: un registro `PRESENTE` por cada alumno de esa hora sin
 * registrar. Los ya registrados no se mandan, así no cambian.
 */
export function registrosMarcarTodos(clase: ClaseDeHora): RegistroAsistencia[] {
  return clase.filas
    .filter((fila) => fila.hora.asistencia === null)
    .map((fila) => ({ ocurrencias: [ocurrencia(fila.hora)], estado: 'PRESENTE' }))
}

/**
 * La fila se ve compacta, en sólo lectura con "Corregir": toda hora ya registrada (presente o
 * ausente, con o sin textos). Sin registrar, el formulario directo.
 */
export function seVeCompacta(fila: FilaDeHora): boolean {
  return fila.hora.asistencia !== null
}

/** Los textos registrados que tienen algo, con su etiqueta, para la vista compacta. */
export function textosRegistrados(fila: FilaDeHora): [string, string][] {
  const a = fila.hora.asistencia
  if (!a) return []
  const textos: [string, string | null][] =
    a.estado === 'PRESENTE'
      ? [
          ['Qué se trabajó', a.trabajado],
          ['Indicaciones para la próxima sesión', a.indicaciones],
        ]
      : [['Observación', a.observacion]]
  return textos.filter((t): t is [string, string] => Boolean(t[1]))
}

/**
 * El detalle del turno ya tiene asistencia registrada de esa hora (presente o ausente): se ve
 * "Corregir". Sin ella (o cerrada por el sistema, que no trae estado), el formulario directo.
 */
export function tieneAsistenciaRegistrada(asistencia: { estado: unknown } | null): boolean {
  return asistencia !== null && asistencia.estado !== null
}

/**
 * Las horas que el detalle del turno ofrece en "Aplicar también a…": las de sus horas seguidas que
 * la API marca `registrable`, salvo la del detalle. Sin reglas propias.
 */
export function horasOfrecidasDelDetalle(
  horasSeguidas: Pick<HorasSeguidas, 'ocurrencias'> | null,
): HoraOfrecida[] {
  if (!horasSeguidas) return []
  return horasSeguidas.ocurrencias
    .filter((h) => h.registrable && !h.actual)
    .map(({ turnoId, fecha, horaInicio, horaFin }) => ({ turnoId, fecha, horaInicio, horaFin }))
}
