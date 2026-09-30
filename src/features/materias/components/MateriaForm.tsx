'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, fieldErrorId } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PanelBody, PanelFooter } from '@/components/ui/panel'
import { Textarea } from '@/components/ui/textarea'
import type { ApiError } from '@/utils/fetch-json'

import { aplicarErroresApi, interpretarErroresApi } from '../errores-api'
import {
  MATERIA_FORM_FIELDS,
  MATERIA_FORM_VACIO,
  type MateriaFormValues,
  materiaFormSchema,
  valoresFormACrear,
} from '../materias.schema'
import type { MateriaCrear } from '../materias.types'

type MateriaFormProps = {
  /** Valores iniciales: vacío en el alta; los de la materia en la edición. */
  defaultValues?: MateriaFormValues
  /** Alta y edición mandan el mismo body (el PATCH recibe los tres campos). */
  onSubmit: (datos: MateriaCrear) => void
  onCancelar: () => void
  isPending: boolean
  error: ApiError | null
}

// Cuerpo y pie del formulario de alta y edición: va dentro de un <Panel> (modal o página) que pone
// el encabezado.
export function MateriaForm({
  defaultValues = MATERIA_FORM_VACIO,
  onSubmit,
  onCancelar,
  isPending,
  error,
}: MateriaFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<MateriaFormValues>({
    resolver: zodResolver(materiaFormSchema),
    defaultValues,
  })

  const camposValidos = useMemo(() => new Set(MATERIA_FORM_FIELDS), [])
  const errorGeneral = useMemo(
    () => (error ? interpretarErroresApi(error, camposValidos).errorGeneral : null),
    [error, camposValidos],
  )

  const procesarEnvio = handleSubmit((valores) => {
    onSubmit(valoresFormACrear(valores))
  })

  // Los 400 (por ejemplo, el precio) y el 409 por nombre repetido se muestran sobre su campo.
  useEffect(() => {
    if (!error) return
    aplicarErroresApi(error, setFieldError, camposValidos, formRef)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- camposValidos es estable (useMemo)
  }, [error, setFieldError])

  return (
    <form
      ref={formRef}
      onSubmit={procesarEnvio}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
    >
      <PanelBody className="space-y-6">
        {errorGeneral && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">{errorGeneral}</AlertDescription>
          </Alert>
        )}

        <Field label="Nombre" htmlFor="nombre" required error={errors.nombre?.message}>
          <Input
            id="nombre"
            placeholder="Ingresá el nombre de la materia"
            autoComplete="off"
            aria-invalid={errors.nombre ? true : undefined}
            aria-describedby={errors.nombre ? fieldErrorId('nombre') : undefined}
            {...register('nombre')}
          />
        </Field>

        <Field
          label="Precio por hora de clase (en pesos)"
          htmlFor="precioHora"
          required
          error={errors.precioHora?.message}
        >
          {/* Texto y no type="number": acepta coma o punto decimal y no cambia el valor con la
              rueda del mouse. El teclado del celular es el numérico con separador. */}
          <Input
            id="precioHora"
            inputMode="decimal"
            placeholder="Por ejemplo, 7500,50"
            autoComplete="off"
            aria-invalid={errors.precioHora ? true : undefined}
            aria-describedby={errors.precioHora ? fieldErrorId('precioHora') : undefined}
            {...register('precioHora')}
          />
        </Field>

        <Field
          label="Descripción"
          htmlFor="descripcion"
          optional
          error={errors.descripcion?.message}
        >
          <Textarea
            id="descripcion"
            rows={4}
            placeholder="Para qué es la materia, a qué nivel apunta…"
            aria-invalid={errors.descripcion ? true : undefined}
            aria-describedby={errors.descripcion ? fieldErrorId('descripcion') : undefined}
            {...register('descripcion')}
          />
        </Field>
      </PanelBody>

      <PanelFooter>
        <Button type="button" variant="cancelado" size="lg" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" variant="confirmado" size="lg" disabled={isPending}>
          {isPending ? 'Guardando…' : 'Guardar materia'}
        </Button>
      </PanelFooter>
    </form>
  )
}
