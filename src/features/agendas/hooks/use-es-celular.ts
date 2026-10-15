'use client'

import { useSyncExternalStore } from 'react'

// El mismo corte que el layout (`app-shell`): por debajo de `md` es el celular.
const CONSULTA_CELULAR = '(max-width: 767.98px)'

function suscribir(onChange: () => void) {
  const consulta = window.matchMedia(CONSULTA_CELULAR)
  consulta.addEventListener('change', onChange)
  return () => consulta.removeEventListener('change', onChange)
}

const esCelular = () => window.matchMedia(CONSULTA_CELULAR).matches

/** Si la pantalla es la de un celular. En el servidor y en la hidratación vale `false`. */
export function useEsCelular(): boolean {
  return useSyncExternalStore(suscribir, esCelular, () => false)
}
