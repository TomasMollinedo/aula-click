'use client'

import { AlertCircle, AlertTriangle, CalendarSearch, Info } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dato, Datos } from '@/components/ui/datos'
import { nombreDiaSemana } from '@/utils/dias-semana'
import { formatearPesos } from '@/utils/moneda'

import type { ErrorAltaTurno } from '../errores-turnos'
import type { BloqueOfertado, MiTurnoCrear } from '../mis-turnos.types'
import { textoFechasPortal, textoHorasElegidas } from '../sacar-turno'

// Resumen antes de confirmar (HU-29) y los rechazos del alta que se resuelven desde ahí.

type ResumenTurnoProps = {
  materia: string
  bloque: BloqueOfertado
  /** Las horas elegidas del bloque. */
  bloqueIds: number[]
  pedido: Pick<MiTurnoCrear, 'tipo' | 'fechaInicio' | 'fechaFin' | 'temas'>
}

/**
 * Materia, profesor, aula, día y horario, fechas y valor por clase (`valorPorClase` de la API, el
 * precio por hora de la materia), con la aclaración de que las clases se abonan en la mesa.
 */
export function ResumenTurno({ materia, bloque, bloqueIds, pedido }: ResumenTurnoProps) {
  const horas = bloque.horas.filter((hora) => bloqueIds.includes(hora.bloqueId))
  return (
    <section
      aria-labelledby="resumen-turno"
      className="border-border space-y-4 rounded-lg border p-4"
    >
      <h3 id="resumen-turno" className="text-sm font-semibold">
        Revisá tu turno
      </h3>
      <Datos>
        <Dato label="Materia" valor={materia} />
        <Dato label="Profesor" valor={`${bloque.profesor.nombre} ${bloque.profesor.apellido}`} />
        <Dato label="Aula" valor={bloque.aula.nombre} />
        <Dato
          label="Día y horario"
          valor={`${nombreDiaSemana(bloque.diaSemana)} ${textoHorasElegidas(horas)}`}
        />
        <Dato label="Fechas" valor={textoFechasPortal(pedido)} />
        <Dato
          label="Valor por clase"
          valor={bloque.valorPorClase === null ? null : formatearPesos(bloque.valorPorClase)}
        />
        {pedido.temas && (
          <Dato
            label="Qué querés trabajar"
            valor={<span className="whitespace-pre-line">{pedido.temas}</span>}
            className="sm:col-span-2"
          />
        )}
      </Datos>
      <p className="bg-canvas flex items-start gap-2 rounded-lg p-3 text-sm">
        <Info className="text-cobalto mt-0.5 size-4 shrink-0" aria-hidden />
        Las clases se abonan en la mesa de entrada.
      </p>
    </section>
  )
}

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

/** Los rechazos que se muestran en el resumen (los de campo vuelven a su paso). */
export type RechazoResumen = Extract<
  ErrorAltaTurno,
  { tipo: 'fechasLlenas' | 'sinLugar' | 'alumnoSuperpuesto' | 'general' }
>

type AlertaRechazoPortalProps = {
  rechazo: RechazoResumen
  isPending: boolean
  /** Reenvía el mismo pedido con `asignarDondeHayLugar: true` (sólo `fechasLlenas`). */
  onReservarConLugar: () => void
  /** Vuelve al paso del horario, con la disponibilidad actualizada. */
  onElegirOtroHorario: () => void
}

/**
 * - `fechasLlenas` (todas las semanas, algunas fechas completas): las fechas, "Reservar sólo las
 *   fechas con lugar" o "Elegir otro horario".
 * - `sinLugar` (alguna hora completa en todas las fechas, o la fecha de una sola clase completa) y
 *   `alumnoSuperpuesto` ("Ya tenés un turno ese día en ese horario"): no se puede continuar con ese
 *   horario; sólo "Elegir otro horario".
 * - `general`: el mensaje de la API.
 *
 * Las líneas de cada fecha y el mensaje de la superposición vienen de la API; el título de las
 * fechas completas es de la pantalla (el `message` general de `BLOQUE_LLENO` es el de la mesa).
 */
export function AlertaRechazoPortal({
  rechazo,
  isPending,
  onReservarConLugar,
  onElegirOtroHorario,
}: AlertaRechazoPortalProps) {
  const elegirOtro = (
    <Button
      type="button"
      variant="outline"
      onClick={onElegirOtroHorario}
      disabled={isPending}
      className="h-auto min-h-9 w-full whitespace-normal sm:w-auto"
    >
      <CalendarSearch />
      Elegir otro horario
    </Button>
  )

  if (rechazo.tipo === 'general') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription className="text-destructive">{rechazo.mensaje}</AlertDescription>
      </Alert>
    )
  }

  if (rechazo.tipo === 'fechasLlenas') {
    return (
      <Alert>
        <AlertTriangle className="text-urgente size-4" />
        <AlertTitle className="line-clamp-none">Algunas fechas están completas</AlertTitle>
        <AlertDescription className="text-foreground space-y-3">
          <Lineas lineas={rechazo.lineas} />
          <p className="text-muted-foreground">
            Podés reservar sólo las fechas que tienen lugar o elegir otro horario.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="confirmado"
              onClick={onReservarConLugar}
              disabled={isPending}
              className="h-auto min-h-9 w-full whitespace-normal sm:w-auto"
            >
              {isPending ? 'Reservando…' : 'Reservar sólo las fechas con lugar'}
            </Button>
            {elegirOtro}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle className="line-clamp-none">
        {rechazo.tipo === 'sinLugar' ? 'Ese horario está completo' : rechazo.mensaje}
      </AlertTitle>
      <AlertDescription className="text-destructive space-y-3">
        <Lineas lineas={rechazo.lineas} />
        {elegirOtro}
      </AlertDescription>
    </Alert>
  )
}
