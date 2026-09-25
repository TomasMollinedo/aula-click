'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AlumnoNuevo } from '@/features/alumnos/components/AlumnoNuevo'
import { PARAM_VOLVER_A, parsearVolverA, rutasDeVuelta } from '@/features/alumnos/volver-a'

// Alta entrando por URL (o al recargar). Navegando desde el listado la intercepta @modal/(.)nuevo.
// Sin historial propio, cerrar va al listado con push en lugar de router.back(). Tras el alta,
// replace al listado, así Atrás no vuelve al formulario. Con `?volverA=` (lista blanca en
// features/alumnos/volver-a.ts), el destino de los dos es el de la vuelta.
function NuevoAlumnoModalPorUrlContenido() {
  const router = useRouter()
  const destino = parsearVolverA(useSearchParams().get(PARAM_VOLVER_A))
  const vuelta = destino ? rutasDeVuelta(destino, '/mesa') : null

  return (
    <AlumnoNuevo
      mode="modal"
      onCerrar={() => router.push(vuelta?.alCerrar ?? '/mesa/alumnos')}
      onCreado={(alumno) => router.replace(vuelta?.alCrear(alumno.id) ?? '/mesa/alumnos')}
    />
  )
}

// `useSearchParams` va dentro de un límite de Suspense (node_modules/next/dist/docs →
// use-search-params).
export default function NuevoAlumnoModalPorUrl() {
  return (
    <Suspense fallback={null}>
      <NuevoAlumnoModalPorUrlContenido />
    </Suspense>
  )
}
