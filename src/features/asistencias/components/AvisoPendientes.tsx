'use client'

import { Clock } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { fechaCortaAsistencia, textoPendientes } from '../formato-asistencias'
import { usePendientesAsistencia } from '../hooks/use-pendientes-asistencia'

/**
 * "Tenés 3 turnos sin registrar de días anteriores…", con la fecha límite que manda la API y un
 * acceso al día del más antiguo. Sin pendientes (o si no se pudo pedir) no muestra nada: no tapa
 * la pantalla.
 */
export function AvisoPendientes({
  fechaActual,
  onIrA,
}: {
  fechaActual: string
  onIrA: (fecha: string) => void
}) {
  const { data } = usePendientesAsistencia()
  const texto = data && textoPendientes(data)
  if (!data?.masAntiguo || !texto) return null
  const { fecha } = data.masAntiguo

  return (
    <Alert className="border-urgente/40 bg-urgente/5">
      <Clock />
      <AlertDescription className="text-foreground flex flex-wrap items-center justify-between gap-3">
        <span>{texto}</span>
        {fecha !== fechaActual && (
          <Button variant="outline" size="sm" onClick={() => onIrA(fecha)}>
            Ir al {fechaCortaAsistencia(fecha)}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
