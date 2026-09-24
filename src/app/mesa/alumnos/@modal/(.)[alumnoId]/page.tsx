'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'

import { AlumnoDetalle } from '@/features/alumnos/components/AlumnoDetalle'

export default function DetalleAlumnoModal({ params }: PageProps<'/mesa/alumnos/[alumnoId]'>) {
  const { alumnoId } = use(params)
  const router = useRouter()

  return (
    <AlumnoDetalle
      alumnoId={alumnoId}
      mode="modal"
      rutaBase="/mesa/alumnos"
      onCerrar={() => router.back()}
    />
  )
}
