import type { MotivoCancelacion } from '@/types/ocurrencia'

// Etiqueta de un motivo de cancelación/finalización, para el detalle de la ocurrencia. Duplica la
// lista de `features/cancelaciones` (misma lista que la API): una feature no importa el `schema`
// de otra, solo sus `hooks` (docs/arquitectura-frontend.md → Quién importa a quién).

const ETIQUETA_MOTIVO: Record<MotivoCancelacion, string> = {
  CANCELACION_ALUMNO: 'Cancelación por el alumno',
  CANCELACION_PROFESOR: 'Cancelación por el profesor',
  PROBLEMA_ADMINISTRATIVO: 'Problema administrativo',
  OTRO: 'Otro',
}

export function etiquetaMotivoCancelacion(motivo: MotivoCancelacion): string {
  return ETIQUETA_MOTIVO[motivo]
}
