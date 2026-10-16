'use client'

import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PaginatedResponse } from '@/types'

import { formatearCantidad, formatearPorcentaje, nombreDeProfesor } from '../formato-tablero'
import type {
  CifrasDeAsistencia,
  DireccionOrden,
  FilaMateriaAsistencia,
  FilaProfesorAsistencia,
  OrdenProfesores,
} from '../tablero.types'
import { TarjetaDeTabla } from './TarjetaDeTabla'

// Las dos tablas de la sección "Asistencia" (HU-39). Sólo dibujan lo que manda la API: las cifras,
// el orden de las filas y qué página se ve los decide el servidor. **Nunca un nombre de alumno:**
// el contrato sólo manda agregados por centro, profesor y materia.
//
// En pantallas chicas la tabla se desplaza dentro de su contenedor (el `overflow-x-auto` de
// `Table`), no la página entera.

/** Las columnas de cifras, iguales en las dos tablas. */
const CIFRAS: {
  campo: Exclude<keyof CifrasDeAsistencia, 'total'>
  titulo: string
  porcentaje?: boolean
  /** Se escribe "12 de 20": la cifra sobre `total`. */
  deTotal?: boolean
}[] = [
  { campo: 'asistenciasRegistradas', titulo: 'Asistencias registradas', deTotal: true },
  { campo: 'porcentajeRegistrado', titulo: '% registradas', porcentaje: true },
  { campo: 'cerradosSinRegistrar', titulo: 'Cerrados por el sistema', deTotal: true },
  { campo: 'porcentajeCerrados', titulo: '% cerrados', porcentaje: true },
  { campo: 'sinRegistrar', titulo: 'Sin registrar', deTotal: true },
  { campo: 'porcentajeSinRegistrar', titulo: '% sin registrar', porcentaje: true },
]

/**
 * Qué es cada estado, bajo el título de las dos tablas: el total son los turnos que ya pasaron, y
 * "sin registrar" es lo que el profesor todavía puede marcar dentro de sus 7 días.
 */
const ACLARACION_PLAZO =
  'Cada cifra es sobre el total de turnos que ya pasaron. «Sin registrar» son los que el profesor todavía puede marcar: tiene 7 días desde la clase; pasado ese plazo el sistema los cierra.'

function celdaDeCifra(
  fila: CifrasDeAsistencia,
  { campo, porcentaje, deTotal }: (typeof CIFRAS)[number],
) {
  if (porcentaje) return formatearPorcentaje(fila[campo])
  if (!deTotal) return formatearCantidad(fila[campo])
  return (
    <>
      <span className="font-medium">{formatearCantidad(fila[campo])}</span>
      <span className="text-muted-foreground"> de {formatearCantidad(fila.total)}</span>
    </>
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
      descripcion={`Asistencias que marcó cada profesor y turnos que dejó sin registrar en el período. ${ACLARACION_PLAZO}`}
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
            <SortableTableHead
              columna="profesor"
              orden={orden}
              direccion={direccion}
              onOrdenar={onOrdenar}
            >
              Profesor
            </SortableTableHead>
            {CIFRAS.map(({ campo, titulo }) => (
              <SortableTableHead
                key={campo}
                numerica
                columna={campo}
                orden={orden}
                direccion={direccion}
                onOrdenar={onOrdenar}
              >
                {titulo}
              </SortableTableHead>
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
              {CIFRAS.map((cifra) => (
                <TableCell key={cifra.campo} className="text-right tabular-nums">
                  {celdaDeCifra(fila, cifra)}
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
      descripcion={`Las mismas cifras agrupadas por materia, con los turnos sin registrar primero. ${ACLARACION_PLAZO}`}
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
              {CIFRAS.map((cifra) => (
                <TableCell key={cifra.campo} className="text-right tabular-nums">
                  {celdaDeCifra(fila, cifra)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TarjetaDeTabla>
  )
}
