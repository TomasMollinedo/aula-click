'use client'

import { useEffect, useRef, useState } from 'react'
import { CircleCheck, Loader2 } from 'lucide-react'

import { CampoArchivo } from '@/components/ui/campo-archivo'
import { Field } from '@/components/ui/field'

import {
  MAX_BYTES_ADJUNTO,
  MENSAJES_ADJUNTO,
  TIPOS_ADJUNTO,
  errorDeAdjunto,
} from '../comprobante-adjunto'
import { useSubirAdjunto } from '../hooks/use-subir-adjunto'

type CampoComprobantePagoProps = {
  id: string
  /** Con transferencia es obligatorio; con débito, opcional (HU-24). */
  obligatorio: boolean
  /** Recibe el `id` del comprobante ya subido, o `null` (sin archivo, subiendo o si falló). */
  onSubido: (adjuntoId: number | null) => void
  /** Avisa mientras sube: el diálogo no deja continuar hasta que termine. */
  onSubiendo: (subiendo: boolean) => void
  /** Error del formulario o de la API (`comprobanteAdjuntoId`). */
  error?: string
  deshabilitado?: boolean
}

/**
 * "Comprobante" del registro de un pago (HU-24, T-97): el archivo que trae la familia, sobre
 * `CampoArchivo` (JPG, PNG o PDF, hasta 5 MB). **Se sube al elegirlo** (`POST /adjuntos`) y, cuando
 * termina, su `id` va al formulario: el pago se registra con ese `comprobanteAdjuntoId`. "Elegir
 * otro" sube el nuevo; "Quitar" lo saca del formulario (el subido queda guardado sin pago, como
 * cualquiera que no se vincula). Si la subida falla, el error se ve en el campo y el formulario
 * queda sin comprobante.
 *
 * Si se elige otro archivo mientras sube el anterior, vale solo el último: la respuesta del
 * anterior se descarta.
 */
export function CampoComprobantePago({
  id,
  obligatorio,
  onSubido,
  onSubiendo,
  error,
  deshabilitado = false,
}: CampoComprobantePagoProps) {
  const subir = useSubirAdjunto()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [errorSubida, setErrorSubida] = useState<string | null>(null)
  // Cada archivo elegido tiene su número: solo cuenta la respuesta del último.
  const ultimo = useRef(0)

  const subiendo = subir.isPending
  useEffect(() => {
    onSubiendo(subiendo)
  }, [onSubiendo, subiendo])
  // Si el campo se va mientras sube (se cambió de forma de pago), ya no hay nada subiendo.
  useEffect(() => () => onSubiendo(false), [onSubiendo])

  function cambiar(nuevo: File | null) {
    const pedido = ++ultimo.current
    setArchivo(nuevo)
    setErrorSubida(null)
    onSubido(null)
    if (!nuevo) {
      subir.reset()
      return
    }
    subir.mutate(nuevo, {
      onSuccess: (adjunto) => {
        if (pedido === ultimo.current) onSubido(adjunto.id)
      },
      onError: (e) => {
        if (pedido !== ultimo.current) return
        // No queda elegido: el archivo que falló no es el comprobante del pago.
        setArchivo(null)
        setErrorSubida(errorDeAdjunto(e).mensaje)
      },
    })
  }

  return (
    <Field label="Comprobante" htmlFor={id} required={obligatorio} optional={!obligatorio}>
      <CampoArchivo
        id={id}
        aceptar={TIPOS_ADJUNTO}
        maxBytes={MAX_BYTES_ADJUNTO}
        mensajes={MENSAJES_ADJUNTO}
        valor={archivo}
        onCambiar={cambiar}
        error={errorSubida ?? error}
        deshabilitado={deshabilitado}
      />
      {/* Siempre montado: un aria-live que aparece junto con su contenido no se anuncia. */}
      <p aria-live="polite" className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {subiendo ? (
          <>
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Subiendo el comprobante…
          </>
        ) : archivo && subir.isSuccess ? (
          <>
            <CircleCheck className="text-confirmado size-3.5" aria-hidden />
            Comprobante subido
          </>
        ) : null}
      </p>
    </Field>
  )
}
