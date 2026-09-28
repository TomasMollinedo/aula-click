import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/utils/cn'

type SeccionPasoProps = {
  numero: number
  titulo: string
  /** Ayuda debajo del título. */
  descripcion?: ReactNode
  /** Todavía no se puede usar (falta completar un paso anterior): se ve atenuada y sin contenido. */
  bloqueada?: boolean
  /** Texto que se muestra mientras está bloqueada. */
  textoBloqueada?: string
  /** Acción a la derecha del título (por ejemplo, "Cambiar"). */
  accion?: ReactNode
  children?: ReactNode
  className?: string
}

/**
 * Una sección de la pantalla de registrar turno. Las secciones se habilitan en orden (no es un
 * wizard con rutas): cada una muestra su número, su título y, si falta un paso anterior, el aviso.
 */
export function SeccionPaso({
  numero,
  titulo,
  descripcion,
  bloqueada = false,
  textoBloqueada,
  accion,
  children,
  className,
}: SeccionPasoProps) {
  const idTitulo = `paso-${numero}-titulo`
  return (
    <Card
      role="region"
      aria-labelledby={idTitulo}
      className={cn('gap-5', bloqueada && 'opacity-60', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
              bloqueada ? 'bg-canvas text-muted-foreground' : 'bg-cobalto text-white',
            )}
          >
            {numero}
          </span>
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-lg leading-7 font-semibold">
              <span className="sr-only">Paso {numero}: </span>
              {titulo}
            </h2>
            {descripcion && !bloqueada && (
              <div className="text-muted-foreground mt-0.5 text-sm">{descripcion}</div>
            )}
            {bloqueada && textoBloqueada && (
              <p className="text-muted-foreground mt-0.5 text-sm">{textoBloqueada}</p>
            )}
          </div>
        </div>
        {accion && !bloqueada && <div className="shrink-0">{accion}</div>}
      </div>
      {!bloqueada && children}
    </Card>
  )
}
