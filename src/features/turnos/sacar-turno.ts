import { isValid, parseISO } from 'date-fns'
import { z } from 'zod'

import { fechaConDia } from '@/utils/formato-fechas'

import { textoHorario } from './formato-turnos'
import type { BloqueOfertado, HoraOfertada, MiTurnoCrear } from './mis-turnos.types'
import { MAX_TEMAS } from './turnos.schema'
import type { TipoTurno } from './turnos.types'

// "Sacar turno" del portal (HU-29): el formulario de los pasos 4 a 6, el body del alta y los textos
// que ve el alumno. Sin reglas: que la fecha sea desde mañana y caiga en el día del bloque, que el
// fin no sea anterior al inicio, la capacidad, la superposición y la deuda los decide la API, y sus
// 400 se muestran en el campo. `materiaId` y `bloqueIds` no son campos: salen de la selección.

/** Textos de los tipos para el alumno (la mesa dice "Sesión única" y "Recurrente"). */
export const TIPO_TURNO_PORTAL: Record<TipoTurno, { titulo: string; ayuda: string }> = {
  SESION_UNICA: { titulo: 'Una sola clase', ayuda: 'Elegís una fecha' },
  RECURRENTE: {
    titulo: 'Todas las semanas',
    ayuda: 'Desde una fecha y, si querés, hasta otra',
  },
}

const FECHA_FORMATO = /^\d{4}-\d{2}-\d{2}$/

const fechaSchema = z
  .string({ message: 'Elegí una fecha' })
  .min(1, { message: 'Elegí una fecha' })
  .regex(FECHA_FORMATO, { message: 'Fecha inválida: debe tener formato AAAA-MM-DD' })
  .refine((v) => isValid(parseISO(v)), { message: 'La fecha no es válida' })

/** Vacío = todas las semanas, sin fecha de fin. */
const fechaFinSchema = z
  .string()
  .optional()
  .refine((v) => !v || (FECHA_FORMATO.test(v) && isValid(parseISO(v))), {
    message: 'La fecha no es válida',
  })

const temasOpcionalesSchema = z
  .string()
  .max(MAX_TEMAS, { message: `No puede superar los ${MAX_TEMAS} caracteres` })
  .optional()

/** Una sola clase: obligatorio (la API también lo exige, con un 400 en `temas`). */
const temasObligatoriosSchema = z
  .string({ message: 'Contanos qué querés trabajar en la clase' })
  .max(MAX_TEMAS, { message: `No puede superar los ${MAX_TEMAS} caracteres` })
  .refine((v) => v.trim().length > 0, { message: 'Contanos qué querés trabajar en la clase' })

export const sacarTurnoFormSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('SESION_UNICA'),
    fecha: fechaSchema,
    temas: temasObligatoriosSchema,
  }),
  z.object({
    tipo: z.literal('RECURRENTE'),
    fechaInicio: fechaSchema,
    fechaFin: fechaFinSchema,
    temas: temasOpcionalesSchema,
  }),
])

export type SacarTurnoFormValues = z.input<typeof sacarTurnoFormSchema>

/** Campos del formulario que un 400 de la API puede marcar (según el tipo, están unos u otros). */
export type CampoSacarTurno = 'fecha' | 'fechaInicio' | 'fechaFin' | 'temas'

/** Valores iniciales de cada tipo, con la fecha propuesta (la de la disponibilidad elegida). */
export function sacarTurnoFormInicial(
  tipo: TipoTurno,
  fecha = '',
  temas = '',
): SacarTurnoFormValues {
  return tipo === 'SESION_UNICA'
    ? { tipo, fecha, temas }
    : { tipo, fechaInicio: fecha, fechaFin: '', temas }
}

/** Lo elegido en los pasos 1 a 3: la materia y las horas de un bloque. */
export type SeleccionMiTurno = {
  materiaId: number
  horas: Pick<HoraOfertada, 'bloqueId' | 'horaInicio'>[]
}

