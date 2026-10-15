'use client'

import type { ReactNode } from 'react'
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form'
import { CalendarCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CalendarioFecha } from '@/components/ui/calendario-fecha'
import { Field, fieldErrorId } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utils/cn'
import { nombreDiaSemana } from '@/utils/dias-semana'

import { type CampoSacarTurno, type SacarTurnoFormValues, TIPO_TURNO_PORTAL } from '../sacar-turno'
import { MAX_TEMAS } from '../turnos.schema'
import type { TipoTurno } from '../turnos.types'

// Paso 3 de "Sacar turno" en el portal: tipo, fechas y "¿Qué querés trabajar en la clase?", con el
// resumen y el botón de confirmar. Es el `TurnoForm` de la mesa sin las observaciones (son internas
// de la mesa, contrato-api.md → Portal del alumno) y con los textos que ve el alumno. Sólo valida
// formato: que la fecha sea desde mañana, que caiga en el día del horario y que el fin no sea
// anterior al inicio lo decide la API, y sus 400 se marcan en el campo.

const TIPOS = ['SESION_UNICA', 'RECURRENTE'] as const

type MiTurnoFormProps = {
  /** El formulario vive en la pantalla: lo resetea al elegir un horario y le marca los 400. */
  form: UseFormReturn<SacarTurnoFormValues>
  /** Día del horario elegido: la ayuda y los días que ofrecen los calendarios. */
  diaSemana: number
  /**
   * Primera fecha elegible: la que devolvió la API para ese horario (la próxima, desde mañana). Es
   * una ayuda para elegir: la API valida igual el día y que sea desde mañana.
   */
  fechaMinima: string
  onSubmit: (valores: SacarTurnoFormValues) => void
  isPending: boolean
  /** No hay horas tildadas: todavía no se puede confirmar. */
  sinHoras: boolean
  /** El resumen del turno, arriba del botón (HU-29). */
  resumen?: ReactNode
  /** Rechazo de la API (alerta) arriba del botón. */
  rechazo?: ReactNode
}

/** Tipo, fechas y temas, con el resumen y "Confirmar turno". */
export function MiTurnoForm({
  form,
  diaSemana,
  fechaMinima,
  onSubmit,
  isPending,
  sinHoras,
  resumen,
  rechazo,
}: MiTurnoFormProps) {
  const { control, getValues, handleSubmit, register, reset } = form
  const errors = form.formState.errors as Partial<Record<CampoSacarTurno, { message?: string }>>
  const [tipo, temas] = useWatch({ control, name: ['tipo', 'temas'] })
  const ayudaDia = `Las clases de este horario son los ${nombreDiaSemana(diaSemana).toLowerCase()}`

  // Cambiar de tipo conserva la fecha (la de una sola clase es la de inicio del semanal) y los
  // temas, y limpia los errores del tipo anterior.
  const cambiarTipo = (nuevo: TipoTurno) => {
    const valores = getValues()
    if (valores.tipo === nuevo) return
    const fecha = valores.tipo === 'SESION_UNICA' ? valores.fecha : valores.fechaInicio
    const temas = valores.temas ?? ''
    reset(
      nuevo === 'SESION_UNICA'
        ? { tipo: nuevo, fecha, temas }
        : { tipo: nuevo, fechaInicio: fecha, fechaFin: '', temas },
    )
  }

  const campoFecha = (
    nombre: CampoSacarTurno,
    label: string,
    requerido: boolean,
    ayuda: string,
  ) => {
    const id = `sacar-turno-${nombre}`
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
          ¿Una sola clase o todas las semanas?{' '}
          <span aria-hidden className="text-muted-foreground font-normal">
            *
          </span>
        </legend>
        <div className="grid gap-3 sm:max-w-lg sm:grid-cols-2">
          {TIPOS.map((valor) => (
            <label
              key={valor}
              className={cn(
                'has-focus-visible:ring-ring flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-focus-visible:ring-2',
                tipo === valor ? 'border-cobalto bg-cobalto/5' : 'border-border',
              )}
            >
              <input
                type="radio"
                name="mi-turno-tipo"
                value={valor}
                checked={tipo === valor}
                onChange={() => cambiarTipo(valor)}
                className="accent-cobalto mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{TIPO_TURNO_PORTAL[valor].titulo}</span>
                <span className="text-muted-foreground block text-xs">
                  {TIPO_TURNO_PORTAL[valor].ayuda}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {tipo === 'SESION_UNICA' ? (
        campoFecha('fecha', 'Fecha de la clase', true, ayudaDia)
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {campoFecha('fechaInicio', 'Desde', true, ayudaDia)}
          {campoFecha('fechaFin', 'Hasta', false, 'Sin fecha de fin, sigue todas las semanas')}
        </div>
      )}

      <Field
        label="¿Qué querés trabajar en la clase?"
        htmlFor="sacar-turno-temas"
        required={tipo === 'SESION_UNICA'}
        optional={tipo !== 'SESION_UNICA'}
        error={errors.temas?.message}
      >
        <Textarea
          id="sacar-turno-temas"
          rows={3}
          maxLength={MAX_TEMAS}
          placeholder="Por ejemplo: funciones cuadráticas para el parcial"
          aria-invalid={!!errors.temas}
          aria-describedby={cn(fieldErrorId('sacar-turno-temas'), 'sacar-turno-temas-contador')}
          {...register('temas')}
        />
        <p id="sacar-turno-temas-contador" className="text-muted-foreground text-right text-xs">
          {(temas ?? '').length} / {MAX_TEMAS}
        </p>
      </Field>

      {resumen}
      {rechazo}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        {sinHoras && (
          <p className="text-destructive text-sm">Elegí al menos una hora para reservar.</p>
        )}
        <Button
          type="submit"
          size="lg"
          variant="confirmado"
          disabled={isPending || sinHoras}
          className="w-full sm:w-auto"
        >
          <CalendarCheck />
          {isPending ? 'Reservando…' : 'Confirmar turno'}
        </Button>
      </div>
    </form>
  )
}
