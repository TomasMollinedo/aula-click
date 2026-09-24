'use client'

import { useRouter } from 'next/navigation'

import { MateriaNueva } from '@/features/materias/components/MateriaNueva'

// Alta entrando por URL (o al recargar). Navegando desde el listado la intercepta @modal/(.)nueva.
// Sin historial propio, cerrar va al listado con push en lugar de router.back(). Tras el alta,
// replace al listado, así Atrás no vuelve al formulario.
export default function NuevaMateriaModalPorUrl() {
  const router = useRouter()

  return (
    <MateriaNueva
      mode="modal"
      onCerrar={() => router.push('/mesa/materias')}
      onCreada={() => router.replace('/mesa/materias')}
    />
  )
}
