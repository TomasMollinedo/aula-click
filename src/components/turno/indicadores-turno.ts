import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'
import type { ComponentProps } from 'react'

import type { Badge } from '@/components/ui/badge'

// Presentación del estado, el estado de pago y la prioridad de un turno (una ocurrencia): etiquetas,
// variantes y textos. Sin reglas: el estado, el pago, la prioridad y los días hasta el examen los
// calcula la API (HU-18, T-31); acá solo se traducen a lo que se ve. Las fechas son `YYYY-MM-DD` y
// se leen con `parseISO` (hora local), nunca con `new Date('YYYY-MM-DD')`.

/** Estado de una ocurrencia, como lo manda la API. */
export type EstadoTurno = 'AGENDADO' | 'CANCELADO' | 'SIN_REGISTRAR'

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

/**
 * Estado del turno → etiqueta y variante de `Badge`. Único lugar con estos colores: la HU de estados
 * está "a definir", y cuando se defina se cambian acá.
 */
export const ESTADO_TURNO: Record<EstadoTurno, EstiloBadge> = {
  AGENDADO: { etiqueta: 'Agendado', variante: 'confirmado' },
  CANCELADO: { etiqueta: 'Cancelado', variante: 'cancelado' },
  SIN_REGISTRAR: { etiqueta: 'Sin registrar', variante: 'secondary' },
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
