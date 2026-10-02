'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Pencil,
  SearchX,
  UserRound,
  Wallet,
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
import type { AlumnoDetalle as AlumnoDetalleType } from '../alumnos.types'
import { useAlumno } from '../hooks/use-alumno'
import { DatosAlumno } from './DatosAlumno'

type AlumnoDetalleProps = {
  /** `alumnoId` tal como llega en la URL. */
  alumnoId: string
  /** URL del listado de alumnos en el segmento del rol (por ejemplo `/mesa/alumnos`). */
  rutaBase: string
  /**
   * Si se muestra "Editar". `PATCH /alumnos/{id}` sigue siendo solo de `MESA_ENTRADAS`: un
   * profesor ve el mismo detalle (datos del tutor y auditoría incluidos), pero sin poder editar.
   * Default `true` (mesa de entradas, que no cambia).
   */
  puedeEditar?: boolean
  /**
   * Contenido de las pestañas "Turnos", "Exámenes" y "Pagos". Las compone `app/` con componentes
   * de otras features (`ocurrencias`, `examenes`, `cuentas`), porque una feature no importa
   * componentes de otra (docs/arquitectura-frontend.md → Quién importa a quién). Una pestaña
   * aparece solo si su prop está: cada rol arma la ficha que le corresponde. "Datos" siempre está.
   */
  renderTurnos?: (alumno: AlumnoDetalleType) => ReactNode
  renderExamenes?: (alumno: AlumnoDetalleType) => ReactNode
  renderPagos?: (alumno: AlumnoDetalleType) => ReactNode
}

const TABS = ['datos', 'turnos', 'examenes', 'pagos'] as const
type Tab = (typeof TABS)[number]

// Página de detalle del alumno, con tabs en la URL (`?tab=datos|turnos|examenes|pagos`, como la del
// profesor). "Editar" abre la edición como modal encima de esta página (slot @modal);
// docs/arquitectura-frontend.md → Modales con URL propia.
export function AlumnoDetalle({
  alumnoId,
  rutaBase,
  puedeEditar = true,
  renderTurnos,
  renderExamenes,
  renderPagos,
}: AlumnoDetalleProps) {
  const id = parsearAlumnoId(alumnoId)
  const { data: alumno, isLoading, isError, error, refetch } = useAlumno(id ?? 0)
  const searchParams = useSearchParams()
  const router = useRouter()
  const rutaDetalle = `${rutaBase}/${alumnoId}`

  // Las pestañas que este rol puede ver; un `?tab=` que no está entre ellas cae en "Datos".
  const disponibles: Record<Tab, boolean> = {
    datos: true,
    turnos: renderTurnos !== undefined,
    examenes: renderExamenes !== undefined,
    pagos: renderPagos !== undefined,
  }
  const tabParam = searchParams.get('tab') as Tab | null
  const tab: Tab =
    tabParam !== null && TABS.includes(tabParam) && disponibles[tabParam] ? tabParam : 'datos'
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
          puedeEditar &&
          tab === 'datos' && (
            <Button size="lg" variant="accent" asChild>
              <Link href={`${rutaBase}/${alumno.id}/editar`}>
                <Pencil />
                Editar
              </Link>
            </Button>
          )
        }
      />

      {/* Una sola pestaña no se envuelve en tabs (ver docs/arquitectura-frontend.md → Modales con URL propia). */}
      {TABS.filter((t) => disponibles[t]).length === 1 ? (
        <DatosAlumno alumno={alumno} />
      ) : (
        <Tabs value={tab} onValueChange={cambiarTab} className="space-y-6">
          {/* Con cuatro tabs, en mobile la barra se desplaza sola en lugar de desbordar la página. */}
          <div className="max-w-full overflow-x-auto">
            <TabsList>
              <TabsTrigger value="datos" className="px-4">
                <UserRound />
                Datos del alumno
              </TabsTrigger>
              {renderTurnos && (
                <TabsTrigger value="turnos" className="px-4">
                  <CalendarClock />
                  Turnos
                </TabsTrigger>
              )}
              {renderExamenes && (
                <TabsTrigger value="examenes" className="px-4">
                  <ClipboardList />
                  Exámenes
                </TabsTrigger>
              )}
              {renderPagos && (
                <TabsTrigger value="pagos" className="px-4">
                  <Wallet />
                  Pagos
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="datos">
            <DatosAlumno alumno={alumno} />
          </TabsContent>
          {renderTurnos && <TabsContent value="turnos">{renderTurnos(alumno)}</TabsContent>}
          {renderExamenes && <TabsContent value="examenes">{renderExamenes(alumno)}</TabsContent>}
          {renderPagos && <TabsContent value="pagos">{renderPagos(alumno)}</TabsContent>}
        </Tabs>
      )}
    </div>
  )
}
