'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, fieldErrorId } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PanelBody, PanelFooter } from '@/components/ui/panel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAulasDisponibles } from '@/features/aulas/hooks/use-aulas-disponibles'
import { DIAS_SEMANA } from '@/utils/dias-semana'
import type { ApiError } from '@/utils/fetch-json'

import { aplicarErroresApi } from '../errores-api'
import { CAMPOS_BLOQUE, interpretarErrorBloque, MENSAJE_SIN_AULAS } from '../errores-bloques'
import { horaCorta, OPCIONES_HORA_FIN, OPCIONES_HORA_INICIO, unaHoraDespues } from '../horario'
import { bloqueFormSchema, type BloqueFormValues } from '../profesores.schema'

type BloqueFormProps = {
  /** Alta de un rango de horas, o edición de una hora (la de fin se deriva y no se edita). */
  modo: 'crear' | 'editar'
  defaultValues: BloqueFormValues
  /** En la edición, la fila que se edita: no ocupa su propia aula al pedir las disponibles. */
  bloqueId?: number
  onSubmit: (valores: BloqueFormValues) => void
  onCancelar: () => void
  isPending: boolean
  error: ApiError | null
}

// Cuerpo y pie del formulario de un bloque: va dentro de un <Panel> que pone el encabezado. Solo
// valida formato; superposición, aula ocupada y el estado del profesor los decide la API, y sus
// errores se muestran acá (docs/arquitectura-frontend.md → Notificaciones: no en un toast).
export function BloqueForm({
  modo,
  defaultValues,
  bloqueId,
  onSubmit,
  onCancelar,
  isPending,
  error,
}: BloqueFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const {
    control,
    handleSubmit,
    setValue,
    setError: setFieldError,
    formState: { errors, isDirty },
  } = useForm<BloqueFormValues>({
    resolver: zodResolver(bloqueFormSchema),
    defaultValues,
  })

  const [diaSemana, horaInicio, horaFin, aulaId] = useWatch({
    control,
    name: ['diaSemana', 'horaInicio', 'horaFin', 'aulaId'],
  })

  // En la edición cada fila dura una hora: el fin sigue al inicio.
  useEffect(() => {
    if (modo !== 'editar') return
    const fin = unaHoraDespues(horaInicio) ?? ''
    if (fin !== horaFin) setValue('horaFin', fin, { shouldDirty: true })
  }, [modo, horaInicio, horaFin, setValue])

  const aulas = useAulasDisponibles({
    diaSemana: diaSemana ? Number(diaSemana) : undefined,
    horaInicio: horaInicio || undefined,
    horaFin: horaFin || undefined,
    excluirBloqueId: bloqueId,
  })
  // La lista que corresponde al horario elegido (no la anterior, que se sigue viendo mientras carga).
  const aulasDelHorario = aulas.isEnabled && !aulas.isPlaceholderData ? aulas.data : undefined
  const sinAulas = aulasDelHorario?.length === 0

  // Si el aula elegida ya no está libre en el nuevo horario, se limpia el campo.
  useEffect(() => {
    if (!aulasDelHorario || !aulaId) return
    if (!aulasDelHorario.some((aula) => String(aula.id) === aulaId)) {
      setValue('aulaId', '', { shouldDirty: true })
    }
  }, [aulasDelHorario, aulaId, setValue])

  const camposValidos = useMemo(() => new Set(CAMPOS_BLOQUE), [])
  const errorApi = useMemo(
    () => (error ? interpretarErrorBloque(error, camposValidos) : null),
    [error, camposValidos],
  )

  // Errores de la API en los campos (setError) y foco en el primero.
  useEffect(() => {
    if (!error) return
    aplicarErroresApi(error, setFieldError, camposValidos, formRef)
  }, [error, setFieldError, camposValidos])

  // Sin la lista del horario actual (primera carga, o la anterior mostrándose mientras llega la
  // nueva) el selector queda deshabilitado: nunca se ofrece un aula de otro horario.
  const textoAula = !aulas.isEnabled
    ? 'Elegí el día y el horario para ver las aulas libres'
    : !aulasDelHorario && !aulas.isError
      ? 'Buscando aulas libres…'
      : 'Seleccionar aula'

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(onSubmit)}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
    >
      <PanelBody className="space-y-6">
        {errorApi?.mensaje && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">
              <p>{errorApi.mensaje}</p>
              {errorApi.lineas.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {errorApi.lineas.map((linea) => (
                    <li key={linea}>{linea}</li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-3">
          <CampoSelect
            name="diaSemana"
            label="Día"
            placeholder="Seleccionar día"
            control={control}
            error={errors.diaSemana?.message}
            opciones={DIAS_SEMANA.map((d) => ({ valor: String(d.dia), texto: d.nombre }))}
          />
          <CampoSelect
            name="horaInicio"
            label="Hora de inicio"
            placeholder="Seleccionar hora"
            control={control}
            error={errors.horaInicio?.message}
            opciones={OPCIONES_HORA_INICIO.map((h) => ({ valor: h, texto: horaCorta(h) }))}
          />
          {modo === 'crear' ? (
            <CampoSelect
              name="horaFin"
              label="Hora de fin"
              placeholder="Seleccionar hora"
              control={control}
              error={errors.horaFin?.message}
              opciones={OPCIONES_HORA_FIN.map((h) => ({ valor: h, texto: horaCorta(h) }))}
            />
          ) : (
            <Field label="Hora de fin" htmlFor="bloque-horaFin" error={errors.horaFin?.message}>
              <Input
                id="bloque-horaFin"
                name="horaFin"
                value={horaFin ? horaCorta(horaFin) : ''}
                readOnly
                disabled
                aria-describedby="bloque-horaFin-ayuda"
              />
              <p id="bloque-horaFin-ayuda" className="text-muted-foreground text-xs">
                Cada hora del horario dura una hora
              </p>
            </Field>
          )}
        </div>

        <CampoSelect
          name="aulaId"
          label="Aula"
          placeholder={textoAula}
          control={control}
          error={errors.aulaId?.message}
          disabled={!aulasDelHorario || sinAulas}
          opciones={(aulasDelHorario ?? []).map((aula) => ({
            valor: String(aula.id),
            texto: `${aula.nombre} · capacidad ${aula.capacidad}`,
          }))}
        />

        {sinAulas && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">{MENSAJE_SIN_AULAS}</AlertDescription>
          </Alert>
        )}
        {aulas.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
              {aulas.error.status === 403
                ? 'No tenés permiso para ver las aulas'
                : `No se pudieron cargar las aulas: ${aulas.error.message}`}
              {aulas.error.status !== 403 && (
                <Button type="button" variant="outline" size="sm" onClick={() => aulas.refetch()}>
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </PanelBody>

      <PanelFooter>
        <Button type="button" variant="cancelado" size="lg" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="confirmado"
          size="lg"
          disabled={
            isPending ||
            sinAulas ||
            // Mientras llega la lista del horario nuevo, el aula elegida puede no seguir libre.
            (aulas.isEnabled && !aulasDelHorario && !aulas.isError) ||
            (modo === 'editar' && !isDirty)
          }
        >
          {isPending ? 'Guardando…' : 'Guardar bloque'}
        </Button>
      </PanelFooter>
    </form>
  )
}

type CampoSelectProps = {
  name: keyof BloqueFormValues
  label: string
  placeholder: string
  control: ReturnType<typeof useForm<BloqueFormValues>>['control']
  error?: string
  disabled?: boolean
  opciones: { valor: string; texto: string }[]
}

function CampoSelect({
  name,
  label,
  placeholder,
  control,
  error,
  disabled,
  opciones,
}: CampoSelectProps) {
  const id = `bloque-${name}`
  return (
    <Field label={label} htmlFor={id} required error={error}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
            <SelectTrigger
              id={id}
              name={name}
              className="w-full"
              aria-invalid={!!error}
              aria-describedby={error ? fieldErrorId(id) : undefined}
              onBlur={field.onBlur}
              ref={field.ref}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {opciones.map((opcion) => (
                <SelectItem key={opcion.valor} value={opcion.valor}>
                  {opcion.texto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  )
}
