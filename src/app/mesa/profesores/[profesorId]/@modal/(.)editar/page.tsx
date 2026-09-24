'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'

import { ProfesorEditar } from '@/features/profesores/components/ProfesorEditar'

export default function EditarProfesorModal({
  params,
}: PageProps<'/mesa/profesores/[profesorId]/editar'>) {
  const { profesorId } = use(params)
  const router = useRouter()

  // Se abre desde el detalle: cerrar o guardar vuelve a él (ya actualizado por la mutación).
  return (
    <ProfesorEditar
      profesorId={profesorId}
      mode="modal"
      onCerrar={() => router.back()}
      onGuardado={() => router.back()}
    />
  )
}
