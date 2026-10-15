'use client'

import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Info } from 'lucide-react'

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
import type { PagoParaAcciones } from '@/types/pago'

import {
  type AnulacionFormInicial,
  type AnulacionFormValues,
  type CampoAnulacionForm,
  DETALLE_MAX,
  MOTIVOS_ANULACION,
  anulacionFormSchema,
  detalleParaEnviar,
} from '../anulaciones.schema'
import { type ErrorAnulacion, interpretarErrorAnulacion } from '../errores-api'
import {
  MENSAJE_ANULADO,
  avisoDeuda,
  avisoPrecio,
  avisoTransferencia,
  lineaPagoCompartido,
  preguntaAnular,
} from '../formato-anulaciones'
import { useAnularPago } from '../hooks/use-anular-pago'
import { usePreviaAnulacion } from '../hooks/use-previa-anulacion'

export type AnularPagoDialogProps = {
  /** El pago que se anula; con `open` en `false` no se usa. */
  pago: PagoParaAcciones
  open: boolean
  /** Cierra el diálogo (Volver, la X o después de anular). */
  onCerrar: () => void
}

/**
 * Diálogo de "Anular pago" (HU-42, `POST /anulaciones`): motivo (lista), detalle (obligatorio con
 * "Otro", contador de 500) y, como confirmación, el resumen y los avisos de `GET /anulaciones/previa`
 * tal como los manda la API. Los avisos informan, no bloquean. No calcula reglas. Si el pago ya
 * estaba anulado (409) o falla el POST, el diálogo queda abierto con el error.
 */
export function AnularPagoDialog({ open, onCerrar, ...resto }: AnularPagoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        {/* Se monta al abrir: el formulario, la previa y el error del intento anterior no sobreviven. */}
        <FormularioAnular onCerrar={onCerrar} {...resto} />
      </DialogContent>
    </Dialog>
  )
}

function FormularioAnular({ pago, onCerrar }: Omit<AnularPagoDialogProps, 'open'>) {
  const mutation = useAnularPago()
  const previa = usePreviaAnulacion(pago.id)
  const toast = useToast()

  const valoresIniciales: AnulacionFormInicial = { motivo: '', detalle: '' }
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AnulacionFormValues>({
    resolver: zodResolver(anulacionFormSchema),
    // El motivo arranca sin elegir: el schema exige que lo elijan.
    defaultValues: valoresIniciales as AnulacionFormValues,
  })

  const motivoElegido = useWatch({ control, name: 'motivo' })
  const detalleLargo = useWatch({ control, name: 'detalle' })?.length ?? 0

  const errorPrevia = useMemo(
    () => (previa.error ? interpretarErrorAnulacion(previa.error) : null),
    [previa.error],
  )
  const errorEnvio = useMemo(
    () => (mutation.error ? interpretarErrorAnulacion(mutation.error) : null),
    [mutation.error],
  )

  // --- Qué se muestra de cada error.
  const errorDefinitivo =
    [errorPrevia, errorEnvio].find(
      (e): e is Extract<ErrorAnulacion, { tipo: 'general' }> =>
        e?.tipo === 'general' && e.definitivo,
    ) ?? null
  const errorCampo = (campo: CampoAnulacionForm) =>
    errors[campo]?.message ??
    (errorEnvio?.tipo === 'campos'
      ? errorEnvio.camposMarcados.find((c) => c.campo === campo)?.mensaje
      : undefined)
  const mensajeDe = (e: ErrorAnulacion | null) =>
    e?.tipo === 'general' || e?.tipo === 'campos' ? e.mensaje : null
  const errorGeneralEnvio = mensajeDe(errorEnvio)
  const errorGeneralPrevia = mensajeDe(errorPrevia)

  const puedeConfirmar = previa.data !== undefined && !mutation.isPending

  const confirmar = handleSubmit((valores) => {
    if (!puedeConfirmar) return
    mutation.mutate(
      { pagoId: pago.id, motivo: valores.motivo, detalle: detalleParaEnviar(valores.detalle) },
      {
        onSuccess: () => {
          toast.success(MENSAJE_ANULADO)
          onCerrar()
        },
      },
    )
  })

  const datos = previa.data
  const avisos = datos?.avisos
  const hayAvisos =
    avisos !== undefined &&
    (avisos.deuda !== null || avisos.precios.length > 0 || avisos.transferenciaCompartida !== null)

  return (
    <form onSubmit={confirmar} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Anular pago</DialogTitle>
        <DialogDescription>
          Se anula el pago completo, nunca un turno suelto. Sus turnos vuelven a quedar pendientes
          de pago; el comprobante se conserva marcado como anulado.
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
          {previa.isLoading && (
            <p className="text-muted-foreground text-sm" role="status">
              Calculando los avisos…
            </p>
          )}

          {errorGeneralPrevia && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-destructive">
                <p>{errorGeneralPrevia}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void previa.refetch()}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {datos && (
            <p className="border-border bg-canvas rounded-lg border p-3 text-sm font-medium">
              {preguntaAnular(datos)}
            </p>
          )}

          {datos && hayAvisos && (
            <div className="space-y-2">
              {datos.avisos.deuda && (
                <Alert>
                  <Info className="size-4" />
                  <AlertDescription>
                    {avisoDeuda(datos.avisos.deuda, datos.pago.alumno)}
                  </AlertDescription>
                </Alert>
              )}
              {datos.avisos.precios.map((precio) => (
                <Alert key={`${precio.materia.id}-${precio.cobrado}`}>
                  <Info className="size-4" />
                  <AlertDescription>{avisoPrecio(precio)}</AlertDescription>
                </Alert>
              ))}
              {datos.avisos.transferenciaCompartida && (
                <Alert>
                  <Info className="size-4" />
                  <AlertDescription>
                    <p>{avisoTransferencia(datos.avisos.transferenciaCompartida)}</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {datos.avisos.transferenciaCompartida.pagos.map((otro) => (
                        <li key={otro.pagoId}>{lineaPagoCompartido(otro)}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
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
                    {MOTIVOS_ANULACION.map((m) => (
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
            {mutation.isPending ? 'Anulando…' : 'Anular pago'}
          </Button>
        )}
      </DialogFooter>
    </form>
  )
}
