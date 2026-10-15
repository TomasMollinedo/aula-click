'use client'

import { useId, useState } from 'react'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CampoArchivo } from '@/components/ui/campo-archivo'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { useToast } from '@/hooks/use-toast'

import {
  errorDeAdjunto,
  esImagenAdjunta,
  MAX_BYTES_ADJUNTO,
  MENSAJES_ADJUNTO,
  TIPOS_ADJUNTO,
} from '../comprobante-adjunto'
import { useReemplazarAdjunto } from '../hooks/use-reemplazar-adjunto'
import type { AdjuntoConUrl } from '../pago-detalle.types'

export type ReemplazarAdjuntoDialogProps = {
  pagoId: number
  /**
   * `'reemplazar'` si el pago tenía comprobante adjunto al abrir y `'adjuntar'` si no (un débito).
   * Lo fija quien abre: no cambia si el detalle se vuelve a pedir con el diálogo abierto.
   */
  modo: 'reemplazar' | 'adjuntar'
  /** El adjunto actual con su URL, para verlo en el campo mientras no se elija otro. */
  actual: AdjuntoConUrl | null
  onCerrar: () => void
}

const TEXTOS = {
  reemplazar: {
    titulo: 'Reemplazar comprobante adjunto',
    descripcion:
      'El comprobante anterior queda guardado en el sistema; el detalle muestra el nuevo.',
    confirmacion: '¿Reemplazar el comprobante adjunto? El anterior queda guardado en el sistema.',
    boton: 'Reemplazar',
    enCurso: 'Reemplazando…',
    exito: 'Se reemplazó el comprobante adjunto',
  },
  adjuntar: {
    titulo: 'Adjuntar comprobante',
    descripcion: 'El comprobante adjunto respalda el pago con tarjeta de débito.',
    confirmacion: '¿Adjuntar este comprobante al pago?',
    boton: 'Adjuntar',
    enCurso: 'Adjuntando…',
    exito: 'Se adjuntó el comprobante',
  },
} as const

/**
 * Reemplazar el comprobante adjunto de un pago o, en un débito sin adjunto, adjuntar uno (HU-24),
 * con `PUT /adjuntos/pagos/{pagoId}`. Dos pasos: elegir el archivo (JPG, PNG o PDF, hasta 5 MB, con
 * vista previa) y confirmar. Lo ofrece el detalle del pago solo si `acciones.reemplazarAdjunto`.
 * Un 400 en `archivo` vuelve al campo con el mensaje de la API; un 404 o un 409 (pago anulado o en
 * efectivo) muestran su mensaje y el detalle se vuelve a pedir solo.
 */
export function ReemplazarAdjuntoDialog({
  pagoId,
  modo,
  actual,
  onCerrar,
}: ReemplazarAdjuntoDialogProps) {
  const idCampo = useId()
  const toast = useToast()
  const mutation = useReemplazarAdjunto(pagoId)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const textos = TEXTOS[modo]

  const error = mutation.error ? errorDeAdjunto(mutation.error) : null
  const errorGeneral = error && !error.enArchivo ? error.mensaje : null

  const elegir = (nuevo: File | null) => {
    setArchivo(nuevo)
    mutation.reset()
  }

  const confirmar = () => {
    if (!archivo) return
    mutation.mutate(archivo, {
      onSuccess: () => {
        toast.success(textos.exito)
        onCerrar()
      },
      // Un 400 en el archivo: se vuelve a elegir, con el mensaje junto al campo.
      onError: (e) => {
        if (errorDeAdjunto(e).enArchivo) setConfirmando(false)
      },
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{textos.titulo}</DialogTitle>
          <DialogDescription>{textos.descripcion}</DialogDescription>
        </DialogHeader>

        {errorGeneral ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">{errorGeneral}</AlertDescription>
          </Alert>
        ) : confirmando && archivo ? (
          <p className="text-sm">
            {textos.confirmacion}{' '}
            <span className="text-muted-foreground break-all">({archivo.name})</span>
          </p>
        ) : (
          <Field htmlFor={idCampo} label="Comprobante" required>
            <CampoArchivo
              id={idCampo}
              aceptar={TIPOS_ADJUNTO}
              maxBytes={MAX_BYTES_ADJUNTO}
              mensajes={MENSAJES_ADJUNTO}
              valor={archivo}
              onCambiar={elegir}
              actual={
                actual && {
                  url: actual.url,
                  nombre: actual.nombre,
                  esImagen: esImagenAdjunta(actual.tipo),
                  detalle: 'Comprobante adjunto actual',
                }
              }
              error={error?.enArchivo ? error.mensaje : undefined}
            />
          </Field>
        )}

        <DialogFooter>
          {errorGeneral ? (
            <Button variant="outline" onClick={onCerrar}>
              Cerrar
            </Button>
          ) : confirmando ? (
            <>
              <Button
                variant="outline"
                onClick={() => setConfirmando(false)}
                disabled={mutation.isPending}
              >
                Volver
              </Button>
              <Button variant="confirmado" onClick={confirmar} disabled={mutation.isPending}>
                {mutation.isPending ? textos.enCurso : textos.boton}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button
                variant="confirmado"
                onClick={() => setConfirmando(true)}
                disabled={archivo === null}
              >
                Continuar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
