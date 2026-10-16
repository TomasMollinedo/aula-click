'use client'

import { useEffect, useRef, useState } from 'react'
import { CircleCheck, Loader2 } from 'lucide-react'

import { CampoArchivo, type MensajesCampoArchivo } from '@/components/ui/campo-archivo'
import { Field } from '@/components/ui/field'
import { useSubirAdjunto } from '@/features/pagos/hooks/use-subir-adjunto'

import { errorDeSubidaComprobante } from '../errores-pago-liquidacion'

// Lo que se acepta es una ayuda para elegir: la API valida tipo, firma y tamaño igual
// (docs/contrato-api.md → Adjuntos). Copiado de `pagos/comprobante-adjunto.ts`.
const TIPOS_COMPROBANTE = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'application/pdf': 'PDF',
} as const
/** 5 MB, como la API. */
const MAX_BYTES_COMPROBANTE = 5 * 1024 * 1024
/** Los mismos que manda la API en `["archivo"]`. */
const MENSAJES_COMPROBANTE: MensajesCampoArchivo = {
  tipo: 'El archivo debe ser JPG, PNG o PDF',
  tamano: 'El archivo supera los 5 MB',
}

type CampoComprobanteTransferenciaProps = {
  id: string
  /** Recibe el `id` del comprobante ya subido, o `null` (sin archivo, subiendo o si falló). */
  onSubido: (adjuntoId: number | null) => void
  /** Avisa mientras sube: el diálogo no deja continuar hasta que termine. */
  onSubiendo: (subiendo: boolean) => void
  /** Error del formulario o de la API (`comprobanteAdjuntoId`). */
  error?: string
  deshabilitado?: boolean
}

/**
 * "Comprobante" del pago de una liquidación (HU-44, T-132): el de la transferencia al profesor,
 * siempre opcional. Como `CampoComprobantePago` (T-97): **se sube al elegirlo** con
 * `useSubirAdjunto` de `pagos` (el mismo `POST /adjuntos`) y su `id` va al formulario; "Elegir
 * otro" sube el nuevo y solo vale la respuesta del último; "Quitar" lo saca del formulario. Si la
 * subida falla, el error se ve en el campo y queda sin comprobante.
 */
export function CampoComprobanteTransferencia({
  id,
  onSubido,
  onSubiendo,
  error,
  deshabilitado = false,
}: CampoComprobanteTransferenciaProps) {
  const subir = useSubirAdjunto()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [errorSubida, setErrorSubida] = useState<string | null>(null)
  // Cada archivo elegido tiene su número: solo cuenta la respuesta del último.
  const ultimo = useRef(0)

  const subiendo = subir.isPending
  useEffect(() => {
    onSubiendo(subiendo)
  }, [onSubiendo, subiendo])
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
        // No queda elegido: el archivo que falló no es el comprobante.
        setArchivo(null)
        setErrorSubida(errorDeSubidaComprobante(e))
      },
    })
  }

  return (
    <Field label="Comprobante" htmlFor={id} optional>
      <CampoArchivo
        id={id}
        aceptar={TIPOS_COMPROBANTE}
        maxBytes={MAX_BYTES_COMPROBANTE}
        mensajes={MENSAJES_COMPROBANTE}
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
