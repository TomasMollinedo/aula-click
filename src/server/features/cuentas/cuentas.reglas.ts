import { limiteDeCobro, sumarImportes } from '@/server/features/pagos/pagos.condiciones'
import type { Ocurrencia } from '@/server/features/turnos/ocurrencias.condiciones'
import { sumarDias } from '@/server/shared/fechas'
import { armarMeta, calcularSkipTake, type MetaPaginacion } from '@/server/shared/paginacion'

// Reglas puras de la cuenta del alumno (HU-16, T-53): qué ocurrencia adeuda, cuál es próxima, qué
// parte de un período le toca a cada sección, su importe, el total y la página. Sin Prisma y sin
// `hoy()` adentro: "hoy" lo pasa quien llama. Las usan `cuentas.condiciones.ts` (la única lectura
// de la deuda) y el service.

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

/** Período pedido (`YYYY-MM-DD`, extremos incluidos). Cada extremo es opcional. */
export type Periodo = { desde?: string; hasta?: string }

/**
 * La parte de un período que le toca a cada sección de la cuenta; `null` si la sección no aplica.
 * En adeudados, sin `desde` el rango empieza en el primer turno (decisión T-69).
 */
export type RangosDelPeriodo = {
  adeudados: { desde?: string; hasta: string } | null
  proximos: { desde: string; hasta: string } | null
}

/**
 * Recorta el período a cada sección (ajustes de la PO del 01/10, decisión T-80). Las fechas se
 * comparan como texto `YYYY-MM-DD`.
 *
 * - **Adeudados:** del período, pero nunca hoy ni después: `hasta` es el menor entre el pedido y
 *   ayer. No aplica (`null`) si el período es sólo futuro (`desde >= hoy`).
 * - **Próximos:** del período, pero nunca antes de hoy ni después del tope de cobro
 *   (`limiteDeCobro(hoy)`, el de `POST /pagos`). No aplica (`null`) si el período es sólo pasado
 *   (`hasta < hoy`). Si empieza después del tope, aplica y el rango queda vacío (`hasta < desde`).
 *
 * Sin período: adeudados hasta ayer y próximos de hoy al tope.
 */
export function rangosDelPeriodo({ desde, hasta }: Periodo, hoy: string): RangosDelPeriodo {
  const ayer = sumarDias(hoy, -1)
  const tope = limiteDeCobro(hoy)
  return {
    adeudados:
      desde !== undefined && desde >= hoy
        ? null
        : {
            ...(desde === undefined ? {} : { desde }),
            hasta: hasta !== undefined && hasta < ayer ? hasta : ayer,
          },
    proximos:
      hasta !== undefined && hasta < hoy
        ? null
        : {
            desde: desde !== undefined && desde > hoy ? desde : hoy,
            hasta: hasta !== undefined && hasta < tope ? hasta : tope,
          },
  }
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
