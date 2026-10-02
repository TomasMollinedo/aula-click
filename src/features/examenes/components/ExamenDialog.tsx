'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

import { interpretarErrorExamen } from '../errores-api'
import {
  type CampoExamenForm,
  type ExamenFormValues,
  OBSERVACIONES_MAX,
  TIPOS_EXAMEN,
  aBodyCrear,
  aBodyEditar,
  examenFormSchema,
  valoresIniciales,
} from '../examenes.schema'
import type { ExamenItem } from '../examenes.types'
import { esFechaPasada, resumenExamen } from '../formato-examenes'
import { useCrearExamen } from '../hooks/use-crear-examen'
import { useEditarExamen } from '../hooks/use-editar-examen'
import { useMateriasExamen } from '../hooks/use-materias-examen'

export type ExamenDialogProps = {
  alumnoId: number
  open: boolean
  /** El examen que se edita; sin él, el diálogo es el alta. */
  examen?: ExamenItem
  /** Cierra el diálogo (Cancelar, la X o después de guardar). */
  onCerrar: () => void
  /**
   * Pasa a editar el examen existente de un 409 `EXAMEN_PENDIENTE`. `null` si ese examen todavía no
   * está en la lista (se está volviendo a pedir): el botón espera.
   */
  editarExistente: (examenId: number) => (() => void) | null
}

/**
 * Alta y edición de un examen (HU-17): materia (las ofrecibles de `/examenes/materias`), fecha,
 * tipo y observaciones (contador de 500). No calcula reglas: si la API rechaza, el diálogo queda
 * abierto con el error.
 */
export function ExamenDialog({ open, onCerrar, examen, ...resto }: ExamenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onCerrar()}>
      {/* No se cierra con un clic afuera, para no perder lo cargado. */}
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        {/* Se monta al abrir y al cambiar de examen: el formulario y el error anterior no sobreviven. */}
        <FormularioExamen
          key={examen?.id ?? 'nuevo'}
          examen={examen}
          onCerrar={onCerrar}
          {...resto}
        />
      </DialogContent>
    </Dialog>
  )
}

