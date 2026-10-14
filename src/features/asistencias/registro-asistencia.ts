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

/** Los valores con los que se abre el formulario: lo ya registrado de esa hora. */
export function valoresIniciales(fila: FilaDeHora): FilaAsistenciaForm {
  const a = fila.hora.asistencia
  return {
    estado: a?.estado ?? null,
    trabajado: a?.trabajado ?? '',
    indicaciones: a?.indicaciones ?? '',
    observacion: a?.observacion ?? '',
    otrasHoras: [],
  }
}

/**
 * Las otras horas del alumno que se ofrecen en "Aplicar también a…": las que todavía no están
 * registradas (una ya registrada se corrige desde su propia fila).
 */
export function otrasHorasSinRegistrar(fila: FilaDeHora): HoraAsistencia[] {
  return fila.otrasHoras.filter((h) => h.asistencia === null)
}

/**
 * Los registros de una fila: esa hora y, con "Aplicar también a…", cada otra hora tildada, con el
 * mismo estado y los mismos textos. Un registro por hora, así se pueden tildar horas que no son
 * seguidas entre sí; el `PUT` es todo o nada. Un texto vacío viaja como `''` y la API lo guarda
 * como `null`. `[]` si falta el estado.
 */
export function registrosDeFila(
  fila: FilaDeHora,
  valores: FilaAsistenciaForm,
): RegistroAsistencia[] {
  if (valores.estado === null) return []
  const estado = valores.estado
  const tildadas = otrasHorasSinRegistrar(fila).filter((h) =>
    valores.otrasHoras.includes(h.turnoId),
  )
  return [fila.hora, ...tildadas]
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
