'use client'

import type { ReactNode } from 'react'
import { ClipboardList } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationControls } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PaginatedResponse } from '@/types'
import { cn } from '@/utils/cn'

import {
  formatearCantidad,
  formatearPorcentaje,
  nombreDeProfesor,
  textoMostrando,
} from '../formato-tablero'
import type {
  CifrasDeAsistencia,
  DireccionOrden,
  FilaMateriaAsistencia,
  FilaProfesorAsistencia,
  OrdenProfesores,
} from '../tablero.types'
import { EncabezadoOrdenable } from './EncabezadoOrdenable'

// Las dos tablas de la sección "Asistencia" (HU-39). Sólo dibujan lo que manda la API: las cifras,
// el orden de las filas y qué página se ve los decide el servidor. **Nunca un nombre de alumno:**
// el contrato sólo manda agregados por centro, profesor y materia.
//
// En pantallas chicas la tabla se desplaza dentro de su contenedor (el `overflow-x-auto` de
// `Table`), no la página entera.

/** Las columnas de cifras, iguales en las dos tablas. */
const CIFRAS: { campo: keyof CifrasDeAsistencia; titulo: string; porcentaje?: boolean }[] = [
  { campo: 'clasesRealizadas', titulo: 'Clases dadas' },
  { campo: 'ausencias', titulo: 'Ausencias' },
  { campo: 'porcentajeAsistencia', titulo: 'Asistencia', porcentaje: true },
  { campo: 'cerradosSinRegistrar', titulo: 'Cerrados sin registrar' },
  { campo: 'dentroDelPlazo', titulo: 'En plazo' },
  { campo: 'porcentajeSinRegistrar', titulo: '% sin registrar', porcentaje: true },
]

function celdaDeCifra(fila: CifrasDeAsistencia, campo: keyof CifrasDeAsistencia, pct = false) {
  return pct ? formatearPorcentaje(fila[campo]) : formatearCantidad(fila[campo])
}

type TablaProps = {
  titulo: string
  /** Lo que explica qué mide la tabla, debajo del título. */
  descripcion: string
  /** El pie de la tabla y el vacío hablan de profesores o de materias. */
  nombres: { singular: string; plural: string }
  textoVacio: string
  /** Lo que va a la derecha del título (el filtro de la tabla de profesores). */
  acciones?: ReactNode
  page: number
  onPageChange: (page: number) => void
  /** Mientras llega la página nueva se ve la anterior, atenuada. */
  enEspera: boolean
  /** Las filas que llegaron: con 0 y `total` mayor a 0, la página quedó pasada del final. */
  filas: number
  children: ReactNode
}

/** La tarjeta de una tabla: título, su contenido y el pie con el paginador. */
function TarjetaDeTabla({
  titulo,
  descripcion,
  nombres,
  textoVacio,
  acciones,
  page,
  onPageChange,
  enEspera,
  filas,
  meta,
  children,
}: TablaProps & { meta: PaginatedResponse<unknown>['meta'] | null }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b p-6">
        <div className="min-w-0">
          <h3 className="text-sm leading-tight font-semibold">{titulo}</h3>
          <p className="text-muted-foreground mt-1 text-xs">{descripcion}</p>
        </div>
        {acciones}
      </div>

      {meta === null ? (
        <div className="space-y-2 p-6" aria-busy aria-label={`Cargando: ${titulo}`}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : meta.total === 0 ? (
        <EmptyState icon={ClipboardList} title={textoVacio} className="py-12" />
      ) : filas === 0 ? (
        // Página fuera de rango: `useCorregirPagina` ya está volviendo a la última que existe.
        <div className="p-6" aria-busy>
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          <div className={cn('transition-opacity', enEspera && 'pointer-events-none opacity-50')}>
            {children}
          </div>
          <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">{textoMostrando(meta, nombres)}</p>
            <PaginationControls
              page={page}
              totalPages={meta.totalPages}
              onPageChange={onPageChange}
            />
          </div>
        </>
      )}
    </Card>
  )
}

