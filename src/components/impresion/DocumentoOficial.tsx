import type { ReactNode } from 'react'
import { format } from 'date-fns'

/** El logo lo sirve la API (misma sesión); el front no tiene una copia en `public/`. */
const LOGO_CENTRO = '/api/v1/centro/logo'

/**
 * Encabezado común de los documentos oficiales imprimibles (HU-11, HU-15): logo y datos del
 * centro, el título del documento, quién lo emite y la fecha y hora de emisión (del navegador, no
 * del servidor). El contenido propio de cada documento (comprobante, turno, agenda) va en `children`.
 * `referencia` es lo que identifica al documento, a la derecha del título (el número del
 * comprobante): va una sola vez, ahí.
 *
 * `centro` llega por props porque `components/` no puede importar de `features/` (ESLint): lo pide
 * con `useCentro()` quien arma el documento. `onLogoListo` se llama cuando el logo terminó de
 * cargar (o falló), para no imprimir un encabezado sin logo.
 * Ver `docs/arquitectura-frontend.md` → Documentos imprimibles.
 */
export function DocumentoOficial({
  titulo,
  referencia,
  emitidoPor,
  centro,
  onLogoListo,
  children,
}: {
  titulo: string
  referencia?: string
  emitidoPor: string
  centro: { nombre: string; direccion: string; telefono: string }
  onLogoListo?: () => void
  children: ReactNode
}) {
  return (
    <article className="mx-auto max-w-[190mm] p-10 text-black">
      <header className="mb-8 flex items-start justify-between gap-6 border-b border-black/20 pb-4">
        <div className="flex items-center gap-4">
          {/* <img> y no next/image: es una imagen de la API detrás de la sesión, sin optimizar. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_CENTRO}
            alt={centro.nombre}
            className="h-16 w-auto shrink-0"
            onLoad={onLogoListo}
            onError={onLogoListo}
          />
          <div className="text-sm">
            <p className="font-semibold">{centro.nombre}</p>
            <p className="text-black/70">{centro.direccion}</p>
            <p className="text-black/70">{centro.telefono}</p>
          </div>
        </div>
        <div className="text-right text-xs text-black/70">
          <p>Emitido por: {emitidoPor}</p>
          <p>{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      </header>

      {referencia ? (
        <div className="mb-6 flex items-baseline justify-between gap-6">
          <h1 className="text-lg font-semibold">{titulo}</h1>
          <p className="text-xl font-semibold tabular-nums">{referencia}</p>
        </div>
      ) : (
        <h1 className="mb-6 text-lg font-semibold">{titulo}</h1>
      )}

      {children}
    </article>
  )
}
