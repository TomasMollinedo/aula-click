'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, fieldErrorId } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PanelBody, PanelFooter } from '@/components/ui/panel'
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
  ALUMNO_FORM_VACIO,
  type AlumnoFormValues,
  SIN_NIVEL,
  alumnoFormSchema,
  valoresFormACrear,
  valoresFormAEditar,
} from '../alumnos.schema'
import { NIVEL_ESCOLARIDAD_LABEL, type AlumnoCrear, type AlumnoEditar } from '../alumnos.types'
import { esMenorDeEdad, hoyLocal } from '../edad'
import { aplicarErroresApi, interpretarErroresApi } from '../errores-api'
import { AvisoMenorDeEdad } from './AvisoMenorDeEdad'

const CAMPOS_TUTOR = [
  'tutorNombre',
  'tutorApellido',
  'tutorDni',
  'tutorTelefono',
  'tutorEmail',
] as const satisfies readonly (keyof AlumnoFormValues)[]

type AlumnoFormProps = {
  onCancelar: () => void
  isPending: boolean
  error: ApiError | null
} & (
  | {
      modo: 'crear'
      defaultValues?: undefined
      onSubmit: (datos: AlumnoCrear) => void
    }
  | {
      modo: 'editar'
      defaultValues: AlumnoFormValues
      onSubmit: (datos: AlumnoEditar | null) => void
    }
)