function FormularioExamen({
  alumnoId,
  examen,
  onCerrar,
  editarExistente,
}: Omit<ExamenDialogProps, 'open'>) {
  const crear = useCrearExamen()
  const editar = useEditarExamen()
  const materias = useMateriasExamen(alumnoId)
  const toast = useToast()

  const guardando = crear.isPending || editar.isPending
  const errorApi = crear.error ?? editar.error

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ExamenFormValues>({
    resolver: zodResolver(examenFormSchema),
    // El tipo arranca sin elegir: el schema exige que lo elijan.
    defaultValues: valoresIniciales(examen) as ExamenFormValues,
  })

  const fecha = useWatch({ control, name: 'fecha' }) ?? ''
  const observacionesLargo = useWatch({ control, name: 'observaciones' })?.length ?? 0

  // La materia del examen que se edita puede no ser ofrecible (el alumno ya no tiene turnos
  // próximos en ella, o se dio de baja): se muestra igual. Cambiarla o no lo valida la API.
  const opcionesMateria = useMemo(() => {
    const ofrecibles = materias.data ?? []
    if (!examen || ofrecibles.some((m) => m.id === examen.materia.id)) return ofrecibles
    return [examen.materia, ...ofrecibles]
  }, [materias.data, examen])

  const error = useMemo(() => (errorApi ? interpretarErrorExamen(errorApi) : null), [errorApi])
  const errorCampo = (campo: CampoExamenForm) =>
    errors[campo]?.message ??
    (error?.tipo === 'campos'
      ? error.camposMarcados.find((c) => c.campo === campo)?.mensaje
      : undefined)
  const errorGeneral = error?.tipo === 'pendiente' ? null : (error?.mensaje ?? null)
  // Sin ninguna materia ofrecible (ni la propia, en la edición) no hay nada que elegir.
  const sinMaterias = materias.isSuccess && opcionesMateria.length === 0
  const irAlExistente = error?.tipo === 'pendiente' ? editarExistente(error.existente.id) : null

  // Ayuda visual con el "hoy" del navegador: la API acepta una fecha pasada y lo avisa igual.
  const fechaPasada = esFechaPasada(fecha, format(new Date(), 'yyyy-MM-dd'))

  const guardar = handleSubmit((valores) => {
    if (!examen) {
      crear.mutate(aBodyCrear(alumnoId, valores), {
        onSuccess: (creado) => {
          toast.success(`Se cargó el examen de ${creado.materia.nombre}`)
          onCerrar()
        },
      })
      return
    }

    const cambios = aBodyEditar(examen, valores)
    if (!cambios) {
      onCerrar()
      return
    }
    editar.mutate(
      { id: examen.id, datos: cambios },
      {
        onSuccess: (editado) => {
          toast.success(`Se guardó el examen de ${editado.materia.nombre}`)
          onCerrar()
        },
      },
    )
  })

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{examen ? 'Editar examen' : 'Nuevo examen'}</DialogTitle>
        <DialogDescription>
          La prioridad de los turnos del alumno en esa materia se actualiza sola.
        </DialogDescription>
      </DialogHeader>

      {materias.isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">
            <p>No se pudieron cargar las materias: {materias.error.message}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void materias.refetch()}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {sinMaterias ? (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>El alumno no tiene turnos próximos</AlertDescription>
        </Alert>
      ) : (
        <Field label="Materia" htmlFor="materiaId" required error={errorCampo('materiaId')}>
          <Controller
            control={control}
            name="materiaId"
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onValueChange={field.onChange}
                disabled={materias.isLoading}
              >
                <SelectTrigger
                  id="materiaId"
                  ref={field.ref}
                  className="w-full"
                  aria-invalid={errorCampo('materiaId') ? true : undefined}
                  aria-describedby={errorCampo('materiaId') ? fieldErrorId('materiaId') : undefined}
                >
                  <SelectValue
                    placeholder={materias.isLoading ? 'Cargando materias…' : 'Elegí una materia'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {opcionesMateria.map((materia) => (
                    <SelectItem key={materia.id} value={String(materia.id)}>
                      {materia.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha" htmlFor="fecha" required error={errorCampo('fecha')}>
          <Input
            id="fecha"
            type="date"
            aria-invalid={errorCampo('fecha') ? true : undefined}
            aria-describedby={errorCampo('fecha') ? fieldErrorId('fecha') : undefined}
            {...register('fecha')}
          />
        </Field>

        <Field label="Tipo" htmlFor="tipo" required error={errorCampo('tipo')}>
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger
                  id="tipo"
                  ref={field.ref}
                  className="w-full"
                  aria-invalid={errorCampo('tipo') ? true : undefined}
                  aria-describedby={errorCampo('tipo') ? fieldErrorId('tipo') : undefined}
                >
                  <SelectValue placeholder="Elegí un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_EXAMEN.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      {fechaPasada && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            La fecha ya pasó: el examen se va a guardar como ya rendido.
          </AlertDescription>
        </Alert>
      )}

      <Field
        label="Observaciones"
        htmlFor="observaciones"
        optional
        error={errorCampo('observaciones')}
      >
        <Textarea
          id="observaciones"
          rows={3}
          maxLength={OBSERVACIONES_MAX}
          placeholder="Temas, material permitido…"
          aria-invalid={errorCampo('observaciones') ? true : undefined}
          aria-describedby={errorCampo('observaciones') ? fieldErrorId('observaciones') : undefined}
          {...register('observaciones')}
        />
        <p className="text-muted-foreground text-right text-xs">
          {observacionesLargo}/{OBSERVACIONES_MAX}
        </p>
      </Field>

      {error?.tipo === 'pendiente' && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">
            <p>
              Ya hay un examen pendiente de esa materia:{' '}
              <span className="font-medium">{resumenExamen(error.existente)}</span>. Podés editarlo
              en lugar de cargar uno nuevo.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={!irAlExistente}
              onClick={() => irAlExistente?.()}
            >
              Editar ese examen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {errorGeneral && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">{errorGeneral}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" variant="confirmado" disabled={guardando || sinMaterias}>
          {guardando ? 'Guardando…' : examen ? 'Guardar cambios' : 'Cargar examen'}
        </Button>
      </DialogFooter>
    </form>
  )
}
