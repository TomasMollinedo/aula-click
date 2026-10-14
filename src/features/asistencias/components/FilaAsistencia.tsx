'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Pencil, UserRound } from 'lucide-react'
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
import type { PlazoAsistencia } from '../asistencias.types'
import { mensajeErrorRegistro } from '../errores-asistencias'
import {
  MAX_OBSERVACION,
  MAX_TEXTO_PRESENTE,
  MENSAJE_REGISTRADA,
  OBSERVACION_CIERRE_SISTEMA,
  fechaCortaAsistencia,
  textoOtrasHoras,
} from '../formato-asistencias'
import { useRegistrarAsistencias } from '../hooks/use-registrar-asistencias'
import {
  type FilaDeHora,
  otrasHorasSinRegistrar,
  registrosDeFila,
  seVeCompacta,
  textosRegistrados,
  valoresIniciales,
} from '../registro-asistencia'
import { SelectorEstadoAsistencia } from './SelectorEstadoAsistencia'
import { TextoConContador } from './TextoConContador'

type Props = {
  fila: FilaDeHora
  /** El plazo del día (el mismo para todas las horas): lo manda la API. */
  plazo: PlazoAsistencia
  /** El plazo no venció: con `false`, todo en sólo lectura. */
  editable: boolean
}

/**
 * Una fila compacta: un alumno en una hora. Datos, estado, indicaciones de la clase anterior y, si
 * el día es editable, el registro (o la corrección). Si no, sólo lectura.
 */
export function FilaAsistencia({ fila, plazo, editable }: Props) {
  const { alumno, hora } = fila

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
            <p className="font-semibold">
              {alumno.apellido}, {alumno.nombre}
            </p>
            <EstadoTurnoBadge estado={hora.estado} plazo={plazo} />
          </div>
          <p className="text-muted-foreground text-sm">
            {fila.materia.nombre} · {rangoHoras(hora.horaInicio, hora.horaFin)}
            {fila.otrasHoras.length > 0 && ` · también ${textoOtrasHoras(fila.otrasHoras)}`}
          </p>
          {fila.temas && (
            <p className="text-sm">
              <span className="text-muted-foreground">Temas a trabajar: </span>
              {fila.temas}
            </p>
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

      {editable ? <RegistroEditable fila={fila} /> : <Registrado fila={fila} />}
    </li>
  )
}

/**
 * Día editable. Una hora ya registrada se ve compacta, en sólo lectura, con "Corregir", que abre
 * el mismo formulario. Sin registrar, el formulario directo. Al guardar, vuelve a compacta.
 */
function RegistroEditable({ fila }: { fila: FilaDeHora }) {
  const compacta = seVeCompacta(fila)
  const [corrigiendo, setCorrigiendo] = useState(false)

  if (compacta && !corrigiendo) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Registrado fila={fila} />
        </div>
        <Button size="sm" variant="outline" onClick={() => setCorrigiendo(true)}>
          <Pencil aria-hidden />
          Corregir
        </Button>
      </div>
    )
  }
  return (
    <RegistroFila
      fila={fila}
      onGuardado={() => setCorrigiendo(false)}
      onCancelar={compacta ? () => setCorrigiendo(false) : undefined}
    />
  )
}

/** El formulario de la fila: estado, textos y "Aplicar también a…" sus otras horas. */
function RegistroFila({
  fila,
  onGuardado,
  onCancelar,
}: {
  fila: FilaDeHora
  onGuardado: () => void
  /** Sólo al corregir: cierra el formulario sin guardar. */
  onCancelar?: () => void
}) {
  const id = useId()
  const toast = useToast()
  const registrar = useRegistrarAsistencias()
  const [error, setError] = useState<string | null>(null)
  const nombre = `${fila.alumno.apellido}, ${fila.alumno.nombre}`

  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<FilaAsistenciaForm>({
    resolver: zodResolver(filaAsistenciaSchema),
    defaultValues: valoresIniciales(fila),
  })
  // Al corregir, "Guardar" se habilita recién cuando algo cambia.
  const sinCambios = Boolean(onCancelar) && !isDirty
  const estado = useWatch({ control, name: 'estado' })

  // Las otras horas del alumno que todavía no están registradas (las registradas se corrigen en su fila).
  const sinRegistrar = otrasHorasSinRegistrar(fila)

  const guardar = handleSubmit((datos) => {
    const registros = registrosDeFila(fila, datos)
    if (registros.length === 0) return
    setError(null)
    registrar.mutate(
      { registros },
      {
        onSuccess: () => {
          toast.success(MENSAJE_REGISTRADA)
          onGuardado()
        },
        onError: (e) => setError(mensajeErrorRegistro(e)),
      },
    )
  })

  return (
    <form onSubmit={guardar} className="space-y-4" noValidate>
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

      {estado === 'PRESENTE' && (
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

      {estado === 'AUSENTE' && (
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

      {sinRegistrar.length > 0 && (
        <Controller
          control={control}
          name="otrasHoras"
          render={({ field }) => (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Aplicar también a</legend>
              {sinRegistrar.map((hora) => {
                const idHora = `${id}-hora-${hora.turnoId}`
                const tildada = field.value.includes(hora.turnoId)
                return (
                  <div key={hora.turnoId} className="flex items-center gap-2">
                    <Checkbox
                      id={idHora}
                      checked={tildada}
                      onCheckedChange={(v) =>
                        field.onChange(
                          v === true
                            ? [...field.value, hora.turnoId]
                            : field.value.filter((t) => t !== hora.turnoId),
                        )
                      }
                    />
                    <Label htmlFor={idHora}>{rangoHoras(hora.horaInicio, hora.horaFin)}</Label>
                  </div>
                )
              })}
            </fieldset>
          )}
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancelar && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={onCancelar}
            disabled={registrar.isPending}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          variant="confirmado"
          size="lg"
          className="w-full sm:w-auto"
          disabled={registrar.isPending || sinCambios}
        >
          {registrar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

/**
 * Lo registrado de la hora (compacto o sólo lectura): sólo los textos que tienen algo, en chico.
 * Un "Sin registrar" cerrado por el sistema muestra su observación de cierre.
 */
function Registrado({ fila }: { fila: FilaDeHora }) {
  const { asistencia, estado } = fila.hora
  if (!asistencia) {
    return estado === 'SIN_REGISTRAR' ? (
      <p className="text-muted-foreground text-sm">
        <span className="font-medium">Observación: </span>
        {OBSERVACION_CIERRE_SISTEMA}
      </p>
    ) : null
  }
  const textos = textosRegistrados(fila)
  if (textos.length === 0) return null
  return (
    <div className="space-y-0.5 text-sm">
      {textos.map(([etiqueta, texto]) => (
        <p key={etiqueta} className="whitespace-pre-line">
          <span className="text-muted-foreground">{etiqueta}: </span>
          {texto}
        </p>
      ))}
    </div>
  )
}
