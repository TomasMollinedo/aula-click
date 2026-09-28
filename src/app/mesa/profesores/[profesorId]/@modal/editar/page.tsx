'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'

import { ProfesorEditar } from '@/features/profesores/components/ProfesorEditar'

// Edición entrando por URL (o al recargar), encima del detalle. Navegando desde el detalle la
// intercepta @modal/(.)editar. Sin historial propio, cerrar o guardar vuelve al detalle con replace
// (Atrás no reabre el formulario).
export default function EditarProfesorModalPorUrl({
  params,
}: PageProps<'/mesa/profesores/[profesorId]/editar'>) {
  const { profesorId } = use(params)
  const router = useRouter()
  const volverAlDetalle = () => router.replace(`/mesa/profesores/${profesorId}`)

  return (
    <ProfesorEditar
      profesorId={profesorId}
      mode="modal"
      onCerrar={volverAlDetalle}
      onGuardado={volverAlDetalle}
    />
  )
}
