'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dato, Datos } from '@/components/ui/datos'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, fieldErrorId } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/utils/cn'
import { textoMes } from '@/utils/formato-fechas'
import { formatearPesos } from '@/utils/moneda'

import { interpretarErrorPagoLiquidacion } from '../errores-pago-liquidacion'
import {
  fechaLarga,
  nombreDeProfesor,
  textoConfirmacionPagoLiquidacion,
  textoExitoPagoLiquidacion,
} from '../formato-liquidaciones'
import { useRegistrarPagoLiquidacion } from '../hooks/use-registrar-pago-liquidacion'
import type { LiquidacionDetalle } from '../liquidaciones.types'
import { ultimoDiaDelMes } from '../mes-liquidacion'
import {
  type PagoLiquidacionFormValues,
  armarPagoLiquidacion,
  pagoLiquidacionFormSchema,
  valoresInicialesPagoLiquidacion,
} from '../pago-liquidacion.schema'
import { CampoComprobanteTransferencia } from './CampoComprobanteTransferencia'

const MAX_OPERACION = 50
const MAX_OBSERVACIONES = 500
const FORM_ID = 'registrar-pago-liquidacion-form'

type Paso = 'formulario' | 'confirmar'

export type RegistrarPagoLiquidacionDialogProps = {
  /**
   * La copia de la liquidación que guardó el detalle al abrir: el diálogo sigue montado aunque al
   * invalidarse el detalle el botón ya no se muestre. Su `total` es el que se confirma.
   */
  liquidacion: LiquidacionDetalle
  /** Lo desmonta el detalle (al cancelar o al terminar). */
  onCerrar: () => void
}

/**
 * Registrar el pago de una liquidación al profesor (HU-44, T-132): la transferencia por el total de
 * la liquidación, con su comprobante opcional. Lo abre "Registrar pago" del detalle. Un solo diálogo
 * por pasos, formulario → confirmar, como `RegistrarPagoDialog` de `pagos`.
 *
 * - **El monto no se escribe**: es el `total` de la copia que guardó el detalle, y viaja como
 *   `totalConfirmado`. Si la liquidación cambió, la API responde 409 `LIQUIDACION_MODIFICADA`: un
 *   toast lo avisa, el diálogo se cierra y el detalle se recarga (lo invalida el hook).
 * - El comprobante se sube al elegirlo (`CampoComprobanteTransferencia`); mientras sube no se puede
 *   continuar.
 * - Los otros 409 (ya pagada, mes no terminado, sin importe) y el 404 se muestran acá con solo
 *   "Cerrar": no tiene sentido reintentar. Un 400 vuelve al formulario con el error en su campo.
 * - Mientras envía no se puede cerrar, y nunca se cierra con un clic afuera (hay un formulario).
 */
