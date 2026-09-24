'use client'

import { useRouter } from 'next/navigation'

import { AlumnoNuevo } from '@/features/alumnos/components/AlumnoNuevo'

// Alta entrando por URL (o al recargar). Navegando desde el listado la intercepta @modal/(.)nuevo.
// Sin historial propio, cerrar o crear va al listado con push en lugar de router.back().
export default function NuevoAlumnoModalPorUrl() {
  const router = useRouter()
  const volverAlListado = () => router.push('/mesa/alumnos')

  return <AlumnoNuevo mode="modal" onCerrar={volverAlListado} onCreado={volverAlListado} />
}
