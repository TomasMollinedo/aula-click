import {
  leerOcurrencias,
  type ClienteOcurrencias,
  type Ocurrencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import { dateAFecha, fechaADate, type Reloj } from '@/server/shared/fechas'
import { esAdeudado, esProximo, importeVigente, rangosDelPeriodo, totalDe } from './cuentas.reglas'

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

/**
 * Filtro de la deuda y de los próximos. `hoy` (`YYYY-MM-DD`) lo calcula quien llama con su reloj;
 * el resto es opcional. `desde` y `hasta` son el período **pedido**, sin recortar: cada lectura
 * toma su parte con `rangosDelPeriodo` (decisión T-92). `profesorId` es el profesor del bloque.
 */
export type FiltroDeuda = {
  alumnoId?: number
  materiaId?: number
  profesorId?: number
  desde?: string
  hasta?: string
  hoy: string
}

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
 * `fechaInicio` más antigua de los turnos `ACTIVO` del filtro que empezaron hasta `hasta`
 * (decisión T-81), o `null` si no hay ninguno. `profesorId` usa la misma relación que el motor
 * (`bloqueAgenda.profesorId`, como `leerSeries`), así no deja afuera nada que el motor devuelva.
 */
async function primerInicio(
  client: ClienteOcurrencias,
  { alumnoId, materiaId, profesorId }: FiltroDeuda,
  hasta: string,
): Promise<string | null> {
  const { _min } = await client.turno.aggregate({
    where: {
      estado: 'ACTIVO',
      fechaInicio: { lte: fechaADate(hasta) },
      ...(alumnoId === undefined ? {} : { alumnoId }),
      ...(materiaId === undefined ? {} : { materiaId }),
      ...(profesorId === undefined ? {} : { bloqueAgenda: { profesorId } }),
    },
    _min: { fechaInicio: true },
  })
  return _min.fechaInicio && dateAFecha(_min.fechaInicio)
}

/**
 * Ocurrencias adeudadas (`esAdeudado`: anteriores a hoy, `SIN_REGISTRAR` y pago `PENDIENTE`), con
 * el importe vigente de su materia, del filtro (todo opcional salvo `hoy`: sin `alumnoId`, de
 * todos los alumnos). Ordenadas del más antiguo al más reciente (fecha, hora de inicio y
 * `turnoId`).
 *
 * Rango: la parte del período que le toca a la deuda (`rangosDelPeriodo`), nunca hoy ni después;
 * si el período es sólo futuro, `[]` sin consultar. Sin `desde`, empieza en la `fechaInicio` más
 * antigua de los turnos `ACTIVO` del filtro (un `aggregate`; si no hay ninguno, no hay deuda y no
 * se lee nada más), sin acotar (decisión T-81): la expansión es en memoria. Materia y profesor los
 * filtra el motor. Una llamada a `leerOcurrencias` y una consulta de precios.
 */
export async function leerAdeudados(
  client: ClienteOcurrencias,
  filtro: FiltroDeuda,
): Promise<Adeudado[]> {
  const { alumnoId, materiaId, profesorId, hoy } = filtro
  const rango = rangosDelPeriodo(filtro, hoy).adeudados
  if (rango === null) return []
  const desde = rango.desde ?? (await primerInicio(client, filtro, rango.hasta))
  if (desde === null) return []

  const ocurrencias = await leerOcurrencias(
    client,
    { desde, hasta: rango.hasta, alumnoId, materiaId, profesorId },
    relojDelDia(hoy),
  )
  return conImportes(
    client,
    ocurrencias.filter((o) => esAdeudado(o, hoy)),
  )
}

/**
 * Total adeudado del filtro (alumno, período, materia y profesor): la suma en centavos de los
 * importes de `leerAdeudados` (los `null` no suman). No tiene otra implementación: el tablero
 * (T-61) y la vista global dan el mismo número con el mismo filtro. Los próximos nunca suman: con
 * un período sólo futuro es 0.
 */
export async function totalAdeudado(
  client: ClienteOcurrencias,
  filtro: FiltroDeuda,
): Promise<number> {
  return totalDe(await leerAdeudados(client, filtro))
}

/**
 * Próximos del filtro (`esProximo`: de hoy a `limiteDeCobro(hoy)`, `AGENDADO` y pago `PENDIENTE`,
 * de series y sesiones únicas; sin `alumnoId`, de todos los alumnos), con el importe vigente,
 * ordenados por fecha, hora de inicio y `turnoId`. Es lo mismo que `POST /pagos` puede cobrar
 * hacia adelante (mismo tope de 8 semanas, decisión T-60). No suman a la deuda.
 *
 * Rango: la parte del período que les toca (`rangosDelPeriodo`), nunca antes de hoy ni después
 * del tope; si el período es sólo pasado, `[]` sin consultar, y si empieza después del tope, `[]`
 * (el motor no lee un rango vacío).
 */
export async function leerProximos(
  client: ClienteOcurrencias,
  filtro: FiltroDeuda,
): Promise<Adeudado[]> {
  const { alumnoId, materiaId, profesorId, hoy } = filtro
  const rango = rangosDelPeriodo(filtro, hoy).proximos
  if (rango === null) return []

  const ocurrencias = await leerOcurrencias(
    client,
    { desde: rango.desde, hasta: rango.hasta, alumnoId, materiaId, profesorId },
    relojDelDia(hoy),
  )
  return conImportes(
    client,
    ocurrencias.filter((o) => esProximo(o, hoy)),
  )
}
