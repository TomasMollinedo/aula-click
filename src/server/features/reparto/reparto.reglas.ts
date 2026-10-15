// Regla del reparto de un turno cobrado entre el centro y el profesor (HU-43, T-120). Pura: sin
// Prisma ni HTTP. Es la única implementación: las demás features la leen de `reparto.condiciones.ts`
// (docs/dominio.md → Reparto). Los importes entran y salen en pesos (`number`), pero se calculan en
// centavos y centésimos enteros para no multiplicar flotantes (convenciones-backend.md → Importes).

/** El reparto de un turno cobrado, en pesos. `parteCentro + parteProfesor === importe`. */
export type Reparto = {
  importe: number
  porcentaje: number
  parteCentro: number
  parteProfesor: number
}

/** La suma de varios repartos, en pesos. Sin porcentaje: en un total no tiene sentido. */
export type TotalReparto = Omit<Reparto, 'porcentaje'>

/** Mensaje del error de configuración sin ningún `PorcentajeCentro` (decisión T-161). */
export const MENSAJE_SIN_PORCENTAJE =
  'No hay un porcentaje del centro configurado (PorcentajeCentro vacío)'

const aCentavos = (importe: number) => Math.round(importe * 100)

/**
 * El reparto de un turno de `importe` pesos al `porcentaje` del centro (15 = 15 %). Parte del
 * centro = importe × porcentaje en centavos enteros, redondeada mitad hacia arriba; parte del
 * profesor = importe − parte del centro, así las dos suman siempre el importe.
 *
 * Lanza `RangeError` (error de programación) si el importe es negativo o el porcentaje no está en
 * `[0, 100)`.
 */
export function repartoDeTurno(importe: number, porcentaje: number): Reparto {
  if (importe < 0) {
    throw new RangeError(`repartoDeTurno: el importe no puede ser negativo (recibió ${importe})`)
  }
  if (porcentaje < 0 || porcentaje >= 100) {
    throw new RangeError(
      `repartoDeTurno: el porcentaje debe estar en [0, 100) (recibió ${porcentaje})`,
    )
  }
  const importeCentavos = aCentavos(importe)
  const porcentajeCentesimos = Math.round(porcentaje * 100)
  const parteCentroCentavos = Math.floor((importeCentavos * porcentajeCentesimos + 5000) / 10000)
  return {
    importe: importeCentavos / 100,
    porcentaje,
    parteCentro: parteCentroCentavos / 100,
    parteProfesor: (importeCentavos - parteCentroCentavos) / 100,
  }
}

/** Suma varios repartos en centavos. Una lista vacía da todo en 0. */
export function sumarReparto(repartos: readonly TotalReparto[]): TotalReparto {
  let importe = 0
  let parteCentro = 0
  let parteProfesor = 0
  for (const reparto of repartos) {
    importe += aCentavos(reparto.importe)
    parteCentro += aCentavos(reparto.parteCentro)
    parteProfesor += aCentavos(reparto.parteProfesor)
  }
  return {
    importe: importe / 100,
    parteCentro: parteCentro / 100,
    parteProfesor: parteProfesor / 100,
  }
}

const formatoPorcentaje = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

/** El porcentaje para un mensaje: `15` → "15 %", `18.5` → "18,5 %". */
export function textoPorcentaje(porcentaje: number): string {
  return `${formatoPorcentaje.format(porcentaje)} %`
}
