import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { ExamenDelPeriodo } from '@/server/features/examenes/examenes.condiciones'
import { mesDe, primerDiaDelMes, ultimoDiaDelMes } from '@/server/shared/zod'
import type { ClaseDelHistorial, GrupoDelHistorial } from './historiales.validation'

// Lo propio del documento PDF del historial académico (T-110, HU-32) que no es dibujo: la forma de
// lo que el service le pasa a la plantilla, la lista de cancelados que sale de los mismos grupos y
// el nombre del archivo (docs/contrato-api.md → Documentos PDF). `respuestaPdf` lo sanea (tildes,
// espacios, mayúsculas). Funciones puras: no leen la base ni el reloj.

/** El alumno como lo trae `alumnosRepository.buscarPorId` (de ahí sale el nivel de escolaridad). */
type AlumnoGuardado = NonNullable<Awaited<ReturnType<AlumnosRepository['buscarPorId']>>>

/** Lo que el documento muestra del alumno (HU-32). **Sin** sus observaciones internas. */
export type AlumnoDelDocumento = Pick<
  AlumnoGuardado,
  'nombre' | 'apellido' | 'dni' | 'nivelEscolaridad'
>

/** Nivel de escolaridad del alumno, el del modelo: lo etiqueta `historiales.formato.ts`. */
export type NivelEscolaridad = NonNullable<AlumnoDelDocumento['nivelEscolaridad']>

/** Motivo de una cancelación, el mismo del historial JSON (HU-13). */
export type MotivoDeCancelacion = NonNullable<ClaseDelHistorial['cancelacion']>['motivo']

/** Una hora cancelada del mes, con su materia y su profesor (salen del grupo que la contiene). */
export type CanceladoDelDocumento = {
  turnoId: number
  fecha: string
  horaInicio: string
  horaFin: string
  materia: string
  profesor: { nombre: string; apellido: string }
  motivo: MotivoDeCancelacion
  detalle: string | null
}

/**
 * Los filtros con los que se pidió el documento, para que la hoja diga qué se está viendo. El
 * nombre lo resuelve el service con el historial **completo** del alumno; es `null` si ese id no
 * está en su historial (el documento muestra el id, así se ve igual que la pantalla pidió).
 */
export type FiltrosDelDocumento = {
  materiaId: number | null
  profesorId: number | null
  materia: string | null
  profesor: { nombre: string; apellido: string } | null
}

/** Lo que va en el PDF del historial académico de un alumno en un período. */
export type HistorialDocumento = {
  alumno: AlumnoDelDocumento
  /**
   * El mes (`AAAA-MM`) cuando el período es un mes **completo**, y `null` cuando es un rango
   * cualquiera (decisión T-163): de eso dependen el nombre del archivo y el rótulo del campo.
   */
  mes: string | null
  /** Primer día del período, incluido. */
  desde: string
  /** Último día del período, incluido (las clases llegan hasta hoy, como en la pantalla). */
  hasta: string
  filtros: FiltrosDelDocumento
  /** Los **mismos** grupos del historial de la pantalla: resumen y bloques de horas seguidas. */
  grupos: GrupoDelHistorial[]
  /** Las horas canceladas del mes (`canceladosDeLosGrupos`). */
  cancelados: CanceladoDelDocumento[]
  /** Los exámenes del mes con su resultado y su nota (HU-34). */
  examenes: ExamenDelPeriodo[]
}

/**
 * Las horas canceladas del mes, de los **mismos grupos** del historial: una cancelada ya viene
 * como un bloque de una, con su `cancelacion` (HU-13), así que no se vuelve a leer el motor. De la
 * fecha y la hora más recientes a las más antiguas, como los bloques.
 */
export function canceladosDeLosGrupos(
  grupos: readonly GrupoDelHistorial[],
): CanceladoDelDocumento[] {
  const cancelados = grupos.flatMap((grupo) =>
    grupo.bloques.flatMap((bloque) =>
      bloque.clases.flatMap((clase) =>
        clase.cancelacion === null
          ? []
          : [
              {
                turnoId: clase.turnoId,
                fecha: clase.fecha,
                horaInicio: clase.horaInicio,
                horaFin: clase.horaFin,
                materia: grupo.materia.nombre,
                profesor: { nombre: grupo.profesor.nombre, apellido: grupo.profesor.apellido },
                motivo: clase.cancelacion.motivo,
                detalle: clase.cancelacion.detalle,
              },
            ],
      ),
    ),
  )
  return cancelados.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
    if (a.horaInicio !== b.horaInicio) return a.horaInicio < b.horaInicio ? 1 : -1
    return a.turnoId - b.turnoId
  })
}

/**
 * El mes `AAAA-MM` si `[desde, hasta]` es **un mes completo** (del primero al último día), o `null`
 * si es cualquier otro rango: con eso el documento se nombra y se rotula como mensual o como de un
 * período (decisión T-163). Lanza `RangeError` si una fecha es inválida (`mesDe`).
 */
export function mesDelPeriodo(desde: string, hasta: string): string | null {
  const mes = mesDe(desde)
  const esMesCompleto = desde === primerDiaDelMes(mes) && hasta === ultimoDiaDelMes(mes)
  return esMesCompleto ? mes : null
}

/**
 * `historial-academico-gonzalez-lucia-2026-10` con un mes completo y
 * `historial-academico-gonzalez-lucia-2026-10-05_2026-11-12` con un rango (sin extensión). HU-32
 * pide los `_` que la decisión T-123 reserva para las dos fechas de un rango, así que entre las
 * partes van guiones (decisión T-162) y el `_` queda sólo para separar las dos fechas.
 */
export function nombreArchivoHistorial(
  documento: Pick<HistorialDocumento, 'alumno' | 'mes' | 'desde' | 'hasta'>,
): string {
  const { alumno, mes, desde, hasta } = documento
  const periodo = mes ?? `${desde}_${hasta}`
  return `historial-academico-${alumno.apellido}-${alumno.nombre}-${periodo}`
}
