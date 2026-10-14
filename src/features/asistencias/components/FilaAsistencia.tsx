'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, UserRound } from 'lucide-react'
import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'

import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { rangoHoras } from '@/utils/horas'

import { type FilaAsistenciaForm, filaAsistenciaSchema } from '../asistencias.schema'
import type { FilaAsistencia as Fila, HoraAsistencia, PlazoAsistencia } from '../asistencias.types'
import { mensajeErrorRegistro } from '../errores-asistencias'
import {
  MAX_OBSERVACION,
  MAX_TEXTO_PRESENTE,
  MENSAJE_REGISTRADA,
  OBSERVACION_CIERRE_SISTEMA,
  fechaCortaAsistencia,
  textoHorarioFila,
} from '../formato-asistencias'
import { useRegistrarAsistencias } from '../hooks/use-registrar-asistencias'
import { registrosDeFila, valoresIniciales } from '../registro-asistencia'
import { SelectorEstadoAsistencia } from './SelectorEstadoAsistencia'
import { TextoConContador } from './TextoConContador'

type Props = {
  fila: Fila
  /** El plazo del día (el mismo para todas las horas): lo manda la API. */
  plazo: PlazoAsistencia
  /** El plazo no venció: con `false`, todo en sólo lectura. */
  editable: boolean
}

/**
 * Una fila compacta por alumno (sus horas seguidas): datos, estado, indicaciones de la clase
 * anterior y, si el día es editable, el registro (o la corrección). Si no, sólo lectura.
 */
