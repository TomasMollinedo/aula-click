'use client'

import Link from 'next/link'
import { AlertCircle, CalendarSearch, Wallet } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import type { ErrorAltaTurno } from '../errores-turnos'

function Lineas({ lineas }: { lineas: string[] }) {
  if (lineas.length === 0) return null
  return (
    <ul className="list-disc space-y-1 pl-5">
      {lineas.map((linea) => (
        <li key={linea}>{linea}</li>
      ))}
    </ul>
  )
}

type AlertaRechazoProps = {
  /** Los rechazos que se muestran en el formulario (no el diálogo ni los campos). */
  rechazo: Extract<
    ErrorAltaTurno,
    { tipo: 'sinLugar' | 'alumnoSuperpuesto' | 'deudaVencida' | 'general' }
  >
  /** "Buscar otros turnos disponibles" (solo `sinLugar`). */
  onBuscarOtros?: () => void
  /** "Cobrar" (solo `deudaVencida`): la pestaña "Pagos" de la ficha del alumno, que arma `app/`. */
  hrefCobrar?: string
}

/**
 * Alerta arriba del botón "Registrar turno". `sinLugar` ofrece buscar otros turnos;
 * `alumnoSuperpuesto` lista los turnos que chocan y no ofrece forzar (es un rechazo total);
 * `deudaVencida` muestra el mensaje de la API (con la cantidad y el total) y ofrece "Cobrar".
 */
export function AlertaRechazo({ rechazo, onBuscarOtros, hrefCobrar }: AlertaRechazoProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      {rechazo.tipo === 'deudaVencida' ? (
        <AlertDescription className="text-destructive space-y-3">
          <p>{rechazo.mensaje}</p>
          {hrefCobrar && (
            <Button asChild variant="outline" size="sm">
              <Link href={hrefCobrar}>
                <Wallet />
                Cobrar
              </Link>
            </Button>
          )}
        </AlertDescription>
      ) : rechazo.tipo === 'general' ? (
        <AlertDescription className="text-destructive">{rechazo.mensaje}</AlertDescription>
      ) : (
        <>
          <AlertTitle className="line-clamp-none">{rechazo.mensaje}</AlertTitle>
          <AlertDescription className="text-destructive space-y-3">
            <Lineas lineas={rechazo.lineas} />
            {rechazo.tipo === 'sinLugar' && onBuscarOtros && (
              <Button type="button" variant="outline" size="sm" onClick={onBuscarOtros}>
                <CalendarSearch />
                Buscar otros turnos disponibles
              </Button>
            )}
          </AlertDescription>
        </>
      )}
    </Alert>
  )
}

type DialogoFechasLlenasProps = {
  /** `null` cierra el diálogo. */
  rechazo: Extract<ErrorAltaTurno, { tipo: 'fechasLlenas' }> | null
  isPending: boolean
  /** Reenvía el mismo pedido con `asignarDondeHayLugar: true`. */
  onAsignarIgual: () => void
  /** Cierra y vuelve a la búsqueda. */
  onCancelar: () => void
}

/**
 * Un recurrente con fechas llenas (`BLOQUE_LLENO` sin horas `sinLugar`): se muestran las fechas por
 * hora y se ofrece crearlo solo en las fechas con lugar. Qué fechas quedan lo decide la API al
 * reenviar (todo se recalcula).
 */
export function DialogoFechasLlenas({
  rechazo,
  isPending,
  onAsignarIgual,
  onCancelar,
}: DialogoFechasLlenasProps) {
  return (
    <Dialog open={rechazo !== null} onOpenChange={(open) => !open && !isPending && onCancelar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hay fechas sin lugar</DialogTitle>
          <DialogDescription>{rechazo?.mensaje}</DialogDescription>
        </DialogHeader>
        {rechazo && (
          <div className="text-sm">
            <Lineas lineas={rechazo.lineas} />
          </div>
        )}
        <DialogFooter className="items-end">
          <Button variant="outline" onClick={onCancelar} disabled={isPending}>
            Cancelar
          </Button>
          <div className="flex flex-col items-end gap-1">
            <Button variant="confirmado" onClick={onAsignarIgual} disabled={isPending}>
              {isPending ? 'Asignando…' : 'Asignar igual'}
            </Button>
            <span className="text-muted-foreground text-xs">
              Se crea solo en las fechas con lugar
            </span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
