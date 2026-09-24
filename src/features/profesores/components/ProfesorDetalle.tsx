'use client'

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarClock,
  Construction,
  IdCard,
  Pencil,
  Phone,
  SearchX,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getInitials } from '@/utils/initials'

import { parsearProfesorId } from '../profesores.schema'
import type { ProfesorDetalle as ProfesorDetalleType, UsuarioAuditoria } from '../profesores.types'
import { useProfesor } from '../hooks/use-profesor'

type ProfesorDetalleProps = {
  /** `profesorId` tal como llega en la URL. */
  profesorId: string
  /** URL del listado de profesores en el segmento del rol (por ejemplo `/mesa/profesores`). */
  rutaBase: string
}

// Página de detalle del profesor, con tabs. "Editar" abre la edición como modal encima de esta
// página (slot @modal); docs/arquitectura-frontend.md → Modales con URL propia.
export function ProfesorDetalle({ profesorId, rutaBase }: ProfesorDetalleProps) {
  const id = parsearProfesorId(profesorId)
  const { data: profesor, isLoading, isError, error, refetch } = useProfesor(id ?? 0)

  const volver = (
    <Link
      href={rutaBase}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
    >
      <ArrowLeft className="size-4" />
      Volver a profesores
    </Link>
  )

  if (id === null || (isError && error?.status === 404)) {
    return (
      <div className="space-y-6">
        {volver}
        <Card className="p-0">
          <EmptyState
            icon={SearchX}
            title="Profesor no encontrado"
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

  if (isError || !profesor) {
    return (
      <div className="space-y-6">
        {volver}
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
            {error?.status === 403
              ? 'No tenés permiso para ver este profesor'
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
        title={
          <span className="flex items-center gap-3">
            <Avatar className="size-11">
              {profesor.fotoUrl && <AvatarImage src={profesor.fotoUrl} alt="" />}
              <AvatarFallback className="bg-cobalto/10 text-cobalto text-sm font-semibold">
                {getInitials(profesor.nombre, profesor.apellido)}
              </AvatarFallback>
            </Avatar>
            {profesor.nombre} {profesor.apellido}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            DNI {profesor.dni} · Matrícula {profesor.matricula}
            <Badge variant={profesor.estado === 'ACTIVO' ? 'confirmado' : 'secondary'}>
              {profesor.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
            </Badge>
          </span>
        }
        actions={
          <Button size="lg" variant="accent" asChild>
            <Link href={`${rutaBase}/${profesor.id}/editar`}>
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
            Datos del profesor
          </TabsTrigger>
          <TabsTrigger value="materias" className="px-4">
            <BookOpen />
            Materias
          </TabsTrigger>
          <TabsTrigger value="horario" className="px-4">
            <CalendarClock />
            Horario de atención
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos">
          <DatosProfesor profesor={profesor} />
        </TabsContent>

        <TabsContent value="materias">
          <Card className="p-0">
            <EmptyState
              icon={Construction}
              title="Función en construcción"
              description="Pronto vas a poder ver y asignar acá las materias del profesor."
            />
          </Card>
        </TabsContent>

        <TabsContent value="horario">
          <Card className="p-0">
            <EmptyState
              icon={Construction}
              title="Próximamente"
              description="Pronto vas a poder ver acá el horario de atención del profesor."
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DatosProfesor({ profesor }: { profesor: ProfesorDetalleType }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion icon={IdCard} titulo="Datos identificatorios">
          <Datos>
            <Dato label="Nombre" valor={profesor.nombre} />
            <Dato label="Apellido" valor={profesor.apellido} />
            <Dato label="DNI" valor={profesor.dni} />
            <Dato label="Título" valor={profesor.titulo} />
            <Dato label="Matrícula" valor={profesor.matricula} />
            <Dato label="Capacidad" valor={`${profesor.capacidad} alumnos por hora`} />
          </Datos>
        </Seccion>

        <Seccion icon={Phone} titulo="Contacto">
          <Datos>
            <Dato label="Teléfono" valor={profesor.telefono} />
            <Dato label="Email" valor={profesor.email} />
          </Datos>
        </Seccion>
      </div>

      <div className="text-muted-foreground space-y-1 text-xs">
        <p>
          Creado por {nombreAuditoria(profesor.createdBy)} · {formatoInstante(profesor.createdAt)}
        </p>
        <p>
          Última modificación por {nombreAuditoria(profesor.updatedBy)} ·{' '}
          {formatoInstante(profesor.updatedAt)}
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
