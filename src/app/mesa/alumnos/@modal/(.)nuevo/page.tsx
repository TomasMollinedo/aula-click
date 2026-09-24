'use client'

import { useRouter } from 'next/navigation'

import { AlumnoNuevo } from '@/features/alumnos/components/AlumnoNuevo'

export default function NuevoAlumnoModal() {
  const router = useRouter()

  // Cerrar o crear vuelve al listado con su q y su page; tras crear, el listado ya se invalidó.
  return <AlumnoNuevo mode="modal" onCerrar={() => router.back()} onCreado={() => router.back()} />
}
