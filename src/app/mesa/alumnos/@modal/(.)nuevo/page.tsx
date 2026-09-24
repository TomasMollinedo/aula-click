'use client'

import { useRouter } from 'next/navigation'

import { AlumnoNuevo } from '@/features/alumnos/components/AlumnoNuevo'

export default function NuevoAlumnoModal() {
  const router = useRouter()

  return (
    <AlumnoNuevo
      mode="modal"
      onCerrar={() => router.back()}
      // replace: Atrás desde la página del alumno creado vuelve al listado, no al alta.
      onCreado={(alumno) => router.replace(`/mesa/alumnos/${alumno.id}`)}
    />
  )
}
