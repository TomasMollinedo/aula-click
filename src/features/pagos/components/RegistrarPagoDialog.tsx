'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { AlertCircle, CircleCheck, Info, Printer, Receipt } from 'lucide-react'

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
import { EmptyState } from '@/components/ui/empty-state'
import { Field, fieldErrorId } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { SolicitudRegistrarPago } from '@/types/pago'
import { cn } from '@/utils/cn'

import { resumenACobrar } from '../a-cobrar'
import { interpretarErrorPago } from '../errores-pagos'
import {
  textoConfirmacion,
  textoExito,
  textoNumeroComprobante,
  textoTotal,
  textoVuelto,
} from '../formato-pagos'
import { useRegistrarPago } from '../hooks/use-registrar-pago'
import {
  type PagoFormValues,
  armarRegistrarPago,
  pagoFormSchema,
  valoresInicialesPago,
} from '../pagos.schema'
import { hrefComprobante } from '../rutas-pagos'
import { ResumenACobrarTabla } from './ResumenACobrarTabla'
import { TurnosRechazados } from './TurnosRechazados'

const MAX_OBSERVACIONES = 500
const FORM_ID = 'registrar-pago-form'

type Paso = 'formulario' | 'confirmar'

/**
 * Registrar el pago en efectivo de una o varias ocurrencias de un alumno (HU-15). Un solo diálogo
 * por pasos: formulario → confirmar → éxito (o el rechazo de la API). Lo abren `AccionRegistrarPago`
 * (desde el detalle del turno) y `cuentas` (con `renderRegistrarPago`, compuesto en `app/`).
 *
 * - Los importes que muestra son los que mandó la API a quien lo abre; el cliente solo los suma
 *   para el resumen (`resumenACobrar`). Cantidad, total y vuelto del éxito salen de la respuesta.
 * - Queda abierto hasta que el usuario lo cierra, aunque la invalidación haga desaparecer lo que lo
 *   abrió: por eso quien lo abre guarda su copia de `ocurrencias` (ver `SolicitudRegistrarPago`).
 * - Mientras envía no se puede cerrar, y nunca se cierra con un clic afuera (hay un formulario).
 */
