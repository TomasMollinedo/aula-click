'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'

import { PageHeader } from '@/components/layout/page-header'
import { AlumnoDetalle } from '@/features/alumnos/components/AlumnoDetalle'
import { BotonNuevoAlumno } from '@/features/alumnos/components/BotonNuevoAlumno'

// Detalle entrando por URL. Navegando desde el listado se abre el modal de @modal/(.)[alumnoId].
export default function DetalleAlumnoPage({ params }: PageProps<'/mesa/alumnos/[alumnoId]'>) {
  const { alumnoId } = use(params)
  const router = useRouter()

  return (
    <div className="space-y-8">
      <PageHeader
        title="Detalle del alumno"
        description="Gestión de datos del alumno"
        actions={<BotonNuevoAlumno rutaBase="/mesa/alumnos" />}
      />
      <AlumnoDetalle
        alumnoId={alumnoId}
        mode="page"
        rutaBase="/mesa/alumnos"
        onCerrar={() => router.push('/mesa/alumnos')}
      />
    </div>
  )
}
