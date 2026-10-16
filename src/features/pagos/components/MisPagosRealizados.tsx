'use client'

import { useState } from 'react'
import { AlertCircle, FileText, Receipt } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationControls } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'
import { formatearPesos } from '@/utils/moneda'

import {
  textoCantidad,
  textoFechaPago,
  textoMateriasDelPago,
  textoNumeroComprobante,
} from '../formato-pagos'
import { useMisPagos } from '../hooks/use-mis-pagos'
import type { MiPago } from '../pagos.types'
import { hrefComprobante } from '../rutas-pagos'

/**
 * Los pagos realizados del alumno, en "Mis pagos" del portal (HU-37, `GET /pagos/mis-pagos`): del
 * más reciente al más antiguo, con el número de comprobante, la fecha, las materias, el total y la
 * forma de pago, y "Ver comprobante" (el PDF, en otra pestaña). Un pago anulado se ve "Anulado":
 * sus turnos vuelven a figurar en lo pendiente. De sólo lectura. Pensado para el celular: una
 * tarjeta por pago, con la paginación de la API.
 */
export function MisPagosRealizados() {
  const [page, setPage] = useState(1)
  const query = useMisPagos(page)

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
          {query.error?.message ?? 'Ocurrió un error inesperado'}
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!query.data) {
    return (
      <div role="status" aria-label="Cargando tus pagos" className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  const { data: pagos, meta } = query.data
  if (meta.total === 0) {
    return (
      <Card className="p-0">
        <EmptyState icon={Receipt} title="Todavía no tenés pagos registrados" />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <ul className={cn('space-y-3', query.isPlaceholderData && 'opacity-60')}>
        {pagos.map((pago) => (
          <li key={pago.id}>
            <TarjetaDePago pago={pago} />
          </li>
        ))}
      </ul>
      <PaginationControls page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
    </div>
  )
}

/** Un pago: número, estado, fecha y forma de pago, materias, total y "Ver comprobante". */
function TarjetaDePago({ pago }: { pago: MiPago }) {
  const anulado = pago.estado === 'ANULADO'
  return (
    <Card className="gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {textoNumeroComprobante(pago.numeroComprobante)}
            {anulado && <Badge variant="cancelado">Anulado</Badge>}
          </p>
          <p className="text-muted-foreground text-sm">
            {textoFechaPago(pago.fechaPago)} · {pago.formaPago.nombre}
          </p>
        </div>
        <p
          className={cn(
            'shrink-0 text-lg font-semibold tabular-nums',
            anulado && 'text-muted-foreground line-through',
          )}
        >
          {formatearPesos(pago.total)}
        </p>
      </div>
      <p className="text-sm">
        {textoMateriasDelPago(pago.materias)}{' '}
        <span className="text-muted-foreground">({textoCantidad(pago.cantidad)})</span>
      </p>
      <div>
        <Button asChild variant="outline" size="sm">
          <a
            href={hrefComprobante(pago.id)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ver comprobante: ${textoNumeroComprobante(pago.numeroComprobante)} (abre el PDF en otra pestaña)`}
          >
            <FileText />
            Ver comprobante
          </a>
        </Button>
      </div>
    </Card>
  )
}
