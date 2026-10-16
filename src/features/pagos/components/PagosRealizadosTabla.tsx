import Link from 'next/link'
import { Eye } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { nombreUsuarioAuditoria } from '@/utils/auditoria'
import { cn } from '@/utils/cn'
import { fechaCorta } from '@/utils/formato-fechas'
import { formatearPesos } from '@/utils/moneda'

import { textoNumero } from '../formato-pagos'
import type { PagoRealizado } from '../pagos-realizados.types'
import { hrefPagosRealizadosDelAlumno } from '../rutas-pagos'

const CELDA = 'px-3 first:pl-6 last:pr-6'

/** "Ver detalle" de cada fila: solo el ícono, sin relleno, como en el listado de alumnos. */
const accionDeFila =
  'focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2'

type PagosRealizadosTablaProps = {
  pagos: readonly PagoRealizado[]
  /** Con la columna del alumno: la vista global. */
  conAlumno: boolean
  /** Si el alumno enlaza a su ficha (mesa de entradas; el gerente no ve la ficha). */
  enlazarAlumno: boolean
  onAbrirPago: (pagoId: number) => void
  /** Filas de un filtro o una página anterior mientras llegan las nuevas. */
  enEspera: boolean
}

/**
 * La tabla de "Pagos realizados" (HU-36). Un pago anulado se lista marcado "Anulado" y con su
 * total tachado y atenuado: no suma al total cobrado. El motivo de la anulación se ve solo en el
 * detalle del pago, que abre "Ver detalle" (`onAbrirPago`).
 */
export function PagosRealizadosTabla({
  pagos,
  conAlumno,
  enlazarAlumno,
  onAbrirPago,
  enEspera,
}: PagosRealizadosTablaProps) {
  return (
    <Table
      aria-label="Pagos realizados"
      className={cn(enEspera && 'opacity-60')}
      aria-busy={enEspera}
    >
      <TableHeader>
        <TableRow>
          <TableHead className={CELDA}>N°</TableHead>
          <TableHead className={CELDA}>Fecha de pago</TableHead>
          {conAlumno && <TableHead className={CELDA}>Alumno</TableHead>}
          <TableHead className={CELDA}>Materias</TableHead>
          <TableHead className={cn(CELDA, 'text-right')}>Turnos</TableHead>
          <TableHead className={cn(CELDA, 'text-right')}>Total</TableHead>
          <TableHead className={CELDA}>Forma de pago</TableHead>
          <TableHead className={CELDA}>Registrado por</TableHead>
          <TableHead className={CELDA}>
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagos.map((pago) => {
          const anulado = pago.estado === 'ANULADO'
          const alumno = `${pago.alumno.apellido}, ${pago.alumno.nombre}`
          return (
            <TableRow key={pago.id}>
              <TableCell className={cn(CELDA, 'font-medium whitespace-nowrap tabular-nums')}>
                <div className="flex flex-col items-start gap-1">
                  {textoNumero(pago.numeroComprobante)}
                  {anulado && <Badge variant="cancelado">Anulado</Badge>}
                </div>
              </TableCell>
              <TableCell className={cn(CELDA, 'whitespace-nowrap tabular-nums')}>
                {fechaCorta(pago.fechaPago)}
              </TableCell>
              {conAlumno && (
                <TableCell className={CELDA}>
                  {enlazarAlumno ? (
                    <Link
                      href={hrefPagosRealizadosDelAlumno(pago.alumno.id)}
                      className="text-cobalto font-medium underline-offset-4 hover:underline"
                    >
                      {alumno}
                    </Link>
                  ) : (
                    alumno
                  )}
                </TableCell>
              )}
              <TableCell className={cn(CELDA, 'whitespace-normal')}>
                {pago.materias.map((materia) => materia.nombre).join(', ')}
              </TableCell>
              <TableCell className={cn(CELDA, 'text-right tabular-nums')}>
                {pago.cantidad}
              </TableCell>
              <TableCell
                className={cn(
                  CELDA,
                  'text-right font-medium whitespace-nowrap tabular-nums',
                  anulado && 'text-muted-foreground font-normal line-through',
                )}
              >
                {formatearPesos(pago.total)}
                {anulado && <span className="sr-only"> (anulado, no suma al total cobrado)</span>}
              </TableCell>
              <TableCell className={cn(CELDA, 'whitespace-nowrap')}>
                {pago.formaPago.nombre}
              </TableCell>
              <TableCell className={CELDA}>{nombreUsuarioAuditoria(pago.registradoPor)}</TableCell>
              <TableCell className={cn(CELDA, 'text-right')}>
                <button
                  type="button"
                  onClick={() => onAbrirPago(pago.id)}
                  aria-label={`Ver detalle del pago ${textoNumero(pago.numeroComprobante)}`}
                  title="Ver detalle"
                  className={cn(accionDeFila, 'text-cobalto hover:bg-cobalto/10')}
                >
                  <Eye className="size-5" />
                </button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
