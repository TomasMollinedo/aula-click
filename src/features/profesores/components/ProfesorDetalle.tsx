'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarClock,
  IdCard,
  Pencil,
  Phone,
  SearchX,
  Trash2,
  Undo2,
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
import { Dato, Datos } from '@/components/ui/datos'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trazabilidad } from '@/components/ui/trazabilidad'
import { getInitials } from '@/utils/initials'

import { parsearProfesorId } from '../profesores.schema'
import type { ProfesorDetalle as ProfesorDetalleType } from '../profesores.types'
import { useProfesor } from '../hooks/use-profesor'
import { rutaAgendaDelSegmento } from '../turnos-vigentes'
import { ConfirmarEstadoProfesor } from './ConfirmarEstadoProfesor'
import { HorarioProfesor } from './HorarioProfesor'
import { MateriasProfesor } from './MateriasProfesor'

type ProfesorDetalleProps = {
  /** `profesorId` tal como llega en la URL. */
  profesorId: string
  /** URL del listado de profesores en el segmento del rol (por ejemplo `/mesa/profesores`). */
  rutaBase: string
}

const TABS = ['datos', 'materias', 'horario'] as const
type Tab = (typeof TABS)[number]

// Página de detalle del profesor, con tabs. "Editar" abre la edición como modal encima de esta
// página (slot @modal); docs/arquitectura-frontend.md → Modales con URL propia. El tab va en la URL
// (`?tab=`), así el formulario de la sección "Horario" (`&bloque=…`) tiene URL propia.
export function ProfesorDetalle({ profesorId, rutaBase }: ProfesorDetalleProps) {
  const id = parsearProfesorId(profesorId)
  const { data: profesor, isLoading, isError, error, refetch } = useProfesor(id ?? 0)
  const searchParams = useSearchParams()
  const router = useRouter()
  const rutaDetalle = `${rutaBase}/${profesorId}`
  const [confirmandoEstado, setConfirmandoEstado] = useState(false)

  const tabParam = searchParams.get('tab')
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'datos'
  // replace: cambiar de tab no suma entradas al historial (Atrás sale del detalle).
  const cambiarTab = (valor: string) =>
    router.replace(valor === 'datos' ? rutaDetalle : `${rutaDetalle}?tab=${valor}`, {
      scroll: false,
    })

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
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'datos' && (
              <>
                <Button size="lg" variant="accent" asChild>
                  <Link href={`${rutaBase}/${profesor.id}/editar`}>
                    <Pencil />
                    Editar datos
                  </Link>
                </Button>
                {profesor.estado === 'ACTIVO' ? (
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={() => setConfirmandoEstado(true)}
                  >
                    <Trash2 />
                    Dar de baja
                  </Button>
                ) : (
                  <Button size="lg" variant="outline" onClick={() => setConfirmandoEstado(true)}>
                    <Undo2 />
                    Reactivar
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={cambiarTab} className="space-y-6">
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
          <MateriasProfesor profesor={profesor} />
        </TabsContent>

        <TabsContent value="horario">
          <HorarioProfesor profesor={profesor} rutaDetalle={rutaDetalle} />
        </TabsContent>
      </Tabs>

      <ConfirmarEstadoProfesor
        profesor={confirmandoEstado ? profesor : null}
        rutaAgenda={rutaAgendaDelSegmento(rutaBase)}
        onCerrar={() => setConfirmandoEstado(false)}
      />
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

      <Trazabilidad auditoria={profesor} />
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
