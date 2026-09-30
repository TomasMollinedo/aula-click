'use client'

import type { ReactNode } from 'react'
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form'
import { CalendarPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CalendarioFecha } from '@/components/ui/calendario-fecha'
import { Field, fieldErrorId } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utils/cn'
import { nombreDiaSemana } from '@/utils/dias-semana'

import {
  MAX_OBSERVACIONES,
  MAX_TEMAS,
  type CampoTurnoForm,
  type TurnoFormValues,
} from '../turnos.schema'
import type { TipoTurno } from '../turnos.types'

const TIPOS: { valor: TipoTurno; titulo: string; ayuda: string }[] = [
  { valor: 'RECURRENTE', titulo: 'Recurrente', ayuda: 'Todas las semanas, desde una fecha' },
  { valor: 'SESION_UNICA', titulo: 'Sesión única', ayuda: 'Una sola fecha' },
]

type TurnoFormProps = {
  /** El formulario vive en la pantalla: lo resetea al elegir un bloque y le marca los 400. */
  form: UseFormReturn<TurnoFormValues>
  /** Día del bloque elegido: la ayuda "Tiene que ser un lunes" y los días que ofrecen los calendarios. */
  diaSemana: number
  /**
   * Próxima ocurrencia del día del bloque (`fecha` del resultado de la API, `YYYY-MM-DD`). Los
   * calendarios solo ofrecen ese día de la semana, de esa fecha en adelante. Es una ayuda para
   * elegir: la API valida igual el día y que no sea pasada.
   */
  fechaMinima: string
  onSubmit: (valores: TurnoFormValues) => void
  isPending: boolean
  /** No hay horas tildadas (o la lista es de otros filtros): no se puede registrar todavía. */
  sinHoras: boolean
  /** Rechazo de la API (alerta) arriba del botón. */
  rechazo?: ReactNode
}

/**
 * Paso 4: tipo, fechas, observaciones y temas a trabajar, con el schema de la feature (solo formato). Que la fecha caiga en
 * el día del bloque, que no sea pasada y que el fin no sea anterior al inicio lo decide la API:
 * sus 400 se marcan en el campo.
 */
