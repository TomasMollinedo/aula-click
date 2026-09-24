'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'

import { AlumnoDetalle } from '@/features/alumnos/components/AlumnoDetalle'

// Detalle entrando por URL (o al recargar). Navegando desde el listado lo intercepta
// @modal/(.)[alumnoId]. Sin historial propio, cerrar va al listado con push.
export default function DetalleAlumnoModalPorUrl({
  params,
}: PageProps<'/mesa/alumnos/[alumnoId]'>) {
  const { alumnoId } = use(params)
  const router = useRouter()

  return (
    <AlumnoDetalle
      alumnoId={alumnoId}
      mode="modal"
      rutaBase="/mesa/alumnos"
      onCerrar={() => router.push('/mesa/alumnos')}
    />
  )
}