/**
 * Body de `POST /turnos/mis-turnos` (sin `alumnoId` ni `observaciones`). Una sola clase manda la
 * fecha como `fechaInicio`, sin `fechaFin`; todas las semanas sin fin manda `fechaFin: null`. Los
 * temas vacíos no se mandan. Los `bloqueIds` van ordenados por hora.
 */
export function armarMiTurnoCrear(
  seleccion: SeleccionMiTurno,
  valores: SacarTurnoFormValues,
  asignarDondeHayLugar: boolean,
): MiTurnoCrear {
  // `HH:mm` con dos dígitos: la comparación de textos es la de horas.
  const bloqueIds = [...seleccion.horas]
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    .map((hora) => hora.bloqueId)
  const temas = valores.temas?.trim()
  const fechas =
    valores.tipo === 'SESION_UNICA'
      ? { fechaInicio: valores.fecha }
      : { fechaInicio: valores.fechaInicio, fechaFin: valores.fechaFin || null }

  return {
    materiaId: seleccion.materiaId,
    bloqueIds,
    tipo: valores.tipo,
    ...fechas,
    ...(temas ? { temas } : {}),
    asignarDondeHayLugar,
  }
}

// ---------------------------------------------------------------------------------------------
// Selección (pasos 2 y 3)
// ---------------------------------------------------------------------------------------------

/** Identidad de un resultado: sus horas (los `bloqueIds`, ordenados). */
export function claveBloqueOfertado(bloque: Pick<BloqueOfertado, 'horas'>): string {
  return bloque.horas
    .map((hora) => hora.bloqueId)
    .sort((a, b) => a - b)
    .join('-')
}

/** Los profesores de los resultados, sin repetir y en el orden de la API (apellido y nombre). */
export function profesoresDe(bloques: readonly BloqueOfertado[]): BloqueOfertado['profesor'][] {
  const profesores: BloqueOfertado['profesor'][] = []
  for (const { profesor } of bloques) {
    if (!profesores.some((p) => p.id === profesor.id)) profesores.push(profesor)
  }
  return profesores
}

/** Los días de la semana de los resultados (ISO), sin repetir y de lunes a domingo. */
export function diasDe(bloques: readonly BloqueOfertado[]): number[] {
  return [...new Set(bloques.map((bloque) => bloque.diaSemana))].sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------------------------
// Textos para el alumno
// ---------------------------------------------------------------------------------------------

/** `['a']` → `'a'`; `['a', 'b', 'c']` → `'a, b y c'`. */
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`
}

/** Las horas elegidas, en orden: `'de 9:00 a 10:00 y de 11:00 a 12:00'`. */
export function textoHorasElegidas(
  horas: readonly Pick<HoraOfertada, 'horaInicio' | 'horaFin'>[],
): string {
  return enumerar(
    [...horas]
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
      .map((hora) => textoHorario(hora.horaInicio, hora.horaFin)),
  )
}

/**
 * Las fechas de un turno como las lee el alumno: `'Una sola clase, el lunes 12/10'`, `'Todas las
 * semanas, desde el lunes 05/10 hasta el lunes 30/11'` o `'Todas las semanas, desde el lunes
 * 05/10, sin fecha de fin'`. Sirve para el pedido (resumen) y para cada tramo creado: un tramo de
 * una sola fecha (un semanal cortado por una fecha completa) se lee `'El martes 20/10'`.
 */
export function textoFechasPortal(turno: {
  tipo: TipoTurno
  fechaInicio: string
  fechaFin?: string | null
}): string {
  const inicio = fechaConDia(turno.fechaInicio)
  if (turno.tipo === 'SESION_UNICA') return `Una sola clase, el ${inicio}`
  if (!turno.fechaFin) return `Todas las semanas, desde el ${inicio}, sin fecha de fin`
  if (turno.fechaFin === turno.fechaInicio) return `El ${inicio}`
  return `Todas las semanas, desde el ${inicio} hasta el ${fechaConDia(turno.fechaFin)}`
}
