import { ConflictError } from '@/server/errors'
import { DIAS_DEUDA_VENCIDA } from '@/server/features/cuentas/cuentas.condiciones'
import type { DeudaVencida } from './turnos.validation'

// Tope de deuda (HU-29, amplía HU-08): un alumno con deuda vencida no saca turnos nuevos, ni por
// el portal ni por la mesa de entrada. Qué es deuda vencida no se decide acá: lo calcula
// `deudaVencida` de `cuentas.condiciones` (T-76), que el repository lee dentro de la transacción
// del alta con el lock del alumno. Acá sólo están el rechazo y sus textos. No afecta cancelar,
// reprogramar ni los turnos que el alumno ya tiene: sólo lo usa el alta.

export const CODIGO_DEUDA_VENCIDA = 'DEUDA_VENCIDA'

/** Mensaje para el alumno (portal): no muestra importes, la deuda se regulariza en la mesa. */
export const MENSAJE_DEUDA_VENCIDA_PORTAL = `Tenés clases adeudadas de hace más de ${DIAS_DEUDA_VENCIDA} días. Para sacar un turno nuevo, regularizá el pago en la mesa de entrada`

/**
 * Importe para el mensaje: `$ 24.000`, o con centavos si los tiene (`$ 24.000,50`). Suma en
 * centavos, como el resto de los importes (convenciones-backend.md → Importes).
 */
export function textoPesos(importe: number): string {
  const centavos = Math.round(importe * 100)
  const enteros = Math.trunc(centavos / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const resto = centavos % 100
  return resto === 0 ? `$ ${enteros}` : `$ ${enteros},${String(resto).padStart(2, '0')}`
}

/**
 * Mensaje para la mesa de entrada, con la cantidad y el total: "El alumno tiene deuda de más de
 * 30 días (3 turnos · $ 24.000). Debe regularizar el pago para agendar turnos nuevos". Si todos
 * los turnos vencidos son de materias sin precio, el total no se muestra.
 */
export function mensajeDeudaVencidaMesa({ cantidad, total }: DeudaVencida): string {
  const turnos = `${cantidad} ${cantidad === 1 ? 'turno' : 'turnos'}`
  const resumen = total > 0 ? `${turnos} · ${textoPesos(total)}` : turnos
  return `El alumno tiene deuda de más de ${DIAS_DEUDA_VENCIDA} días (${resumen}). Debe regularizar el pago para agendar turnos nuevos`
}

/** 409 `DEUDA_VENCIDA` con `{ cantidad, total }` si el alumno tiene deuda vencida. */
export function verificarTopeDeuda(deuda: DeudaVencida, mensaje: string): void {
  if (deuda.cantidad === 0) return
  throw new ConflictError(mensaje, {
    code: CODIGO_DEUDA_VENCIDA,
    details: { cantidad: deuda.cantidad, total: deuda.total },
  })
}
