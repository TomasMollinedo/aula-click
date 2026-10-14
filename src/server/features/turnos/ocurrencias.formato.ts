import { fechaCorta } from '@/server/shared/formato'
import type { EstadoOcurrencia, PlazoAsistencia } from './turnos.reglas'
import type { TipoTurno } from './turnos.validation'

// Cómo se escribe una ocurrencia en un documento (los PDF del turno, de los turnos de un alumno y
// de la agenda). Devuelven lo mismo que muestra el frontend (`ESTADO_TURNO` y `ETIQUETA_PRIORIDAD`
// de `src/components/turno/indicadores-turno.ts`, y los textos de la hoja del turno), que el
// backend no puede importar. Las otras features las toman de `ocurrencias.condiciones.ts`.

const ETIQUETA_ESTADO: Record<EstadoOcurrencia, string> = {
  AGENDADO: 'Agendado',
  CANCELADO: 'Cancelado',
  SIN_REGISTRAR: 'Sin registrar',
  REALIZADO: 'Realizado',
  AUSENTE: 'Ausente',
}

/** `'SIN_REGISTRAR'` → `'Sin registrar'`. */
export function etiquetaEstado(estado: EstadoOcurrencia): string {
  return ETIQUETA_ESTADO[estado]
}

/**
 * La etiqueta de un "Sin registrar" con su plazo: `'Sin registrar · vence el 12/10'` o, vencido,
 * `'Sin registrar · cerrado por el sistema'`. Cualquier otro estado (o sin plazo), `etiquetaEstado`.
 */
export function etiquetaEstadoConPlazo(
  estado: EstadoOcurrencia,
  plazo: PlazoAsistencia | null,
): string {
  if (estado !== 'SIN_REGISTRAR' || !plazo) return etiquetaEstado(estado)
  const detalle = plazo.vencido ? 'cerrado por el sistema' : `vence el ${fechaCorta(plazo.vence)}`
  return `${etiquetaEstado(estado)} · ${detalle}`
}

/**
 * La prioridad de una ocurrencia. Son los valores de `PRIORIDADES` de `examenes`: se declaran acá
 * para que `turnos` no dependa de `examenes` (quien llama pasa su `Prioridad`, y si los valores
 * dejaran de coincidir, no compila).
 */
type PrioridadDeOcurrencia = 'ALTA' | 'MEDIA' | 'BAJA'

const ETIQUETA_PRIORIDAD: Record<PrioridadDeOcurrencia, string> = {
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
}

/** `'ALTA'` → `'Alta'`. */
export function etiquetaPrioridad(prioridad: PrioridadDeOcurrencia): string {
  return ETIQUETA_PRIORIDAD[prioridad]
}

/** `'Recurrente'` o `'Sesión única'`. */
export function textoTipo(tipo: TipoTurno): string {
  return tipo === 'RECURRENTE' ? 'Recurrente' : 'Sesión única'
}

/** El período de una serie: `'03/09 – 08/10'`, o `'03/09 – sin fin'` si no tiene fecha de fin. */
export function textoPeriodoSerie(serie: { fechaInicio: string; fechaFin: string | null }): string {
  return `${fechaCorta(serie.fechaInicio)} – ${serie.fechaFin ? fechaCorta(serie.fechaFin) : 'sin fin'}`
}
