'use client'

import { useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Info } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CalendarioFecha } from '@/components/ui/calendario-fecha'
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
import { useInvalidarOcurrencias } from '@/features/ocurrencias/hooks/use-invalidar-ocurrencias'
import { useToast } from '@/hooks/use-toast'
import type { OcurrenciaDetalle } from '@/types/ocurrencia'
import { cn } from '@/utils/cn'
import { diaSemanaDeFecha } from '@/utils/dias-semana'

import { type ErrorFinalizacion, interpretarErrorFinalizacion } from '../errores-api'
import {
  type CampoFinalizacionForm,
  DETALLE_MAX,
  type FinalizacionFormInicial,
  type FinalizacionFormValues,
  MOTIVOS_FINALIZACION,
  detalleParaEnviar,
  esFechaConFormato,
  finalizacionFormSchema,
} from '../finalizaciones.schema'
import type { FinalizacionCreada } from '../finalizaciones.types'
import {
  avisoOtrosTramos,
  avisoPagados,
  lineaPagado,
  mensajeFinalizado,
  resumenPrevia,
  resumenTurno,
  textoUsarFecha,
} from '../formato-finalizaciones'
import { useFinalizarTurno } from '../hooks/use-finalizar-turno'
import { usePreviaFinalizacion } from '../hooks/use-previa-finalizacion'

export type FinalizarTurnoDialogProps = {
  /** La ocurrencia desde cuyo detalle se finaliza el turno; con `open` en `false` no se usa. */
  ocurrencia: OcurrenciaDetalle
  open: boolean
  /** Cierra el diálogo (Volver, la X o después de finalizar). */
  onCerrar: () => void
  /** Solo cuando la API finalizó el turno, después de cerrar. */
  onFinalizado?: (finalizacion: FinalizacionCreada) => void
}

/**
 * Diálogo de "Finalizar turno" (HU-14, `POST /finalizaciones`): desde qué fecha, motivo (lista) y
 * detalle (obligatorio con "Otro", contador de 500). Al elegir la fecha pide la previa y muestra
 * qué se libera, los turnos pagados que lo impiden y los tramos posteriores. El resumen es la
 * confirmación: no hay un segundo paso. No calcula reglas: qué fecha vale y qué se libera lo decide
 * la API. Si el POST falla, el diálogo queda abierto con el error.
 */
export function FinalizarTurnoDialog({ open, onCerrar, ...resto }: FinalizarTurnoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        {/* Se monta al abrir: el formulario y el error del intento anterior no sobreviven. */}
        <FormularioFinalizar onCerrar={onCerrar} {...resto} />
      </DialogContent>
    </Dialog>
  )
}

