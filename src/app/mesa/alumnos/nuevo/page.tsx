'use client'

import { useRouter } from 'next/navigation'

import { AlumnoForm } from '@/features/alumnos/components/AlumnoForm'
import { useCrearAlumno } from '@/features/alumnos/hooks/use-crear-alumno'
import type { AlumnoCrear } from '@/features/alumnos/alumnos.types'

export default function NuevoAlumnoPage() {
  const router = useRouter()
  const mutation = useCrearAlumno()

  function handleSubmit(datos: AlumnoCrear) {
    mutation.mutate(datos, {
      onSuccess: (alumno) => {
        router.push(`/mesa/alumnos/${alumno.id}`)
      },
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo alumno</h1>
      <AlumnoForm
        modo="crear"
        onSubmit={handleSubmit}
        isPending={mutation.isPending}
        error={mutation.error}
      />
    </div>
  )
}
