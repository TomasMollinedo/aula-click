import type { ReactElement } from 'react'
import { ahora, type Reloj } from '@/server/shared/fechas'
import { fechaHoraDocumento, nombreCompleto } from '@/server/shared/formato'
import { DATOS_CENTRO } from './centro.datos'
import { LogoCentroPdf } from './centro.logo-pdf'

// El encabezado de un documento oficial en PDF (T-64: para eso existe `centro`). Lo arman igual
// todos los controllers que devuelven un PDF, así que está una sola vez, acá.

export type EncabezadoDeDocumento = {
  centro: { nombre: string; direccion: string; telefono: string }
  logo: ReactElement
  /** Quien saca el documento: el usuario de la sesión, nombre y apellido. */
  emitidoPor: string
  /** El instante del servidor en la hora del negocio, `dd/MM/yyyy HH:mm`. */
  fechaEmision: string
}

/**
 * Las props del encabezado de `DocumentoOficialPdf`: los datos y el logo del centro, "Emitido por"
 * (el usuario de la sesión, `c.get('user')`) y la fecha de emisión (el reloj del servidor;
 * inyectable para los tests).
 */
export function encabezadoDeDocumento(
  usuario: { name?: string | null; apellido?: string | null },
  reloj?: Reloj,
): EncabezadoDeDocumento {
  return {
    centro: DATOS_CENTRO,
    logo: <LogoCentroPdf />,
    emitidoPor: nombreCompleto(usuario.name, usuario.apellido),
    fechaEmision: fechaHoraDocumento(ahora(reloj)),
  }
}
