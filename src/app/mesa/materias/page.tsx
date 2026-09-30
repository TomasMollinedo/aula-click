import { MateriasPantalla } from '@/features/materias/components/MateriasPantalla'

// Mesa de entradas ve el catálogo en solo lectura (HU-12): listado, búsqueda y detalle con precio
// y profesores. El alta, la edición, la baja y la reactivación son del gerente (/gerente/materias),
// por eso este segmento no tiene la ruta `nueva` ni el slot @modal.
export default function MateriasPage() {
  return <MateriasPantalla rutaBase="/mesa/materias" rutaProfesores="/mesa/profesores" />
}
