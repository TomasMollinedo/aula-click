import { HandCoins } from 'lucide-react'

import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RepartoDelPago as Reparto } from '@/types/pago'
import { fechaCorta } from '@/utils/formato-fechas'
import { formatearPesos } from '@/utils/moneda'
import { formatearPorcentaje } from '@/utils/porcentaje'

// El modal del detalle es angosto: menos relleno que el de `Table` (px-6) para que las cinco
// columnas entren sin desplazarse en la pantalla grande.
const CELDA = 'px-2 py-3 first:pl-0 last:pr-0'
const NUMERO = `${CELDA} text-right tabular-nums whitespace-nowrap`

/**
 * El reparto de un pago entre el centro y los profesores (HU-43), en el detalle del pago del
 * gerente (slot `renderReparto` de `PagoDetalle`). Una fila por turno, en el orden de la lista de
 * turnos de arriba, y los totales: todo viene de la API, nada se calcula acá.
 */
export function RepartoDelPago({ reparto }: { reparto: Reparto }) {
  return (
    <Card>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <HandCoins className="text-cobalto size-4" />
        Reparto
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={CELDA}>Turno</TableHead>
            <TableHead className={NUMERO}>Importe</TableHead>
            <TableHead className={NUMERO}>%</TableHead>
            <TableHead className={NUMERO}>Centro</TableHead>
            <TableHead className={NUMERO}>Profesor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reparto.turnos.map((turno) => (
            <TableRow key={`${turno.turnoId}|${turno.fecha}`}>
              <TableCell className={CELDA}>
                <p>{fechaCorta(turno.fecha)}</p>
                <p className="text-muted-foreground">
                  {turno.profesor.nombre} {turno.profesor.apellido}
                </p>
              </TableCell>
              <TableCell className={NUMERO}>{formatearPesos(turno.importe)}</TableCell>
              <TableCell className={NUMERO}>{formatearPorcentaje(turno.porcentaje)}</TableCell>
              <TableCell className={NUMERO}>{formatearPesos(turno.parteCentro)}</TableCell>
              <TableCell className={NUMERO}>{formatearPesos(turno.parteProfesor)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className={CELDA}>Total</TableCell>
            <TableCell className={NUMERO}>{formatearPesos(reparto.totales.importe)}</TableCell>
            <TableCell className={CELDA} />
            <TableCell className={NUMERO}>{formatearPesos(reparto.totales.parteCentro)}</TableCell>
            <TableCell className={NUMERO}>
              {formatearPesos(reparto.totales.parteProfesor)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  )
}