/**
 * La tabla de profesores: se reordena por cualquier columna (lo hace la API) y marca con "No
 * registra asistencia" a los que tienen turnos cerrados sin registrar. El filtro de la tarjeta
 * ("Sólo con turnos sin registrar") afecta **sólo** a esta tabla.
 */
export function TablaProfesoresAsistencia({
  profesores,
  orden,
  direccion,
  onOrdenar,
  filtro,
  page,
  onPageChange,
  enEspera,
}: {
  profesores: PaginatedResponse<FilaProfesorAsistencia> | null
  orden: OrdenProfesores
  direccion: DireccionOrden
  onOrdenar: (columna: OrdenProfesores) => void
  filtro: ReactNode
  page: number
  onPageChange: (page: number) => void
  enEspera: boolean
}) {
  return (
    <TarjetaDeTabla
      titulo="Asistencia por profesor"
      descripcion="Clases dadas, ausencias y turnos sin registrar de cada profesor en el período."
      nombres={{ singular: 'profesor', plural: 'profesores' }}
      textoVacio="No hay profesores con turnos en este período"
      acciones={filtro}
      page={page}
      onPageChange={onPageChange}
      enEspera={enEspera}
      filas={profesores?.data.length ?? 0}
      meta={profesores?.meta ?? null}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <EncabezadoOrdenable
              columna="profesor"
              orden={orden}
              direccion={direccion}
              onOrdenar={onOrdenar}
            >
              Profesor
            </EncabezadoOrdenable>
            {CIFRAS.map(({ campo, titulo }) => (
              <EncabezadoOrdenable
                key={campo}
                numerica
                columna={campo}
                orden={orden}
                direccion={direccion}
                onOrdenar={onOrdenar}
              >
                {titulo}
              </EncabezadoOrdenable>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {profesores?.data.map((fila) => (
            <TableRow key={fila.profesor.id}>
              <TableCell className="font-medium">
                <span className="flex flex-wrap items-center gap-2">
                  {nombreDeProfesor(fila.profesor)}
                  {fila.noRegistraAsistencia && (
                    <Badge variant="estadoSinRegistrar">No registra asistencia</Badge>
                  )}
                </span>
              </TableCell>
              {CIFRAS.map(({ campo, porcentaje }) => (
                <TableCell key={campo} className="text-right tabular-nums">
                  {celdaDeCifra(fila, campo, porcentaje)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TarjetaDeTabla>
  )
}

/** La tabla de materias: las mismas cifras por materia, con el orden fijo de la API. */
export function TablaMateriasAsistencia({
  materias,
  page,
  onPageChange,
  enEspera,
}: {
  materias: PaginatedResponse<FilaMateriaAsistencia> | null
  page: number
  onPageChange: (page: number) => void
  enEspera: boolean
}) {
  return (
    <TarjetaDeTabla
      titulo="Asistencia por materia"
      descripcion="Las mismas cifras agrupadas por materia, con los turnos sin registrar primero."
      nombres={{ singular: 'materia', plural: 'materias' }}
      textoVacio="No hay materias con turnos en este período"
      page={page}
      onPageChange={onPageChange}
      enEspera={enEspera}
      filas={materias?.data.length ?? 0}
      meta={materias?.meta ?? null}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Materia</TableHead>
            {CIFRAS.map(({ campo, titulo }) => (
              <TableHead key={campo} className="text-right">
                {titulo}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {materias?.data.map((fila) => (
            <TableRow key={fila.materia.id}>
              <TableCell className="font-medium">{fila.materia.nombre}</TableCell>
              {CIFRAS.map(({ campo, porcentaje }) => (
                <TableCell key={campo} className="text-right tabular-nums">
                  {celdaDeCifra(fila, campo, porcentaje)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TarjetaDeTabla>
  )
}
