'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, fieldErrorId } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PanelBody, PanelFooter } from '@/components/ui/panel'
import { useToast } from '@/hooks/use-toast'
import type { ApiError } from '@/utils/fetch-json'

import { aplicarErroresApi, interpretarErroresApi } from '../errores-api'
import { useQuitarFotoProfesor } from '../hooks/use-quitar-foto-profesor'
import { useSubirFotoProfesor } from '../hooks/use-subir-foto-profesor'
import {
  PROFESOR_CREAR_FORM_FIELDS,
  PROFESOR_CREAR_FORM_VACIO,
  PROFESOR_FORM_FIELDS,
  type ProfesorCrearFormValues,
  type ProfesorFormValues,
  profesorCrearFormSchema,
  profesorFormSchema,
  valoresFormACrear,
  valoresFormAEditar,
} from '../profesores.schema'
import type { ProfesorCrear, ProfesorEditar } from '../profesores.types'
import { type CambioFotoPendiente, FotoProfesorCampo } from './FotoProfesorCampo'

type ProfesorFormProps =
  | {
      modo: 'crear'
      onCancelar: () => void
      isPending: boolean
      error: ApiError | null
      /** `foto` es el archivo elegido en el formulario (todavía no subido) o null. */
      onSubmit: (datos: ProfesorCrear, foto: File | null) => void
    }
  | {
      modo: 'editar'
      onCancelar: () => void
      isPending: boolean
      error: ApiError | null
      profesorId: number
      fotoUrl: string | null
      defaultValues: ProfesorFormValues
      onSubmit: (datos: ProfesorEditar | null) => void
    }

// Cuerpo y pie del formulario: va dentro de un <Panel> (modal o página) que pone el encabezado. El
// alta y la edición tienen forma distinta (la contraseña solo existe en el alta), así que cada una
// es su propio componente con su propio useForm; ProfesorForm solo elige cuál montar.
export function ProfesorForm(props: ProfesorFormProps) {
  if (props.modo === 'crear') return <ProfesorFormCrear {...props} />
  return <ProfesorFormEditar {...props} />
}

function ProfesorFormCrear({
  onSubmit,
  onCancelar,
  isPending,
  error,
}: Extract<ProfesorFormProps, { modo: 'crear' }>) {
  const formRef = useRef<HTMLFormElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<ProfesorCrearFormValues>({
    resolver: zodResolver(profesorCrearFormSchema),
    defaultValues: PROFESOR_CREAR_FORM_VACIO,
  })

  const camposValidos = useMemo(() => new Set(PROFESOR_CREAR_FORM_FIELDS), [])
  const errorGeneral = useMemo(
    () => (error ? interpretarErroresApi(error, camposValidos).errorGeneral : null),
    [error, camposValidos],
  )

  const procesarEnvio = handleSubmit((valores) => {
    onSubmit(valoresFormACrear(valores), archivo)
  })

  // Mostrar errores de la API en los campos (setError) y poner el foco en el primero.
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
      <PanelBody className="@container space-y-6">
        {errorGeneral && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">{errorGeneral}</AlertDescription>
          </Alert>
        )}

        <FotoProfesorCampo modo="crear" archivo={archivo} onArchivoChange={setArchivo} />

        <Grilla>
          <CampoTexto
            label="Nombre"
            obligatorio
            placeholder="Ingresá el nombre"
            autoComplete="off"
            error={errors.nombre?.message}
            caracteres="nombre"
            {...register('nombre')}
          />
          <CampoTexto
            label="Apellido"
            obligatorio
            placeholder="Ingresá el apellido"
            autoComplete="off"
            error={errors.apellido?.message}
            caracteres="nombre"
            {...register('apellido')}
          />
          <CampoTexto
            label="DNI"
            obligatorio
            placeholder="Sin puntos"
            inputMode="numeric"
            error={errors.dni?.message}
            caracteres="dni"
            {...register('dni')}
          />
          <CampoTexto
            label="Teléfono"
            obligatorio
            type="tel"
            placeholder="Código de área y número"
            error={errors.telefono?.message}
            caracteres="telefono"
            {...register('telefono')}
          />
          <CampoTexto
            label="Email"
            obligatorio
            type="email"
            placeholder="nombre@correo.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <CampoTexto
            label="Título"
            obligatorio
            placeholder="Por ejemplo, Profesor en Matemática"
            error={errors.titulo?.message}
            {...register('titulo')}
          />
          <CampoTexto
            label="Matrícula"
            obligatorio
            placeholder="Matrícula profesional"
            error={errors.matricula?.message}
            {...register('matricula')}
          />
          <CampoTexto
            label="Capacidad"
            obligatorio
            type="number"
            min={1}
            step={1}
            placeholder="Alumnos por hora"
            error={errors.capacidad?.message}
            {...register('capacidad')}
          />
        </Grilla>

        <section className="space-y-4" aria-labelledby="profesor-cuenta-titulo">
          <h3 id="profesor-cuenta-titulo" className="text-lg font-semibold">
            Cuenta de acceso
          </h3>
          <Grilla>
            <CampoTexto
              label="Contraseña inicial"
              obligatorio
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <CampoTexto
              label="Confirmar contraseña"
              obligatorio
              type="password"
              autoComplete="new-password"
              error={errors.confirmarPassword?.message}
              {...register('confirmarPassword')}
            />
          </Grilla>
        </section>
      </PanelBody>

      <PanelFooter>
        <Button type="button" variant="cancelado" size="lg" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" variant="confirmado" size="lg" disabled={isPending}>
          {isPending ? 'Guardando…' : 'Guardar profesor'}
        </Button>
      </PanelFooter>
    </form>
  )
}

