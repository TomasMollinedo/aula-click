'use client'

import { type MouseEvent, useEffect, useRef, useState } from 'react'
import { ExternalLink, FileUp, Paperclip, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

import { textoAdjuntadoPor } from '../formato-pagos'
import { useAdjuntoDePago } from '../hooks/use-adjunto-de-pago'
import type { DetallePago } from '../pago-detalle.types'
import { QuitarAdjuntoDialog } from './QuitarAdjuntoDialog'
import { ReemplazarAdjuntoDialog } from './ReemplazarAdjuntoDialog'

type ComprobanteAdjuntoDelPagoProps = Pick<DetallePago, 'adjunto' | 'acciones'> & {
  pagoId: number
}

type Dialogo = { tipo: 'reemplazar'; modo: 'reemplazar' | 'adjuntar' } | { tipo: 'quitar' }

/**
 * La sección "Comprobante adjunto" del detalle de un pago (HU-24): el archivo que trajo la familia,
 * no el comprobante de pago en PDF que emite el centro. Con adjunto, su nombre, quién lo adjuntó y
 * cuándo, y "Ver comprobante adjunto", que lo abre en otra pestaña con la URL prefirmada de
 * `GET /adjuntos/pagos/{pagoId}` (se pide solo si hay adjunto y vence a los 15 minutos: nunca se
 * guarda). Sin adjunto, "Sin comprobante adjunto".
 *
 * "Reemplazar comprobante adjunto" (o "Adjuntar comprobante", en un débito sin adjunto) y "Quitar"
 * se muestran solo según `acciones`, que decide la API. Cada diálogo queda montado hasta que se
 * cierra, aunque su botón ya no se vea (terminar invalida el detalle); si al cerrarlo el botón ya
 * no está, el foco va al modal del detalle, como en `AccionRegistrarPago`.
 */
export function ComprobanteAdjuntoDelPago({
  pagoId,
  adjunto,
  acciones,
}: ComprobanteAdjuntoDelPagoProps) {
  const conUrl = useAdjuntoDePago(pagoId, adjunto !== null)
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const [cierres, setCierres] = useState(0)
  const modalRef = useRef<HTMLElement | null>(null)

  const abrir = (evento: MouseEvent<HTMLButtonElement>, nuevo: Dialogo) => {
    modalRef.current = evento.currentTarget.closest<HTMLElement>('[role="dialog"]')
    setDialogo(nuevo)
  }

  const cerrar = () => {
    setDialogo(null)
    setCierres((n) => n + 1)
  }

  useEffect(() => {
    if (cierres === 0) return
    const timeout = setTimeout(() => {
      const activo = document.activeElement
      if (activo && activo !== document.body && activo.isConnected) return
      modalRef.current?.focus()
    }, 0)
    return () => clearTimeout(timeout)
  }, [cierres])

  return (
    <Card>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Paperclip className="text-cobalto size-4" />
        Comprobante adjunto
      </h3>

      {adjunto ? (
        <div className="space-y-1">
          <p className="text-sm font-medium break-all">{adjunto.nombre}</p>
          <p className="text-muted-foreground text-xs">
            {textoAdjuntadoPor(adjunto.adjuntadoPor, adjunto.adjuntadoEl)}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Sin comprobante adjunto</p>
      )}

      {adjunto && conUrl.isError && (
        <p className="text-destructive flex flex-wrap items-center gap-2 text-sm">
          No se pudo obtener el comprobante adjunto.
          <Button variant="outline" size="sm" onClick={() => conUrl.refetch()}>
            Reintentar
          </Button>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {adjunto &&
          (conUrl.data ? (
            <Button asChild variant="outline">
              <a
                href={conUrl.data.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ver comprobante adjunto: ${adjunto.nombre} (abre en otra pestaña)`}
              >
                <ExternalLink />
                Ver comprobante adjunto
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <ExternalLink />
              Ver comprobante adjunto
            </Button>
          ))}

        {acciones.reemplazarAdjunto && (
          <Button
            variant="outline"
            onClick={(e) =>
              abrir(e, { tipo: 'reemplazar', modo: adjunto ? 'reemplazar' : 'adjuntar' })
            }
          >
            <FileUp />
            {adjunto ? 'Reemplazar comprobante adjunto' : 'Adjuntar comprobante'}
          </Button>
        )}

        {acciones.quitarAdjunto && (
          <Button variant="outline" onClick={(e) => abrir(e, { tipo: 'quitar' })}>
            <Trash2 />
            Quitar
          </Button>
        )}
      </div>

      {dialogo?.tipo === 'reemplazar' && (
        <ReemplazarAdjuntoDialog
          pagoId={pagoId}
          modo={dialogo.modo}
          actual={conUrl.data ?? null}
          onCerrar={cerrar}
        />
      )}
      {dialogo?.tipo === 'quitar' && <QuitarAdjuntoDialog pagoId={pagoId} onCerrar={cerrar} />}
    </Card>
  )
}
