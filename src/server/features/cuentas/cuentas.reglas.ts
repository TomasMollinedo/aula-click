import { limiteDeCobro, sumarImportes } from '@/server/features/pagos/pagos.condiciones'
import type { Ocurrencia } from '@/server/features/turnos/ocurrencias.condiciones'
import type { Estado } from '@/server/shared/estado'
import { sumarDias } from '@/server/shared/fechas'
import { armarMeta, calcularSkipTake, type MetaPaginacion } from '@/server/shared/paginacion'
import type { OpcionesDeCuenta } from './cuentas.validation'

// Reglas puras de la cuenta del alumno (HU-16, T-53; con asistencia y deuda vencida, T-76): qué
// ocurrencia adeuda, cuál es próxima, cuál es deuda vencida, qué parte de un período le toca a cada
// sección, su importe, el total y la página. Cuenta toda ocurrencia no cancelada e impaga, con
// cualquier estado (`AGENDADO`, `SIN_REGISTRAR`, `REALIZADO` o `AUSENTE`): la fecha decide la
// sección. Sin Prisma y sin `hoy()` adentro: "hoy" lo pasa quien llama. Las usan
// `cuentas.condiciones.ts` (la única lectura de la deuda) y el service.

/** Lo que las reglas miran de una ocurrencia (una `Ocurrencia` del motor lo cumple). */
export type OcurrenciaCuenta = Pick<Ocurrencia, 'fecha' | 'estado'> & {
  pago: Pick<Ocurrencia['pago'], 'estado'>
}

/** Días desde los que un adeudado es deuda vencida (HU-29): hace 30 días o más. */
export const DIAS_DEUDA_VENCIDA = 30

/**
 * Adeuda (definición F, ampliada por T-76): fecha anterior a hoy, no cancelada y pago `PENDIENTE`.
 * Con fecha pasada eso es `SIN_REGISTRAR` (también uno cerrado por el sistema), `REALIZADO` o
 * `AUSENTE`: haya ido o no el alumno, su lugar estuvo reservado (HU-22). "Pendiente" es sin un
 * pago **vigente**: un pago anulado no cuenta, y eso lo resuelve el motor (T-74). La de hoy no
 * adeuda: es próxima.
 */
export function esAdeudado(ocurrencia: OcurrenciaCuenta, hoy: string): boolean {
  return (
    ocurrencia.fecha < hoy &&
    ocurrencia.estado !== 'CANCELADO' &&
    ocurrencia.pago.estado === 'PENDIENTE'
  )
}

/**
 * Próxima: fecha entre hoy y `limiteDeCobro(hoy)` (hoy + 56, el mismo tope que `POST /pagos`), no
 * cancelada y pago `PENDIENTE`. No suma a la deuda. Un turno de **hoy** con asistencia (`REALIZADO`
 * o `AUSENTE`) sigue siendo próximo hasta mañana: la fecha separa las dos secciones, como en HU-16
 * (propuesta del punto 6 de "Puntos a confirmar" del Sprint 3, pendiente de las PO).
 */
export function esProximo(ocurrencia: OcurrenciaCuenta, hoy: string): boolean {
  return (
    ocurrencia.fecha >= hoy &&
    ocurrencia.fecha <= limiteDeCobro(hoy) &&
    ocurrencia.estado !== 'CANCELADO' &&
    ocurrencia.pago.estado === 'PENDIENTE'
  )
}

/**
 * Deuda vencida (HU-29): adeudada (`esAdeudado`) y con fecha de hace `DIAS_DEUDA_VENCIDA` días o
 * más (`fecha <= hoy - 30`). Con hoy 05/10, la del 05/09 está vencida y la del 06/09 no.
 */
export function esDeudaVencida(ocurrencia: OcurrenciaCuenta, hoy: string): boolean {
  return esAdeudado(ocurrencia, hoy) && ocurrencia.fecha <= sumarDias(hoy, -DIAS_DEUDA_VENCIDA)
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
 * En adeudados, sin `desde` el rango empieza en el primer turno (decisión T-81).
 */
export type RangosDelPeriodo = {
  adeudados: { desde?: string; hasta: string } | null
  proximos: { desde: string; hasta: string } | null
}

/**
 * Recorta el período a cada sección (ajustes de la PO del 01/10, decisión T-92). Las fechas se
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

/** Lo que `opcionesDeLaCuenta` mira de cada ocurrencia por cobrar. */
type OcurrenciaConOpciones = {
  ocurrencia: Pick<Ocurrencia, 'materia'> & {
    profesor: Pick<Ocurrencia['profesor'], 'id' | 'nombre' | 'apellido'>
  }
}

/**
 * Materias y profesores de lo que el alumno tiene por cobrar (adeudados y próximos), para los
 * filtros de "Por cobrar" (decisión T-177): sin repetir, las materias por nombre y los profesores
 * por apellido y nombre, como `opcionesDeLosGrupos` del historial. El estado de cada materia lo
 * pasa quien llama (la ocurrencia no lo trae).
 */
export function opcionesDeLaCuenta(
  items: readonly OcurrenciaConOpciones[],
  estados: ReadonlyMap<number, Estado>,
): OpcionesDeCuenta {
  const materias = new Map<number, OpcionesDeCuenta['materias'][number]>()
  const profesores = new Map<number, OpcionesDeCuenta['profesores'][number]>()
  for (const { ocurrencia } of items) {
    const { materia, profesor } = ocurrencia
    if (!materias.has(materia.id)) {
      materias.set(materia.id, {
        id: materia.id,
        nombre: materia.nombre,
        estado: estados.get(materia.id) ?? 'ACTIVO',
      })
    }
    if (!profesores.has(profesor.id)) {
      profesores.set(profesor.id, {
        id: profesor.id,
        nombre: profesor.nombre,
        apellido: profesor.apellido,
      })
    }
  }
  return {
    materias: [...materias.values()].sort(
      (a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.id - b.id,
    ),
    profesores: [...profesores.values()].sort(
      (a, b) =>
        a.apellido.localeCompare(b.apellido, 'es') ||
        a.nombre.localeCompare(b.nombre, 'es') ||
        a.id - b.id,
    ),
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
