import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'
import type { LucideIcon } from 'lucide-react'
import {
  Calendar1,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  Lock,
  UserRoundX,
} from 'lucide-react'
import type { ComponentProps } from 'react'

import type { Badge } from '@/components/ui/badge'

// Presentación del estado, el estado de pago y la prioridad de un turno (una ocurrencia): etiquetas,
// variantes y textos. Sin reglas: el estado, el pago, la prioridad y los días hasta el examen los
// calcula la API (HU-18, T-31); acá solo se traducen a lo que se ve. Las fechas son `YYYY-MM-DD` y
// se leen con `parseISO` (hora local), nunca con `new Date('YYYY-MM-DD')`.

/**
 * Estado de una ocurrencia, como lo manda la API. `REALIZADO` y `AUSENTE` salen de la asistencia
 * registrada (HU-22); `SIN_REGISTRAR` es un turno pasado sin asistencia.
 */
export type EstadoTurno = 'AGENDADO' | 'CANCELADO' | 'SIN_REGISTRAR' | 'REALIZADO' | 'AUSENTE'

/**
 * Plazo para registrar la asistencia, tal cual lo manda la API (`plazoAsistencia`): su último día
 * (`YYYY-MM-DD`) y si ya pasó. El front no calcula ninguno de los dos.
 */
export interface PlazoAsistencia {
  vence: string
  vencido: boolean
}

/** Estado de pago de una ocurrencia, como lo manda la API. */
export type EstadoPago = 'PENDIENTE' | 'PAGADO'

/** Prioridad de una ocurrencia (HU-18), como la manda la API. */
export type Prioridad = 'ALTA' | 'MEDIA' | 'BAJA'

/**
 * Lo que el indicador usa del examen que determina la prioridad. El `examen` de la API trae además
 * `id` y `tipo`: se puede pasar entero.
 */
export interface ExamenPrioridad {
  materiaNombre: string
  /** `YYYY-MM-DD`. */
  fecha: string
  /** Días desde la fecha del turno hasta el examen (0 = el mismo día). Lo calcula la API. */
  dias: number
}

export type VariantePrioridad = 'fila' | 'punto' | 'detalle'

type VarianteBadge = NonNullable<ComponentProps<typeof Badge>['variant']>

interface EstiloBadge {
  etiqueta: string
  variante: VarianteBadge
}

/** Como `EstiloBadge`, más el ícono que acompaña a la palabra: cada estado tiene el suyo. */
interface EstiloEstadoTurno extends EstiloBadge {
  icono: LucideIcon
}

/**
 * Estado del turno → etiqueta, variante de `Badge` e ícono. Único lugar con estos colores e íconos:
 * la HU de estados está "a definir", y cuando se defina se cambian acá. El ícono es un segundo canal
 * además del color (la palabra siempre se lee): no hay dos estados con el mismo ícono.
 */
export const ESTADO_TURNO: Record<EstadoTurno, EstiloEstadoTurno> = {
  AGENDADO: { etiqueta: 'Agendado', variante: 'estadoAgendado', icono: Calendar1 },
  CANCELADO: { etiqueta: 'Cancelado', variante: 'estadoCancelado', icono: CircleX },
  SIN_REGISTRAR: { etiqueta: 'Sin registrar', variante: 'estadoSinRegistrar', icono: CircleDashed },
  REALIZADO: { etiqueta: 'Realizado', variante: 'estadoRealizado', icono: CircleCheck },
  AUSENTE: { etiqueta: 'Ausente', variante: 'estadoAusente', icono: UserRoundX },
}

/**
 * Lo que dice "Sin registrar" cuando la API manda el plazo: `'Sin registrar · vence el 12/10'`, o
 * `'Sin registrar · cerrado por el sistema'` si ya venció. La fecha y el `vencido` son de la API.
 */
export function textoSinRegistrar(plazo: PlazoAsistencia): string {
  const { etiqueta } = ESTADO_TURNO.SIN_REGISTRAR
  if (plazo.vencido) return `${etiqueta} · cerrado por el sistema`
  return `${etiqueta} · vence el ${format(parseISO(plazo.vence), 'dd/MM', { locale: es })}`
}

/**
 * Qué distintivo lleva un turno, o `null` si no lleva ninguno.
 *
 * Con `sinAsistencia` (calendarios y listas, donde la asistencia no se muestra: solo se ve en el
 * detalle del turno) solo "Agendado" y "Cancelado" tienen distintivo; un turno pasado no cancelado
 * (sin registrar, realizado o ausente) queda sin él, como antes de la asistencia. Sin la opción, el
 * `plazo` cambia "Sin registrar": su texto, su ícono (reloj dentro del plazo, candado si lo cerró el sistema) y su borde punteado.
 */
export function distintivoTurno(
  estado: EstadoTurno,
  opciones: { plazo?: PlazoAsistencia | null; sinAsistencia?: boolean } = {},
): EstiloEstadoTurno | null {
  const { plazo, sinAsistencia } = opciones
  if (sinAsistencia && estado !== 'AGENDADO' && estado !== 'CANCELADO') return null
  if (estado === 'SIN_REGISTRAR' && plazo) {
    return {
      etiqueta: textoSinRegistrar(plazo),
      variante: plazo.vencido ? 'estadoCerrado' : 'estadoPorVencer',
      icono: plazo.vencido ? Lock : Clock,
    }
  }
  return ESTADO_TURNO[estado]
}

/** Estado de pago → etiqueta y variante de `Badge`. */
export const ESTADO_PAGO: Record<EstadoPago, EstiloBadge> = {
  PENDIENTE: { etiqueta: 'Pendiente', variante: 'pendiente' },
  PAGADO: { etiqueta: 'Pagado', variante: 'confirmado' },
}

/** Prioridad → la palabra que se muestra (HU-18). */
export const ETIQUETA_PRIORIDAD: Record<Prioridad, string> = {
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
}

/**
 * Si el indicador se muestra: Alta y Media siempre; Baja no tiene distintivo en una fila ni junto al
 * turno (`fila`, `punto`) y solo se lee en el `detalle` (HU-18).
 */
export function mostrarPrioridad(prioridad: Prioridad, variante: VariantePrioridad): boolean {
  return prioridad !== 'BAJA' || variante === 'detalle'
}

/**
 * `0` → `'el mismo día del turno'`, `1` → `'en 1 día'`, `5` → `'en 5 días'`. Los días se cuentan
 * desde la fecha del turno, no desde hoy (HU-18): por eso 0 no es "hoy".
 */
export function textoDiasHastaExamen(dias: number): string {
  if (dias === 0) return 'el mismo día del turno'
  if (dias === 1) return 'en 1 día'
  return `en ${dias} días`
}

/**
 * El examen en corto, para leerlo al lado de la prioridad sin abrir el tooltip: `'Examen 15/10 ·
 * en 5 días'`, `'Examen 05/10 · el mismo día'`. Los días son los de la API, desde la fecha del turno.
 */
export function textoExamenCorto(examen: ExamenPrioridad): string {
  const fecha = format(parseISO(examen.fecha), 'dd/MM', { locale: es })
  const dias = examen.dias === 0 ? 'el mismo día' : textoDiasHastaExamen(examen.dias)
  return `Examen ${fecha} · ${dias}`
}

/** Examen que determina la prioridad: `'Examen de Matemática el 15/10 (en 5 días)'`. */
export function textoExamenPrioridad(examen: ExamenPrioridad): string {
  const fecha = format(parseISO(examen.fecha), 'dd/MM', { locale: es })
  return `Examen de ${examen.materiaNombre} el ${fecha} (${textoDiasHastaExamen(examen.dias)})`
}
