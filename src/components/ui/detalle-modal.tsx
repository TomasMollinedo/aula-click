'use client'

import { AlertCircle, History, SearchX } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId } from 'react'

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
import { cn } from '@/utils/cn'
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
  /**
   * Acciones además de "Cerrar" (por ejemplo, un link a la edición), cada una un
   * `DetalleModalAccion`. Cada acción aporta al pie **un solo elemento** (o ninguno): el pie
   * cuenta sus hijos para repartirlos en columnas.
   */
  acciones?: ReactNode
  /** Acciones del encabezado, al lado de la cruz de cerrar (por ejemplo, "Generar PDF"). */
  accionesEncabezado?: ReactNode
  /**
   * Se cierra solo con la cruz del encabezado, que va destacada: el pie no lleva "Cerrar" y, si no
   * hay acciones, no se muestra.
   */
  soloCruz?: boolean
  /** Los datos del registro, normalmente un `<Datos>` con sus `<Dato>`. */
  children?: ReactNode
}

/**
 * Botón del pie de un `DetalleModal` ("Cerrar" y cada acción): un `Button` con el alto y el relleno
 * fijos, así todos miden lo mismo y solo cambia la `variant`. El ancho lo pone el pie.
 */
function DetalleModalAccion({ className, ...props }: Omit<ComponentProps<typeof Button>, 'size'>) {
  return <Button size="lg" className={cn('min-w-36 px-3', className)} {...props} />
}

// El pie reparte los botones en columnas iguales según cuántos haya (se cuentan con `:has()`): hasta
// dos, a la derecha con su ancho; cuatro, en 2 × 2; el resto, de a tres por fila. En pantallas
// angostas van apilados (`PanelFooter`).
const PIE =
  'sm:grid sm:grid-cols-3 sm:has-[>:nth-child(4):last-child]:grid-cols-2 sm:has-[>:nth-child(-n+2):last-child]:flex'

// La cruz cuando es la única forma de cerrar (`soloCruz`): con borde, más oscura y más grande.
const CRUZ_DESTACADA =
  'border-input text-foreground hover:border-oscuro/50 border bg-background shadow-sm [&_svg]:size-5 [&_svg]:stroke-[2.5]'

/**
 * Detalle de solo lectura de una entidad sencilla, como modal sobre la pantalla actual (sin página
 * propia): encabezado, los datos, la trazabilidad (auditoría) y el pie con "Cerrar" y las acciones
 * (con `soloCruz`, sin "Cerrar": solo la cruz del encabezado).
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
  accionesEncabezado,
  soloCruz = false,
  children,
}: DetalleModalProps) {
  const hayDatos = !cargando && !error
  const idTrazabilidad = useId()

  return (
    <Panel mode="modal" onClose={onCerrar} className="max-w-xl">
      <PanelHeader
        actions={hayDatos && accionesEncabezado}
        closeClassName={soloCruz ? CRUZ_DESTACADA : undefined}
      >
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

      {/* Sin "Cerrar", el pie puede quedar sin botones (cada acción decide si se muestra): no se ve. */}
      <PanelFooter className={cn(PIE, soloCruz && 'empty:hidden!')}>
        {!soloCruz && (
          <DetalleModalAccion variant="outline" onClick={onCerrar}>
            Cerrar
          </DetalleModalAccion>
        )}
        {hayDatos && acciones}
      </PanelFooter>
    </Panel>
  )
}

export { DetalleModal, DetalleModalAccion }
