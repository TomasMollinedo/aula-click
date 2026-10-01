'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'

import { cn } from '@/utils/cn'
import { nombreDiaSemana } from '@/utils/dias-semana'

import { claveDeCelda, etiquetaDeHora, type SemanaCalendario } from '../calendario'
import { BloqueClase } from './BloqueClase'

type CalendarioGrillaProps = {
  semana: SemanaCalendario
  mostrarProfesor: boolean
  /** Hay una semana en pantalla y se está pidiendo otra (o un filtro nuevo): se atenúa. */
  isFetching: boolean
}

// Ancho mínimo de la columna de un día y de la de las horas: debajo de eso la grilla se desplaza
// dentro de su contenedor, en vez de apretar los bloques o ensanchar la página (mobile).
const ANCHO_DIA = '10rem'
const ANCHO_HORAS = '5rem'

/**
 * La grilla de una semana (HU-19): los días con clases en columnas, de lunes a domingo, y las horas
 * en filas, desde la primera hasta la última clase de la semana. Cada celda apila las clases de esa
 * hora (varios profesores pueden coincidir en el centro); expandir una agranda su fila sin mezclar
 * las clases de otras horas. Es una tabla para que los lectores de pantalla la recorran por día y
 * hora y para que las filas crezcan con su contenido. El lugar de cada clase lo decide la API, no
 * este componente.
 */
export function CalendarioGrilla({ semana, mostrarProfesor, isFetching }: CalendarioGrillaProps) {
  const [abiertas, setAbiertas] = useState<ReadonlySet<string>>(new Set())

  function alternar(clave: string) {
    setAbiertas((actuales) => {
      const nuevas = new Set(actuales)
      if (!nuevas.delete(clave)) nuevas.add(clave)
      return nuevas
    })
  }

  return (
    <div className="overflow-x-auto">
      <table
        aria-label="Calendario semanal"
        aria-busy={isFetching}
        className={cn(
          'w-full border-separate border-spacing-0 transition-opacity',
          isFetching && 'opacity-60',
        )}
        style={{ minWidth: `calc(${ANCHO_HORAS} + ${semana.dias.length} * ${ANCHO_DIA})` }}
      >
        <thead>
          <tr>
            <th
              scope="col"
              className="bg-canvas border-border sticky left-0 z-20 border-b"
              style={{ minWidth: ANCHO_HORAS, width: ANCHO_HORAS }}
            >
              <span className="sr-only">Hora</span>
            </th>
            {semana.dias.map((dia) => (
              <th
                key={dia.fecha}
                scope="col"
                aria-current={dia.esHoy ? 'date' : undefined}
                className={cn(
                  'border-border border-b border-l px-2 py-3 text-center font-normal',
                  dia.esHoy && 'bg-primary/5',
                )}
                style={{ minWidth: ANCHO_DIA }}
              >
                <span
                  className={cn(
                    'block text-xs font-medium tracking-wide uppercase',
                    dia.esHoy ? 'text-primary' : 'text-muted-foreground',
                    dia.esPasado && 'opacity-60',
                  )}
                >
                  {nombreDiaSemana(dia.diaSemana)}
                </span>
                <span
                  className={cn(
                    'mx-auto mt-1 flex size-9 items-center justify-center rounded-full text-lg font-semibold',
                    dia.esHoy && 'bg-primary text-primary-foreground',
                    dia.esPasado && 'text-muted-foreground',
                  )}
                >
                  {format(parseISO(dia.fecha), 'd')}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semana.horas.map((hora) => (
            <tr key={hora}>
              <th
                scope="row"
                className="bg-canvas border-border text-foreground sticky left-0 z-10 border-t border-r px-3 py-2 text-right align-top text-base font-bold tabular-nums"
              >
                {etiquetaDeHora(hora)}
              </th>
              {semana.dias.map((dia) => {
                const clases = semana.celdas.get(claveDeCelda(dia.fecha, hora)) ?? []
                return (
                  <td
                    key={dia.fecha}
                    className={cn(
                      'border-border h-16 border-t border-l p-1.5 align-top',
                      dia.esHoy && 'bg-primary/5',
                    )}
                  >
                    {clases.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {clases.map((clase) => (
                          <BloqueClase
                            key={clase.clave}
                            clase={clase}
                            expandida={abiertas.has(clase.clave)}
                            onAlternar={() => alternar(clase.clave)}
                            mostrarProfesor={mostrarProfesor}
                            esPasada={dia.esPasado}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