function ProfesorFormEditar({
  profesorId,
  fotoUrl,
  defaultValues,
  onSubmit,
  onCancelar,
  isPending,
  error,
}: Extract<ProfesorFormProps, { modo: 'editar' }>) {
  const formRef = useRef<HTMLFormElement>(null)
  const toast = useToast()

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<ProfesorFormValues>({
    resolver: zodResolver(profesorFormSchema),
    defaultValues,
  })

  // Foto: se elige o se marca "quitar" acá, pero se sube o se quita recién al guardar el
  // formulario (un solo botón, "Guardar profesor"), junto con los demás campos.
  const [cambioFoto, setCambioFoto] = useState<CambioFotoPendiente | null>(null)
  const subirFoto = useSubirFotoProfesor(profesorId)
  const quitarFoto = useQuitarFotoProfesor(profesorId)
  const fotoPending = subirFoto.isPending || quitarFoto.isPending

  const camposValidos = useMemo(() => new Set(PROFESOR_FORM_FIELDS), [])
  const errorGeneral = useMemo(
    () => (error ? interpretarErroresApi(error, camposValidos).errorGeneral : null),
    [error, camposValidos],
  )

  const procesarEnvio = handleSubmit(async (valores) => {
    if (cambioFoto) {
      try {
        if (cambioFoto.tipo === 'archivo') {
          await subirFoto.mutateAsync(cambioFoto.archivo)
          toast.success('Se actualizó la foto')
        } else {
          await quitarFoto.mutateAsync()
          toast.success('Se quitó la foto')
        }
        setCambioFoto(null)
      } catch (errorFoto) {
        toast.error(errorFoto instanceof Error ? errorFoto.message : 'No se pudo guardar la foto')
        return
      }
    }
    onSubmit(valoresFormAEditar(valores, dirtyFields))
  })

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
      <PanelBody className="@container space-y-6">
        {errorGeneral && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">{errorGeneral}</AlertDescription>
          </Alert>
        )}

        <FotoProfesorCampo
          modo="editar"
          fotoUrl={fotoUrl}
          cambio={cambioFoto}
          onCambioChange={setCambioFoto}
          disabled={isPending || fotoPending}
        />

        <Grilla>
          <CampoTexto
            label="Nombre"
            obligatorio
            placeholder="Ingresá el nombre"
            autoComplete="off"
            error={errors.nombre?.message}
            caracteres="nombre"
            {...register('nombre')}
          />
          <CampoTexto
            label="Apellido"
            obligatorio
            placeholder="Ingresá el apellido"
            autoComplete="off"
            error={errors.apellido?.message}
            caracteres="nombre"
            {...register('apellido')}
          />
          <CampoTexto
            label="DNI"
            obligatorio
            placeholder="Sin puntos"
            inputMode="numeric"
            error={errors.dni?.message}
            caracteres="dni"
            {...register('dni')}
          />
          <CampoTexto
            label="Teléfono"
            obligatorio
            type="tel"
            placeholder="Código de área y número"
            error={errors.telefono?.message}
            caracteres="telefono"
            {...register('telefono')}
          />
          <CampoTexto
            label="Email"
            obligatorio
            type="email"
            placeholder="nombre@correo.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <CampoTexto
            label="Título"
            obligatorio
            placeholder="Por ejemplo, Profesor en Matemática"
            error={errors.titulo?.message}
            {...register('titulo')}
          />
          <CampoTexto
            label="Matrícula"
            obligatorio
            placeholder="Matrícula profesional"
            error={errors.matricula?.message}
            {...register('matricula')}
          />
          <CampoTexto
            label="Capacidad"
            obligatorio
            type="number"
            min={1}
            step={1}
            placeholder="Alumnos por hora"
            error={errors.capacidad?.message}
            {...register('capacidad')}
          />
        </Grilla>
      </PanelBody>

      <PanelFooter>
        <Button type="button" variant="cancelado" size="lg" onClick={onCancelar}>
          Cancelar
        </Button>
        {/* Sin cambios no hay nada que guardar: el botón queda deshabilitado (así lo muestra el diseño). */}
        <Button
          type="submit"
          variant="confirmado"
          size="lg"
          disabled={isPending || fotoPending || (!isDirty && !cambioFoto)}
        >
          {isPending || fotoPending ? 'Guardando…' : 'Guardar profesor'}
        </Button>
      </PanelFooter>
    </form>
  )
}

// Dos columnas en el modal y tres cuando el panel es ancho (página): mismo orden de campos.
function Grilla({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-5 gap-y-4 @xl:grid-cols-2 @4xl:grid-cols-3">{children}</div>
}

type CampoTextoProps = {
  label: string
  name: string
  obligatorio?: boolean
  opcional?: boolean
  error?: string
} & React.ComponentProps<typeof Input>

function CampoTexto({ label, obligatorio, opcional, error, ...inputProps }: CampoTextoProps) {
  const id = `profesor-${inputProps.name}`
  return (
    <Field label={label} htmlFor={id} required={obligatorio} optional={opcional} error={error}>
      <Input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? fieldErrorId(id) : undefined}
        {...inputProps}
      />
    </Field>
  )
}
