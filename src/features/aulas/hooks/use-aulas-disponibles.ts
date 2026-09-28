import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AulaDisponible, AulasDisponiblesParams } from '../aulas.types'
import { listarAulasDisponibles } from '../api/aulas.api'
import { aulasKeys } from '../api/aulas.keys'

const HORA_EN_PUNTO = /^([01]\d|2[0-3]):00$/

/**
 * Si el horario ya se puede consultar: día ISO de 1 a 7 y dos horas en punto con el fin posterior
 * al inicio (el mismo formato que exige la API). Mientras no, la query no se dispara.
 */
function horarioCompleto({ diaSemana, horaInicio, horaFin }: Partial<AulasDisponiblesParams>) {
  if (diaSemana === undefined || horaInicio === undefined || horaFin === undefined) return false
  return (
    Number.isInteger(diaSemana) &&
    diaSemana >= 1 &&
    diaSemana <= 7 &&
    HORA_EN_PUNTO.test(horaInicio) &&
    HORA_EN_PUNTO.test(horaFin) &&
    // `HH:mm` con dos dígitos: la comparación de textos es la de horas.
    horaFin > horaInicio
  )
}

/**
 * Aulas libres para el día y horario elegidos en un formulario (el de bloques del profesor). Se
 * vuelve a pedir cuando cambian; queda deshabilitada hasta que el horario esté completo.
 */
export function useAulasDisponibles(params: Partial<AulasDisponiblesParams>) {
  return useQuery<AulaDisponible[], ApiError>({
    queryKey: aulasKeys.disponibles(params),
    queryFn: () => listarAulasDisponibles(params as AulasDisponiblesParams),
    enabled: horarioCompleto(params),
    // Al cambiar el horario se sigue viendo la lista anterior hasta que llegue la nueva.
    placeholderData: keepPreviousData,
  })
}
