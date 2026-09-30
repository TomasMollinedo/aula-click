'use client'

import { useMemo, useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, fieldErrorId } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

import {
  CANCELACION_FORM_VACIO,
  type CancelacionFormValues,
  DETALLE_MAX,
  MOTIVOS_CANCELACION,
  cancelacionFormSchema,
  detalleParaEnviar,
} from '../cancelaciones.schema'
import type { OcurrenciaACancelar } from '../cancelaciones.types'
import { interpretarErrorCancelacion } from '../errores-api'
import {
  mensajeCancelado,
  preguntaUna,
  preguntaVarias,
  textoOcurrencia,
} from '../formato-cancelaciones'
import { useCancelarTurnos } from '../hooks/use-cancelar-turnos'

export type CancelarTurnosDialogProps = {
  /** Las ocurrencias a cancelar; con `open` en `false` no se usa. */
  ocurrencias: OcurrenciaACancelar[]
  /** Nombre del alumno para la pregunta de una sola ocurrencia; sin él se omite. */
  alumno?: string
  open: boolean
  /** Cierra el diálogo (cancelar, cerrar el rechazo o después de cancelar). */
  onCerrar: () => void
  /** Solo cuando la API canceló (todas, es todo o nada). */
  onCancelado?: (cantidad: number) => void
}

/**
 * Diálogo común de "Cancelar turno" y "Cancelar seleccionados" (`POST /cancelaciones`): motivo
 * (lista), detalle (obligatorio con "Otro", contador de 500) y el resumen de lo que se cancela. Si
 * la API responde 409 `TURNOS_NO_CANCELABLES` el diálogo queda abierto y dice cuáles no se
 * pudieron cancelar y por qué; no se canceló ninguna.
 */
export function CancelarTurnosDialog({ open, onCerrar, ...resto }: CancelarTurnosDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        {/* Se monta al abrir: el formulario y el error del intento anterior no sobreviven. */}
        <FormularioCancelar onCerrar={onCerrar} {...resto} />
      </DialogContent>
    </Dialog>
  )
}

function FormularioCancelar({
  ocurrencias,
  alumno,
  onCerrar,
  onCancelado,
}: Omit<CancelarTurnosDialogProps, 'open'>) {
  const mutation = useCancelarTurnos()
  const toast = useToast()
  const formRef = useRef<HTMLFormElement>(null)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CancelacionFormValues>({
    resolver: zodResolver(cancelacionFormSchema),
    // El motivo arranca sin elegir: el schema exige que lo elijan.
    defaultValues: CANCELACION_FORM_VACIO as CancelacionFormValues,
  })

  const error = useMemo(
    () => (mutation.error ? interpretarErrorCancelacion(mutation.error, ocurrencias) : null),
    [mutation.error, ocurrencias],
  )
  const rechazadas = error?.tipo === 'noCancelables' ? error : null
  const errorCampo = (campo: 'motivo' | 'detalle') =>
    errors[campo]?.message ??
    (error?.tipo === 'campos'
      ? error.camposMarcados.find((c) => c.campo === campo)?.mensaje
      : undefined)
  const errorGeneral =
    error?.tipo === 'general' ? error.mensaje : error?.tipo === 'campos' ? error.mensaje : null

  const unica = ocurrencias.length === 1 ? ocurrencias[0] : undefined
  const motivoElegido = useWatch({ control, name: 'motivo' })
  const detalleLargo = useWatch({ control, name: 'detalle' })?.length ?? 0

  const confirmar = handleSubmit((valores) => {
    mutation.mutate(
      {
        ocurrencias: ocurrencias.map(({ turnoId, fecha }) => ({ turnoId, fecha })),
        motivo: valores.motivo,
        detalle: detalleParaEnviar(valores.detalle),
      },
      {
        onSuccess: ({ cantidad }) => {
          toast.success(mensajeCancelado(cantidad))
          onCerrar()
          onCancelado?.(cantidad)
        },
      },
    )
  })

  return (
    <form ref={formRef} onSubmit={confirmar} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{unica ? 'Cancelar turno' : 'Cancelar turnos'}</DialogTitle>
        <DialogDescription>
          {unica ? preguntaUna(unica, alumno) : preguntaVarias(ocurrencias.length)}
        </DialogDescription>
      </DialogHeader>

      {!unica && (
        <ul className="border-border max-h-40 space-y-1 overflow-y-auto rounded-lg border p-3 text-sm">
          {ocurrencias.map((o) => (
            <li key={`${o.turnoId}|${o.fecha}`}>{textoOcurrencia(o)}</li>
          ))}
        </ul>
      )}

      {rechazadas && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">
            <p>{rechazadas.mensaje}. No se canceló ninguno.</p>
            {rechazadas.lineas.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {rechazadas.lineas.map((linea) => (
                  <li key={linea}>{linea}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}
      {errorGeneral && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">{errorGeneral}</AlertDescription>
        </Alert>
      )}

      {!rechazadas && (
        <>
          <Field label="Motivo" htmlFor="motivo" required error={errorCampo('motivo')}>
            <Controller
              control={control}
              name="motivo"
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="motivo"
                    className="w-full"
                    aria-invalid={errorCampo('motivo') ? true : undefined}
                    aria-describedby={errorCampo('motivo') ? fieldErrorId('motivo') : undefined}
                  >
                    <SelectValue placeholder="Elegí un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_CANCELACION.map((m) => (
                      <SelectItem key={m.valor} value={m.valor}>
                        {m.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field
            label="Detalle"
            htmlFor="detalle"
            required={motivoElegido === 'OTRO'}
            optional={motivoElegido !== 'OTRO'}
            error={errorCampo('detalle')}
          >
            <Textarea
              id="detalle"
              rows={3}
              maxLength={DETALLE_MAX}
              placeholder="Contanos qué pasó"
              aria-invalid={errorCampo('detalle') ? true : undefined}
              aria-describedby={errorCampo('detalle') ? fieldErrorId('detalle') : undefined}
              {...register('detalle')}
            />
            <p className="text-muted-foreground text-right text-xs">
              {detalleLargo}/{DETALLE_MAX}
            </p>
          </Field>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCerrar} disabled={mutation.isPending}>
          {rechazadas ? 'Cerrar' : 'Volver'}
        </Button>
        {!rechazadas && (
          <Button type="submit" variant="destructive" disabled={mutation.isPending}>
            {mutation.isPending
              ? 'Cancelando…'
              : unica
                ? 'Cancelar turno'
                : `Cancelar ${ocurrencias.length} turnos`}
          </Button>
        )}
      </DialogFooter>
    </form>
  )
}
