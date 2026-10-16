import type { PagoParaAcciones } from '@/types/pago'

import type { DetallePago } from './pago-detalle.types'

/**
 * El pago que reciben las acciones del pie del detalle (`renderAcciones`, por ejemplo "Anular
 * pago"): lo justo de la respuesta de `GET /pagos/{id}`, con las acciones tal como las mandó la API.
 */
export function pagoParaAcciones(detalle: DetallePago): PagoParaAcciones {
  return {
    id: detalle.id,
    numeroComprobante: detalle.numeroComprobante,
    estado: detalle.estado,
    alumno: {
      id: detalle.alumno.id,
      nombre: detalle.alumno.nombre,
      apellido: detalle.alumno.apellido,
      dni: detalle.alumno.dni,
    },
    total: detalle.total,
    cantidad: detalle.cantidad,
    acciones: { ...detalle.acciones },
  }
}
