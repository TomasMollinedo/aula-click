'use client'

import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ApiError } from '@/utils/fetch-json'

import {
  type AlumnoFormValues,
  SIN_NIVEL,
  alumnoFormSchema,
  valoresFormACrear,
  valoresFormAEditar,
} from '../alumnos.schema'
import { NIVEL_ESCOLARIDAD_LABEL, type AlumnoCrear, type AlumnoEditar } from '../alumnos.types'
import { aplicarErroresApi } from '../errores-api'

type AlumnoFormProps =
  | {
      modo: 'crear'
      defaultValues?: undefined
      onSubmit: (datos: AlumnoCrear) => void
      isPending: boolean
      error: ApiError | null
    }
  | {
      modo: 'editar'
      defaultValues: AlumnoFormValues
      onSubmit: (datos: AlumnoEditar | null) => void
      isPending: boolean
      error: ApiError | null
    }

export function AlumnoForm({ modo, defaultValues, onSubmit, isPending, error }: AlumnoFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setError: setFieldError,
    formState: { errors, dirtyFields },
  } = useForm<AlumnoFormValues>({
    resolver: zodResolver(alumnoFormSchema),
    defaultValues: defaultValues ?? {
      nombre: '',
      apellido: '',
      dni: '',
      fechaNacimiento: '',
      email: '',
      telefono: '',
      nivelEscolaridad: SIN_NIVEL,
      grado: '',
      institucionEducativa: '',
      observaciones: '',
      tutorNombre: '',
      tutorApellido: '',
      tutorDni: '',
      tutorTelefono: '',
      tutorEmail: '',
    },
  })

  const procesarEnvio = handleSubmit((valores) => {
    setErrorGeneral(null)
    if (modo === 'crear') {
      onSubmit(valoresFormACrear(valores))
    } else {
      const cambios = valoresFormAEditar(valores, dirtyFields)
      onSubmit(cambios)
    }
  })

  // Mostrar errores de la API en los campos correspondientes.
  useEffect(() => {
    if (!error) return
    const resultado = aplicarErroresApi(error, setFieldError, formRef)
    if (resultado.errorGeneral) {
      setErrorGeneral(resultado.errorGeneral)
    }
  }, [error, setFieldError])

  return (
    <form ref={formRef} onSubmit={procesarEnvio} className="space-y-8" noValidate>
      {errorGeneral && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{errorGeneral}</AlertDescription>
        </Alert>
      )}

      {/* Identificatorios */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Datos identificatorios</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            label="Nombre"
            obligatorio
            error={errors.nombre?.message}
            {...register('nombre')}
          />
          <CampoTexto
            label="Apellido"
            obligatorio
            error={errors.apellido?.message}
            {...register('apellido')}
          />
          <CampoTexto
            label="DNI"
            obligatorio
            placeholder="30.123.456"
            error={errors.dni?.message}
            {...register('dni')}
          />
          <CampoTexto
            label="Fecha de nacimiento"
            obligatorio
            type="date"
            error={errors.fechaNacimiento?.message}
            {...register('fechaNacimiento')}
          />
        </div>
      </fieldset>

      {/* Contacto */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Contacto</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            label="Email"
            obligatorio
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <CampoTexto
            label="Teléfono"
            obligatorio
            placeholder="(387) 15-412-3456"
            error={errors.telefono?.message}
            {...register('telefono')}
          />
        </div>
      </fieldset>

      {/* Tutor */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Tutor</legend>
        <p className="text-muted-foreground text-sm">
          Obligatorio si el alumno es menor de 18 años
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            label="Nombre del tutor"
            error={errors.tutorNombre?.message}
            {...register('tutorNombre')}
          />
          <CampoTexto
            label="Apellido del tutor"
            error={errors.tutorApellido?.message}
            {...register('tutorApellido')}
          />
          <CampoTexto
            label="DNI del tutor"
            placeholder="20.111.222"
            error={errors.tutorDni?.message}
            {...register('tutorDni')}
          />
          <CampoTexto
            label="Teléfono del tutor"
            placeholder="(387) 15-433-9876"
            error={errors.tutorTelefono?.message}
            {...register('tutorTelefono')}
          />
          <CampoTexto
            label="Email del tutor"
            type="email"
            error={errors.tutorEmail?.message}
            {...register('tutorEmail')}
          />
        </div>
      </fieldset>

      {/* Escolares */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Datos escolares</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nivel de escolaridad</Label>
            <Controller
              name="nivelEscolaridad"
              control={control}
              render={({ field }) => (
                <Select value={field.value || SIN_NIVEL} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin especificar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_NIVEL}>Sin especificar</SelectItem>
                    {Object.entries(NIVEL_ESCOLARIDAD_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.nivelEscolaridad && (
              <p className="text-destructive text-sm">{errors.nivelEscolaridad.message}</p>
            )}
          </div>
          <CampoTexto
            label="Grado o año"
            placeholder="5° año"
            error={errors.grado?.message}
            {...register('grado')}
          />
          <div className="sm:col-span-2">
            <CampoTexto
              label="Institución educativa"
              error={errors.institucionEducativa?.message}
              {...register('institucionEducativa')}
            />
          </div>
        </div>
      </fieldset>

      {/* Observaciones */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Observaciones</legend>
        <div className="space-y-2">
          <Textarea {...register('observaciones')} rows={4} aria-invalid={!!errors.observaciones} />
          {errors.observaciones && (
            <p className="text-destructive text-sm">{errors.observaciones.message}</p>
          )}
        </div>
      </fieldset>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Guardando…' : modo === 'crear' ? 'Crear alumno' : 'Guardar cambios'}
      </Button>
    </form>
  )
}

type CampoTextoProps = {
  label: string
  obligatorio?: boolean
  error?: string
} & React.ComponentProps<'input'>

function CampoTexto({ label, obligatorio, error, ...inputProps }: CampoTextoProps) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {obligatorio && <span className="text-destructive"> *</span>}
      </Label>
      <Input {...inputProps} aria-invalid={!!error} />
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
