import { isValid, parseISO } from 'date-fns'
import { z } from 'zod'

import type { HoraDisponible, TurnoCrear } from './turnos.types'

// Schema del formulario de alta de turno: solo formato (docs/arquitectura-frontend.md →
// Formularios). Que la fecha caiga en el día del bloque, que no sea pasada, que el fin no sea
// anterior al inicio, la capacidad y los solapamientos los decide la API, y sus 400 se muestran en
// el campo. `alumnoId`, `materiaId` y `bloqueIds` no son campos: salen de la selección.

const FECHA_FORMATO = /^\d{4}-\d{2}-\d{2}$/
const MAX_MOTIVO = 500

/** Fecha `YYYY-MM-DD` válida (mismo criterio que `fechaNacimiento` de alumnos). */
const fechaFormatoSchema = z
  .string()
  .regex(FECHA_FORMATO, { message: 'Fecha inválida: debe tener formato AAAA-MM-DD' })
  .refine((v) => isValid(parseISO(v)), { message: 'La fecha no es válida' })

/**
 * La fecha tiene formato `YYYY-MM-DD` válido (solo formato, como el schema). La usa el refresco de
 * la ocupación por fecha, para no pedir la disponibilidad con una fecha a medio cargar.
 */
export function esFechaConFormato(valor: string | undefined): valor is string {
  return fechaFormatoSchema.safeParse(valor).success
}

const fechaSchema = z
  .string({ message: 'Campo obligatorio' })
  .min(1, { message: 'Campo obligatorio' })
  .pipe(fechaFormatoSchema)

/** Vacío = recurrente sin fin. */
const fechaOpcionalSchema = z
  .string()
  .optional()
  .pipe(z.union([z.literal(''), fechaFormatoSchema]).optional())

const motivoConsultaSchema = z
  .string()
  .max(MAX_MOTIVO, { message: `No puede superar los ${MAX_MOTIVO} caracteres` })
  .optional()
  .or(z.literal(''))

export const turnoFormSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('SESION_UNICA'),
    fecha: fechaSchema,
    motivoConsulta: motivoConsultaSchema,
  }),
  z.object({
    tipo: z.literal('RECURRENTE'),
    fechaInicio: fechaSchema,
    fechaFin: fechaOpcionalSchema,
    motivoConsulta: motivoConsultaSchema,
  }),
])

export type TurnoFormValues = z.input<typeof turnoFormSchema>

/** Campos del formulario que un 400 de la API puede marcar (según el tipo, están unos u otros). */
export const CAMPOS_TURNO_FORM = ['fecha', 'fechaInicio', 'fechaFin', 'motivoConsulta'] as const

export type CampoTurnoForm = (typeof CAMPOS_TURNO_FORM)[number]

/** Valores iniciales de cada tipo, para el alta y para cambiar de tipo sin arrastrar campos. */
export const TURNO_FORM_VACIO = {
  RECURRENTE: { tipo: 'RECURRENTE', fechaInicio: '', fechaFin: '', motivoConsulta: '' },
  SESION_UNICA: { tipo: 'SESION_UNICA', fecha: '', motivoConsulta: '' },
} as const satisfies Record<TurnoFormValues['tipo'], TurnoFormValues>

/** Lo que sale de la búsqueda: el alumno, la materia y las horas tildadas de un bloque. */
export type SeleccionTurno = {
  alumnoId: number
  materiaId: number
  horas: Pick<HoraDisponible, 'bloqueId' | 'horaInicio'>[]
}

/**
 * Body del `POST /turnos` a partir de la selección y del formulario. En una sesión única la fecha
 * va como `fechaInicio` (sin `fechaFin`); un recurrente sin fin manda `fechaFin: null`. El motivo
 * vacío (o solo espacios) no se manda. Los `bloqueIds` van ordenados por hora.
 */
export function armarTurnoCrear(
  seleccion: SeleccionTurno,
  valores: TurnoFormValues,
  asignarDondeHayLugar: boolean,
): TurnoCrear {
  // `HH:mm` con dos dígitos: la comparación de textos es la de horas.
  const bloqueIds = [...seleccion.horas]
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    .map((hora) => hora.bloqueId)
  const motivo = valores.motivoConsulta?.trim()

  const fechas =
    valores.tipo === 'SESION_UNICA'
      ? { fechaInicio: valores.fecha }
      : { fechaInicio: valores.fechaInicio, fechaFin: valores.fechaFin || null }

  return {
    alumnoId: seleccion.alumnoId,
    materiaId: seleccion.materiaId,
    bloqueIds,
    tipo: valores.tipo,
    ...fechas,
    ...(motivo ? { motivoConsulta: motivo } : {}),
    asignarDondeHayLugar,
  }
}
