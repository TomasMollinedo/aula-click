'use client'

import { useState } from 'react'
import { AlertCircle, KeyRound, RotateCcw, UserPlus } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

import {
  AVISO_CONTRASENA_INICIAL,
  mensajeErrorAcceso,
  textoAccesoCreado,
  textoConfirmarRestablecer,
  textoContrasenaRestablecida,
} from '../acceso-portal'
import type { AlumnoDetalle } from '../alumnos.types'
import { useAccesoCrear, useAccesoRestablecer } from '../hooks/use-acceso-portal'

export type AccesoPortalFichaProps = {
  alumno: AlumnoDetalle
  /**
   * Muestra las acciones (crear el acceso, restablecer la contraseña): sólo mesa de entradas, la
   * única que puede hacerlas (la API responde 403 a los demás). Es ayuda visual: decide la API.
   */
  puedeEditar?: boolean
}

/**
 * Sección "Acceso al portal" de la pestaña "Datos" de la ficha (HU-27): el usuario del alumno, quién
 * creó el acceso y quién restableció la contraseña por última vez, y "Restablecer contraseña" (con
 * confirmación). Sin acceso: "Sin acceso al portal" y "Crear acceso al portal". Los éxitos van en un
 * toast y los 409, en la sección. La monta `DatosAlumno`.
 */
export function AccesoPortalFicha({ alumno, puedeEditar = false }: AccesoPortalFichaProps) {
  const toast = useToast()
  const crear = useAccesoCrear(alumno.id)
  const restablecer = useAccesoRestablecer(alumno.id)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { acceso } = alumno
  const restablecida = acceso && textoContrasenaRestablecida(acceso)

  function crearAcceso() {
    setError(null)
    crear.mutate(undefined, {
      onSuccess: (a) =>
        toast.success(`Se creó el acceso al portal con el usuario ${a.acceso?.usuario ?? ''}`),
      onError: (e) => setError(mensajeErrorAcceso(e)),
    })
  }

  function confirmarRestablecer() {
    setError(null)
    restablecer.mutate(undefined, {
      onSuccess: (a) => {
        toast.success(`Se restableció la contraseña de ${a.acceso?.usuario ?? ''}`)
        setConfirmando(false)
      },
      onError: (e) => {
        setError(mensajeErrorAcceso(e))
        setConfirmando(false)
      },
    })
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound aria-hidden className="text-cobalto size-4" />
          Acceso al portal
        </h2>
        {puedeEditar &&
          (acceso ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmando(true)}>
              <RotateCcw aria-hidden />
              Restablecer contraseña
            </Button>
          ) : (
            <Button size="sm" onClick={crearAcceso} disabled={crear.isPending}>
              <UserPlus aria-hidden />
              {crear.isPending ? 'Creando…' : 'Crear acceso al portal'}
            </Button>
          ))}
      </div>

      {acceso ? (
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Usuario del portal: </span>
            <span className="font-semibold">{acceso.usuario}</span>
          </p>
          <div className="text-muted-foreground space-y-0.5 text-xs">
            <p>{textoAccesoCreado(acceso)}</p>
            {restablecida && <p>{restablecida}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="font-medium">Sin acceso al portal</p>
          {puedeEditar && <p className="text-muted-foreground">{AVISO_CONTRASENA_INICIAL}</p>}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      {acceso && (
        <Dialog open={confirmando} onOpenChange={(abierto) => !abierto && setConfirmando(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restablecer contraseña</DialogTitle>
              <DialogDescription>{textoConfirmarRestablecer(acceso.usuario)}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmando(false)}
                disabled={restablecer.isPending}
              >
                Cancelar
              </Button>
              <Button onClick={confirmarRestablecer} disabled={restablecer.isPending}>
                {restablecer.isPending ? 'Restableciendo…' : 'Restablecer contraseña'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}
