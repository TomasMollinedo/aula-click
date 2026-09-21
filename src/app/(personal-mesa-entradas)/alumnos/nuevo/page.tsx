import { AlumnoForm } from '@/features/alumnos/components/AlumnoForm'

export default function NuevoAlumnoPage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo alumno</h1>
      <AlumnoForm />
    </div>
  )
}
