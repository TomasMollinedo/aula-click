import Link from 'next/link'
import { Eye } from 'lucide-react'

import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/utils/cn'
import { fechaConDia } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

import { type FilaDeCuenta, claveOcurrencia } from '../a-cobrar'
import { textoOcurrencia } from '../formato-cuentas'
import { hrefFichaAlumno } from '../rutas-cuentas'
import { type Seleccion, estaSeleccionada } from '../seleccion'
import { ImporteDeCuenta } from './ImporteDeCuenta'

type OcurrenciasTablaProps = {
  filas: readonly FilaDeCuenta[]
  /** Nombre accesible de la tabla (el título de su sección). */
  etiqueta: string
  /** Columna "Estado" (`EstadoTurnoBadge` con el `estado` de la API). */
  conEstado?: boolean
  /** Columna "Alumno", con el enlace a su ficha (vista global). */
  conAlumno?: boolean
  /** Con selección: columna de casillas. Sin ella, solo la acción por fila. */
  seleccion?: Seleccion
  onAlternar?: (fila: FilaDeCuenta) => void
  /**
   * "Ver detalle" de la fila: abre el detalle del turno, desde donde se cobra ese turno solo (o se
   * cancela o reprograma). No toca la selección. Recibe el botón, para devolverle el foco al cerrar.
   */
  onVerDetalle: (fila: FilaDeCuenta, boton: HTMLButtonElement) => void
  /**
   * Las filas son de un filtro o una página anterior (`isPlaceholderData`): se atenúan y no se
   * pueden tildar ni abrir hasta que lleguen las actuales.
   */
  enEspera?: boolean
}

/**
 * Los adeudados o los próximos de una cuenta. No calcula nada: fecha, horario, estado e importe
 * son los de la API. Scrollea en horizontal dentro de su contenedor en pantallas angostas.
 *
 * Columnas compactas (`CELDA`: menos margen entre columnas; fecha y horario en una sola), para que
 * el importe destacado y la acción de la fila entren sin scroll en un escritorio.
 */
const CELDA = 'px-3 first:pl-6 last:pr-6'

export function OcurrenciasTabla({
  filas,
  etiqueta,
  conEstado = false,
  conAlumno = false,
  seleccion,
  onAlternar,
  onVerDetalle,
  enEspera = false,
}: OcurrenciasTablaProps) {
  const conCasillas = seleccion !== undefined && onAlternar !== undefined

  return (
    <Table aria-label={etiqueta} className={cn(enEspera && 'opacity-60')} aria-busy={enEspera}>
      <TableHeader>
        <TableRow>
          {conCasillas && (
            <TableHead className={cn(CELDA, 'w-10 pr-0')}>
              <span className="sr-only">Seleccionar</span>
            </TableHead>
          )}
          {conAlumno && <TableHead className={CELDA}>Alumno</TableHead>}
          <TableHead className={CELDA}>Fecha y horario</TableHead>
          <TableHead className={CELDA}>Materia</TableHead>
          <TableHead className={CELDA}>Profesor</TableHead>
          {conEstado && <TableHead className={CELDA}>Estado</TableHead>}
          <TableHead className={cn(CELDA, 'text-right')}>Importe</TableHead>
          <TableHead className={CELDA}>
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((fila) => {
          const turno = textoOcurrencia(fila)
          const accion = conAlumno
            ? `Ver detalle del turno de ${textoOcurrencia(fila, true)}`
            : `Ver detalle del turno del ${turno}`
          const tildada = conCasillas && estaSeleccionada(seleccion, fila)
          return (
            <TableRow key={claveOcurrencia(fila)} data-state={tildada ? 'selected' : undefined}>
              {conCasillas && (
                <TableCell className={cn(CELDA, 'pr-0')}>
                  <Checkbox
                    checked={tildada}
                    onCheckedChange={() => onAlternar(fila)}
                    disabled={enEspera}
                    aria-label={`Seleccionar el turno del ${turno}`}
                  />
                </TableCell>
              )}
              {conAlumno && 'alumno' in fila && (
                <TableCell className={CELDA}>
                  <Link
                    href={hrefFichaAlumno(fila.alumno.id)}
                    className="text-cobalto font-medium whitespace-nowrap underline-offset-4 hover:underline"
                  >
                    {fila.alumno.nombre} {fila.alumno.apellido}
                  </Link>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    DNI {fila.alumno.dni}
                  </p>
                </TableCell>
              )}
              <TableCell className={cn(CELDA, 'whitespace-nowrap')}>
                <p className="first-letter:uppercase">{fechaConDia(fila.fecha)}</p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {rangoHoras(fila.horaInicio, fila.horaFin)}
                </p>
              </TableCell>
              <TableCell className={CELDA}>{fila.materia.nombre}</TableCell>
              <TableCell className={CELDA}>
                {fila.profesor.nombre} {fila.profesor.apellido}
              </TableCell>
              {conEstado && (
                <TableCell className={CELDA}>
                  <EstadoTurnoBadge estado={fila.estado} />
                </TableCell>
              )}
              <TableCell className={cn(CELDA, 'text-right whitespace-nowrap')}>
                <ImporteDeCuenta importe={fila.importe} />
              </TableCell>
              <TableCell className={cn(CELDA, 'text-right')}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => onVerDetalle(fila, e.currentTarget)}
                  disabled={enEspera}
                  aria-label={accion}
                >
                  <Eye />
                  Ver detalle
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
