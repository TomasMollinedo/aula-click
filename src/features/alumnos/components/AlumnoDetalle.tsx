'use client'

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { AlertTriangle, Pencil } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { getInitials } from '@/utils/initials'

import { parsearAlumnoId } from '../alumnos.schema'
import {
  type AlumnoDetalle as AlumnoDetalleType,
  NIVEL_ESCOLARIDAD_LABEL,
  type UsuarioAuditoria,
} from '../alumnos.types'
import { useAlumno } from '../hooks/use-alumno'
import { AlumnoPanelEstado } from './AlumnoPanelEstado'

type AlumnoDetalleProps = {
  /** `alumnoId` tal como llega en la URL. */
  alumnoId: string
  mode: 'modal' | 'page'
  onCerrar: () => void
  /** URL del listado de alumnos en el segmento del rol (por ejemplo `/mesa/alumnos`). */
  rutaBase: string
}

const TITULO = 'Detalle del alumno'

export function AlumnoDetalle({ alumnoId, mode, onCerrar, rutaBase }: AlumnoDetalleProps) {
  const id = parsearAlumnoId(alumnoId)
  const { data: alumno, isLoading, isError, error, refetch } = useAlumno(id ?? 0)

  const estado = { mode, onCerrar, titulo: TITULO }
  if (id === null) return <AlumnoPanelEstado {...estado} estado="no-encontrado" />
  if (isLoading) return <AlumnoPanelEstado {...estado} estado="cargando" />
  if (isError && error?.status === 404) {
    return <AlumnoPanelEstado {...estado} estado="no-encontrado" />
  }
  if (isError || !alumno) {
    return (
      <AlumnoPanelEstado {...estado} estado="error" error={error} onReintentar={() => refetch()} />
    )
  }

  return (
    <Panel mode={mode} onClose={onCerrar}>
      <PanelHeader
        actions={
          <Button variant="outline" asChild>
            <Link href={`${rutaBase}/${alumno.id}/editar`}>
              <Pencil />
              Editar
            </Link>
          </Button>
        }
      >
        <Avatar className="hidden size-11 sm:flex">
          <AvatarFallback className="bg-cobalto/10 text-cobalto text-xs font-semibold">
            {getInitials(alumno.nombre, alumno.apellido)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <PanelTitle className="truncate">
            {TITULO} — {alumno.nombre} {alumno.apellido}
          </PanelTitle>
          <PanelDescription>Información personal y próximos turnos</PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-8">
        <FichaAlumno alumno={alumno} />
      </PanelBody>
    </Panel>
  )
}

function FichaAlumno({ alumno }: { alumno: AlumnoDetalleType }) {
  const faltanDatosTutor =
    alumno.menorDeEdad &&
    (!alumno.tutorNombre || !alumno.tutorApellido || !alumno.tutorTelefono || !alumno.tutorEmail)

  const nombreTutor = [alumno.tutorNombre, alumno.tutorApellido].filter(Boolean).join(' ')
  const contactoTutor = [alumno.tutorTelefono, alumno.tutorEmail].filter(Boolean).join(' · ')
  const nivel = alumno.nivelEscolaridad ? NIVEL_ESCOLARIDAD_LABEL[alumno.nivelEscolaridad] : null

  return (
    <>
      {faltanDatosTutor && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription className="text-destructive">
            El alumno es menor de edad y faltan datos del tutor. Editá la ficha para completarlos.
          </AlertDescription>
        </Alert>
      )}

      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Dato label="DNI" valor={alumno.dni} />
        <Dato
          label="Fecha de nacimiento"
          valor={format(parseISO(alumno.fechaNacimiento), 'dd/MM/yyyy')}
        />
        <Dato label="Teléfono" valor={alumno.telefono} />
        <Dato label="Email" valor={alumno.email} />
        <Dato
          label="Tutor"
          valor={
            nombreTutor || contactoTutor ? (
              <>
                {nombreTutor && <span className="block">{nombreTutor}</span>}
                {contactoTutor && <span className="block">{contactoTutor}</span>}
                {alumno.tutorDni && (
                  <span className="text-muted-foreground block">DNI {alumno.tutorDni}</span>
                )}
              </>
            ) : null
          }
        />
        <Dato label="Nivel" valor={[nivel, alumno.grado].filter(Boolean).join(' — ') || null} />
        <Dato label="Colegio" valor={alumno.institucionEducativa} />
      </dl>

      <section className="space-y-2">
        <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Observaciones
        </h3>
        <p className="bg-canvas rounded-lg px-4 py-3 text-sm whitespace-pre-line">
          {alumno.observaciones ?? 'Sin observaciones'}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Próximos turnos</h3>
        <div className="border-border overflow-hidden rounded-xl border">
          <div className="bg-canvas text-muted-foreground grid grid-cols-3 px-4 py-2.5 text-[11px] font-semibold tracking-wide uppercase">
            <span>Fecha y hora</span>
            <span>Materia</span>
            <span>Profesor</span>
          </div>
          <p className="text-muted-foreground border-border border-t px-4 py-4 text-sm">
            Próximamente
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Exámenes</h3>
        <p className="text-muted-foreground border-border rounded-xl border px-4 py-4 text-sm">
          Próximamente
        </p>
      </section>

      <section className="border-border space-y-1.5 border-t pt-5">
        <h3 className="font-semibold">Trazabilidad</h3>
        <p className="text-muted-foreground text-sm">
          Creado por {nombreAuditoria(alumno.createdBy)} · {formatoInstante(alumno.createdAt)}
        </p>
        <p className="text-muted-foreground text-sm">
          Última modificación por {nombreAuditoria(alumno.updatedBy)} ·{' '}
          {formatoInstante(alumno.updatedAt)}
        </p>
      </section>
    </>
  )
}

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm break-words">{valor ?? '—'}</dd>
    </div>
  )
}

// Instante de auditoría (ISO en UTC) en hora local: parseISO respeta la "Z".
function formatoInstante(instante: string): string {
  return format(parseISO(instante), 'dd/MM/yyyy, HH:mm')
}

function nombreAuditoria(usuario: UsuarioAuditoria | null): string {
  return usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Sistema'
}
