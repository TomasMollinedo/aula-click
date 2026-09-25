import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Acción principal del encabezado de las pantallas de materias. Navegando desde el listado abre
// el alta como modal (slot @modal).
export function BotonNuevaMateria({
  rutaBase,
}: {
  /** URL del listado de materias en el segmento del rol (por ejemplo `/mesa/materias`). */
  rutaBase: string
}) {
  return (
    <Button size="lg" asChild>
      <Link href={`${rutaBase}/nueva`}>
        <Plus />
        Nueva materia
      </Link>
    </Button>
  )
}