export function RegistrarPagoLiquidacionDialog({
  liquidacion,
  onCerrar,
}: RegistrarPagoLiquidacionDialogProps) {
  const mutation = useRegistrarPagoLiquidacion()
  const toast = useToast()
  const [paso, setPaso] = useState<Paso>('formulario')
  const [subiendoComprobante, setSubiendoComprobante] = useState(false)
  // `isPending` se actualiza después del próximo tick: un doble clic rápido llegaría a mandar dos
  // veces. El ref lo corta en el mismo evento.
  const enviando = useRef(false)
  const contenidoRef = useRef<HTMLDivElement>(null)

  // "Hoy" del navegador, solo como propuesta y como `max`: qué es hoy para la regla lo decide la API.
  const hoy = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const form = useForm<PagoLiquidacionFormValues>({
    resolver: zodResolver(pagoLiquidacionFormSchema),
    defaultValues: valoresInicialesPagoLiquidacion(hoy),
  })
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setError,
    setFocus,
    formState: { errors },
  } = form
  const observaciones = useWatch({ control, name: 'observaciones' })

  const rechazo = useMemo(
    () => (mutation.error ? interpretarErrorPagoLiquidacion(mutation.error) : null),
    [mutation.error],
  )
  const vista = rechazo?.tipo === 'conflicto' ? 'conflicto' : paso

  const cerrar = () => {
    if (enviando.current) return
    onCerrar()
  }

  // Al cambiar de paso, el foco va al contenido nuevo (el botón que lo tenía ya no está). Al abrir,
  // lo pone el Dialog en el primer campo.
  const vistaAnterior = useRef(vista)
  useEffect(() => {
    if (vistaAnterior.current === vista) return
    vistaAnterior.current = vista
    contenidoRef.current?.focus()
  }, [vista])

  // Un 400 por campo: el foco va al primero marcado, ya de vuelta en el formulario.
  const primerCampoConError = rechazo?.tipo === 'campos' ? rechazo.campos[0].campo : null
  useEffect(() => {
    if (vista === 'formulario' && primerCampoConError) setFocus(primerCampoConError)
  }, [vista, primerCampoConError, setFocus])

  const continuar = handleSubmit(() => {
    // El botón ya está deshabilitado; esto corta un Enter en un campo mientras sube.
    if (subiendoComprobante) return
    mutation.reset()
    setPaso('confirmar')
  })

  const registrar = () => {
    if (enviando.current) return
    enviando.current = true
    mutation.mutate(
      {
        profesorId: liquidacion.profesor.id,
        mes: liquidacion.mes,
        body: armarPagoLiquidacion(getValues(), liquidacion.total),
      },
      {
        onSuccess: (pago) => {
          // La invalidación la hace el hook: el detalle ya muestra "Pagada" con la transferencia.
          toast.success(textoExitoPagoLiquidacion(pago))
          onCerrar()
        },
        onError: (error) => {
          const interpretado = interpretarErrorPagoLiquidacion(error)
          switch (interpretado.tipo) {
            case 'campos':
              for (const { campo, mensaje } of interpretado.campos) {
                setError(campo, { type: 'server', message: mensaje })
              }
              setPaso('formulario')
              return
            case 'modificada':
              // El detalle se recarga solo (el hook invalidó): ahí se ve el total nuevo.
              toast.warning(interpretado.mensaje)
              onCerrar()
              return
            case 'conflicto':
              // Se queda mostrando el mensaje con "Cerrar" (`vista`).
              return
            case 'general':
              setPaso('formulario')
              return
          }
        },
        onSettled: () => {
          enviando.current = false
        },
      },
    )
  }

  const mensajeGeneral =
    rechazo?.tipo === 'general' || rechazo?.tipo === 'campos' ? rechazo.mensaje : null
  const valores = getValues()

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent
        className="max-w-xl"
        showCloseButton={!mutation.isPending}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Liquidación de {textoMes(liquidacion.mes)} · {nombreDeProfesor(liquidacion.profesor)}
          </DialogDescription>
        </DialogHeader>

        <div ref={contenidoRef} tabIndex={-1} className="space-y-5 outline-none">
          {vista === 'conflicto' && rechazo && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-destructive">{rechazo.mensaje}</AlertDescription>
            </Alert>
          )}

          {vista === 'confirmar' && (
            <>
              <p className="text-base font-medium">
                {textoConfirmacionPagoLiquidacion(liquidacion)}
              </p>
              <Datos className="sm:grid-cols-3">
                <Dato
                  label="Fecha de la transferencia"
                  valor={fechaLarga(valores.fechaTransferencia)}
                />
                <Dato label="Número de operación" valor={valores.numeroOperacion.trim()} />
                <Dato
                  label="Comprobante"
                  valor={valores.comprobanteAdjuntoId !== null ? 'Adjunto' : 'Sin comprobante'}
                />
              </Datos>
            </>
          )}

          {/*
            Oculto (no desmontado) fuera del formulario: así el comprobante elegido sigue a la vista
            al volver de "confirmar" o de un 400.
          */}
          <form
            id={FORM_ID}
            onSubmit={continuar}
            noValidate
            hidden={vista !== 'formulario'}
            className="space-y-5"
          >
            {mensajeGeneral && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription className="text-destructive">{mensajeGeneral}</AlertDescription>
              </Alert>
            )}

            <Datos>
              <Dato label="Forma de pago" valor="Transferencia" />
              <Dato
                label="Monto"
                valor={
                  <span className="text-xl font-semibold tabular-nums">
                    {formatearPesos(liquidacion.total)}
                  </span>
                }
              />
            </Datos>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Fecha de la transferencia"
                htmlFor="pago-liquidacion-fecha"
                required
                error={errors.fechaTransferencia?.message}
              >
                <Input
                  id="pago-liquidacion-fecha"
                  type="date"
                  min={ultimoDiaDelMes(liquidacion.mes)}
                  max={hoy}
                  aria-invalid={!!errors.fechaTransferencia}
                  aria-describedby={fieldErrorId('pago-liquidacion-fecha')}
                  {...register('fechaTransferencia')}
                />
              </Field>
              <Field
                label="Número de operación"
                htmlFor="pago-liquidacion-operacion"
                required
                error={errors.numeroOperacion?.message}
              >
                <Input
                  id="pago-liquidacion-operacion"
                  maxLength={MAX_OPERACION}
                  autoComplete="off"
                  aria-invalid={!!errors.numeroOperacion}
                  aria-describedby={fieldErrorId('pago-liquidacion-operacion')}
                  {...register('numeroOperacion')}
                />
              </Field>
            </div>

            <Controller
              control={control}
              name="comprobanteAdjuntoId"
              render={({ field }) => (
                <CampoComprobanteTransferencia
                  id="pago-liquidacion-comprobante"
                  onSubido={field.onChange}
                  onSubiendo={setSubiendoComprobante}
                  error={errors.comprobanteAdjuntoId?.message}
                />
              )}
            />

            <Field
              label="Observaciones"
              htmlFor="pago-liquidacion-observaciones"
              optional
              error={errors.observaciones?.message}
            >
              <Textarea
                id="pago-liquidacion-observaciones"
                rows={2}
                maxLength={MAX_OBSERVACIONES}
                aria-invalid={!!errors.observaciones}
                aria-describedby={cn(
                  fieldErrorId('pago-liquidacion-observaciones'),
                  'pago-liquidacion-observaciones-contador',
                )}
                {...register('observaciones')}
              />
              <p
                id="pago-liquidacion-observaciones-contador"
                className="text-muted-foreground text-right text-xs"
              >
                {(observaciones ?? '').length} / {MAX_OBSERVACIONES}
              </p>
            </Field>
          </form>
        </div>

        <DialogFooter>
          {vista === 'formulario' && (
            <>
              <Button type="button" variant="outline" onClick={cerrar}>
                Cancelar
              </Button>
              <Button type="submit" form={FORM_ID} disabled={subiendoComprobante}>
                {subiendoComprobante ? 'Subiendo comprobante…' : 'Continuar'}
              </Button>
            </>
          )}
          {vista === 'confirmar' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaso('formulario')}
                disabled={mutation.isPending}
              >
                Volver
              </Button>
              <Button
                type="button"
                variant="confirmado"
                onClick={registrar}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Registrando…' : 'Registrar pago'}
              </Button>
            </>
          )}
          {vista === 'conflicto' && (
            <Button type="button" variant="outline" onClick={cerrar}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
