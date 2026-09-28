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
  onSubmit: (datos: MateriaCrear) => void
  onCancelar: () => void
  isPending: boolean
  error: ApiError | null
}

// Cuerpo y pie del formulario: va dentro de un <Panel> (modal o página) que pone el encabezado.
// En este sprint solo hay alta: la edición de materias no existe todavía en la API.
export function MateriaForm({ onSubmit, onCancelar, isPending, error }: MateriaFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<MateriaFormValues>({
    resolver: zodResolver(materiaFormSchema),
    defaultValues: MATERIA_FORM_VACIO,
  })

  const camposValidos = useMemo(() => new Set(MATERIA_FORM_FIELDS), [])
  const errorGeneral = useMemo(
    () => (error ? interpretarErroresApi(error, camposValidos).errorGeneral : null),
    [error, camposValidos],
  )

  const procesarEnvio = handleSubmit((valores) => {
    onSubmit(valoresFormACrear(valores))
  })

  // El 409 por nombre repetido se muestra sobre el campo `nombre`, igual que un 400.
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
