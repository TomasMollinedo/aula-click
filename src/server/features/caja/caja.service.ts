import { ValidationError } from '@/server/errors'
import { hoy, type Reloj } from '@/server/shared/fechas'
import type { CajaRepository } from './caja.repository'
import {
  MENSAJE_FECHA_FUTURA,
  armarMovimientos,
  armarResumen,
  filtrarMovimientos,
} from './caja.reglas'
import type { Caja, CajaPdfQuery, CajaQuery } from './caja.validation'

// Caja diaria del gerente (HU-46, T-127). No conoce HTTP ni Prisma. Sólo lectura: lee del
// repository los tres tipos de movimiento del día y los arma con las reglas puras. El resumen es
// siempre el del día completo; los filtros sólo recortan la lista de movimientos.

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real;
 * los tests, con uno falso y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Lo importa sólo como tipo, así el service no carga Prisma ni `@/config/env`.
 */
export function crearCajaService({
  repository,
  reloj,
}: {
  repository: CajaRepository
  reloj?: Reloj
}) {
  /** La fecha pedida o, sin ella, la de hoy. 400 en `fecha` si es futura. */
  function fechaDeLaCaja(fecha: string | undefined): string {
    const fechaHoy = hoy(reloj)
    if (fecha !== undefined && fecha > fechaHoy) {
      throw new ValidationError('Datos de entrada inválidos', {
        details: [{ path: ['fecha'], message: MENSAJE_FECHA_FUTURA }],
      })
    }
    return fecha ?? fechaHoy
  }

  /** La caja de `fecha` con los movimientos recortados por los filtros que lleguen. */
  async function armarCaja(fecha: string, filtros: Pick<CajaQuery, 'tipo' | 'formaPago'>) {
    const [cobros, anulaciones, pagosAProfesores] = await Promise.all([
      repository.cobrosDelDia(fecha),
      repository.anulacionesDelDia(fecha),
      repository.pagosAProfesoresDelDia(fecha),
    ])
    const lecturas = { cobros, anulaciones, pagosAProfesores }
    return {
      fecha,
      movimientos: filtrarMovimientos(armarMovimientos(lecturas), filtros),
      resumen: armarResumen(lecturas),
    }
  }

  return {
    /** `GET /caja`: los movimientos del día (con `tipo` y `formaPago`) y el resumen completo. */
    async obtener({ fecha, tipo, formaPago }: CajaQuery): Promise<Caja> {
      return armarCaja(fechaDeLaCaja(fecha), { tipo, formaPago })
    },

    /**
     * `GET /caja/pdf`: lo mismo que `obtener` sin filtros, con la lista completa de movimientos. La
     * fecha y los números son los de la pantalla: el PDF no recalcula nada.
     */
    async paraDocumento({ fecha }: CajaPdfQuery): Promise<Caja> {
      return armarCaja(fechaDeLaCaja(fecha), {})
    },
  }
}

export type CajaService = ReturnType<typeof crearCajaService>
