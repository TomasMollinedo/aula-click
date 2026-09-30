'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'

import { CancelarTurnosDialog } from './CancelarTurnosDialog'

export type AccionCancelarVariosProps = {
  alumnoId: number
  /** Las ocurrencias tildadas en la pestaña "Turnos" (todas cancelables, del mismo alumno). */
  ocurrencias: OcurrenciaDeAlumno[]
  /** Terminó (canceló): quien la muestra limpia la selección. Descartar el diálogo la conserva. */
  onListo: () => void
}

/**
 * "Cancelar seleccionados" de la pestaña "Turnos" de la ficha del alumno. Sin selección no se
 * muestra. Las que se tildan son las `cancelable` de la lista (lo decide la API); si aun así
 * alguna ya no se puede (la pagaron mientras tanto) el diálogo lo dice y no cancela ninguna.
 */
export function AccionCancelarVarios({ ocurrencias, onListo }: AccionCancelarVariosProps) {
  const [abierto, setAbierto] = useState(false)
  if (ocurrencias.length === 0) return null

  return (
    <>
      <Button type="button" variant="cancelado" onClick={() => setAbierto(true)}>
        {ocurrencias.length === 1
          ? 'Cancelar seleccionado'
          : `Cancelar seleccionados (${ocurrencias.length})`}
      </Button>
      <CancelarTurnosDialog
        open={abierto}
        ocurrencias={ocurrencias}
        onCerrar={() => setAbierto(false)}
        onCancelado={onListo}
      />
    </>
  )
}
