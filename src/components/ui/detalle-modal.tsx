'use client'

import { AlertCircle, History, SearchX } from 'lucide-react'
import { type ReactNode, useId } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'
import { Trazabilidad } from '@/components/ui/trazabilidad'
import type { Auditoria } from '@/types'
import type { ApiError } from '@/utils/fetch-json'

type DetalleModalProps = {
  titulo: string
  /** Debajo del título (por ejemplo, un resumen del registro o su estado). */
  descripcion?: ReactNode
  onCerrar: () => void
  /** Mientras se piden los datos. */
  cargando?: boolean
  /** Error del pedido: 404 muestra "no encontrado", 403 "sin permiso" y el resto, su mensaje. */
  error?: ApiError | null
  onReintentar?: () => void
  /** Título del 404, por ejemplo `'Hora no encontrada'`. */
  textoNoEncontrado?: string
  /** Quién creó el registro y quién lo modificó por última vez. */
  auditoria?: Auditoria
  /** Acciones además de "Cerrar" (por ejemplo, un link a la edición). */
  acciones?: ReactNode
  /** Los datos del registro, normalmente un `<Datos>` con sus `<Dato>`. */
  children?: ReactNode
}

/**
 * Detalle de solo lectura de una entidad sencilla, como modal sobre la pantalla actual (sin página
 * propia): encabezado, los datos, la trazabilidad (auditoría) y el pie con "Cerrar" y las acciones.
 * Resuelve también la carga y los errores del pedido, así cada feature solo arma sus datos.
 * Se cierra con un clic afuera: no hay nada que perder (docs/arquitectura-frontend.md).
 */
function DetalleModal({
  titulo,
  descripcion,
  onCerrar,
  cargando = false,
  error = null,
  onReintentar,
  textoNoEncontrado = 'No se encontró el registro',
  auditoria,
  acciones,
  children,
}: DetalleModalProps) {
  const hayDatos = !cargando && !error
  const idTrazabilidad = useId()

  return (
    <Panel mode="modal" onClose={onCerrar} className="max-w-xl">
      <PanelHeader>
        <div className="min-w-0">
          <PanelTitle>{titulo}</PanelTitle>
          <PanelDescription>{cargando ? 'Cargando…' : (descripcion ?? 'Detalle')}</PanelDescription>
        </div>
      </PanelHeader>

      <PanelBody className="space-y-6" aria-busy={cargando}>
        {cargando && (
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-36" />
              </div>
            ))}
          </div>
        )}

        {error?.status === 404 && (
          <EmptyState
            icon={SearchX}
            title={textoNoEncontrado}
            description="Puede que el enlace sea incorrecto."
            className="py-10"
          />
        )}

        {error && error.status !== 404 && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
              {error.status === 403 ? 'No tenés permiso para ver este detalle' : error.message}
              {error.status !== 403 && onReintentar && (
                <Button variant="outline" size="sm" onClick={onReintentar}>
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {hayDatos && children}

        {hayDatos && auditoria && (
          <section aria-labelledby={idTrazabilidad} className="border-border border-t pt-5">
            <h3 id={idTrazabilidad} className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <History className="text-cobalto size-4" />
              Trazabilidad
            </h3>
            <Trazabilidad auditoria={auditoria} />
          </section>
        )}
      </PanelBody>

      <PanelFooter>
        <Button variant="outline" size="lg" onClick={onCerrar}>
          Cerrar
        </Button>
        {hayDatos && acciones}
      </PanelFooter>
    </Panel>
  )
}

export { DetalleModal }
