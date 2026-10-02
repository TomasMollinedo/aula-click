import type { ReactNode } from 'react'
import { format } from 'date-fns'

/**
 * El logo lo sirve la API (misma sesión); el front no tiene una copia en `public/`. La API lo
 * manda con un `Cache-Control` largo: si cambia el archivo, se sube `v` para que el navegador no
 * siga mostrando el anterior.
 */
const LOGO_CENTRO = '/api/v1/centro/logo?v=2'

/** Etiqueta chica en cobalto, la misma que usan los campos del documento (`Campo`). */
function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <dt className="text-cobalto text-[10px] font-bold tracking-widest uppercase">{children}</dt>
  )
}

/**
 * Encabezado común de los documentos oficiales imprimibles (HU-11, HU-15): logo y datos del
 * centro, el título del documento, quién lo emite y la fecha y hora de emisión (del navegador, no
 * del servidor). El contenido propio de cada documento (comprobante, turno, agenda) va en `children`.
 * `referencia` es lo que identifica al documento, a la derecha del título (el número del
 * comprobante): va una sola vez, ahí.
 *
 * Quien emite el documento es el centro (Nexo Académico, `GET /centro`), no el sistema: el nombre
 * de la app no aparece en la hoja.
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
    <article data-documento-oficial className="mx-auto max-w-[190mm] p-10 text-black">
      <header className="border-cobalto mb-8 flex items-center justify-between gap-6 border-b-2 pb-5">
        <div className="flex items-center gap-4">
          {/* <img> y no next/image: es una imagen de la API detrás de la sesión, sin optimizar. */}
          {/* `alt` vacío: el nombre del centro ya está escrito al lado. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_CENTRO}
            alt=""
            className="h-14 w-auto shrink-0"
            onLoad={onLogoListo}
            onError={onLogoListo}
          />
          <div>
            <p className="text-sidebar text-xl leading-tight font-bold tracking-tight">
              {centro.nombre}
            </p>
            <p className="mt-1 text-xs text-black/60">{centro.direccion}</p>
            <p className="text-xs text-black/60">Tel. {centro.telefono}</p>
          </div>
        </div>
        <dl className="shrink-0 space-y-2 text-right text-xs">
          <div>
            <Etiqueta>Emitido por</Etiqueta>
            <dd className="mt-0.5 text-black/80">{emitidoPor}</dd>
          </div>
          <div>
            <Etiqueta>Fecha de emisión</Etiqueta>
            <dd className="mt-0.5 text-black/80">{format(new Date(), 'dd/MM/yyyy HH:mm')}</dd>
          </div>
        </dl>
      </header>

      {referencia ? (
        <div className="text-sidebar mb-6 flex items-baseline justify-between gap-6">
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{referencia}</p>
        </div>
      ) : (
        <h1 className="text-sidebar mb-6 text-2xl font-semibold tracking-tight">{titulo}</h1>
      )}

      {children}
    </article>
  )
}
