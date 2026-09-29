import { useEffect, useRef } from 'react'

/**
 * Llama a `window.print()` una sola vez, apenas `listo` pasa a `true`. No se dispara mientras
 * `listo` es `false`, y no se repite en renders posteriores aunque `listo` se mantenga en `true`.
 *
 * `listo` tiene que incluir los datos del documento, los del centro (`useCentro`) y que el logo
 * haya terminado de cargar (`onLogoListo` de `DocumentoOficial`), para que no salga un
 * encabezado sin logo.
 */
export function useImprimirCuandoEsteListo(listo: boolean): void {
  const yaImprimio = useRef(false)

  useEffect(() => {
    if (!listo || yaImprimio.current) return
    yaImprimio.current = true
    window.print()
  }, [listo])
}
