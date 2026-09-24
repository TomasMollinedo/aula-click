'use client'

import { X } from 'lucide-react'
import { type ComponentProps, type ReactNode, createContext, useContext } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/utils/cn'

// Contenedor con encabezado, cuerpo y pie que se muestra igual como modal (`mode="modal"`, sobre
// la pantalla actual) o como tarjeta dentro de la página (`mode="page"`). Lo usan las pantallas de
// alta, detalle y edición, que se abren como modal desde un listado y como página al entrar por URL
// (docs/arquitectura-frontend.md → Modales con URL propia).

type PanelMode = 'modal' | 'page'

const PanelContext = createContext<{ mode: PanelMode; onClose: () => void } | null>(null)

function usePanel() {
  const context = useContext(PanelContext)
  if (!context) throw new Error('Los componentes Panel* van dentro de <Panel>')
  return context
}

function Panel({
  mode,
  onClose,
  dismissOnInteractOutside = true,
  className,
  children,
}: {
  mode: PanelMode
  onClose: () => void
  /** En `false`, un clic fuera del modal no lo cierra (por ejemplo, en un formulario). */
  dismissOnInteractOutside?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <PanelContext.Provider value={{ mode, onClose }}>
      {mode === 'modal' ? (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
          <DialogContent
            showCloseButton={false}
            onInteractOutside={dismissOnInteractOutside ? undefined : (e) => e.preventDefault()}
            className={cn(
              'flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0',
              className,
            )}
          >
            {children}
          </DialogContent>
        </Dialog>
      ) : (
        <section
          data-slot="panel"
          className={cn(
            'bg-card text-card-foreground flex flex-col overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5',
            className,
          )}
        >
          {children}
        </section>
      )}
    </PanelContext.Provider>
  )
}

/** Encabezado: título y descripción a la izquierda; `actions` y el botón de cerrar a la derecha. */
function PanelHeader({
  className,
  actions,
  children,
  ...props
}: ComponentProps<'header'> & { actions?: ReactNode }) {
  return (
    <header
      data-slot="panel-header"
      className={cn('border-border flex items-start gap-4 border-b px-6 py-5 sm:px-7', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <PanelClose />
      </div>
    </header>
  )
}

function PanelTitle({ className, ...props }: ComponentProps<'h2'>) {
  const { mode } = usePanel()
  const classes = cn('text-xl leading-tight font-semibold', className)
  return mode === 'modal' ? (
    <DialogTitle data-slot="panel-title" className={classes} {...props} />
  ) : (
    <h2 data-slot="panel-title" className={classes} {...props} />
  )
}

function PanelDescription({ className, ...props }: ComponentProps<'p'>) {
  const { mode } = usePanel()
  const classes = cn('text-muted-foreground mt-1 text-xs', className)
  return mode === 'modal' ? (
    <DialogDescription data-slot="panel-description" className={classes} {...props} />
  ) : (
    <p data-slot="panel-description" className={classes} {...props} />
  )
}

function PanelClose({ className }: { className?: string }) {
  const { onClose } = usePanel()
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Cerrar"
      className={cn(
        'text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2',
        className,
      )}
    >
      <X className="size-4" />
    </button>
  )
}

/** Cuerpo con scroll propio: en el modal, el encabezado y el pie quedan fijos. */
function PanelBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-body"
      className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-7', className)}
      {...props}
    />
  )
}

function PanelFooter({ className, ...props }: ComponentProps<'footer'>) {
  return (
    <footer
      data-slot="panel-footer"
      className={cn(
        'border-border flex flex-col-reverse gap-3 border-t px-6 py-4 sm:flex-row sm:justify-end sm:px-7',
        className,
      )}
      {...props}
    />
  )
}

export { Panel, PanelHeader, PanelTitle, PanelDescription, PanelClose, PanelBody, PanelFooter }
