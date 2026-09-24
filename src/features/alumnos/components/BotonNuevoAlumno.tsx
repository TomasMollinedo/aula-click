import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Acción principal del encabezado de las pantallas de alumnos. Navegando desde el listado
// abre el alta como modal (slot @modal).
export function BotonNuevoAlumno({
  rutaBase,
}: {
  /** URL del listado de alumnos en el segmento del rol (por ejemplo `/mesa/alumnos`). */
  rutaBase: string
}) {
  return (
    <Button size="lg" asChild>
      <Link href={`${rutaBase}/nuevo`}>
        <Plus />
        Nuevo alumno
      </Link>
    </Button>
  )
}
