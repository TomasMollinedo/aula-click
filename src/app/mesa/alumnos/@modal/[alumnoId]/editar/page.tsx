'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'

import { AlumnoEditar } from '@/features/alumnos/components/AlumnoEditar'

// Edición entrando por URL (o al recargar). Navegando desde el detalle la intercepta
// @modal/(.)[alumnoId]/editar. Sin historial propio, cerrar o guardar va al listado con push.
export default function EditarAlumnoModalPorUrl({
  params,
}: PageProps<'/mesa/alumnos/[alumnoId]/editar'>) {
  const { alumnoId } = use(params)
  const router = useRouter()
  const volverAlListado = () => router.push('/mesa/alumnos')

  return (
    <AlumnoEditar
      alumnoId={alumnoId}
      mode="modal"
      onCerrar={volverAlListado}
      onGuardado={volverAlListado}
    />
  )
}
