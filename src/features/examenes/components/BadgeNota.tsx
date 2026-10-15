import { Badge } from '@/components/ui/badge'

import type { ResultadoExamen } from '../examenes.types'
import { type TramoNota, textoNota, tramoNota } from '../formato-examenes'

/** Color de cada tramo de la nota (`tramoNota`): verde, ámbar y bordó, de la paleta de la app. */
const VARIANTE_TRAMO: Record<TramoNota, 'confirmado' | 'urgente' | 'cancelado'> = {
  alta: 'confirmado',
  media: 'urgente',
  baja: 'cancelado',
}

/**
 * La nota de un examen (HU-34): "Nota 7,5" con el color de su tramo (`tramoNota`), "Ausente" en
 * gris (no rindió: ni buena ni mala) o "Sin nota". El texto sale de `textoNota`. Lo usan la pestaña
 * "Exámenes" de la ficha y "Mis exámenes" del portal: recibe sólo `resultado` y `nota`, que traen
 * las dos respuestas.
 */
export function BadgeNota({
  resultado,
  nota,
}: {
  resultado: ResultadoExamen | null
  nota: number | null
}) {
  const texto = textoNota({ resultado, nota })
  if (resultado === 'CON_NOTA' && nota !== null) {
    return <Badge variant={VARIANTE_TRAMO[tramoNota(nota)]}>Nota {texto}</Badge>
  }
  if (resultado === 'AUSENTE') return <Badge variant="secondary">{texto}</Badge>
  return <Badge variant="outline">{texto}</Badge>
}
