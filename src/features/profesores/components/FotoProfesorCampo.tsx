'use client'

import { type ChangeEvent, useEffect, useMemo, useRef } from 'react'
import { ImagePlus, Trash2, User } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

import { useQuitarFotoProfesor } from '../hooks/use-quitar-foto-profesor'
import { useSubirFotoProfesor } from '../hooks/use-subir-foto-profesor'

// Mismos límites que valida la API (`profesores.validation.ts`): los schemas del frontend no
// comparten código con el backend (T-08). Si cambian allá, se cambian acá.
const FOTO_TIPOS_ACEPTADOS = ['image/jpeg', 'image/png']
const FOTO_MAX_BYTES = 5 * 1024 * 1024

type FotoProfesorCampoProps =
  | {
      modo: 'crear'
      /** Archivo elegido, todavía no subido: el profesor no tiene id hasta crearse. */
      archivo: File | null
      onArchivoChange: (archivo: File | null) => void
    }
  | {
      modo: 'editar'
      profesorId: number
      /** URL prefirmada de la foto actual, o null si no tiene. */
      fotoUrl: string | null
    }

// Vista previa de la foto del profesor, con opciones de elegir, reemplazar o quitar. En el alta
// guarda el archivo local y lo sube ProfesorNuevo recién al crear el profesor (que hasta entonces no
// tiene id); en la edición sube o quita de inmediato, sin esperar a "Guardar".
export function FotoProfesorCampo(props: FotoProfesorCampoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  // Los hooks se llaman siempre, sin condicionar por el modo (reglas de los hooks). En "crear" no
  // hay profesorId todavía: se pasa 0 y las mutaciones nunca se disparan en ese modo.
  const profesorId = props.modo === 'editar' ? props.profesorId : 0
  const subir = useSubirFotoProfesor(profesorId)
  const quitar = useQuitarFotoProfesor(profesorId)

  const archivoCrear = props.modo === 'crear' ? props.archivo : null
  const previewLocal = useMemo(
    () => (archivoCrear ? URL.createObjectURL(archivoCrear) : null),
    [archivoCrear],
  )
  // Solo libera el object URL (no sincroniza estado de React): no hay setState que lo reemplace.
  useEffect(() => {
    return () => {
      if (previewLocal) URL.revokeObjectURL(previewLocal)
    }
  }, [previewLocal])

  const hayFoto = props.modo === 'crear' ? !!props.archivo : !!props.fotoUrl
  const previewSrc = props.modo === 'crear' ? previewLocal : props.fotoUrl
  const isPending = subir.isPending || quitar.isPending

  function manejarSeleccion(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo después
    if (!file) return

    if (!FOTO_TIPOS_ACEPTADOS.includes(file.type)) {
      toast.error('La foto debe ser JPG o PNG')
      return
    }
    if (file.size > FOTO_MAX_BYTES) {
      toast.error('La foto no puede superar los 5 MB')
      return
    }

    if (props.modo === 'crear') {
      props.onArchivoChange(file)
      return
    }
    subir.mutate(file, {
      onSuccess: () => toast.success('Se actualizó la foto'),
      onError: (error) => toast.error(error.message),
    })
  }

  function manejarQuitar() {
    if (props.modo === 'crear') {
      props.onArchivoChange(null)
      return
    }
    quitar.mutate(undefined, {
      onSuccess: () => toast.success('Se quitó la foto'),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20">
        {previewSrc && <AvatarImage src={previewSrc} alt="" />}
        <AvatarFallback className="bg-cobalto/10 text-cobalto">
          <User className="size-8" />
        </AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            {hayFoto ? 'Reemplazar foto' : 'Agregar foto'}
          </Button>
          {hayFoto && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={manejarQuitar}
            >
              <Trash2 className="size-4" />
              Quitar
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">JPG o PNG, hasta 5 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        aria-label="Foto del profesor"
        onChange={manejarSeleccion}
      />
    </div>
  )
}
