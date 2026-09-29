import { MateriasPantalla } from '@/features/materias/components/MateriasPantalla'

// El gerente administra el catálogo (HU-12). Su menú no tiene "Profesores": sin `rutaProfesores`,
// el detalle lista los profesores sin enlace.
export default function MateriasPage() {
  return <MateriasPantalla rutaBase="/gerente/materias" puedeEscribir />
}
