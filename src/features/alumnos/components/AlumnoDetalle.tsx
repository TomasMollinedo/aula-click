'use client'

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Construction,
  GraduationCap,
  IdCard,
  NotebookPen,
  Pencil,
  Phone,
  SearchX,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { parsearAlumnoId } from '../alumnos.schema'
import {
  type AlumnoDetalle as AlumnoDetalleType,
  NIVEL_ESCOLARIDAD_LABEL,
  type UsuarioAuditoria,
} from '../alumnos.types'
import { useAlumno } from '../hooks/use-alumno'

type AlumnoDetalleProps = {
  /** `alumnoId` tal como llega en la URL. */
  alumnoId: string
  /** URL del listado de alumnos en el segmento del rol (por ejemplo `/mesa/alumnos`). */
  rutaBase: string
}

// Página de detalle del alumno, con tabs. "Editar" abre la edición como modal encima de esta página
// (slot @modal); docs/arquitectura-frontend.md → Modales con URL propia.
export function AlumnoDetalle({ alumnoId, rutaBase }: AlumnoDetalleProps) {
  const id = parsearAlumnoId(alumnoId)
  const { data: alumno, isLoading, isError, error, refetch } = useAlumno(id ?? 0)

  const volver = (
    <Link
      href={rutaBase}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
    >
      <ArrowLeft className="size-4" />
      Volver a alumnos
    </Link>
  )

  if (id === null || (isError && error?.status === 404)) {
    return (
      <div className="space-y-6">
        {volver}
        <Card className="p-0">
          <EmptyState
            icon={SearchX}
            title="Alumno no encontrado"
            description="Puede que el enlace sea incorrecto."
          >
            <Button variant="outline" asChild>
              <Link href={rutaBase}>Volver al listado</Link>
            </Button>
          </EmptyState>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy>
        {volver}
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !alumno) {
    return (
      <div className="space-y-6">
        {volver}
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
            {error?.status === 403
              ? 'No tenés permiso para ver este alumno'
              : (error?.message ?? 'Ocurrió un error inesperado')}
            {error?.status !== 403 && (
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Reintentar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {volver}
      <PageHeader
        title={`${alumno.nombre} ${alumno.apellido}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            DNI {alumno.dni}
            {alumno.menorDeEdad && <Badge variant="accent">Menor de edad</Badge>}
          </span>
        }
        actions={
          <Button size="lg" asChild>
            <Link href={`${rutaBase}/${alumno.id}/editar`}>
              <Pencil />
              Editar
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="datos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="datos" className="px-4">
            <UserRound />
            Datos del alumno
          </TabsTrigger>
          <TabsTrigger value="turnos" className="px-4">
            <CalendarClock />
            Turnos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos">
          <DatosAlumno alumno={alumno} />
        </TabsContent>

        <TabsContent value="turnos">
          <Card className="p-0">
            <EmptyState
              icon={Construction}
              title="Función en construcción"
              description="Pronto vas a poder ver acá los turnos del alumno."
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DatosAlumno({ alumno }: { alumno: AlumnoDetalleType }) {
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

      <div className="text-muted-foreground space-y-1 text-xs">
        <p>
          Creado por {nombreAuditoria(alumno.createdBy)} · {formatoInstante(alumno.createdAt)}
        </p>
        <p>
          Última modificación por {nombreAuditoria(alumno.updatedBy)} ·{' '}
          {formatoInstante(alumno.updatedAt)}
        </p>
      </div>
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

function Datos({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{children}</dl>
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
