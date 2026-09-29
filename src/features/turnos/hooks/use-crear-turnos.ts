import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useInvalidarAgendas } from '@/features/agendas/hooks/use-invalidar-agendas'
import { useInvalidarOcurrencias } from '@/features/ocurrencias/hooks/use-invalidar-ocurrencias'
import { useInvalidarHorarioDe } from '@/features/profesores/hooks/use-invalidar-horario'
import type { ApiError } from '@/utils/fetch-json'

import type { TurnoCrear, TurnosAlta } from '../turnos.types'
import { crearTurnos } from '../api/turnos.api'
import { turnosKeys } from '../api/turnos.keys'

/**
 * Alta de turnos (uno por hora y tramo). Al terminar bien invalida todo lo de turnos (la
 * disponibilidad cambió), las agendas y las ocurrencias (hay turnos nuevos) y el horario del
 * profesor, que muestra la ocupación (T-33).
 */
export function useCrearTurnos() {
  const queryClient = useQueryClient()
  const invalidarHorarioDe = useInvalidarHorarioDe()
  const invalidarAgendas = useInvalidarAgendas()
  const invalidarOcurrencias = useInvalidarOcurrencias()

  return useMutation<TurnosAlta, ApiError, TurnoCrear>({
    mutationFn: crearTurnos,
    onSuccess: (alta) => {
      void queryClient.invalidateQueries({ queryKey: turnosKeys.all })
      void invalidarAgendas()
      void invalidarOcurrencias()
      const profesorIds = new Set(alta.turnos.map((turno) => turno.profesor.id))
      for (const profesorId of profesorIds) void invalidarHorarioDe(profesorId)
    },
  })
}
