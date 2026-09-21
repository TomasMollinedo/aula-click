import { AlumnoForm } from '@/features/alumnos/components/AlumnoForm'

// AL-02/AL-04 (editar). Placeholder de ruta — AlumnoForm todavía no tiene modo edición
// ni existe use-alumno.ts (detalle) / use-update-alumno.ts. Ver mapa-hu-frontend.md.
export default function EditarAlumnoPage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Editar alumno</h1>
      <AlumnoForm />
    </div>
  )
}
