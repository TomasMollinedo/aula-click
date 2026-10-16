'use client'

import { useId } from 'react'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { BarraFiltros, claseControlFiltro } from '@/components/ui/barra-filtros'
import { CalendarioFecha } from '@/components/ui/calendario-fecha'
import { Field, fieldErrorId } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { CampoFiltroPagos } from '../errores-pagos-realizados'
import type { EstadoPagoRegistrado } from '@/types/pago'

import {
  alumnoDeLosBuscadores,
  ESTADOS_PAGO,
  FORMAS_PAGO,
  type FiltrosPagosRealizados,
} from '../filtros-pagos-realizados'
import { textoFormaPago } from '../formato-pagos'
import type { CodigoFormaPago } from '../pago-detalle.types'
import { FiltroMateriaDePagos } from './FiltroMateriaDePagos'
import { FiltroAlumnoDePagos, FiltroProfesorDePagos } from './FiltroPersonaDePagos'

// Radix Select no admite un valor vacío: "sin filtro" es este valor y se traduce a `null`.
const TODAS = 'TODAS'
const TODOS = 'TODOS'

const NOMBRE_ESTADO: Record<EstadoPagoRegistrado, string> = {
  VIGENTE: 'Vigentes',
  ANULADO: 'Anulados',
}

// Desde `2xl` van todos los filtros y "Limpiar filtros" en una sola fila. Los buscadores (alumno,
// materia y profesor) se reparten lo que sobra y cortan el nombre con "…" (entero en el `title`);
// las fechas y los dos Select tienen el ancho justo de su contenido. En `xl` (1280 px) con el menú
// lateral abierto no entran: los buscadores quedaban en ~60 px. Antes de `2xl`, en filas de 2 a 4.
const COLUMNAS = {
  conAlumno:
    'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-[minmax(0,1fr)_repeat(2,8rem)_repeat(2,minmax(0,1fr))_10rem_7.5rem_auto]',
  sinAlumno:
    'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[repeat(2,8rem)_repeat(2,minmax(0,1fr))_10rem_7.5rem_auto]',
}

type FiltrosPagosRealizadosProps = {
  filtros: FiltrosPagosRealizados
  /** Con el filtro por alumno: la vista global (en la ficha, el alumno ya está elegido). */
  conAlumno: boolean
  /** El alumno de la ficha: con él (o con el del filtro) se acotan profesor y materia (T-170). */
  alumnoIdFicha?: number
  onCambiar: (cambios: Partial<FiltrosPagosRealizados>) => void
  onLimpiar: () => void
  puedeLimpiar: boolean
  /** El 400 de la API por campo (`interpretarErrorPagosRealizados`): hoy, el período en "Hasta". */
  errores?: Partial<Record<CampoFiltroPagos, string>>
  /** El 400 que no se pudo ubicar en un campo. */
  errorGeneral?: string | null
}

/**
 * Los filtros de "Pagos realizados" (HU-36): alumno (solo en la vista global), período por fecha
 * de pago, materia, profesor, forma de pago y estado ("Todos", "Vigentes" o "Anulados"). Con un alumno (el de la ficha o el elegido), materia
 * y profesor solo ofrecen los de sus pagos (decisión T-170). No guarda estado: muestra los de la URL y avisa cada
 * cambio, que se aplica enseguida. Las dos fechas son obligatorias (no se pueden vaciar) y no se
 * validan: un "Hasta" anterior al "Desde" se manda igual y el error de la API sale junto al campo.
 */
