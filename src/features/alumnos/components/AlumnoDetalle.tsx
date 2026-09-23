'use client'

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { AlertTriangle, Pencil } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { NIVEL_ESCOLARIDAD_LABEL, type AlumnoDetalle as AlumnoDetalleType } from '../alumnos.types'

type AlumnoDetalleProps = {
  alumno: AlumnoDetalleType
}

export function AlumnoDetalle({ alumno }: AlumnoDetalleProps) {
  const faltanDatosTutor =
    alumno.menorDeEdad &&
    (!alumno.tutorNombre || !alumno.tutorApellido || !alumno.tutorTelefono || !alumno.tutorEmail)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {alumno.apellido}, {alumno.nombre}
        </h1>
        <Button asChild>
          <Link href={`/mesa/alumnos/${alumno.id}/editar`}>
            <Pencil className="size-4" />
            Editar
          </Link>
        </Button>
      </div>

      {faltanDatosTutor && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            El alumno es menor de edad y faltan datos del tutor. Editá la ficha para completarlos.
          </AlertDescription>
        </Alert>
      )}

      {/* Identificatorios */}
      <Seccion titulo="Datos identificatorios">
        <Campo label="Nombre" valor={alumno.nombre} />
        <Campo label="Apellido" valor={alumno.apellido} />
        <Campo label="DNI" valor={alumno.dni} />
        <Campo
          label="Fecha de nacimiento"
          valor={format(parseISO(alumno.fechaNacimiento), 'dd/MM/yyyy')}
        />
      </Seccion>

      {/* Contacto */}
      <Seccion titulo="Contacto">
        <Campo label="Email" valor={alumno.email} />
        <Campo label="Teléfono" valor={alumno.telefono} />
      </Seccion>

      {/* Tutor */}
      <Seccion titulo="Tutor">
        <Campo label="Nombre" valor={alumno.tutorNombre} />
        <Campo label="Apellido" valor={alumno.tutorApellido} />
        <Campo label="DNI" valor={alumno.tutorDni} />
        <Campo label="Teléfono" valor={alumno.tutorTelefono} />
        <Campo label="Email" valor={alumno.tutorEmail} />
      </Seccion>

      {/* Escolares */}
      <Seccion titulo="Datos escolares">
        <Campo
          label="Nivel de escolaridad"
          valor={alumno.nivelEscolaridad ? NIVEL_ESCOLARIDAD_LABEL[alumno.nivelEscolaridad] : null}
        />
        <Campo label="Grado o año" valor={alumno.grado} />
        <Campo label="Institución educativa" valor={alumno.institucionEducativa} />
      </Seccion>

      {/* Observaciones */}
      <Seccion titulo="Observaciones">
        <p className="text-sm">{alumno.observaciones ?? '—'}</p>
      </Seccion>

      {/* Próximamente */}
      <Seccion titulo="Exámenes">
        <p className="text-muted-foreground text-sm">Próximamente</p>
      </Seccion>

      <Seccion titulo="Turnos">
        <p className="text-muted-foreground text-sm">Próximamente</p>
      </Seccion>

      {/* Auditoría */}
      <div className="border-border space-y-1 border-t pt-4">
        <p className="text-muted-foreground text-xs">
          Creado por {nombreAuditoria(alumno.createdBy)} el{' '}
          {format(parseISO(alumno.createdAt), 'dd/MM/yyyy HH:mm')}
        </p>
        <p className="text-muted-foreground text-xs">
          Última modificación por {nombreAuditoria(alumno.updatedBy)} el{' '}
          {format(parseISO(alumno.updatedAt), 'dd/MM/yyyy HH:mm')}
        </p>
      </div>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Campo({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-sm">{valor ?? '—'}</p>
    </div>
  )
}

function nombreAuditoria(usuario: { nombre: string; apellido: string } | null): string {
  return usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Sistema'
}
