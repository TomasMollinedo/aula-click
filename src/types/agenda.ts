import type { EstadoOcurrencia, PrioridadOcurrencia } from './ocurrencia'

// Filtros de las agendas (T-35). Viven en la URL (`useFiltrosAgenda` de `features/agendas`) y los
// reciben la lista, el calendario semanal y el PDF de la agenda: `features/documentos` no puede
// importar los types de `features/agendas`, así que el tipo compartido está acá.

export type FiltrosAgenda = {
  profesorId: number | null
  estado: EstadoOcurrencia | null
  prioridad: PrioridadOcurrencia | null
}
