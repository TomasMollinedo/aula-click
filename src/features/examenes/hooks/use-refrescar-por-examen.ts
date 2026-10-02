import { useCallback } from 'react'

import { useInvalidarAgendas } from '@/features/agendas/hooks/use-invalidar-agendas'
import { useInvalidarOcurrencias } from '@/features/ocurrencias/hooks/use-invalidar-ocurrencias'

import { useInvalidarExamenes } from './use-invalidar-examenes'

/**
 * Lo que cambia al cargar, editar o eliminar un examen: los exámenes y, como la prioridad de un
 * turno sale de ellos (HU-18) y no se guarda, las ocurrencias y las agendas que la muestran.
 */
export function useRefrescarPorExamen() {
  const invalidarExamenes = useInvalidarExamenes()
  const invalidarOcurrencias = useInvalidarOcurrencias()
  const invalidarAgendas = useInvalidarAgendas()

  return useCallback(() => {
    void invalidarExamenes()
    void invalidarOcurrencias()
    void invalidarAgendas()
  }, [invalidarExamenes, invalidarOcurrencias, invalidarAgendas])
}
