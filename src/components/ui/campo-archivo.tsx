'use client'

import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import Image from 'next/image'
import { File as IconoArchivo, FileText, RefreshCw, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  esImagen,
  formatearTamano,
  listarEtiquetas,
  rechazoArchivo,
  type TiposAceptados,
} from '@/components/ui/campo-archivo-reglas'
import { fieldErrorId } from '@/components/ui/field'
import { cn } from '@/utils/cn'

/** Mensajes de un archivo rechazado: los pasa quien usa el campo, como en `archivoSchema` (API). */
export type MensajesCampoArchivo = {
  /** El archivo no es de un tipo de `aceptar`. Ej.: "El archivo debe ser JPG, PNG o PDF". */
  tipo: string
  /** El archivo supera `maxBytes`. Ej.: "El archivo supera los 5 MB". */
  tamano: string
}

type CampoArchivoProps = {
  /** `htmlFor` del `Field` que lo envuelve: lo lleva el control enfocable del campo. */
  id: string
  /** Tipos aceptados: MIME → etiqueta (`{ 'application/pdf': 'PDF' }`). */
  aceptar: TiposAceptados
  maxBytes: number
  mensajes: MensajesCampoArchivo
  /** Archivo elegido, todavía no subido, o `null`. */
  valor: File | null
  /** Recibe el archivo elegido (ya aceptado) o `null` al quitarlo. Un archivo rechazado no llega. */
  onCambiar: (archivo: File | null) => void
  /** Error de afuera (formulario o API). Se muestra si no hay un rechazo propio más reciente. */
  error?: string
  deshabilitado?: boolean
  className?: string
}

/**
 * Campo para elegir un archivo con el mouse, con el teclado o arrastrándolo, con vista previa antes
 * de confirmar (miniatura si es imagen; ícono, nombre y tamaño si no) y "Elegir otro" / "Quitar".
 *
 * Va dentro de un `Field` **sin** su `error`: el campo muestra el suyo (el rechazo de tipo o tamaño,
 * o el `error` que recibe) con `fieldErrorId(id)`, así el `Label` y el `aria-describedby` quedan
 * asociados como en cualquier campo. Tipo y tamaño se revisan para ayudar: la API valida igual.
 */
export function CampoArchivo({
  id,
  aceptar,
  maxBytes,
  mensajes,
  valor,
  onCambiar,
  error,
  deshabilitado = false,
  className,
}: CampoArchivoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const controlRef = useRef<HTMLButtonElement>(null)
  // Al quitar, el botón que tenía el foco desaparece: el foco pasa al área para elegir.
  const enfocarAlCambiar = useRef(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [rechazo, setRechazo] = useState<string | null>(null)
  const ayudaId = useId()

  const etiquetas = listarEtiquetas(aceptar)
  const ayuda = `${etiquetas}, hasta ${formatearTamano(maxBytes)}`
  const mensajeError = rechazo ?? error
  const errorId = fieldErrorId(id)
  const describedBy = mensajeError ? `${ayudaId} ${errorId}` : ayudaId

  // URL de objeto para la miniatura: se libera al cambiar de archivo o al desmontar.
  const miniatura = useMemo(
    () => (valor && esImagen(valor.type) ? URL.createObjectURL(valor) : null),
    [valor],
  )
  useEffect(() => {
    return () => {
      if (miniatura) URL.revokeObjectURL(miniatura)
    }
  }, [miniatura])

  useEffect(() => {
    if (!enfocarAlCambiar.current) return
    enfocarAlCambiar.current = false
    controlRef.current?.focus()
  }, [valor])

  function elegir(archivo: File) {
    const motivo = rechazoArchivo(archivo, aceptar, maxBytes)
    if (motivo) {
      // No queda elegido: se conserva el archivo anterior, si había.
      setRechazo(mensajes[motivo])
      return
    }
    setRechazo(null)
    onCambiar(archivo)
  }

  function abrirSelector() {
    if (!deshabilitado) inputRef.current?.click()
  }

  function manejarSeleccion(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo después de quitarlo
    if (archivo) elegir(archivo)
  }

  function quitar() {
    setRechazo(null)
    enfocarAlCambiar.current = true
    onCambiar(null)
  }

  function manejarArrastre(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (deshabilitado) {
      e.dataTransfer.dropEffect = 'none'
      return
    }
    e.dataTransfer.dropEffect = 'copy'
    setArrastrando(true)
  }

  function manejarSalida(e: DragEvent<HTMLDivElement>) {
    // dragleave también salta al pasar sobre un hijo: solo cuenta si sale del área.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastrando(false)
  }

  function manejarSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setArrastrando(false)
    const archivo = e.dataTransfer.files[0]
    if (!deshabilitado && archivo) elegir(archivo)
  }

  // Props del control enfocable (el área vacía o "Elegir otro"): el que asocia el `Label`.
  const control = {
    id,
    ref: controlRef,
    disabled: deshabilitado,
    'aria-invalid': mensajeError ? true : undefined,
    'aria-describedby': describedBy,
  } as const

  return (
    <div data-slot="campo-archivo" className={cn('space-y-2', className)}>
      <div
        onDragEnter={manejarArrastre}
        onDragOver={manejarArrastre}
        onDragLeave={manejarSalida}
        onDrop={manejarSoltar}
        className={cn(
          'rounded-lg border border-dashed transition-colors',
          arrastrando ? 'border-cobalto bg-cobalto/5' : 'border-input',
          mensajeError && !arrastrando && 'border-destructive',
          deshabilitado && 'opacity-50',
        )}
      >
        {valor ? (
          <div className="flex flex-wrap items-center gap-3 p-3">
            <div
              aria-hidden
              className="bg-canvas text-muted-foreground flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md"
            >
              {miniatura ? (
                <Image
                  src={miniatura}
                  alt=""
                  width={64}
                  height={64}
                  className="size-full object-cover"
                />
              ) : valor.type === 'application/pdf' ? (
                <FileText className="size-8" />
              ) : (
                <IconoArchivo className="size-8" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={valor.name}>
                {valor.name}
              </p>
              <p className="text-muted-foreground text-xs">
                {aceptar[valor.type] ?? 'Archivo'} · {formatearTamano(valor.size)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                {...control}
                type="button"
                variant="outline"
                size="sm"
                onClick={abrirSelector}
              >
                <RefreshCw />
                Elegir otro
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deshabilitado}
                onClick={quitar}
                aria-label={`Quitar ${valor.name}`}
              >
                <Trash2 />
                Quitar
              </Button>
            </div>
          </div>
        ) : (
          <button
            {...control}
            type="button"
            onClick={abrirSelector}
            className="focus-visible:ring-ring flex w-full flex-col items-center gap-2 rounded-lg px-4 py-6 text-center outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
          >
            <Upload aria-hidden className="text-cobalto size-6" />
            <span className="text-sm font-medium">
              {arrastrando
                ? 'Soltá el archivo acá'
                : 'Arrastrá el archivo o hacé clic para elegirlo'}
            </span>
          </button>
        )}
      </div>

      <p id={ayudaId} className="text-muted-foreground text-xs">
        {ayuda}
      </p>
      {mensajeError && (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {mensajeError}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={Object.keys(aceptar).join(',')}
        tabIndex={-1}
        aria-hidden
        className="hidden"
        disabled={deshabilitado}
        onChange={manejarSeleccion}
      />
    </div>
  )
}