export function FilaAsistencia({ fila, plazo, editable }: Props) {
  const { alumno } = fila
  const nombre = `${alumno.apellido}, ${alumno.nombre}`
  const estados = new Set(fila.ocurrencias.map((h) => h.estado))
  const [primera] = fila.ocurrencias

  return (
    <li className="space-y-4 px-4 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        <Avatar className="size-10">
          {alumno.fotoUrl && <AvatarImage src={alumno.fotoUrl} alt="" />}
          <AvatarFallback>
            <UserRound aria-hidden className="size-5" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-semibold">{nombre}</p>
            {estados.size === 1 && primera && (
              <EstadoTurnoBadge estado={primera.estado} plazo={plazo} />
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {fila.materia.nombre} · {textoHorarioFila(fila.horaInicio, fila.horaFin, fila.horas)}
          </p>
          {fila.temas && (
            <p className="text-sm">
              <span className="text-muted-foreground">Temas a trabajar: </span>
              {fila.temas}
            </p>
          )}
          {estados.size > 1 && (
            <ul className="flex flex-wrap gap-2 pt-1">
              {fila.ocurrencias.map((h) => (
                <li key={h.turnoId} className="flex items-center gap-1.5 text-xs">
                  {rangoHoras(h.horaInicio, h.horaFin)}
                  <EstadoTurnoBadge estado={h.estado} plazo={plazo} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {fila.indicacionesAnteriores && (
        <div className="bg-canvas rounded-lg px-3 py-2 text-sm">
          <p className="text-muted-foreground text-xs font-medium">
            Indicaciones de la clase anterior (
            {fechaCortaAsistencia(fila.indicacionesAnteriores.fecha)})
          </p>
          <p className="whitespace-pre-line">{fila.indicacionesAnteriores.indicaciones}</p>
        </div>
      )}

      {editable ? <RegistroFila fila={fila} /> : <SoloLectura fila={fila} />}
    </li>
  )
}

/** El formulario de la fila: estado, textos y "Ajustar por hora". */
function RegistroFila({ fila }: { fila: Fila }) {
  const id = useId()
  const toast = useToast()
  const registrar = useRegistrarAsistencias()
  const [error, setError] = useState<string | null>(null)
  const nombre = `${fila.alumno.apellido}, ${fila.alumno.nombre}`

  const { control, handleSubmit, formState } = useForm<FilaAsistenciaForm>({
    resolver: zodResolver(filaAsistenciaSchema),
    defaultValues: valoresIniciales(fila),
  })
  const valores = useWatch({ control })
  const ajustar = Boolean(valores.ajustarPorHora)
  const hayPresente = ajustar
    ? (valores.porHora ?? []).some((h) => h?.estado === 'PRESENTE')
    : valores.estado === 'PRESENTE'

  const guardar = handleSubmit((datos) => {
    setError(null)
    registrar.mutate(
      { registros: registrosDeFila(fila, datos) },
      {
        onSuccess: () => toast.success(MENSAJE_REGISTRADA),
        onError: (e) => setError(mensajeErrorRegistro(e)),
      },
    )
  })

  return (
    <form onSubmit={guardar} className="space-y-4" noValidate>
      {fila.horas > 1 && (
        <Controller
          control={control}
          name="ajustarPorHora"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${id}-ajustar`}
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
              />
              <Label htmlFor={`${id}-ajustar`}>Ajustar por hora</Label>
            </div>
          )}
        />
      )}

      {!ajustar ? (
        <Controller
          control={control}
          name="estado"
          render={({ field, fieldState }) => (
            <div className="space-y-1">
              <SelectorEstadoAsistencia
                value={field.value}
                onChange={field.onChange}
                etiqueta={`Asistencia de ${nombre}`}
                invalido={Boolean(fieldState.error)}
              />
              {fieldState.error && (
                <p className="text-destructive text-xs">{fieldState.error.message}</p>
              )}
            </div>
          )}
        />
      ) : (
        <ul className="space-y-3">
          {fila.ocurrencias.map((hora, i) => (
            <li key={hora.turnoId} className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">{rangoHoras(hora.horaInicio, hora.horaFin)}</p>
              <Controller
                control={control}
                name={`porHora.${i}.estado`}
                render={({ field, fieldState }) => (
                  <div className="space-y-1">
                    <SelectorEstadoAsistencia
                      value={field.value}
                      onChange={field.onChange}
                      etiqueta={`Asistencia de ${nombre} de ${rangoHoras(hora.horaInicio, hora.horaFin)}`}
                      invalido={Boolean(fieldState.error)}
                    />
                    {fieldState.error && (
                      <p className="text-destructive text-xs">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />
              {valores.porHora?.[i]?.estado === 'AUSENTE' && (
                <Controller
                  control={control}
                  name={`porHora.${i}.observacion`}
                  render={({ field, fieldState }) => (
                    <TextoConContador
                      id={`${id}-obs-${i}`}
                      label="Observación"
                      max={MAX_OBSERVACION}
                      error={fieldState.error?.message}
                      {...field}
                    />
                  )}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {hayPresente && (
        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            control={control}
            name="trabajado"
            render={({ field, fieldState }) => (
              <TextoConContador
                id={`${id}-trabajado`}
                label="Qué se trabajó"
                max={MAX_TEXTO_PRESENTE}
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Controller
            control={control}
            name="indicaciones"
            render={({ field, fieldState }) => (
              <TextoConContador
                id={`${id}-indicaciones`}
                label="Indicaciones para la próxima sesión"
                max={MAX_TEXTO_PRESENTE}
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
        </div>
      )}

      {!ajustar && valores.estado === 'AUSENTE' && (
        <Controller
          control={control}
          name="observacion"
          render={({ field, fieldState }) => (
            <TextoConContador
              id={`${id}-observacion`}
              label="Observación"
              max={MAX_OBSERVACION}
              error={fieldState.error?.message}
              {...field}
            />
          )}
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="confirmado"
          size="lg"
          className="w-full sm:w-auto"
          disabled={registrar.isPending || formState.isSubmitting}
        >
          {registrar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

/** Sólo lectura (plazo vencido): lo registrado de cada hora, o el cierre del sistema. */
function SoloLectura({ fila }: { fila: Fila }) {
  return (
    <ul className="space-y-2">
      {fila.ocurrencias.map((hora) => (
        <li key={hora.turnoId} className="bg-canvas space-y-1 rounded-lg px-3 py-2 text-sm">
          {fila.horas > 1 && (
            <p className="font-medium">{rangoHoras(hora.horaInicio, hora.horaFin)}</p>
          )}
          <DetalleRegistrado hora={hora} />
        </li>
      ))}
    </ul>
  )
}

function DetalleRegistrado({ hora }: { hora: HoraAsistencia }) {
  const { asistencia } = hora
  if (!asistencia) {
    return hora.estado === 'SIN_REGISTRAR' ? (
      <p>
        <span className="text-muted-foreground">Observación: </span>
        {OBSERVACION_CIERRE_SISTEMA}
      </p>
    ) : null
  }
  const textos: [string, string | null][] =
    asistencia.estado === 'PRESENTE'
      ? [
          ['Qué se trabajó', asistencia.trabajado],
          ['Indicaciones para la próxima sesión', asistencia.indicaciones],
        ]
      : [['Observación', asistencia.observacion]]
  return (
    <>
      {textos.map(([etiqueta, texto]) => (
        <p key={etiqueta}>
          <span className="text-muted-foreground">{etiqueta}: </span>
          {texto ?? '—'}
        </p>
      ))}
    </>
  )
}
