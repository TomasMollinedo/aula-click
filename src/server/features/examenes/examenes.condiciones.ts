import type { Prisma, TipoExamen } from '@/generated/prisma/client'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'

// Regla y lectura de la **prioridad del turno** (HU-18, docs/dominio.md → Prioridad), que usan
// otras features (`ocurrencias` y `agendas`) desde sus repositories (decisión T-39). Es la única
// implementación: nunca se reescribe en otra feature. No crea el cliente de Prisma (lo recibe): de
// Prisma solo importa tipos.
//
// De otra feature solo se importan `*.repository` y `*.condiciones` (lo hace cumplir ESLint).

export type { TipoExamen }

/** Cliente con el que se consulta: `prisma` o el `tx` de una transacción. */
export type ClienteExamenes = Prisma.TransactionClient

export const PRIORIDADES = ['ALTA', 'MEDIA', 'BAJA'] as const

export type Prioridad = (typeof PRIORIDADES)[number]

/** Una ocurrencia de la que se pide la prioridad. `fecha` es `YYYY-MM-DD`. */
export interface PedidoPrioridad {
  alumnoId: number
  materiaId: number
  fecha: string
}

/** Prioridad de una ocurrencia y, si lo hay, el examen que la determina. */
export interface PrioridadDeTurno {
  prioridad: Prioridad
  examen?: {
    id: number
    fecha: string
    tipo: TipoExamen
    materiaNombre: string
    dias: number
  }
}

/** Clave del Map que devuelve `leerPrioridades`: `alumnoId-materiaId-fecha`. */
export function clavePrioridad(p: PedidoPrioridad): string {
  return `${p.alumnoId}-${p.materiaId}-${p.fecha}`
}

/**
 * Prioridad según los días hasta el examen: `ALTA` de 0 a 10 (0 = el mismo día), `MEDIA` de 11 a
 * 20, `BAJA` más de 20 o `null` (sin examen próximo). Lanza `RangeError` si `dias` es negativo o
 * no es entero (un examen anterior al turno no cuenta: no se le pide prioridad).
 */
export function prioridadPorDias(dias: number | null): Prioridad {
  if (dias === null) return 'BAJA'
  if (!Number.isInteger(dias) || dias < 0) {
    throw new RangeError(`Días hasta el examen inválidos: ${dias} (se espera un entero >= 0)`)
  }
  if (dias <= 10) return 'ALTA'
  if (dias <= 20) return 'MEDIA'
  return 'BAJA'
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

// Días de calendario de `desde` a `hasta` (YYYY-MM-DD), con fechas a las 00:00 UTC: sin horario de
// verano de por medio, la resta es exacta.
function diasEntre(desde: string, hasta: string): number {
  return Math.round((fechaADate(hasta).getTime() - fechaADate(desde).getTime()) / MS_POR_DIA)
}

/**
 * Prioridad de un lote de ocurrencias, con **una sola consulta**: los exámenes `ACTIVO` de esos
 * alumnos y materias con fecha `>=` la menor fecha pedida. Para cada ítem toma el próximo examen
 * del mismo alumno y la misma materia con fecha `>=` la del ítem (el mismo día cuenta) y calcula
 * la prioridad con `prioridadPorDias`. Sin examen, `{ prioridad: 'BAJA' }`; no hay tope superior:
 * una `BAJA` por lejanía también trae su examen.
 *
 * - `fecha` es la fecha **efectiva** de la ocurrencia (la reprogramada, si la hay).
 * - Las ocurrencias canceladas no tienen prioridad: las filtra quien llama, no se piden.
 * - Se llama desde un repository, con `prisma` o con el `tx` de su transacción.
 * - No persiste ni cachea: si cambia un examen, cambia en la próxima consulta.
 *
 * Devuelve un Map con una entrada por cada ítem pedido, indexado por `clavePrioridad` (los ítems
 * duplicados comparten clave). Lanza `RangeError` si alguna fecha es inválida, antes de consultar.
 */
export async function leerPrioridades(
  client: ClienteExamenes,
  items: PedidoPrioridad[],
): Promise<Map<string, PrioridadDeTurno>> {
  const resultado = new Map<string, PrioridadDeTurno>()
  if (items.length === 0) return resultado

  // Validadas, las fechas YYYY-MM-DD se comparan como strings.
  for (const item of items) fechaADate(item.fecha)
  const menorFecha = items.reduce(
    (menor, item) => (item.fecha < menor ? item.fecha : menor),
    items[0].fecha,
  )

  const examenes = await client.examen.findMany({
    where: {
      estado: 'ACTIVO',
      alumnoId: { in: [...new Set(items.map((item) => item.alumnoId))] },
      materiaId: { in: [...new Set(items.map((item) => item.materiaId))] },
      fecha: { gte: fechaADate(menorFecha) },
    },
    select: {
      id: true,
      alumnoId: true,
      materiaId: true,
      fecha: true,
      tipo: true,
      materia: { select: { nombre: true } },
    },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  })

  // El `in × in` trae exámenes de pares alumno-materia que no se pidieron: se agrupa por par.
  // Cada grupo queda ordenado por fecha e id, como la consulta.
  const porPar = new Map<
    string,
    { id: number; fecha: string; tipo: TipoExamen; materiaNombre: string }[]
  >()
  for (const examen of examenes) {
    const par = `${examen.alumnoId}-${examen.materiaId}`
    const grupo = porPar.get(par) ?? []
    grupo.push({
      id: examen.id,
      fecha: dateAFecha(examen.fecha),
      tipo: examen.tipo,
      materiaNombre: examen.materia.nombre,
    })
    porPar.set(par, grupo)
  }

  for (const item of items) {
    const proximo = porPar
      .get(`${item.alumnoId}-${item.materiaId}`)
      ?.find((examen) => examen.fecha >= item.fecha)
    if (!proximo) {
      resultado.set(clavePrioridad(item), { prioridad: 'BAJA' })
      continue
    }
    const dias = diasEntre(item.fecha, proximo.fecha)
    resultado.set(clavePrioridad(item), {
      prioridad: prioridadPorDias(dias),
      examen: { ...proximo, dias },
    })
  }
  return resultado
}
