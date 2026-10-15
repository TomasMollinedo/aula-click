'use client'

import { KeyRound } from 'lucide-react'

import { AVISO_CONTRASENA_INICIAL, datosParaSugerir } from '../acceso-portal'
import { useAccesoUsuarioSugerido } from '../hooks/use-acceso-usuario-sugerido'

export type AccesoPortalAltaProps = {
  /** Los valores que el formulario del alta tiene en este momento (con los que se sugiere el usuario). */
  nombre: string
  apellido: string
  dni: string
}

/**
 * Sección "Acceso al portal" del alta del alumno (HU-27): el usuario que se le va a asignar (de la
 * API, con debounce, en cuanto están nombre, apellido y DNI; no se escribe a mano) y el aviso de la
 * contraseña inicial. La monta `AlumnoForm`. El usuario es una sugerencia: el definitivo lo da la
 * API al guardar.
 */
export function AccesoPortalAlta({ nombre, apellido, dni }: AccesoPortalAltaProps) {
  const sugerido = useAccesoUsuarioSugerido({ nombre, apellido, dni })
  const completos = datosParaSugerir({ nombre, apellido, dni }) !== null

  return (
    <section className="space-y-3" aria-labelledby="alumno-acceso-titulo">
      <h3 id="alumno-acceso-titulo" className="flex items-center gap-2 text-lg font-semibold">
        <KeyRound aria-hidden className="text-cobalto size-4" />
        Acceso al portal
      </h3>
      <div className="bg-canvas space-y-2 rounded-lg px-4 py-3 text-sm">
        <p aria-live="polite">
          <span className="text-muted-foreground">Usuario: </span>
          {!completos ? (
            <span className="text-muted-foreground">
              Se genera con el nombre, el apellido y el DNI
            </span>
          ) : sugerido.isError ? (
            <span className="text-muted-foreground">
              No se pudo sugerir el usuario: se asigna al guardar
            </span>
          ) : sugerido.data ? (
            <span className="font-semibold">{sugerido.data.usuario}</span>
          ) : (
            <span className="text-muted-foreground">Calculando…</span>
          )}
        </p>
        <p className="text-muted-foreground">{AVISO_CONTRASENA_INICIAL}</p>
      </div>
    </section>
  )
}
