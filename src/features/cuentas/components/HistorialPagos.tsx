import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatearPesos } from '@/utils/moneda'

import type { PagoDelHistorial } from '../cuentas.types'
import { textoCantidadTurnos, textoFechaPago } from '../formato-cuentas'
import { hrefComprobante } from '../rutas-cuentas'

/**
 * Los pagos del alumno, del más reciente al más antiguo (el orden de la API). Sin acciones de
 * anular (definición D): solo "Ver comprobante", en una pestaña nueva como en T-52.
 */
export function HistorialPagos({ pagos }: { pagos: readonly PagoDelHistorial[] }) {
  return (
    <Table aria-label="Pagos registrados">
      <TableHeader>
        <TableRow>
          <TableHead>N° de comprobante</TableHead>
          <TableHead>Fecha de pago</TableHead>
          <TableHead>Turnos</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>
            <span className="sr-only">Comprobante</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagos.map((pago) => (
          <TableRow key={pago.pagoId}>
            <TableCell className="font-medium tabular-nums">{pago.numeroComprobante}</TableCell>
            <TableCell className="tabular-nums">{textoFechaPago(pago.fechaPago)}</TableCell>
            <TableCell className="whitespace-nowrap">
              {textoCantidadTurnos(pago.cantidad)}
            </TableCell>
            <TableCell className="text-right whitespace-nowrap tabular-nums">
              {formatearPesos(pago.total)}
            </TableCell>
            <TableCell className="text-right">
              <Button asChild size="sm" variant="outline">
                <a href={hrefComprobante(pago.pagoId)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Ver comprobante
                  <span className="sr-only">
                    {' '}
                    N° {pago.numeroComprobante} (se abre en otra pestaña)
                  </span>
                </a>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