// Cuerpo y pie del formulario: va dentro de un <Panel> (modal o página) que pone el encabezado.
export function AlumnoForm({
  modo,
  defaultValues,
  onSubmit,
  onCancelar,
  isPending,
  error,
}: AlumnoFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  const {
    register,
    handleSubmit,
    control,
    setError: setFieldError,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<AlumnoFormValues>({
    resolver: zodResolver(alumnoFormSchema),
    defaultValues: defaultValues ?? ALUMNO_FORM_VACIO,
  })

  // Qué marca el error de la API (sin efectos; el setError y el foco van en el efecto de abajo).
  // Se deriva del error, que la mutación vuelve a null al reenviar.
  const errorApi = useMemo(() => (error ? interpretarErroresApi(error) : null), [error])
  const camposConErrorApi = errorApi?.camposMarcados ?? []

  const [fechaNacimiento, ...datosTutor] = useWatch({
    control,
    name: ['fechaNacimiento', ...CAMPOS_TUTOR],
  })
  // Solo ayuda visual (aviso y asteriscos): no bloquea el envío; la regla la valida la API (T-28).
  const esMenor = esMenorDeEdad(fechaNacimiento ?? '', hoyLocal()) === true
  // Un mayor con datos de tutor los conserva (docs/dominio.md): se muestran como opcionales.
  // Con un error en un campo del tutor (por ejemplo, un 400 de la API) la sección se muestra siempre.
  const mostrarTutor =
    esMenor ||
    datosTutor.some((dato) => dato?.trim()) ||
    CAMPOS_TUTOR.some(
      (campo) => errors[campo] || camposConErrorApi.some((marcado) => marcado.campo === campo),
    )

  // Red de seguridad: un error de la API sobre un campo que no está en pantalla se repite arriba.
  // Hoy los únicos campos condicionales son los del tutor, que se muestran si tienen un error.
  const camposOcultos: readonly string[] = mostrarTutor ? [] : CAMPOS_TUTOR
  const erroresOcultos = camposConErrorApi.filter(({ campo }) => camposOcultos.includes(campo))
  const errorGeneral =
    errorApi?.errorGeneral ??
    (erroresOcultos.length > 0 ? erroresOcultos.map(({ mensaje }) => mensaje).join('. ') : null)

  const procesarEnvio = handleSubmit((valores) => {
    if (modo === 'crear') {
      onSubmit(valoresFormACrear(valores))
    } else {
      onSubmit(valoresFormAEditar(valores, dirtyFields))
    }
  })

  // Mostrar errores de la API en los campos (setError) y poner el foco en el primero. Corre después
  // del render en que la sección del tutor ya se muestra si el error marca alguno de sus campos.
  useEffect(() => {
    if (!error) return
    aplicarErroresApi(error, setFieldError, formRef)
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

        <Grilla>
          <CampoTexto
            label="Nombre"
            obligatorio
            placeholder="Ingresá el nombre"
            autoComplete="off"
            error={errors.nombre?.message}
            {...register('nombre')}
          />
          <CampoTexto
            label="Apellido"
            obligatorio
            placeholder="Ingresá el apellido"
            autoComplete="off"
            error={errors.apellido?.message}
            {...register('apellido')}
          />
          <CampoTexto
            label="DNI"
            obligatorio
            placeholder="Sin puntos"
            inputMode="numeric"
            error={errors.dni?.message}
            {...register('dni')}
          />
          <CampoTexto
            label="Fecha de nacimiento"
            obligatorio
            type="date"
            max={hoyLocal()}
            error={errors.fechaNacimiento?.message}
            {...register('fechaNacimiento')}
          />
          <CampoTexto
            label="Teléfono"
            obligatorio
            type="tel"
            placeholder="Código de área y número"
            error={errors.telefono?.message}
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
          <Field
            label="Nivel de escolaridad"
            htmlFor="alumno-nivelEscolaridad"
            optional
            error={errors.nivelEscolaridad?.message}
          >
            <Controller
              name="nivelEscolaridad"
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="alumno-nivelEscolaridad"
                    className="w-full"
                    aria-invalid={!!errors.nivelEscolaridad}
                    onBlur={field.onBlur}
                  >
                    <SelectValue placeholder="Seleccionar nivel" />
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
          </Field>
          <CampoTexto
            label="Grado o año"
            opcional
            placeholder="Por ejemplo, 3.er año"
            error={errors.grado?.message}
            {...register('grado')}
          />
          <CampoTexto
            label="Colegio / institución"
            opcional
            placeholder="Nombre de la institución"
            error={errors.institucionEducativa?.message}
            {...register('institucionEducativa')}
          />
        </Grilla>

        {esMenor && <AvisoMenorDeEdad modo={modo} />}

        {mostrarTutor && (
          <section className="space-y-4" aria-labelledby="alumno-tutor-titulo">
            <h3 id="alumno-tutor-titulo" className="text-lg font-semibold">
              Tutor o responsable
            </h3>
            <Grilla>
              <CampoTexto
                label="Nombre"
                obligatorio={esMenor}
                opcional={!esMenor}
                placeholder="Ingresá el nombre"
                autoComplete="off"
                error={errors.tutorNombre?.message}
                {...register('tutorNombre')}
              />
              <CampoTexto
                label="Apellido"
                obligatorio={esMenor}
                opcional={!esMenor}
                placeholder="Ingresá el apellido"
                autoComplete="off"
                error={errors.tutorApellido?.message}
                {...register('tutorApellido')}
              />
              <CampoTexto
                label="DNI"
                opcional
                placeholder="Sin puntos"
                inputMode="numeric"
                error={errors.tutorDni?.message}
                {...register('tutorDni')}
              />
              <CampoTexto
                label="Teléfono"
                obligatorio={esMenor}
                opcional={!esMenor}
                type="tel"
                placeholder="Código de área y número"
                error={errors.tutorTelefono?.message}
                {...register('tutorTelefono')}
              />
              <CampoTexto
                label="Email"
                obligatorio={esMenor}
                opcional={!esMenor}
                type="email"
                placeholder="nombre@correo.com"
                error={errors.tutorEmail?.message}
                {...register('tutorEmail')}
              />
            </Grilla>
          </section>
        )}

        <Field
          label="Observaciones"
          htmlFor="alumno-observaciones"
          optional
          error={errors.observaciones?.message}
        >
          <Textarea
            id="alumno-observaciones"
            rows={4}
            placeholder="Información relevante para las clases"
            aria-invalid={!!errors.observaciones}
            aria-describedby={fieldErrorId('alumno-observaciones')}
            {...register('observaciones')}
          />
        </Field>
      </PanelBody>

      <PanelFooter>
        <Button type="button" variant="cancelado" size="lg" onClick={onCancelar}>
          Cancelar
        </Button>
        {/* Sin cambios no hay nada que guardar: el botón queda deshabilitado (así lo muestra el diseño). */}
        <Button type="submit" variant="confirmado" size="lg" disabled={isPending || !isDirty}>
          {isPending ? 'Guardando…' : 'Guardar alumno'}
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
} & React.ComponentProps<'input'>

function CampoTexto({ label, obligatorio, opcional, error, ...inputProps }: CampoTextoProps) {
  const id = `alumno-${inputProps.name}`
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
