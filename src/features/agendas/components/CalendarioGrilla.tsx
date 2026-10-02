'use client'

import { useState } from 'react'

import type { SemanaCalendario } from '../calendario'
import { BloqueClase } from './BloqueClase'
import { GrillaSemanal } from './GrillaSemanal'

type CalendarioGrillaProps = {
  semana: SemanaCalendario
  mostrarProfesor: boolean
  /** Hay una semana en pantalla y se está pidiendo otra (o un filtro nuevo): se atenúa. */
  isFetching: boolean
}

/**
 * La grilla de una semana de una agenda (HU-19): en cada celda se apilan las clases de esa hora
 * (varios profesores pueden coincidir en el centro); expandir una agranda su fila sin mezclar las
 * clases de otras horas. La tabla es `GrillaSemanal`; acá se decide qué clases lleva cada celda y
 * cuáles están expandidas. El lugar de cada clase lo decide la API, no este componente.
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
    <GrillaSemanal
      grilla={semana}
      isFetching={isFetching}
      renderCelda={(clases, dia) =>
        clases.map((clase) => (
          <BloqueClase
            key={clase.clave}
            clase={clase}
            expandida={abiertas.has(clase.clave)}
            onAlternar={() => alternar(clase.clave)}
            mostrarProfesor={mostrarProfesor}
            esPasada={dia.esPasado}
          />
        ))
      }
    />
  )
}
