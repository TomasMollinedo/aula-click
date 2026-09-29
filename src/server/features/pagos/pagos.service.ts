import { NotFoundError, ValidationError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { Actor } from '@/server/shared/actor'
import { hoy, type Reloj } from '@/server/shared/fechas'
import type { PagosRepository } from './pagos.repository'
import {
  calcularVuelto,
  MENSAJE_FECHA_PAGO_FUTURA,
  planificarPago,
  type PedidoPago,
} from './pagos.reglas'
import type { Comprobante, PagoRegistrado, RegistrarPago } from './pagos.validation'

// Reglas de negocio del cobro (HU-15, T-51). No conoce HTTP ni Prisma: lanza AppError o sus
// subclases. Qué se puede cobrar, el total y el vuelto los decide `planificarPago` (puro); del
// alumno sólo lee, por su repository.

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Los importa sólo como tipo, así el service no carga Prisma ni `@/config/env`.
 */
export function crearPagosService({
  repository,
  alumnosRepository,
  reloj,
}: {
  repository: Pick<PagosRepository, 'leerSnapshot' | 'registrar' | 'buscarComprobante'>
  alumnosRepository: Pick<AlumnosRepository, 'buscarPorId'>
  reloj?: Reloj
}) {
  return {
    /**
     * Registra el pago de una o varias ocurrencias de un alumno, todo o nada. Chequeos, en orden
     * (el primero que falla gana):
     * 1. El body ya lo validó Zod (400).
     * 2. `fechaPago` posterior a hoy → 400 en `fechaPago`.
     * 3. Alumno inexistente → 404 (su estado no importa: una deuda se cobra igual).
     * 4. Chequeo previo sin lock (`planificarPago` sobre el snapshot): ocurrencia de otro alumno
     *    → 400; alguna no cobrable → 409 `TURNOS_NO_COBRABLES`; total fuera de rango o
     *    `montoRecibido` menor al total → 400.
     * 5. `repository.registrar`, que bloquea el alumno, relee y vuelve a decidir con la misma
     *    regla antes de escribir. La respuesta sale del plan decidido bajo lock.
     */
    async registrar(datos: RegistrarPago, actor: Actor): Promise<PagoRegistrado> {
      const fechaHoy = hoy(reloj)
      if (datos.fechaPago > fechaHoy) {
        throw new ValidationError(MENSAJE_FECHA_PAGO_FUTURA, {
          details: [{ path: ['fechaPago'], message: MENSAJE_FECHA_PAGO_FUTURA }],
        })
      }

      const alumno = await alumnosRepository.buscarPorId(datos.alumnoId)
      if (!alumno) throw new NotFoundError('Alumno no encontrado')

      const montoRecibido = datos.montoRecibido ?? null
      const pedido: PedidoPago = {
        alumnoId: datos.alumnoId,
        ocurrencias: datos.ocurrencias,
        montoRecibido,
      }
      const verificar = (snapshot: Parameters<typeof planificarPago>[0]) =>
        planificarPago(snapshot, pedido, fechaHoy)

      verificar(await repository.leerSnapshot(datos.ocurrencias, reloj))

      const { pagoId, numeroComprobante, plan } = await repository.registrar(
        {
          alumnoId: datos.alumnoId,
          ocurrencias: datos.ocurrencias,
          fechaPago: datos.fechaPago,
          montoRecibido,
          observaciones: datos.observaciones ?? null,
        },
        verificar,
        actor,
        reloj,
      )
      return {
        pagoId,
        numeroComprobante,
        cantidad: plan.lineas.length,
        total: plan.total,
        montoRecibido,
        vuelto: plan.vuelto,
      }
    },

    /** Datos del comprobante. El vuelto se recalcula, nunca se lee de la base. 404 si no existe. */
    async obtenerComprobante(id: number): Promise<Comprobante> {
      const comprobante = await repository.buscarComprobante(id)
      if (!comprobante) throw new NotFoundError('Pago no encontrado')
      return {
        ...comprobante,
        vuelto: calcularVuelto(comprobante.montoRecibido, comprobante.total),
      }
    },
  }
}

export type PagosService = ReturnType<typeof crearPagosService>
