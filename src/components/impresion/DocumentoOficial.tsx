import type { ReactNode } from 'react'
import { format } from 'date-fns'
import { MousePointer2 } from 'lucide-react'

import { DATOS_CENTRO } from './datos-centro'

/**
 * Encabezado común de los documentos oficiales imprimibles (HU-11, HU-15): la misma marca del
 * Sidebar (ícono + `bg-dorado`, ver `components/layout/sidebar-logo.tsx`) y los datos del centro,
 * el título del documento, quién lo emite y la fecha y hora de emisión (del navegador, no del
 * servidor). El contenido propio de cada documento (comprobante, turno, agenda) va en `children`.
 * Pensado para una página con su propia ruta que use `useImprimirCuandoEsteListo`
 * (ver `docs/arquitectura-frontend.md` → Documentos imprimibles).
 */
export function DocumentoOficial({
  titulo,
  emitidoPor,
  children,
}: {
  titulo: string
  emitidoPor: string
  children: ReactNode
}) {
  return (
    <article className="mx-auto max-w-[190mm] p-10 text-black">
      <header className="mb-8 flex items-start justify-between gap-6 border-b border-black/20 pb-4">
        <div className="flex items-center gap-3">
          <span className="bg-dorado flex size-10 shrink-0 items-center justify-center rounded-lg">
            <MousePointer2 className="size-5 fill-white text-white" />
          </span>
          <div className="text-sm">
            <p className="font-semibold">{DATOS_CENTRO.nombre}</p>
            <p className="text-black/70">{DATOS_CENTRO.direccion}</p>
            <p className="text-black/70">{DATOS_CENTRO.telefono}</p>
          </div>
        </div>
        <div className="text-right text-xs text-black/70">
          <p>Emitido por: {emitidoPor}</p>
          <p>{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      </header>

      <h1 className="mb-6 text-lg font-semibold">{titulo}</h1>

      {children}
    </article>
  )
}