export function FiltrosPagosRealizados({
  filtros,
  conAlumno,
  alumnoIdFicha,
  onCambiar,
  onLimpiar,
  puedeLimpiar,
  errores = {},
  errorGeneral,
}: FiltrosPagosRealizadosProps) {
  const id = useId()
  const alumnoId = alumnoDeLosBuscadores(filtros, alumnoIdFicha)
  const ids = {
    alumno: `${id}-alumno`,
    desde: `${id}-desde`,
    hasta: `${id}-hasta`,
    materia: `${id}-materia`,
    profesor: `${id}-profesor`,
    formaPago: `${id}-forma-pago`,
    estado: `${id}-estado`,
  }
  const aria = (campo: CampoFiltroPagos, idCampo: string) =>
    errores[campo]
      ? { 'aria-invalid': true, 'aria-describedby': fieldErrorId(idCampo) }
      : { 'aria-invalid': undefined, 'aria-describedby': undefined }

  return (
    <div className="space-y-3">
      <BarraFiltros
        hayFiltros={puedeLimpiar}
        onLimpiar={onLimpiar}
        limpiarEnFila="2xl"
        className={conAlumno ? COLUMNAS.conAlumno : COLUMNAS.sinAlumno}
      >
        {conAlumno && (
          <Field label="Alumno" htmlFor={ids.alumno} error={errores.alumnoId}>
            <FiltroAlumnoDePagos
              id={ids.alumno}
              value={filtros.alumnoId}
              onChange={(alumnoId) => onCambiar({ alumnoId })}
              {...aria('alumnoId', ids.alumno)}
            />
          </Field>
        )}

        <Field label="Desde" htmlFor={ids.desde} error={errores.desde}>
          <CalendarioFecha
            id={ids.desde}
            compacto
            value={filtros.desde}
            onChange={(desde) => desde && onCambiar({ desde })}
            {...aria('desde', ids.desde)}
          />
        </Field>

        <Field label="Hasta" htmlFor={ids.hasta} error={errores.hasta}>
          <CalendarioFecha
            id={ids.hasta}
            compacto
            value={filtros.hasta}
            onChange={(hasta) => hasta && onCambiar({ hasta })}
            {...aria('hasta', ids.hasta)}
          />
        </Field>

        <Field label="Materia" htmlFor={ids.materia} error={errores.materiaId}>
          <FiltroMateriaDePagos
            id={ids.materia}
            value={filtros.materiaId}
            alumnoId={alumnoId}
            onChange={(materiaId) => onCambiar({ materiaId })}
            {...aria('materiaId', ids.materia)}
          />
        </Field>

        <Field label="Profesor" htmlFor={ids.profesor} error={errores.profesorId}>
          <FiltroProfesorDePagos
            id={ids.profesor}
            value={filtros.profesorId}
            alumnoId={alumnoId}
            onChange={(profesorId) => onCambiar({ profesorId })}
            {...aria('profesorId', ids.profesor)}
          />
        </Field>

        <Field label="Forma de pago" htmlFor={ids.formaPago} error={errores.formaPago}>
          <Select
            value={filtros.formaPago ?? TODAS}
            onValueChange={(valor) =>
              onCambiar({ formaPago: valor === TODAS ? null : (valor as CodigoFormaPago) })
            }
          >
            <SelectTrigger
              id={ids.formaPago}
              className={claseControlFiltro(filtros.formaPago === null)}
              title={filtros.formaPago ? textoFormaPago(filtros.formaPago) : undefined}
              {...aria('formaPago', ids.formaPago)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas</SelectItem>
              {FORMAS_PAGO.map((codigo) => (
                <SelectItem key={codigo} value={codigo}>
                  {textoFormaPago(codigo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Estado" htmlFor={ids.estado} error={errores.estado}>
          <Select
            value={filtros.estado ?? TODOS}
            onValueChange={(valor) =>
              onCambiar({ estado: valor === TODOS ? null : (valor as EstadoPagoRegistrado) })
            }
          >
            <SelectTrigger
              id={ids.estado}
              className={claseControlFiltro(filtros.estado === null)}
              {...aria('estado', ids.estado)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {ESTADOS_PAGO.map((estado) => (
                <SelectItem key={estado} value={estado}>
                  {NOMBRE_ESTADO[estado]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </BarraFiltros>

      {errorGeneral && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">{errorGeneral}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
