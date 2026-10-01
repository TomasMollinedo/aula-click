import Link from 'next/link'
import { Banknote } from 'lucide-react'

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
import { textoImporte, textoOcurrencia } from '../formato-cuentas'
import { hrefFichaAlumno } from '../rutas-cuentas'
import { type Seleccion, estaSeleccionada } from '../seleccion'

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
  /** "Registrar pago" de la fila: cobra solo ese turno y no toca la selección. */
  onCobrar: (fila: FilaDeCuenta, boton: HTMLButtonElement) => void
  /** Página anterior mientras llega la nueva (`keepPreviousData`). */
  atenuada?: boolean
}

/**
 * Los adeudados o los próximos de una cuenta. No calcula nada: fecha, horario, estado e importe
 * son los de la API. Scrollea en horizontal dentro de su contenedor en pantallas angostas.
 */
export function OcurrenciasTabla({
  filas,
  etiqueta,
  conEstado = false,
  conAlumno = false,
  seleccion,
  onAlternar,
  onCobrar,
  atenuada = false,
}: OcurrenciasTablaProps) {
  const conCasillas = seleccion !== undefined && onAlternar !== undefined

  return (
    <Table aria-label={etiqueta} className={cn(atenuada && 'opacity-60')} aria-busy={atenuada}>
      <TableHeader>
        <TableRow>
          {conCasillas && (
            <TableHead className="w-10 pr-0">
              <span className="sr-only">Seleccionar</span>
            </TableHead>
          )}
          {conAlumno && <TableHead>Alumno</TableHead>}
          <TableHead>Fecha</TableHead>
          <TableHead>Horario</TableHead>
          <TableHead>Materia</TableHead>
          <TableHead>Profesor</TableHead>
          {conEstado && <TableHead>Estado</TableHead>}
          <TableHead className="text-right">Importe</TableHead>
          <TableHead>
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((fila) => {
          const turno = textoOcurrencia(fila)
          const accion = conAlumno
            ? `Registrar pago del turno de ${textoOcurrencia(fila, true)}`
            : `Registrar pago del turno del ${turno}`
          const tildada = conCasillas && estaSeleccionada(seleccion, fila)
          return (
            <TableRow key={claveOcurrencia(fila)} data-state={tildada ? 'selected' : undefined}>
              {conCasillas && (
                <TableCell className="pr-0">
                  <Checkbox
                    checked={tildada}
                    onCheckedChange={() => onAlternar(fila)}
                    aria-label={`Seleccionar el turno del ${turno}`}
                  />
                </TableCell>
              )}
              {conAlumno && 'alumno' in fila && (
                <TableCell>
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
              <TableCell className="whitespace-nowrap">{fechaConDia(fila.fecha)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {rangoHoras(fila.horaInicio, fila.horaFin)}
              </TableCell>
              <TableCell>{fila.materia.nombre}</TableCell>
              <TableCell className="whitespace-nowrap">
                {fila.profesor.nombre} {fila.profesor.apellido}
              </TableCell>
              {conEstado && (
                <TableCell>
                  <EstadoTurnoBadge estado={fila.estado} />
                </TableCell>
              )}
              <TableCell
                className={cn(
                  'text-right whitespace-nowrap',
                  fila.importe === null ? 'text-muted-foreground' : 'tabular-nums',
                )}
              >
                {textoImporte(fila.importe)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => onCobrar(fila, e.currentTarget)}
                  aria-label={accion}
                >
                  <Banknote />
                  Registrar pago
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
