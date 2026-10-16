'use client'

import { Controller, type UseFormReturn, useWatch } from 'react-hook-form'
import { Info } from 'lucide-react'

import { Field, fieldErrorId } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/utils/cn'

import { textoFormaPago, textoRedDebito } from '../formato-pagos'
import {
  CAMPOS_DEL_MEDIO,
  FORMAS_PAGO,
  type PagoFormValues,
  REDES_DEBITO,
  valoresInicialesPago,
} from '../pagos.schema'
import { CampoComprobantePago } from './CampoComprobantePago'

type Form = UseFormReturn<PagoFormValues>

/** Los campos de cada medio vacíos, como al abrir el diálogo. */
const MEDIO_VACIO = valoresInicialesPago('')

/** El `aria-describedby` de un control: su error y, si hay, su ayuda. */
function describedBy(campo: string, ayuda?: string) {
  return cn(fieldErrorId(campo), ayuda)
}

/**
 * "Forma de pago" (HU-23): obligatoria y **sin opción elegida al abrir**. Al cambiar de medio, los
 * campos del anterior se vacían (con sus errores): un pago, un medio.
 */
export function SelectorFormaPago({ form }: { form: Form }) {
  const {
    control,
    setValue,
    clearErrors,
    formState: { errors },
  } = form

  return (
    <Field
      label="Forma de pago"
      htmlFor="pago-formaPago"
      required
      error={errors.formaPago?.message}
    >
      <Controller
        control={control}
        name="formaPago"
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={(valor) => {
              if (valor === field.value) return
              for (const campo of CAMPOS_DEL_MEDIO) setValue(campo, MEDIO_VACIO[campo])
              clearErrors([...CAMPOS_DEL_MEDIO, 'formaPago'])
              field.onChange(valor)
            }}
          >
            <SelectTrigger
              id="pago-formaPago"
              ref={field.ref}
              className="w-full"
              aria-invalid={errors.formaPago ? true : undefined}
              aria-describedby={describedBy('pago-formaPago')}
            >
              <SelectValue placeholder="Elegí la forma de pago" />
            </SelectTrigger>
            <SelectContent>
              {FORMAS_PAGO.map((forma) => (
                <SelectItem key={forma} value={forma}>
                  {textoFormaPago(forma)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  )
}

/**
 * Los campos del medio elegido, y solo esos (HU-23):
 * - Efectivo: el monto recibido (con él la API calcula el vuelto).
 * - Transferencia: operación, banco o billetera, titular (opcional) y el comprobante, obligatorio.
 * - Débito: red, cupón, últimos 4 (opcional; nunca el número completo) y el comprobante, opcional.
 *
 * El comprobante se sube al elegirlo (`CampoComprobantePago`); mientras sube, `onSubiendo` avisa
 * para que el diálogo no deje continuar.
 */
export function CamposDelMedio({
  form,
  onSubiendo,
}: {
  form: Form
  onSubiendo: (subiendo: boolean) => void
}) {
  const {
    control,
    register,
    formState: { errors },
  } = form
  const formaPago = useWatch({ control, name: 'formaPago' })

  const comprobante = (obligatorio: boolean) => (
    <Controller
      control={control}
      name="comprobanteAdjuntoId"
      render={({ field }) => (
        <CampoComprobantePago
          id="pago-comprobante"
          obligatorio={obligatorio}
          onSubido={field.onChange}
          onSubiendo={onSubiendo}
          error={errors.comprobanteAdjuntoId?.message}
        />
      )}
    />
  )

  if (formaPago === 'EFECTIVO') {
    return (
      <Field
        label="Monto recibido"
        htmlFor="pago-montoRecibido"
        required
        error={errors.montoRecibido?.message}
      >
        <Input
          id="pago-montoRecibido"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Por ejemplo 35.000"
          aria-invalid={!!errors.montoRecibido}
          aria-describedby={describedBy('pago-montoRecibido', 'pago-montoRecibido-ayuda')}
          {...register('montoRecibido')}
        />
        <p id="pago-montoRecibido-ayuda" className="text-muted-foreground text-xs">
          Lo que entrega el alumno: con eso calculamos el vuelto
        </p>
      </Field>
    )
  }

  if (formaPago === 'TRANSFERENCIA') {
    return (
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Número de operación"
            htmlFor="pago-transferenciaOperacion"
            required
            error={errors.transferenciaOperacion?.message}
          >
            <Input
              id="pago-transferenciaOperacion"
              autoComplete="off"
              maxLength={50}
              aria-invalid={!!errors.transferenciaOperacion}
              aria-describedby={describedBy('pago-transferenciaOperacion')}
              {...register('transferenciaOperacion')}
            />
          </Field>
          <Field
            label="Banco o billetera"
            htmlFor="pago-transferenciaBanco"
            required
            error={errors.transferenciaBanco?.message}
          >
            <Input
              id="pago-transferenciaBanco"
              autoComplete="off"
              maxLength={100}
              placeholder="Por ejemplo Banco Macro o Mercado Pago"
              aria-invalid={!!errors.transferenciaBanco}
              aria-describedby={describedBy('pago-transferenciaBanco')}
              {...register('transferenciaBanco')}
            />
          </Field>
        </div>
        <Field
          label="Titular de la cuenta"
          htmlFor="pago-transferenciaTitular"
          optional
          error={errors.transferenciaTitular?.message}
        >
          <Input
            id="pago-transferenciaTitular"
            autoComplete="off"
            maxLength={100}
            aria-invalid={!!errors.transferenciaTitular}
            aria-describedby={describedBy('pago-transferenciaTitular')}
            {...register('transferenciaTitular')}
          />
        </Field>
        {comprobante(true)}
        <p className="bg-canvas flex items-start gap-2 rounded-lg px-3 py-2 text-sm">
          <Info className="text-cobalto mt-0.5 size-4 shrink-0" aria-hidden />
          ¿Una transferencia que cubre a varios hermanos? Registrá un pago por cada uno, con los
          mismos datos de la transferencia, y subí el mismo comprobante en cada pago.
        </p>
      </div>
    )
  }

  if (formaPago === 'DEBITO') {
    return (
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Red" htmlFor="pago-debitoRed" required error={errors.debitoRed?.message}>
            <Controller
              control={control}
              name="debitoRed"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="pago-debitoRed"
                    ref={field.ref}
                    className="w-full"
                    aria-invalid={errors.debitoRed ? true : undefined}
                    aria-describedby={describedBy('pago-debitoRed')}
                  >
                    <SelectValue placeholder="Elegí la red" />
                  </SelectTrigger>
                  <SelectContent>
                    {REDES_DEBITO.map((red) => (
                      <SelectItem key={red} value={red}>
                        {textoRedDebito(red)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label="Número de cupón"
            htmlFor="pago-debitoCupon"
            required
            error={errors.debitoCupon?.message}
          >
            <Input
              id="pago-debitoCupon"
              inputMode="numeric"
              autoComplete="off"
              maxLength={20}
              aria-invalid={!!errors.debitoCupon}
              aria-describedby={describedBy('pago-debitoCupon')}
              {...register('debitoCupon')}
            />
          </Field>
          <Field
            label="Últimos 4 dígitos"
            htmlFor="pago-debitoUltimos4"
            optional
            error={errors.debitoUltimos4?.message}
          >
            <Input
              id="pago-debitoUltimos4"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="1234"
              aria-invalid={!!errors.debitoUltimos4}
              aria-describedby={describedBy('pago-debitoUltimos4', 'pago-debitoUltimos4-ayuda')}
              {...register('debitoUltimos4')}
            />
            <p id="pago-debitoUltimos4-ayuda" className="text-muted-foreground text-xs">
              Nunca el número completo de la tarjeta
            </p>
          </Field>
        </div>
        {comprobante(false)}
      </div>
    )
  }

  // Sin forma de pago elegida: todavía no hay campos del medio.
  return null
}
