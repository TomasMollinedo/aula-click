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
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

import { interpretarErrorNota } from '../errores-api'
import {
  type CampoNotaForm,
  type NotaFormValues,
  RESULTADOS_NOTA,
  aBodyNota,
  notaFormSchema,
  valoresInicialesNota,
} from '../examenes.schema'
import type { ExamenItem } from '../examenes.types'
import { resumenExamen } from '../formato-examenes'
import { useCargarNota } from '../hooks/use-cargar-nota'

export type NotaDialogProps = {
  /** El examen al que se le carga o corrige la nota; `null` con el diálogo cerrado. */
  examen: ExamenItem | null
  onCerrar: () => void
}

/**
 * Cargar o corregir la nota de un examen ya rendido (HU-34): "Con nota" (de 1 a 10, con coma
 * decimal) o "Ausente al examen". El rango y si se puede cargar los decide la API: su 400 se ve en
 * el campo y su 409 (`EXAMEN_FUTURO`) como mensaje.
 */
export function NotaDialog({ examen, onCerrar }: NotaDialogProps) {
  return (
    <Dialog open={examen !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      {/* No se cierra con un clic afuera, para no perder lo cargado. */}
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        {/* Se monta por examen: el formulario y el error anterior no sobreviven. */}
        {examen && <FormularioNota key={examen.id} examen={examen} onCerrar={onCerrar} />}
      </DialogContent>
    </Dialog>
  )
}

function FormularioNota({ examen, onCerrar }: { examen: ExamenItem; onCerrar: () => void }) {
  const cargar = useCargarNota()
  const toast = useToast()
  const corregir = examen.resultado !== null

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<NotaFormValues>({
    resolver: zodResolver(notaFormSchema),
    // El resultado arranca sin elegir al cargar: el schema exige que lo elijan.
    defaultValues: valoresInicialesNota(examen) as NotaFormValues,
  })
  const resultado = useWatch({ control, name: 'resultado' })

  const error = useMemo(
    () => (cargar.error ? interpretarErrorNota(cargar.error) : null),
    [cargar.error],
  )
  const errorCampo = (campo: CampoNotaForm) =>
    errors[campo]?.message ?? error?.campos.find((c) => c.campo === campo)?.mensaje

  const guardar = handleSubmit((valores) => {
    cargar.mutate(
      { id: examen.id, datos: aBodyNota(valores) },
      {
        onSuccess: () => {
          toast.success(`Se guardó la nota del examen de ${examen.materia.nombre}`)
          onCerrar()
        },
      },
    )
  })

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{corregir ? 'Editar nota' : 'Cargar nota'}</DialogTitle>
        <DialogDescription>
          {examen.materia.nombre} · {resumenExamen(examen)}
        </DialogDescription>
      </DialogHeader>

      <Field label="Resultado" htmlFor="resultado" required error={errorCampo('resultado')}>
        <Controller
          control={control}
          name="resultado"
          render={({ field }) => (
            <div
              id="resultado"
              role="group"
              aria-label="Resultado"
              className="grid grid-cols-2 gap-2"
            >
              {RESULTADOS_NOTA.map((r) => {
                const elegido = field.value === r.valor
                return (
                  <Button
                    key={r.valor}
                    type="button"
                    variant={elegido ? 'default' : 'outline'}
                    aria-pressed={elegido}
                    onClick={() => field.onChange(r.valor)}
                  >
                    {r.etiqueta}
                  </Button>
                )
              })}
            </div>
          )}
        />
      </Field>

      {resultado === 'CON_NOTA' && (
        <Field label="Nota" htmlFor="nota" required error={errorCampo('nota')}>
          <Input
            id="nota"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Por ejemplo 7,5"
            className="max-w-40"
            aria-invalid={errorCampo('nota') ? true : undefined}
            aria-describedby={errorCampo('nota') ? fieldErrorId('nota') : undefined}
            {...register('nota')}
          />
          <p className="text-muted-foreground text-xs">De 1 a 10, con hasta dos decimales.</p>
        </Field>
      )}

      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Si querés dejar un comentario sobre el examen, escribilo en sus observaciones.
        </AlertDescription>
      </Alert>

      {error?.mensaje && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">{error.mensaje}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCerrar} disabled={cargar.isPending}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="confirmado"
          disabled={cargar.isPending || (corregir && !isDirty)}
        >
          {cargar.isPending ? 'Guardando…' : 'Guardar nota'}
        </Button>
      </DialogFooter>
    </form>
  )
}
