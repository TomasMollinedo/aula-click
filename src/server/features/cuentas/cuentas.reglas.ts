import { limiteDeCobro, sumarImportes } from '@/server/features/pagos/pagos.condiciones'
import type { Ocurrencia } from '@/server/features/turnos/ocurrencias.condiciones'
import { armarMeta, calcularSkipTake, type MetaPaginacion } from '@/server/shared/paginacion'

// Reglas puras de la cuenta del alumno (HU-16, T-53): qué ocurrencia adeuda, cuál es próxima, su
// importe, el total y la página. Sin Prisma y sin `hoy()` adentro: "hoy" lo pasa quien llama. Las
// usan `cuentas.condiciones.ts` (la única lectura de la deuda) y el service.

/** Lo que las reglas miran de una ocurrencia (una `Ocurrencia` del motor lo cumple). */
export type OcurrenciaCuenta = Pick<Ocurrencia, 'fecha' | 'estado'> & {
  pago: Pick<Ocurrencia['pago'], 'estado'>
}

/**
 * Adeuda (definición F): fecha anterior a hoy, estado `SIN_REGISTRAR` (no cancelada) y pago
 * `PENDIENTE` (definición D: pagada = hay un `PagoTurno`). La de hoy no adeuda: es próxima.
 */
export function esAdeudado(ocurrencia: OcurrenciaCuenta, hoy: string): boolean {
  return (
    ocurrencia.fecha < hoy &&
    ocurrencia.estado === 'SIN_REGISTRAR' &&
    ocurrencia.pago.estado === 'PENDIENTE'
  )
}

/**
 * Próxima: fecha entre hoy y `limiteDeCobro(hoy)` (hoy + 56, el mismo tope que `POST /pagos`),
 * estado `AGENDADO` y pago `PENDIENTE`. No suma a la deuda.
 */
export function esProximo(ocurrencia: OcurrenciaCuenta, hoy: string): boolean {
  return (
    ocurrencia.fecha >= hoy &&
    ocurrencia.fecha <= limiteDeCobro(hoy) &&
    ocurrencia.estado === 'AGENDADO' &&
    ocurrencia.pago.estado === 'PENDIENTE'
  )
}

/** Precio por hora vigente de la materia, o `null` si no tiene (o no está en el `Map`). */
export function importeVigente(
  precios: ReadonlyMap<number, number | null>,
  materiaId: number,
): number | null {
  return precios.get(materiaId) ?? null
}

/** Suma en centavos de los importes; los `null` (materia sin precio) no suman. */
export function totalDe(items: readonly { importe: number | null }[]): number {
  return sumarImportes(items.flatMap((item) => (item.importe === null ? [] : [item.importe])))
}

/** Día 1 del mes de `fecha` (`YYYY-MM-DD`): `'2026-10-31'` → `'2026-10-01'`. */
export function primerDiaDelMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`
}

/**
 * Página en memoria de una lista ya ordenada: el tramo de `{ page, pageSize }` y su `meta` con el
 * total de la lista. Una página fuera de rango da `[]` con el `meta` correcto.
 */
export function paginarEnMemoria<T>(
  items: readonly T[],
  query: { page: number; pageSize: number },
): { data: T[]; meta: MetaPaginacion } {
  const { skip, take } = calcularSkipTake(query)
  return { data: items.slice(skip, skip + take), meta: armarMeta(query, items.length) }
}
