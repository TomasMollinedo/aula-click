import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Acción principal del encabezado de las pantallas de profesores. Navegando desde el listado
// abre el alta como modal (slot @modal).
export function BotonNuevoProfesor({
  rutaBase,
}: {
  /** URL del listado de profesores en el segmento del rol (por ejemplo `/mesa/profesores`). */
  rutaBase: string
}) {
  return (
    <Button size="lg" asChild>
      <Link href={`${rutaBase}/nuevo`}>
        <Plus />
        Nuevo profesor
      </Link>
    </Button>
  )
}
