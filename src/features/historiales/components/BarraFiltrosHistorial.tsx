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
import { SelectBuscable } from '@/components/ui/select-buscable'

import type { CampoFiltro } from '../errores-historiales'
import {
  ETIQUETA_OPCION,
  type FiltrosHistorial,
  type OpcionPeriodo,
  OPCIONES_PERIODO,
  etiquetaMes,
  mesesOfrecidos,
} from '../filtros-historial'
import { nombreProfesor } from '../formato-historiales'
import type { OpcionesDelHistorial } from '../historiales.types'

type BarraFiltrosHistorialProps = {
  filtros: FiltrosHistorial
  /** Hoy, para los meses que ofrece el selector. Lo pasa el hook de los filtros. */
  hoy: string
  /** Materias y profesores del historial completo del alumno, tal como los manda la API. */
  opciones: OpcionesDelHistorial
  onElegirOpcion: (opcion: OpcionPeriodo) => void
  onElegirMes: (mes: string) => void
  onCambiarRango: (cambios: { desde?: string; hasta?: string }) => void
  onCambiar: (cambios: Partial<FiltrosHistorial>) => void
  onLimpiar: () => void
  puedeLimpiar: boolean
  /** El 400 de la API por campo (`interpretarErrorHistorial`): hoy, el período en "Hasta". */
  errores?: Partial<Record<CampoFiltro, string>>
  /** El 400 que no se pudo ubicar en un campo. */
  errorGeneral?: string | null
}

/**
 * Los filtros del historial académico (HU-31): el período (un mes, por defecto el actual, o un
 * rango de fechas) más materia y profesor, con las `opciones` que manda la API. No guarda estado:
 * muestra los de la URL y avisa cada cambio, que se aplica enseguida. **No valida el período**: un
 * "Hasta" anterior al "Desde" se manda igual y el error de la API sale junto al campo.
 *
 * Es una `BarraFiltros`: en pantallas anchas entran todos en una fila con "Limpiar filtros" al
 * final; en las angostas se reparten en columnas y el botón va en una fila propia.
 */
export function BarraFiltrosHistorial({
  filtros,
  hoy,
  opciones,
  onElegirOpcion,
  onElegirMes,
  onCambiarRango,
  onCambiar,
  onLimpiar,
  puedeLimpiar,
  errores = {},
  errorGeneral,
}: BarraFiltrosHistorialProps) {
  const id = useId()
  const ids = {
    opcion: `${id}-periodo`,
    mes: `${id}-mes`,
    desde: `${id}-desde`,
    hasta: `${id}-hasta`,
    materia: `${id}-materia`,
    profesor: `${id}-profesor`,
  }

  const { periodo } = filtros
  const porMes = periodo.opcion === 'mes'
  const materiaElegida = opciones.materias.find((m) => m.id === filtros.materiaId) ?? null
  const profesorElegido = opciones.profesores.find((p) => p.id === filtros.profesorId) ?? null

  // Un campo más con el rango ("Desde" y "Hasta" en lugar del mes): la grilla declara **una columna
  // por campo** más la del botón, así nada se pasa de renglón y "Limpiar filtros" queda en la fila,
  // a la altura de los controles. Con cuatro columnas fijas, el quinto campo caía abajo y el botón
  // con él, desfasado.
  const columnas = porMes
    ? 'sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]'
    : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]'

  return (
    <div className="space-y-3">
      <BarraFiltros
        hayFiltros={puedeLimpiar}
        onLimpiar={onLimpiar}
        limpiarEnFila="xl"
        className={columnas}
      >
        <Field label="Período" htmlFor={ids.opcion}>
          <Select value={periodo.opcion} onValueChange={(v) => onElegirOpcion(v as OpcionPeriodo)}>
            <SelectTrigger id={ids.opcion} className={claseControlFiltro(false)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCIONES_PERIODO.map((opcion) => (
                <SelectItem key={opcion} value={opcion}>
                  {ETIQUETA_OPCION[opcion]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {porMes ? (
          <Field label="Mes" htmlFor={ids.mes}>
            <Select value={periodo.mes} onValueChange={onElegirMes}>
              <SelectTrigger id={ids.mes} className={claseControlFiltro(false)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mesesOfrecidos(hoy, periodo.mes).map((mes) => (
                  <SelectItem key={mes} value={mes} className="capitalize">
                    {etiquetaMes(mes)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <>
            <Field label="Desde" htmlFor={ids.desde} error={errores.desde}>
              <CalendarioFecha
                id={ids.desde}
                compacto
                value={periodo.desde}
                onChange={(fecha) => fecha && onCambiarRango({ desde: fecha })}
                aria-invalid={errores.desde ? true : undefined}
                aria-describedby={errores.desde ? fieldErrorId(ids.desde) : undefined}
              />
            </Field>

            <Field label="Hasta" htmlFor={ids.hasta} error={errores.hasta}>
              <CalendarioFecha
                id={ids.hasta}
                compacto
                value={periodo.hasta}
                onChange={(fecha) => fecha && onCambiarRango({ hasta: fecha })}
                // El historial son las clases de hoy o anteriores: una fecha posterior no agrega
                // nada (la API recorta `hasta` a hoy), así que el calendario no la ofrece. Es una
                // ayuda de la UI: el período lo valida igual la API.
                max={hoy}
                aria-invalid={errores.hasta ? true : undefined}
                aria-describedby={errores.hasta ? fieldErrorId(ids.hasta) : undefined}
              />
            </Field>
          </>
        )}

        <Field label="Materia" htmlFor={ids.materia} error={errores.materiaId}>
          <SelectBuscable
            id={ids.materia}
            opciones={opciones.materias}
            value={materiaElegida}
            onChange={(materia) => onCambiar({ materiaId: materia?.id ?? null })}
            textoTodas="Todas las materias"
            etiquetaBusqueda="Buscar materia"
            textoVacio="No hay materias en el historial"
          />
        </Field>

        <Field label="Profesor" htmlFor={ids.profesor} error={errores.profesorId}>
          <SelectBuscable
            id={ids.profesor}
            opciones={opciones.profesores.map((profesor) => ({
              id: profesor.id,
              nombre: nombreProfesor(profesor),
            }))}
            value={
              profesorElegido && {
                id: profesorElegido.id,
                nombre: nombreProfesor(profesorElegido),
              }
            }
            onChange={(profesor) => onCambiar({ profesorId: profesor?.id ?? null })}
            textoTodas="Todos los profesores"
            etiquetaBusqueda="Buscar profesor"
            textoVacio="No hay profesores en el historial"
          />
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