export function RegistrarPagoDialog({ alumnoId, ocurrencias, onCerrar }: SolicitudRegistrarPago) {
  const mutation = useRegistrarPago()
  const toast = useToast()
  const [paso, setPaso] = useState<Paso>('formulario')
  // `isPending` se actualiza después del próximo tick: un doble clic rápido llegaría a mandar dos
  // veces. El ref lo corta en el mismo evento.
  const enviando = useRef(false)
  const contenidoRef = useRef<HTMLDivElement>(null)

  const resumen = useMemo(() => resumenACobrar(ocurrencias), [ocurrencias])
  const form = useForm<PagoFormValues>({
    resolver: zodResolver(pagoFormSchema),
    // "Hoy" del navegador, solo como propuesta: qué es hoy para la regla lo decide la API.
    defaultValues: valoresInicialesPago(format(new Date(), 'yyyy-MM-dd')),
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
    () => (mutation.error ? interpretarErrorPago(mutation.error, ocurrencias) : null),
    [mutation.error, ocurrencias],
  )
  const pagoRegistrado = mutation.data ?? null
  const bloqueado = rechazo?.tipo === 'turnos' || rechazo?.tipo === 'yaPagado'
  const vista =
    ocurrencias.length === 0 ? 'vacio' : pagoRegistrado ? 'exito' : bloqueado ? 'rechazo' : paso

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

  // Un 400 por campo: el foco va al primero marcado, ya de vuelta en el formulario. Depende del
  // nombre del campo (un texto) y no de `rechazo`, para no robar el foco en cada render; cada envío
  // pasa por "confirmar", así que `vista` cambia y vuelve a correr.
  const primerCampoConError = rechazo?.tipo === 'campos' ? rechazo.campos[0].campo : null
  useEffect(() => {
    if (vista === 'formulario' && primerCampoConError) setFocus(primerCampoConError)
  }, [vista, primerCampoConError, setFocus])

  const continuar = handleSubmit(() => {
    mutation.reset()
    setPaso('confirmar')
  })

  const registrar = () => {
    if (enviando.current) return
    enviando.current = true
    mutation.mutate(armarRegistrarPago(alumnoId, ocurrencias, getValues()), {
      onSuccess: (pago) => toast.success(textoExito(pago)),
      onError: (error) => {
        const interpretado = interpretarErrorPago(error, ocurrencias)
        if (interpretado.tipo === 'campos') {
          for (const { campo, mensaje } of interpretado.campos) {
            setError(campo, { type: 'server', message: mensaje })
          }
        }
        setPaso('formulario')
      },
      onSettled: () => {
        enviando.current = false
      },
    })
  }

  const mensajeGeneral =
    rechazo?.tipo === 'general'
      ? rechazo.mensaje
      : rechazo?.tipo === 'campos'
        ? rechazo.mensaje
        : null

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent
        className="max-w-2xl"
        showCloseButton={!mutation.isPending}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>Pago en efectivo de los turnos del alumno.</DialogDescription>
        </DialogHeader>

        <div ref={contenidoRef} tabIndex={-1} className="space-y-5 outline-none">
          {vista === 'vacio' && (
            <EmptyState
              icon={Receipt}
              title="No hay turnos para cobrar"
              description="Cerrá y elegí los turnos de nuevo."
              className="py-8"
            />
          )}

          {vista === 'exito' && pagoRegistrado && (
            <div role="status" className="flex items-start gap-3">
              <CircleCheck className="text-confirmado mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="space-y-1">
                <p className="font-semibold">{textoExito(pagoRegistrado)}</p>
                <p className="text-muted-foreground text-sm">
                  {textoNumeroComprobante(pagoRegistrado.numeroComprobante)}
                </p>
                {textoVuelto(pagoRegistrado) && (
                  <p className="text-lg font-semibold">{textoVuelto(pagoRegistrado)}</p>
                )}
              </div>
            </div>
          )}

          {vista === 'rechazo' && rechazo?.tipo === 'turnos' && (
            <TurnosRechazados mensaje={rechazo.mensaje} turnos={rechazo.turnos} />
          )}
          {vista === 'rechazo' && rechazo?.tipo === 'yaPagado' && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-destructive">{rechazo.mensaje}</AlertDescription>
            </Alert>
          )}

          {vista === 'confirmar' && (
            <p className="text-base font-medium">{textoConfirmacion(resumen)}</p>
          )}

          {vista === 'formulario' && (
            <form id={FORM_ID} onSubmit={continuar} noValidate className="space-y-5">
              <section aria-label="Turnos a cobrar" className="space-y-2">
                <ResumenACobrarTabla ocurrencias={ocurrencias} />
                <p className="text-right text-base font-semibold">{textoTotal(resumen.total)}</p>
                {resumen.sinPrecio > 0 && (
                  <Alert>
                    <Info className="size-4" />
                    <AlertDescription>Hay turnos de materias sin precio cargado</AlertDescription>
                  </Alert>
                )}
              </section>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Forma de pago</p>
                  <p className="text-sm">Efectivo</p>
                </div>
                <Field
                  label="Fecha de pago"
                  htmlFor="pago-fechaPago"
                  required
                  error={errors.fechaPago?.message}
                >
                  <Input
                    id="pago-fechaPago"
                    type="date"
                    max={format(new Date(), 'yyyy-MM-dd')}
                    aria-invalid={!!errors.fechaPago}
                    aria-describedby={fieldErrorId('pago-fechaPago')}
                    {...register('fechaPago')}
                  />
                </Field>
              </div>

              <Field
                label="Monto recibido"
                htmlFor="pago-montoRecibido"
                optional
                error={errors.montoRecibido?.message}
              >
                <Input
                  id="pago-montoRecibido"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="Por ejemplo 35.000"
                  aria-invalid={!!errors.montoRecibido}
                  aria-describedby={cn(
                    fieldErrorId('pago-montoRecibido'),
                    'pago-montoRecibido-ayuda',
                  )}
                  {...register('montoRecibido')}
                />
                <p id="pago-montoRecibido-ayuda" className="text-muted-foreground text-xs">
                  Si lo cargás, te mostramos el vuelto
                </p>
              </Field>

              <Field
                label="Observaciones"
                htmlFor="pago-observaciones"
                optional
                error={errors.observaciones?.message}
              >
                <Textarea
                  id="pago-observaciones"
                  rows={2}
                  maxLength={MAX_OBSERVACIONES}
                  aria-invalid={!!errors.observaciones}
                  aria-describedby={cn(
                    fieldErrorId('pago-observaciones'),
                    'pago-observaciones-contador',
                  )}
                  {...register('observaciones')}
                />
                <p
                  id="pago-observaciones-contador"
                  className="text-muted-foreground text-right text-xs"
                >
                  {(observaciones ?? '').length} / {MAX_OBSERVACIONES}
                </p>
              </Field>

              {mensajeGeneral && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription className="text-destructive">{mensajeGeneral}</AlertDescription>
                </Alert>
              )}
            </form>
          )}
        </div>

        <DialogFooter>
          {vista === 'formulario' && (
            <>
              <Button type="button" variant="outline" onClick={cerrar}>
                Cancelar
              </Button>
              <Button type="submit" form={FORM_ID}>
                Continuar
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
          {vista === 'exito' && pagoRegistrado && (
            <>
              <Button type="button" variant="outline" onClick={cerrar}>
                Cerrar
              </Button>
              <Button asChild>
                <a
                  href={hrefComprobante(pagoRegistrado.pagoId)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Printer />
                  Imprimir comprobante
                  <span className="sr-only">(se abre en otra pestaña)</span>
                </a>
              </Button>
            </>
          )}
          {(vista === 'rechazo' || vista === 'vacio') && (
            <Button type="button" variant="outline" onClick={cerrar}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
