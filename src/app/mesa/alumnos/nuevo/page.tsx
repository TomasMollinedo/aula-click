'use client'

import { useRouter } from 'next/navigation'

import { PageHeader } from '@/components/layout/page-header'
import { AlumnoNuevo } from '@/features/alumnos/components/AlumnoNuevo'

// Alta entrando por URL. Navegando desde el listado se abre el modal de @modal/(.)nuevo.
// Salir vuelve al listado: ir a otra ruta de /mesa/alumnos abriría un modal encima de esta página.
export default function NuevoAlumnoPage() {
  const router = useRouter()
  const volverAlListado = () => router.push('/mesa/alumnos')

  return (
    <div className="space-y-8">
      <PageHeader title="Nuevo alumno" description="Gestión de datos del alumno" />
      <AlumnoNuevo mode="page" onCerrar={volverAlListado} onCreado={volverAlListado} />
    </div>
  )
}
