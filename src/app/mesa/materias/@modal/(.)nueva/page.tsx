'use client'

import { useRouter } from 'next/navigation'

import { MateriaNueva } from '@/features/materias/components/MateriaNueva'

export default function NuevaMateriaModal() {
  const router = useRouter()

  // Cerrar o crear limpian la búsqueda y los filtros con un replace: si volvieran al listado tal
  // cual estaba (router.back()), una materia recién creada podía no aparecer en un listado
  // filtrado y parecer que el alta no funcionó.
  return (
    <MateriaNueva
      mode="modal"
      onCerrar={() => router.replace('/mesa/materias')}
      onCreada={() => router.replace('/mesa/materias')}
    />
  )
}
