import { limiteDeCobro } from '@/server/features/pagos/pagos.condiciones'
import {
  leerOcurrencias,
  type ClienteOcurrencias,
  type Ocurrencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import { dateAFecha, fechaADate, sumarDias, type Reloj } from '@/server/shared/fechas'
import { esAdeudado, esProximo, importeVigente, totalDe } from './cuentas.reglas'

// Deuda del alumno (HU-16, T-53): la **única** implementación de qué se adeuda y cuánto. La usan
// el repository de `cuentas` (ficha del alumno y vista global) y el tablero del gerente (T-61),
// con `prisma` o con su `tx`. No crea el cliente de Prisma (lo recibe): de Prisma solo importa
// tipos. Las ocurrencias salen del motor de `turnos` (`leerOcurrencias`), nunca de una expansión
// propia; qué adeuda y qué es próximo lo deciden las reglas puras de `cuentas.reglas.ts`.

// Tipos que necesitan quienes consumen estas condiciones sin importar otras features.
export type { ClienteOcurrencias, Ocurrencia }

/**
 * Una ocurrencia de la cuenta con el importe **vigente** de su materia (`null` si no tiene
 * precio). Tipo de dominio, no un DTO: horas en minutos y referencias como las da el motor. Cada
 * feature arma su DTO campo por campo.
 */
export type Adeudado = { ocurrencia: Ocurrencia; importe: number | null }

/** Filtro de la deuda. `hoy` (`YYYY-MM-DD`) lo calcula quien llama con su reloj. */
export type FiltroDeuda = { alumnoId?: number; hoy: string }

/**
 * Reloj fijo al mediodía UTC de `fecha`: en Salta (UTC-3) es la misma fecha, así `hoy()` del motor
 * devuelve `fecha`. Las 00:00 UTC (`fechaADate`) ya serían el día anterior en Salta.
 */
function relojDelDia(fecha: string): Reloj {
  const instante = new Date(`${fecha}T12:00:00.000Z`)
  return () => instante
}

/** Precio por hora vigente de cada materia, en una consulta. Sin materias, sin consulta. */
async function leerPrecios(
  client: ClienteOcurrencias,
  materiaIds: readonly number[],
): Promise<Map<number, number | null>> {
  const ids = [...new Set(materiaIds)]
  if (ids.length === 0) return new Map()
  const materias = await client.materia.findMany({
    where: { id: { in: ids } },
    select: { id: true, precioHora: true },
  })
  return new Map(materias.map((m) => [m.id, m.precioHora ? m.precioHora.toNumber() : null]))
}

/** Las ocurrencias con el importe vigente de su materia, en el mismo orden. */
async function conImportes(
  client: ClienteOcurrencias,
  ocurrencias: Ocurrencia[],
): Promise<Adeudado[]> {
  const precios = await leerPrecios(
    client,
    ocurrencias.map((o) => o.materiaId),
  )
  return ocurrencias.map((ocurrencia) => ({
    ocurrencia,
    importe: importeVigente(precios, ocurrencia.materiaId),
  }))
}

/**
 * Ocurrencias adeudadas (`esAdeudado`: anteriores a hoy, `SIN_REGISTRAR` y pago `PENDIENTE`), con
 * el importe vigente de su materia, del filtro (`alumnoId` opcional: sin él, de todos los
 * alumnos). Ordenadas del más antiguo al más reciente (fecha, hora de inicio y `turnoId`).
 *
 * Rango: desde la `fechaInicio` más antigua de los turnos `ACTIVO` que empezaron antes de hoy (un
 * `aggregate`; si no hay ninguno, no hay deuda y no se lee nada más) hasta ayer. Sin acotar
 * (decisión T-69): la expansión es en memoria. Una llamada a `leerOcurrencias` y una consulta de
 * precios.
 */
export async function leerAdeudados(
  client: ClienteOcurrencias,
  { alumnoId, hoy }: FiltroDeuda,
): Promise<Adeudado[]> {
  const { _min } = await client.turno.aggregate({
    where: {
      estado: 'ACTIVO',
      fechaInicio: { lt: fechaADate(hoy) },
      ...(alumnoId === undefined ? {} : { alumnoId }),
    },
    _min: { fechaInicio: true },
  })
  if (!_min.fechaInicio) return []

  const ocurrencias = await leerOcurrencias(
    client,
    { desde: dateAFecha(_min.fechaInicio), hasta: sumarDias(hoy, -1), alumnoId },
    relojDelDia(hoy),
  )
  return conImportes(
    client,
    ocurrencias.filter((o) => esAdeudado(o, hoy)),
  )
}

/**
 * Total adeudado del filtro: la suma en centavos de los importes de `leerAdeudados` (los `null` no
 * suman). No tiene otra implementación: el tablero (T-61) y la vista global dan el mismo número.
 */
export async function totalAdeudado(
  client: ClienteOcurrencias,
  filtro: FiltroDeuda,
): Promise<number> {
  return totalDe(await leerAdeudados(client, filtro))
}

/**
 * Próximos del alumno (`esProximo`: de hoy a `limiteDeCobro(hoy)`, `AGENDADO` y pago
 * `PENDIENTE`, de series y sesiones únicas), con el importe vigente, ordenados por fecha, hora de
 * inicio y `turnoId`. Es lo mismo que `POST /pagos` puede cobrar hacia adelante (mismo tope de 8
 * semanas, decisión T-60). La usa el repository de `cuentas`; no suma a la deuda.
 */
export async function leerProximos(
  client: ClienteOcurrencias,
  { alumnoId, hoy }: { alumnoId: number; hoy: string },
): Promise<Adeudado[]> {
  const ocurrencias = await leerOcurrencias(
    client,
    { desde: hoy, hasta: limiteDeCobro(hoy), alumnoId },
    relojDelDia(hoy),
  )
  return conImportes(
    client,
    ocurrencias.filter((o) => esProximo(o, hoy)),
  )
}
