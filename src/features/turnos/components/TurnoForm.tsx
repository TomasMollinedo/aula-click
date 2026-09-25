'use client'

import type { ReactNode } from 'react'
import { type UseFormReturn, useWatch } from 'react-hook-form'
import { CalendarPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field, fieldErrorId } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utils/cn'
import { nombreDiaSemana } from '@/utils/dias-semana'

import type { CampoTurnoForm, TurnoFormValues } from '../turnos.schema'
import type { TipoTurno } from '../turnos.types'

const MAX_MOTIVO = 500

const TIPOS: { valor: TipoTurno; titulo: string; ayuda: string }[] = [
  { valor: 'RECURRENTE', titulo: 'Recurrente', ayuda: 'Todas las semanas, desde una fecha' },
  { valor: 'SESION_UNICA', titulo: 'Sesión única', ayuda: 'Una sola fecha' },
]

type TurnoFormProps = {
  /** El formulario vive en la pantalla: lo resetea al elegir un bloque y le marca los 400. */
  form: UseFormReturn<TurnoFormValues>
  /** Día del bloque elegido: solo para la ayuda "Tiene que ser un lunes" (no se valida acá). */
  diaSemana: number
  onSubmit: (valores: TurnoFormValues) => void
  isPending: boolean
  /** No hay horas tildadas (o la lista es de otros filtros): no se puede registrar todavía. */
  sinHoras: boolean
  /** Rechazo de la API (alerta) arriba del botón. */
  rechazo?: ReactNode
}

/**
 * Paso 4: tipo, fechas y motivo, con el schema de la feature (solo formato). Que la fecha caiga en
 * el día del bloque, que no sea pasada y que el fin no sea anterior al inicio lo decide la API:
 * sus 400 se marcan en el campo.
 */
export function TurnoForm({
  form,
  diaSemana,
  onSubmit,
  isPending,
  sinHoras,
  rechazo,
}: TurnoFormProps) {
  const { register, handleSubmit, control, getValues, reset } = form
  const errors = form.formState.errors as Partial<Record<CampoTurnoForm, { message?: string }>>
  const [tipo, motivo] = useWatch({ control, name: ['tipo', 'motivoConsulta'] })
  const ayudaDia = `Tiene que ser un ${nombreDiaSemana(diaSemana).toLowerCase()}`

  // Cambiar de tipo conserva la fecha (la de la sesión única es la de inicio del recurrente) y el
  // motivo, y limpia los errores del tipo anterior.
  const cambiarTipo = (nuevo: TipoTurno) => {
    const valores = getValues()
    if (valores.tipo === nuevo) return
    const fecha = valores.tipo === 'SESION_UNICA' ? valores.fecha : valores.fechaInicio
    const motivoConsulta = valores.motivoConsulta ?? ''
    reset(
      nuevo === 'SESION_UNICA'
        ? { tipo: nuevo, fecha, motivoConsulta }
        : { tipo: nuevo, fechaInicio: fecha, fechaFin: '', motivoConsulta },
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
        <Input
          id={id}
          type="date"
          aria-invalid={!!error}
          aria-describedby={cn(fieldErrorId(id), `${id}-ayuda`)}
          {...register(nombre)}
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
        label="Motivo de consulta"
        htmlFor="turno-motivo"
        optional
        error={errors.motivoConsulta?.message}
      >
        <Textarea
          id="turno-motivo"
          rows={3}
          maxLength={MAX_MOTIVO}
          placeholder="Por ejemplo: repaso de funciones para el parcial"
          aria-invalid={!!errors.motivoConsulta}
          aria-describedby={cn(fieldErrorId('turno-motivo'), 'turno-motivo-contador')}
          {...register('motivoConsulta')}
        />
        <p id="turno-motivo-contador" className="text-muted-foreground text-right text-xs">
          {(motivo ?? '').length} / {MAX_MOTIVO}
        </p>
      </Field>

      {rechazo}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {sinHoras && (
          <p className="text-muted-foreground text-sm">Tildá al menos una hora para registrar.</p>
        )}
        <Button type="submit" size="lg" variant="confirmado" disabled={isPending || sinHoras}>
          <CalendarPlus />
          {isPending ? 'Registrando…' : 'Registrar turno'}
        </Button>
      </div>
    </form>
  )
}
