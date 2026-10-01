import type {
  AgendaListadoParams,
  CalendarioParams,
  AgendaProfesorParams,
  AgendaPropiaParams,
} from '../agendas.types'

// Todo cuelga de `all`: una mutación de turnos (alta, cancelación, pago…) invalida `all` con
// `useInvalidarAgendas` y alcanza a la lista y al calendario de las tres agendas.
export const agendasKeys = {
  all: ['agendas'] as const,
  diarias: () => [...agendasKeys.all, 'diaria'] as const,
  diaria: (params: AgendaListadoParams) => [...agendasKeys.diarias(), params] as const,
  propias: () => [...agendasKeys.all, 'propia'] as const,
  propia: (params: AgendaPropiaParams) => [...agendasKeys.propias(), params] as const,
  profesores: () => [...agendasKeys.all, 'profesor'] as const,
  profesor: (params: AgendaProfesorParams) => [...agendasKeys.profesores(), params] as const,
  calendarios: () => [...agendasKeys.all, 'calendario'] as const,
  calendario: (params: CalendarioParams) => [...agendasKeys.calendarios(), params] as const,
}
