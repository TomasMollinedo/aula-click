'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AlumnoNuevo } from '@/features/alumnos/components/AlumnoNuevo'
import { PARAM_VOLVER_A, parsearVolverA, rutasDeVuelta } from '@/features/alumnos/volver-a'

function NuevoAlumnoModalInterceptado() {
  const router = useRouter()
  // `?volverA=` (lista blanca en features/alumnos/volver-a.ts): al crear o cerrar, vuelve ahí.
  const destino = parsearVolverA(useSearchParams().get(PARAM_VOLVER_A))
  const vuelta = destino ? rutasDeVuelta(destino, '/mesa') : null

  // Sin `volverA`: cerrar o crear vuelve al listado con su q y su page; tras crear, el listado ya
  // se invalidó.
  return (
    <AlumnoNuevo
      mode="modal"
      onCerrar={() => (vuelta ? router.push(vuelta.alCerrar) : router.back())}
      onCreado={(alumno) => (vuelta ? router.replace(vuelta.alCrear(alumno.id)) : router.back())}
    />
  )
}

// `useSearchParams` va dentro de un límite de Suspense (node_modules/next/dist/docs →
// use-search-params).
export default function NuevoAlumnoModal() {
  return (
    <Suspense fallback={null}>
      <NuevoAlumnoModalInterceptado />
    </Suspense>
  )
}
