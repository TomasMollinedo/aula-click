'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'

import { AlumnoEditar } from '@/features/alumnos/components/AlumnoEditar'

// Edición desde el lápiz de una fila del listado: modal encima del listado. Cerrar o guardar vuelve
// a él con su q y su page. Desde la página de detalle la intercepta [alumnoId]/@modal/(.)editar.
export default function EditarAlumnoDesdeListadoModal({
  params,
}: PageProps<'/mesa/alumnos/[alumnoId]/editar'>) {
  const { alumnoId } = use(params)
  const router = useRouter()

  return (
    <AlumnoEditar
      alumnoId={alumnoId}
      mode="modal"
      onCerrar={() => router.back()}
      onGuardado={() => router.back()}
    />
  )
}
