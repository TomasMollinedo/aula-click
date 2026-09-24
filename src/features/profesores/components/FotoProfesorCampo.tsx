'use client'

import { type ChangeEvent, useEffect, useMemo, useRef } from 'react'
import { ImagePlus, Trash2, User } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

// Mismos límites que valida la API (`profesores.validation.ts`): los schemas del frontend no
// comparten código con el backend (T-08). Si cambian allá, se cambian acá.
const FOTO_TIPOS_ACEPTADOS = ['image/jpeg', 'image/png']
const FOTO_MAX_BYTES = 5 * 1024 * 1024

// Cambio de foto elegido en la edición, todavía no guardado: un archivo nuevo o la foto actual
// marcada para quitarse. Lo sube o quita ProfesorFormEditar recién al hacer clic en "Guardar
// profesor" (junto con el resto de los cambios, un solo botón de guardado).
export type CambioFotoPendiente = { tipo: 'archivo'; archivo: File } | { tipo: 'quitar' }

type FotoProfesorCampoProps =
  | {
      modo: 'crear'
      /** Archivo elegido, todavía no subido: el profesor no tiene id hasta crearse. */
      archivo: File | null
      onArchivoChange: (archivo: File | null) => void
    }
  | {
      modo: 'editar'
      /** URL prefirmada de la foto actual, o null si no tiene. */
      fotoUrl: string | null
      cambio: CambioFotoPendiente | null
      onCambioChange: (cambio: CambioFotoPendiente | null) => void
      /** Mientras se guarda el formulario: deshabilita elegir o quitar. */
      disabled?: boolean
    }

// Vista previa de la foto del profesor, con opciones de elegir, reemplazar o quitar. En ambos
// modos el archivo (o la marca de "quitar") queda en el estado del formulario: en el alta lo sube
// ProfesorNuevo al crear el profesor; en la edición lo sube o quita ProfesorFormEditar al guardar.
export function FotoProfesorCampo(props: FotoProfesorCampoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const archivoCrear = props.modo === 'crear' ? props.archivo : null
  const archivoPendiente =
    props.modo === 'editar' && props.cambio?.tipo === 'archivo' ? props.cambio.archivo : null
  const archivoPreview = archivoCrear ?? archivoPendiente
  const previewLocal = useMemo(
    () => (archivoPreview ? URL.createObjectURL(archivoPreview) : null),
    [archivoPreview],
  )
  // Solo libera el object URL (no sincroniza estado de React): no hay setState que lo reemplace.
  useEffect(() => {
    return () => {
      if (previewLocal) URL.revokeObjectURL(previewLocal)
    }
  }, [previewLocal])

  const quitandoPendiente = props.modo === 'editar' && props.cambio?.tipo === 'quitar'
  const hayFotoGuardada = props.modo === 'crear' ? !!props.archivo : !!props.fotoUrl
  const hayFoto = quitandoPendiente ? false : !!archivoPreview || hayFotoGuardada
  const previewSrc =
    previewLocal ?? (quitandoPendiente || props.modo === 'crear' ? null : props.fotoUrl)
  const disabled = props.modo === 'editar' && !!props.disabled

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
    props.onCambioChange({ tipo: 'archivo', archivo: file })
  }

  function manejarQuitar() {
    if (props.modo === 'crear') {
      props.onArchivoChange(null)
      return
    }
    props.onCambioChange({ tipo: 'quitar' })
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
            disabled={disabled}
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
              disabled={disabled}
              onClick={manejarQuitar}
            >
              <Trash2 className="size-4" />
              Quitar
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {props.modo === 'editar' && props.cambio
            ? 'El cambio se guarda con "Guardar profesor"'
            : 'JPG o PNG, hasta 5 MB'}
        </p>
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
