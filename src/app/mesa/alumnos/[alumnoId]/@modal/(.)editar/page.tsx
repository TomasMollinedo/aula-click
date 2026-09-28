'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'

import { AlumnoEditar } from '@/features/alumnos/components/AlumnoEditar'

export default function EditarAlumnoModal({
  params,
}: PageProps<'/mesa/alumnos/[alumnoId]/editar'>) {
  const { alumnoId } = use(params)
  const router = useRouter()

  // Se abre desde el detalle: cerrar o guardar vuelve a él (ya actualizado por la mutación).
  return (
    <AlumnoEditar
      alumnoId={alumnoId}
      mode="modal"
      onCerrar={() => router.back()}
      onGuardado={() => router.back()}
    />
  )
}
