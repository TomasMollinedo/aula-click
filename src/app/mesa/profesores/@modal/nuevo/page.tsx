'use client'

import { useRouter } from 'next/navigation'

import { ProfesorNuevo } from '@/features/profesores/components/ProfesorNuevo'

// Alta entrando por URL (o al recargar). Navegando desde el listado la intercepta @modal/(.)nuevo.
// Sin historial propio, cerrar va al listado con push en lugar de router.back(). Tras el alta,
// replace al listado, así Atrás no vuelve al formulario.
export default function NuevoProfesorModalPorUrl() {
  const router = useRouter()

  return (
    <ProfesorNuevo
      mode="modal"
      onCerrar={() => router.push('/mesa/profesores')}
      onCreado={() => router.replace('/mesa/profesores')}
    />
  )
}
