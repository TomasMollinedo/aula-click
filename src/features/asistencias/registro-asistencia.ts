import type { FilaAsistenciaForm } from './asistencias.schema'
import type {
  ClaseAsistencia,
  EstadoAsistencia,
  FilaAsistencia,
  RegistroAsistencia,
} from './asistencias.types'

// Del formulario de una fila al body del `PUT /asistencias`, y al revés (lo ya registrado como
// valores iniciales). Sin reglas: la API decide si se puede registrar.

const ocurrencia = (hora: { turnoId: number; fecha: string }) => ({
  turnoId: hora.turnoId,
  fecha: hora.fecha,
})

/**
 * Los valores con los que se abre el formulario: lo ya registrado. Si todas las horas tienen el
 * mismo estado (o ninguna está registrada), uno para la fila; si difieren, "Ajustar por hora".
 * Los textos de presente salen de la primera hora presente; la observación, de la primera ausente.
 */
export function valoresIniciales(fila: FilaAsistencia): FilaAsistenciaForm {
  const estados = fila.ocurrencias.map((h) => h.asistencia?.estado ?? null)
  const distintos = new Set(estados).size > 1
  const presente = fila.ocurrencias.find((h) => h.asistencia?.estado === 'PRESENTE')?.asistencia
  const ausente = fila.ocurrencias.find((h) => h.asistencia?.estado === 'AUSENTE')?.asistencia
  return {
    estado: distintos ? null : (estados[0] ?? null),
    trabajado: presente?.trabajado ?? '',
    indicaciones: presente?.indicaciones ?? '',
    observacion: ausente?.observacion ?? '',
    ajustarPorHora: distintos,
    porHora: fila.ocurrencias.map((h) => ({
      estado: h.asistencia?.estado ?? null,
      observacion: h.asistencia?.estado === 'AUSENTE' ? (h.asistencia.observacion ?? '') : '',
    })),
  }
}

function registro(
  horas: { turnoId: number; fecha: string }[],
  estado: EstadoAsistencia,
  valores: Pick<FilaAsistenciaForm, 'trabajado' | 'indicaciones'>,
  observacion: string,
): RegistroAsistencia {
  return estado === 'PRESENTE'
    ? {
        ocurrencias: horas.map(ocurrencia),
        estado,
        trabajado: valores.trabajado,
        indicaciones: valores.indicaciones,
      }
    : { ocurrencias: horas.map(ocurrencia), estado, observacion }
}

/**
 * Los registros de una fila. Sin "Ajustar por hora", uno con todas sus horas. Con "Ajustar por
 * hora", uno por hora: las presentes llevan los textos de la fila (uno por fila) y cada ausente,
 * su propia observación. Un texto vacío viaja como `''` y la API lo guarda como `null`.
 */
export function registrosDeFila(
  fila: FilaAsistencia,
  valores: FilaAsistenciaForm,
): RegistroAsistencia[] {
  if (!valores.ajustarPorHora) {
    if (valores.estado === null) return []
    return [registro(fila.ocurrencias, valores.estado, valores, valores.observacion)]
  }
  return fila.ocurrencias.flatMap((hora, i) => {
    const deLaHora = valores.porHora[i]
    if (!deLaHora || deLaHora.estado === null) return []
    return [registro([hora], deLaHora.estado, valores, deLaHora.observacion)]
  })
}

/** La fila no tiene ninguna hora registrada. */
export function esFilaSinRegistrar(fila: FilaAsistencia): boolean {
  return fila.ocurrencias.every((h) => h.asistencia === null)
}

/**
 * "Marcar todos presentes" de una clase: un registro `PRESENTE` por cada fila sin registrar. Las
 * ya registradas no se mandan, así no cambian.
 */
export function registrosMarcarTodos(clase: ClaseAsistencia): RegistroAsistencia[] {
  return clase.filas
    .filter(esFilaSinRegistrar)
    .map((fila) => ({ ocurrencias: fila.ocurrencias.map(ocurrencia), estado: 'PRESENTE' }))
}
