import type { OcurrenciaACobrar } from '@/types/pago'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fechaConDia } from '@/utils/formato-fechas'

import { textoHorario, textoImporte } from '../formato-pagos'

/**
 * Una fila por turno que se ofrece cobrar, en el orden en que llegan (el mismo del body: los
 * errores vuelven por posición). Los importes son los que mandó la API a quien abrió el diálogo.
 */
export function ResumenACobrarTabla({ ocurrencias }: { ocurrencias: OcurrenciaACobrar[] }) {
  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-3">Fecha</TableHead>
            <TableHead className="px-3">Horario</TableHead>
            <TableHead className="px-3">Materia</TableHead>
            <TableHead className="px-3">Profesor</TableHead>
            <TableHead className="px-3 text-right">Importe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ocurrencias.map((o) => (
            <TableRow key={`${o.turnoId}|${o.fecha}`}>
              <TableCell className="px-3 py-2.5">{fechaConDia(o.fecha)}</TableCell>
              <TableCell className="px-3 py-2.5">{textoHorario(o.horaInicio, o.horaFin)}</TableCell>
              <TableCell className="px-3 py-2.5">{o.materia.nombre}</TableCell>
              <TableCell className="px-3 py-2.5">
                {o.profesor.nombre} {o.profesor.apellido}
              </TableCell>
              <TableCell
                className={
                  o.importe === null
                    ? 'text-muted-foreground px-3 py-2.5 text-right'
                    : 'px-3 py-2.5 text-right tabular-nums'
                }
              >
                {textoImporte(o.importe)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
