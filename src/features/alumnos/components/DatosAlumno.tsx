'use client'

import { format, parseISO } from 'date-fns'
import {
  AlertTriangle,
  GraduationCap,
  IdCard,
  NotebookPen,
  Phone,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Dato, Datos } from '@/components/ui/datos'
import { Trazabilidad } from '@/components/ui/trazabilidad'

import { type AlumnoDetalle, NIVEL_ESCOLARIDAD_LABEL } from '../alumnos.types'

/** La pestaña "Datos" de la ficha del alumno: datos personales, contacto, tutor, escolares y trazabilidad. */
export function DatosAlumno({ alumno }: { alumno: AlumnoDetalle }) {
  const tieneDatosTutor = [
    alumno.tutorNombre,
    alumno.tutorApellido,
    alumno.tutorDni,
    alumno.tutorTelefono,
    alumno.tutorEmail,
  ].some(Boolean)
  // Mismo criterio que el formulario: el tutor corresponde a un menor; un mayor que conserva datos
  // de tutor (docs/dominio.md) también los ve.
  const mostrarTutor = alumno.menorDeEdad || tieneDatosTutor
  const faltanDatosTutor =
    alumno.menorDeEdad &&
    (!alumno.tutorNombre || !alumno.tutorApellido || !alumno.tutorTelefono || !alumno.tutorEmail)

  return (
    <div className="space-y-6">
      {faltanDatosTutor && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription className="text-destructive">
            El alumno es menor de edad y faltan datos del tutor. Editá la ficha para completarlos.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion icon={IdCard} titulo="Datos identificatorios">
          <Datos>
            <Dato label="Nombre" valor={alumno.nombre} />
            <Dato label="Apellido" valor={alumno.apellido} />
            <Dato label="DNI" valor={alumno.dni} />
            <Dato
              label="Fecha de nacimiento"
              valor={format(parseISO(alumno.fechaNacimiento), 'dd/MM/yyyy')}
            />
          </Datos>
        </Seccion>

        <Seccion icon={Phone} titulo="Contacto">
          <Datos>
            <Dato label="Teléfono" valor={alumno.telefono} />
            <Dato label="Email" valor={alumno.email} />
          </Datos>
        </Seccion>

        {mostrarTutor && (
          <Seccion icon={UserRound} titulo="Tutor o responsable">
            <Datos>
              <Dato label="Nombre" valor={alumno.tutorNombre} />
              <Dato label="Apellido" valor={alumno.tutorApellido} />
              <Dato label="DNI" valor={alumno.tutorDni} />
              <Dato label="Teléfono" valor={alumno.tutorTelefono} />
              <Dato label="Email" valor={alumno.tutorEmail} />
            </Datos>
          </Seccion>
        )}

        <Seccion icon={GraduationCap} titulo="Datos escolares">
          <Datos>
            <Dato
              label="Nivel"
              valor={
                alumno.nivelEscolaridad ? NIVEL_ESCOLARIDAD_LABEL[alumno.nivelEscolaridad] : null
              }
            />
            <Dato label="Grado o año" valor={alumno.grado} />
            <Dato label="Colegio / institución" valor={alumno.institucionEducativa} />
          </Datos>
        </Seccion>

        <Seccion icon={NotebookPen} titulo="Observaciones" className="lg:col-span-2">
          <p className="text-sm whitespace-pre-line">
            {alumno.observaciones ?? (
              <span className="text-muted-foreground">Sin observaciones</span>
            )}
          </p>
        </Seccion>
      </div>

      <Trazabilidad auditoria={alumno} />
    </div>
  )
}

function Seccion({
  icon: Icon,
  titulo,
  className,
  children,
}: {
  icon: LucideIcon
  titulo: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={className}>
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon className="text-cobalto size-4" />
        {titulo}
      </h2>
      {children}
    </Card>
  )
}