function FormularioFinalizar({
  ocurrencia,
  onCerrar,
  onFinalizado,
}: Omit<FinalizarTurnoDialogProps, 'open'>) {
  const mutation = useFinalizarTurno()
  const invalidarOcurrencias = useInvalidarOcurrencias()
  const toast = useToast()

  // La fecha propuesta es la del turno que se está mirando, si sigue agendado.
  const valoresIniciales: FinalizacionFormInicial = {
    fechaDesde: ocurrencia.estado === 'AGENDADO' ? ocurrencia.fecha : '',
    motivo: '',
    detalle: '',
  }
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FinalizacionFormValues>({
    resolver: zodResolver(finalizacionFormSchema),
    // El motivo arranca sin elegir: el schema exige que lo elijan.
    defaultValues: valoresIniciales as FinalizacionFormValues,
  })

  const fechaDesde = useWatch({ control, name: 'fechaDesde' }) ?? ''
  const motivoElegido = useWatch({ control, name: 'motivo' })
  const detalleLargo = useWatch({ control, name: 'detalle' })?.length ?? 0

  // --- Previa de la fecha elegida.
  const previa = usePreviaFinalizacion(ocurrencia.turnoId, fechaDesde)
  const hayFecha = esFechaConFormato(fechaDesde)
  const previaMostrada = hayFecha && !previa.isError ? previa.data : undefined
  // Con la previa de la fecha anterior (placeholder) no se puede confirmar.
  const previaVigente = previa.isPlaceholderData ? undefined : previaMostrada

  const errorPrevia = useMemo(
    () => (previa.error ? interpretarErrorFinalizacion(previa.error) : null),
    [previa.error],
  )
  const errorEnvio = useMemo(
    () => (mutation.error ? interpretarErrorFinalizacion(mutation.error) : null),
    [mutation.error],
  )

  // Un 409 de la previa (ya finalizado, ya no vigente) dice que el detalle tiene datos viejos.
  const previaEnConflicto = previa.error?.status === 409
  useEffect(() => {
    if (previaEnConflicto) void invalidarOcurrencias()
  }, [previaEnConflicto, invalidarOcurrencias])

  // --- Qué se muestra de cada error.
  const errorDefinitivo =
    [errorPrevia, errorEnvio].find(
      (e): e is Extract<ErrorFinalizacion, { tipo: 'general' }> =>
        e?.tipo === 'general' && e.definitivo,
    ) ?? null
  const errorCampo = (campo: CampoFinalizacionForm) =>
    errors[campo]?.message ??
    [errorEnvio, errorPrevia]
      .flatMap((e) => (e?.tipo === 'campos' ? e.camposMarcados : []))
      .find((c) => c.campo === campo)?.mensaje
  const mensajeDe = (e: ErrorFinalizacion | null) =>
    e?.tipo === 'general' || e?.tipo === 'campos' ? e.mensaje : null
  const errorGeneralEnvio = mensajeDe(errorEnvio)
  const errorGeneralPrevia = mensajeDe(errorPrevia)

  // Los pagados se muestran una sola vez: los de la previa de la fecha elegida y, si todavía no los
  // trae, los del 409 del POST (un pago que entró entre la previa y la confirmación).
  const pagados =
    previaVigente && previaVigente.pagadas.length > 0 && previaVigente.ultimaFechaPagada
      ? {
          pagadas: previaVigente.pagadas,
          ultimaFechaPagada: previaVigente.ultimaFechaPagada,
          fechaDesdeMinima: previaVigente.fechaDesdeMinima,
        }
      : errorEnvio?.tipo === 'pagados'
        ? errorEnvio
        : null

  const puedeConfirmar =
    previaVigente !== undefined && previaVigente.pagadas.length === 0 && !mutation.isPending

  const cambiarFecha = (fecha: string) => {
    // El error del intento anterior era de la otra fecha.
    mutation.reset()
    setValue('fechaDesde', fecha, { shouldValidate: true, shouldDirty: true })
  }

  const confirmar = handleSubmit((valores) => {
    if (!puedeConfirmar) return
    mutation.mutate(
      {
        turnoId: ocurrencia.turnoId,
        fechaDesde: valores.fechaDesde,
        motivo: valores.motivo,
        detalle: detalleParaEnviar(valores.detalle),
      },
      {
        onSuccess: (finalizacion) => {
          toast.success(mensajeFinalizado(finalizacion))
          onCerrar()
          onFinalizado?.(finalizacion)
        },
      },
    )
  })

  return (
    <form onSubmit={confirmar} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Finalizar turno</DialogTitle>
        <DialogDescription>
          {resumenTurno(ocurrencia)}. Desde la fecha que elijas, el turno deja de repetirse; los
          turnos anteriores no cambian.
        </DialogDescription>
      </DialogHeader>

      {errorDefinitivo ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">
            {errorDefinitivo.mensaje}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Field label="Desde" htmlFor="fechaDesde" required error={errorCampo('fechaDesde')}>
            <Controller
              control={control}
              name="fechaDesde"
              render={({ field }) => (
                // Solo deja elegir el día de la serie, de hoy en adelante. Es una ayuda: la fecha
                // la valida la API.
                <CalendarioFecha
                  id="fechaDesde"
                  ref={field.ref}
                  value={field.value ?? ''}
                  onChange={cambiarFecha}
                  onBlur={field.onBlur}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  diaSemana={diaSemanaDeFecha(ocurrencia.fecha)}
                  disabled={mutation.isPending}
                  aria-invalid={errorCampo('fechaDesde') ? true : undefined}
                  aria-describedby={
                    errorCampo('fechaDesde') ? fieldErrorId('fechaDesde') : undefined
                  }
                />
              )}
            />
          </Field>

          {hayFecha && previa.isLoading && (
            <p className="text-muted-foreground text-sm" role="status">
              Calculando qué se libera…
            </p>
          )}

          {errorGeneralPrevia && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-destructive">
                <p>{errorGeneralPrevia}</p>
                {errorPrevia?.tipo === 'general' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => void previa.refetch()}
                  >
                    Reintentar
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {previaMostrada && (
            <div
              className={cn('space-y-3', previa.isPlaceholderData && 'opacity-60')}
              aria-busy={previa.isPlaceholderData}
            >
              {previaMostrada.pagadas.length === 0 && (
                <p className="border-border bg-canvas rounded-lg border p-3 text-sm font-medium">
                  {resumenPrevia(previaMostrada)}
                </p>
              )}
              {previaMostrada.otrosTramos.length > 0 && (
                <Alert>
                  <Info className="size-4" />
                  <AlertDescription>
                    {avisoOtrosTramos(previaMostrada.otrosTramos)}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {pagados && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-destructive">
                <p>Hay turnos pagados desde esa fecha:</p>
                <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-4">
                  {pagados.pagadas.map((pagado) => (
                    <li key={pagado.fecha}>{lineaPagado(pagado)}</li>
                  ))}
                </ul>
                <p className="mt-2 font-medium">{avisoPagados(pagados)}</p>
                {pagados.fechaDesdeMinima && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={mutation.isPending}
                    onClick={() => cambiarFecha(pagados.fechaDesdeMinima as string)}
                  >
                    {textoUsarFecha(pagados.fechaDesdeMinima)}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {errorGeneralEnvio && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-destructive">{errorGeneralEnvio}</AlertDescription>
            </Alert>
          )}

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
                    {MOTIVOS_FINALIZACION.map((m) => (
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
          {errorDefinitivo ? 'Cerrar' : 'Volver'}
        </Button>
        {!errorDefinitivo && (
          <Button type="submit" variant="destructive" disabled={!puedeConfirmar}>
            {mutation.isPending ? 'Finalizando…' : 'Finalizar turno'}
          </Button>
        )}
      </DialogFooter>
    </form>
  )
}
