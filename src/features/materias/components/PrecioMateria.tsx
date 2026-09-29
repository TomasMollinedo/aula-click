import { Badge } from '@/components/ui/badge'
import { formatearPesos } from '@/utils/moneda'

import type { MateriaListadoItem } from '../materias.types'

/**
 * Precio por hora de una materia en pesos ("$ 7.500,00"), o la etiqueta "Sin precio" si la API
 * dice `sinPrecio` (materias anteriores a HU-12). Lo usan el listado y el detalle.
 */
export function PrecioMateria({
  materia,
}: {
  materia: Pick<MateriaListadoItem, 'precioHora' | 'sinPrecio'>
}) {
  if (materia.sinPrecio || materia.precioHora === null) {
    return <Badge variant="urgente">Sin precio</Badge>
  }
  return <span className="tabular-nums">{formatearPesos(materia.precioHora)}</span>
}
