import { AlertCircle, ExternalLink } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import type { TurnoRechazado } from '../errores-pagos'
import { hrefComprobante } from '../rutas-pagos'

/**
 * Los turnos que la API no dejó cobrar (409 `TURNOS_NO_COBRABLES` o 400 de otro alumno), una línea
 * por turno con el `message` de la API. Uno ya pagado enlaza a su comprobante, en otra pestaña.
 */
export function TurnosRechazados({
  mensaje,
  turnos,
}: {
  mensaje: string
  turnos: TurnoRechazado[]
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle className="line-clamp-none">{mensaje}</AlertTitle>
      <AlertDescription className="text-destructive">
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {turnos.map((turno) => (
            <li key={`${turno.turnoId}|${turno.fecha}`}>
              {turno.linea}
              {turno.pagoId !== null && (
                <>
                  {' '}
                  <a
                    href={hrefComprobante(turno.pagoId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cobalto inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                  >
                    Ver comprobante
                    <ExternalLink className="size-3" aria-hidden />
                    <span className="sr-only">(se abre en otra pestaña)</span>
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
