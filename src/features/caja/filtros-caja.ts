import { format, isValid, parseISO } from 'date-fns'

import {
  CODIGOS_FORMA_PAGO,
  TIPOS_MOVIMIENTO,
  type CodigoFormaPago,
  type ListarCajaParams,
  type TipoMovimiento,
} from './caja.types'

// La fecha y los filtros de la caja diaria en la URL (`?fecha=&tipo=&formaPago=`). Funciones puras:
// este es el único lugar que conoce los nombres de los parámetros y sus valores válidos. Ninguna
// usa `new Date()`: "hoy" se recibe (docs/arquitectura-frontend.md → Fechas y horas) y sólo decide
// qué fecha no hace falta escribir en la URL y cuál no se puede elegir; qué día es hoy para la caja
// lo decide la API.
//
// - Sin `?fecha=` (o con una que no sea una fecha real `YYYY-MM-DD`) no se manda fecha: la API
//   devuelve la caja de hoy en la zona del negocio y la rotula en `data.fecha`. La fecha de hoy
//   tampoco se escribe, por lo mismo.
// - `tipo` y `formaPago` recortan **sólo** la lista de movimientos; el resumen es siempre el del
//   día completo. Un valor que no existe es "sin filtro": la URL nunca rompe la pantalla.
// - Los demás parámetros (`pago`, el detalle del pago abierto) se conservan.

const PARAMETRO_FECHA = 'fecha'
const PARAMETRO_TIPO = 'tipo'
const PARAMETRO_FORMA_PAGO = 'formaPago'
const FORMATO_FECHA = 'yyyy-MM-dd'

export type FiltrosCaja = {
  /** El día que se está viendo (`YYYY-MM-DD`), o sin fecha: hoy, que decide la API. */
  fecha: string | undefined
  tipo: TipoMovimiento | null
  formaPago: CodigoFormaPago | null
}

/** Una fecha real `YYYY-MM-DD` (`2026-02-30` y `15/10/2026` no lo son), o `undefined`. */
function fechaReal(valor: string | null): string | undefined {
  if (valor === null || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined
  const fecha = parseISO(valor)
  return isValid(fecha) && format(fecha, FORMATO_FECHA) === valor ? valor : undefined
}

function tipoMovimiento(valor: string | null): TipoMovimiento | null {
  return TIPOS_MOVIMIENTO.find((tipo) => tipo === valor) ?? null
}

function codigoFormaPago(valor: string | null): CodigoFormaPago | null {
  return CODIGOS_FORMA_PAGO.find((codigo) => codigo === valor) ?? null
}

/** La fecha y los filtros de la URL; lo que no es válido queda sin filtro. */
export function leerFiltrosCaja(params: URLSearchParams): FiltrosCaja {
  return {
    fecha: fechaReal(params.get(PARAMETRO_FECHA)),
    tipo: tipoMovimiento(params.get(PARAMETRO_TIPO)),
    formaPago: codigoFormaPago(params.get(PARAMETRO_FORMA_PAGO)),
  }
}

/**
 * Copia de `params` con esa fecha y esos filtros (sin mutar los actuales): un filtro vacío no se
 * escribe y la fecha de hoy tampoco (es el valor por defecto, el que decide la API). Los demás
 * parámetros (`pago`) se conservan.
 */
export function paramsConFiltros(
  params: URLSearchParams,
  filtros: FiltrosCaja,
  hoy: string,
): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  for (const nombre of [PARAMETRO_FECHA, PARAMETRO_TIPO, PARAMETRO_FORMA_PAGO]) {
    nuevos.delete(nombre)
  }
  if (filtros.fecha !== undefined && filtros.fecha !== hoy) {
    nuevos.set(PARAMETRO_FECHA, filtros.fecha)
  }
  if (filtros.tipo !== null) nuevos.set(PARAMETRO_TIPO, filtros.tipo)
  if (filtros.formaPago !== null) nuevos.set(PARAMETRO_FORMA_PAGO, filtros.formaPago)
  return nuevos
}

/** "Limpiar filtros": saca `tipo` y `formaPago` y deja el día que se está viendo. */
export function paramsSinFiltros(
  params: URLSearchParams,
  filtros: FiltrosCaja,
  hoy: string,
): URLSearchParams {
  return paramsConFiltros(params, { ...filtros, tipo: null, formaPago: null }, hoy)
}

/** Si hay algo que limpiar. La fecha no cuenta: recorrer los días no es un filtro. */
export function hayFiltros(filtros: FiltrosCaja): boolean {
  return filtros.tipo !== null || filtros.formaPago !== null
}

/**
 * El día que se puede pedir: hoy o uno pasado, nunca uno futuro (`dominio.md` → Caja diaria), así
 * que una fecha posterior a `hoy` se recorta a `hoy`. Es una comodidad de la UI (el input de fecha
 * y la flecha de "Día siguiente"), no la regla: la API valida igual y responde 400 en `fecha`.
 */
export function fechaElegible(fecha: string, hoy: string): string {
  // `YYYY-MM-DD`: la comparación de textos es la de fechas.
  return fecha > hoy ? hoy : fecha
}

/** El query de `GET /caja`: lo vacío no se manda (sin `fecha`, la API usa la de hoy). */
export function aParams(filtros: FiltrosCaja): ListarCajaParams {
  return {
    ...(filtros.fecha !== undefined && { fecha: filtros.fecha }),
    ...(filtros.tipo !== null && { tipo: filtros.tipo }),
    ...(filtros.formaPago !== null && { formaPago: filtros.formaPago }),
  }
}
