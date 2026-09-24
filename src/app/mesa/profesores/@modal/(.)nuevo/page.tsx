'use client'

import { useRouter } from 'next/navigation'

import { ProfesorNuevo } from '@/features/profesores/components/ProfesorNuevo'

export default function NuevoProfesorModal() {
  const router = useRouter()

  // Cerrar o crear vuelve al listado con su q, page y filtros; tras crear, el listado ya se invalidó.
  return (
    <ProfesorNuevo mode="modal" onCerrar={() => router.back()} onCreado={() => router.back()} />
  )
}
