'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'

import { PageHeader } from '@/components/layout/page-header'
import { AlumnoEditar } from '@/features/alumnos/components/AlumnoEditar'
import { BotonNuevoAlumno } from '@/features/alumnos/components/BotonNuevoAlumno'

// Edición entrando por URL. Navegando desde el detalle se abre el modal de @modal/(.)[alumnoId]/editar.
// Salir vuelve al listado: ir al detalle lo abriría como modal encima de esta página.
export default function EditarAlumnoPage({ params }: PageProps<'/mesa/alumnos/[alumnoId]/editar'>) {
  const { alumnoId } = use(params)
  const router = useRouter()
  const volverAlListado = () => router.push('/mesa/alumnos')

  return (
    <div className="space-y-8">
      <PageHeader
        title="Editar alumno"
        description="Gestión de datos del alumno"
        actions={<BotonNuevoAlumno rutaBase="/mesa/alumnos" />}
      />
      <AlumnoEditar
        alumnoId={alumnoId}
        mode="page"
        onCerrar={volverAlListado}
        onGuardado={volverAlListado}
      />
    </div>
  )
}
