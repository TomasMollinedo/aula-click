'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { rangoHoras } from '@/utils/horas'

import { type FilaAsistenciaForm, filaAsistenciaSchema } from '../asistencias.schema'
import { mensajeErrorRegistro } from '../errores-asistencias'
import { MAX_OBSERVACION, MAX_TEXTO_PRESENTE, MENSAJE_REGISTRADA } from '../formato-asistencias'
import { useRegistrarAsistencias } from '../hooks/use-registrar-asistencias'
import { type HoraARegistrar, type HoraOfrecida, registrosDeHoras } from '../registro-asistencia'
import { SelectorEstadoAsistencia } from './SelectorEstadoAsistencia'
import { TextoConContador } from './TextoConContador'

export type FormularioAsistenciaProps = {
  /** Nombre accesible del selector "Presente / Ausente" (`'Asistencia de Pérez, Lucas'`). */
  etiqueta: string
  /** Lo ya registrado de esa hora (`valoresIniciales` o `valoresDeAsistencia`). */
  valoresIniciales: FilaAsistenciaForm
  /** La hora que se registra. */
  hora: HoraARegistrar
  /** Las que ofrece "Aplicar también a…": las tildadas se registran con los mismos datos. */
  horasOfrecidas: HoraOfrecida[]
  onGuardado: () => void
  /** Sólo al corregir: cierra el formulario sin guardar. */
  onCancelar?: () => void
}

/**
 * El formulario de asistencia de una hora: "Presente" / "Ausente", los textos con su contador y
 * "Aplicar también a…" otras horas. Guarda con `PUT /asistencias` (un registro por hora, con
 * `registrosDeHoras`) y muestra los errores de la API en el formulario. Lo usan la fila de la
 * pantalla "Asistencia" y el detalle del turno (`RegistrarAsistenciaTurno`).
 */
export function FormularioAsistencia({
  etiqueta,
  valoresIniciales,
  hora,
  horasOfrecidas,
  onGuardado,
  onCancelar,
}: FormularioAsistenciaProps) {
  const id = useId()
  const toast = useToast()
  const registrar = useRegistrarAsistencias()
  const [error, setError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<FilaAsistenciaForm>({
    resolver: zodResolver(filaAsistenciaSchema),
    defaultValues: valoresIniciales,
  })
  // Al corregir, "Guardar" se habilita recién cuando algo cambia.
  const sinCambios = Boolean(onCancelar) && !isDirty
  const estado = useWatch({ control, name: 'estado' })

  const guardar = handleSubmit((datos) => {
    const tildadas = horasOfrecidas.filter((h) => datos.otrasHoras.includes(h.turnoId))
    const registros = registrosDeHoras(hora, tildadas, datos)
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
              etiqueta={etiqueta}
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

      {horasOfrecidas.length > 0 && (
        <Controller
          control={control}
          name="otrasHoras"
          render={({ field }) => (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Aplicar también a</legend>
              {horasOfrecidas.map((otra) => {
                const idHora = `${id}-hora-${otra.turnoId}`
                const tildada = field.value.includes(otra.turnoId)
                return (
                  <div key={otra.turnoId} className="flex items-center gap-2">
                    <Checkbox
                      id={idHora}
                      checked={tildada}
                      onCheckedChange={(v) =>
                        field.onChange(
                          v === true
                            ? [...field.value, otra.turnoId]
                            : field.value.filter((t) => t !== otra.turnoId),
                        )
                      }
                    />
                    <Label htmlFor={idHora}>{rangoHoras(otra.horaInicio, otra.horaFin)}</Label>
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