export function TurnoForm({
  form,
  diaSemana,
  fechaMinima,
  onSubmit,
  isPending,
  sinHoras,
  rechazo,
}: TurnoFormProps) {
  const { register, handleSubmit, control, getValues, reset } = form
  const errors = form.formState.errors as Partial<Record<CampoTurnoForm, { message?: string }>>
  const [tipo, observaciones, temas] = useWatch({
    control,
    name: ['tipo', 'observaciones', 'temas'],
  })
  const ayudaDia = `Tiene que ser un ${nombreDiaSemana(diaSemana).toLowerCase()}`

  // Cambiar de tipo conserva la fecha (la de la sesión única es la de inicio del recurrente) y el
  // observaciones y los temas, y limpia los errores del tipo anterior.
  const cambiarTipo = (nuevo: TipoTurno) => {
    const valores = getValues()
    if (valores.tipo === nuevo) return
    const fecha = valores.tipo === 'SESION_UNICA' ? valores.fecha : valores.fechaInicio
    const observaciones = valores.observaciones ?? ''
    const temas = valores.temas ?? ''
    reset(
      nuevo === 'SESION_UNICA'
        ? { tipo: nuevo, fecha, observaciones, temas }
        : { tipo: nuevo, fechaInicio: fecha, fechaFin: '', observaciones, temas },
    )
  }

  const campoFecha = (nombre: CampoTurnoForm, label: string, requerido: boolean, ayuda: string) => {
    const id = `turno-${nombre}`
    const error = errors[nombre]?.message
    return (
      <Field
        label={label}
        htmlFor={id}
        required={requerido}
        optional={!requerido}
        error={error}
        className="sm:max-w-xs"
      >
        {/* Solo deja elegir el día del bloque, desde su próxima ocurrencia: así cada fecha que se
            elige refresca la ocupación (§7). La API valida igual el día y que no sea pasada. */}
        <Controller
          control={control}
          name={nombre}
          render={({ field }) => (
            <CalendarioFecha
              id={id}
              ref={field.ref}
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              min={fechaMinima}
              diaSemana={diaSemana}
              placeholder={requerido ? 'Elegí una fecha' : 'Sin fecha de fin'}
              textoVaciar={requerido ? undefined : 'Sin fecha de fin'}
              aria-invalid={!!error}
              aria-describedby={cn(fieldErrorId(id), `${id}-ayuda`)}
            />
          )}
        />
        <p id={`${id}-ayuda`} className="text-muted-foreground text-xs">
          {ayuda}
        </p>
      </Field>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">
          Tipo de turno{' '}
          <span aria-hidden className="text-muted-foreground font-normal">
            *
          </span>
        </legend>
        <div className="grid gap-3 sm:max-w-lg sm:grid-cols-2">
          {TIPOS.map((opcion) => (
            <label
              key={opcion.valor}
              className={cn(
                'has-focus-visible:ring-ring flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-focus-visible:ring-2',
                tipo === opcion.valor ? 'border-cobalto bg-cobalto/5' : 'border-border',
              )}
            >
              <input
                type="radio"
                name="turno-tipo"
                value={opcion.valor}
                checked={tipo === opcion.valor}
                onChange={() => cambiarTipo(opcion.valor)}
                className="accent-cobalto mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{opcion.titulo}</span>
                <span className="text-muted-foreground block text-xs">{opcion.ayuda}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {tipo === 'SESION_UNICA' ? (
        campoFecha('fecha', 'Fecha', true, ayudaDia)
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {campoFecha('fechaInicio', 'Fecha de inicio', true, ayudaDia)}
          {campoFecha(
            'fechaFin',
            'Fecha de fin',
            false,
            `${ayudaDia}. Sin fecha de fin, el turno se repite todas las semanas`,
          )}
        </div>
      )}

      <Field
        label="Temas a trabajar"
        htmlFor="turno-temas"
        required={tipo === 'SESION_UNICA'}
        optional={tipo !== 'SESION_UNICA'}
        error={errors.temas?.message}
      >
        <Textarea
          id="turno-temas"
          rows={3}
          maxLength={MAX_TEMAS}
          placeholder="Por ejemplo: funciones cuadráticas y ecuaciones"
          aria-invalid={!!errors.temas}
          aria-describedby={cn(fieldErrorId('turno-temas'), 'turno-temas-contador')}
          {...register('temas')}
        />
        <p id="turno-temas-contador" className="text-muted-foreground text-right text-xs">
          {(temas ?? '').length} / {MAX_TEMAS}
        </p>
      </Field>

      <Field
        label="Observaciones"
        htmlFor="turno-observaciones"
        optional
        error={errors.observaciones?.message}
      >
        <Textarea
          id="turno-observaciones"
          rows={3}
          maxLength={MAX_OBSERVACIONES}
          placeholder="Por ejemplo: viene con el parcial del viernes"
          aria-invalid={!!errors.observaciones}
          aria-describedby={cn(fieldErrorId('turno-observaciones'), 'turno-observaciones-contador')}
          {...register('observaciones')}
        />
        <p id="turno-observaciones-contador" className="text-muted-foreground text-right text-xs">
          {(observaciones ?? '').length} / {MAX_OBSERVACIONES}
        </p>
      </Field>

      {rechazo}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {sinHoras && (
          <p className="text-destructive text-sm">Tildá al menos una hora para registrar.</p>
        )}
        <Button type="submit" size="lg" variant="confirmado" disabled={isPending || sinHoras}>
          <CalendarPlus />
          {isPending ? 'Registrando…' : 'Registrar turno'}
        </Button>
      </div>
    </form>
  )
}
