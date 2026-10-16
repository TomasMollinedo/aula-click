'use client'

import { ExternalLink, Paperclip } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { textoAdjuntadoPor } from '../formato-liquidaciones'
import { useComprobanteTransferencia } from '../hooks/use-comprobante-transferencia'
import type { ComprobanteDeTransferencia } from '../liquidaciones.types'

/**
 * El comprobante de la transferencia de una liquidación pagada (solo el gerente lo ve), con el
 * criterio de "ver" de `ComprobanteAdjuntoDelPago`: su nombre, quién lo adjuntó y cuándo, y "Ver
 * comprobante", que lo abre en otra pestaña con la URL prefirmada de
 * `GET /adjuntos/liquidaciones/{liquidacionId}` (se pide solo si hay comprobante y vence a los 15
 * minutos: nunca se guarda). No se reemplaza ni se quita. Sin comprobante, "Sin comprobante
 * adjunto".
 */
export function ComprobanteTransferencia({
  liquidacionId,
  comprobante,
}: {
  liquidacionId: number
  comprobante: ComprobanteDeTransferencia | null
}) {
  const conUrl = useComprobanteTransferencia(liquidacionId, comprobante !== null)

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Paperclip className="text-cobalto size-4" />
        Comprobante de la transferencia
      </h3>

      {comprobante ? (
        <>
          <div className="space-y-1">
            <p className="text-sm font-medium break-all">{comprobante.nombre}</p>
            <p className="text-muted-foreground text-xs">
              {textoAdjuntadoPor(comprobante.adjuntadoPor, comprobante.adjuntadoEl)}
            </p>
          </div>

          {conUrl.isError && (
            <p className="text-destructive flex flex-wrap items-center gap-2 text-sm">
              {conUrl.error.message}
              <Button variant="outline" size="sm" onClick={() => conUrl.refetch()}>
                Reintentar
              </Button>
            </p>
          )}

          {conUrl.data ? (
            <Button asChild variant="outline">
              <a
                href={conUrl.data.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ver comprobante: ${comprobante.nombre} (abre en otra pestaña)`}
              >
                <ExternalLink />
                Ver comprobante
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <ExternalLink />
              Ver comprobante
            </Button>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">Sin comprobante adjunto</p>
      )}
    </div>
  )
}
