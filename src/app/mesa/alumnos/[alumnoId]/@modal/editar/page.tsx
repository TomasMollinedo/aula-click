'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'

import { AlumnoEditar } from '@/features/alumnos/components/AlumnoEditar'

// Edición entrando por URL (o al recargar), encima del detalle. Navegando desde el detalle la
// intercepta @modal/(.)editar. Sin historial propio, cerrar o guardar vuelve al detalle con replace
// (Atrás no reabre el formulario).
export default function EditarAlumnoModalPorUrl({
  params,
}: PageProps<'/mesa/alumnos/[alumnoId]/editar'>) {
  const { alumnoId } = use(params)
  const router = useRouter()
  const volverAlDetalle = () => router.replace(`/mesa/alumnos/${alumnoId}`)

  return (
    <AlumnoEditar
      alumnoId={alumnoId}
      mode="modal"
      onCerrar={volverAlDetalle}
      onGuardado={volverAlDetalle}
    />
  )
}
