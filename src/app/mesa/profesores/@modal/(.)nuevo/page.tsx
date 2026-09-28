'use client'

import { useRouter } from 'next/navigation'

import { ProfesorNuevo } from '@/features/profesores/components/ProfesorNuevo'

export default function NuevoProfesorModal() {
  const router = useRouter()

  // Cerrar o crear limpian la búsqueda y los filtros con un replace: si volvieran al listado tal
  // cual estaba (router.back()), un profesor recién creado podía no aparecer en un listado
  // filtrado y parecer que el alta no funcionó.
  return (
    <ProfesorNuevo
      mode="modal"
      onCerrar={() => router.replace('/mesa/profesores')}
      onCreado={() => router.replace('/mesa/profesores')}
    />
  )
}
