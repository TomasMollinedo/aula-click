import { useEffect, useRef } from 'react'

/**
 * Llama a `window.print()` una sola vez, apenas `listo` pasa a `true` (los datos del documento ya
 * cargaron). No se dispara mientras `listo` es `false`, y no se repite en renders posteriores
 * aunque `listo` se mantenga en `true`.
 */
export function useImprimirCuandoEsteListo(listo: boolean): void {
  const yaImprimio = useRef(false)

  useEffect(() => {
    if (!listo || yaImprimio.current) return
    yaImprimio.current = true
    window.print()
  }, [listo])
}
