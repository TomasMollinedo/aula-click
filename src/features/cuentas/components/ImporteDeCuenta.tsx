import { Badge } from '@/components/ui/badge'
import { formatearPesos } from '@/utils/moneda'

/**
 * El importe de un turno de la cuenta ("$ 8.000,00"), o la etiqueta "Sin precio" si la materia no
 * tiene. Se ve igual que el precio por hora del listado de materias (`PrecioMateria`, de
 * `features/materias`, que no se puede importar): verde de la paleta, grande y semibold, para que
 * el importe se destaque en la fila. El número es el de la API.
 */
export function ImporteDeCuenta({ importe }: { importe: number | null }) {
  if (importe === null) return <Badge variant="urgente">Sin precio</Badge>
  return (
    <span className="text-confirmado text-xl font-semibold tabular-nums">
      {formatearPesos(importe)}
    </span>
  )
}
