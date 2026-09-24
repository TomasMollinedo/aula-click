'use client'

import { useRouter } from 'next/navigation'

import { AlumnoNuevo } from '@/features/alumnos/components/AlumnoNuevo'

// Alta entrando por URL (o al recargar). Navegando desde el listado la intercepta @modal/(.)nuevo.
// Sin historial propio, cerrar va al listado con push en lugar de router.back(). Tras el alta,
// replace al listado, así Atrás no vuelve al formulario.
export default function NuevoAlumnoModalPorUrl() {
  const router = useRouter()

  return (
    <AlumnoNuevo
      mode="modal"
      onCerrar={() => router.push('/mesa/alumnos')}
      onCreado={() => router.replace('/mesa/alumnos')}
    />
  )
}
