'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type PestanaMiMateria = 'historial' | 'examenes'

/**
 * La pestaña de una materia del portal, en la URL (`?tab=examenes`; el historial no se escribe) con
 * `router.replace`, como las de la ficha del alumno: cambiar de pestaña no suma historial y el mes
 * (`?mes=`) se conserva.
 */
export function usePestanaMiMateria() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const pestana: PestanaMiMateria =
    searchParams.get('tab') === 'examenes' ? 'examenes' : 'historial'

  function cambiar(valor: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (valor === 'examenes') params.set('tab', 'examenes')
    else params.delete('tab')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return { pestana, cambiar }
}
