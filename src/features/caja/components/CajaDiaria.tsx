'use client'

import { AlertCircle, Banknote, RotateCw } from 'lucide-react'

import { NavegacionFecha } from '@/features/agendas/components/NavegacionFecha'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { sumarDias } from '@/utils/calendario'

import { interpretarErrorCaja } from '../errores-caja'
import { aParams, hayFiltros } from '../filtros-caja'
import { textoSinMovimientos, textoSinResultados } from '../formato-caja'
import { useCaja } from '../hooks/use-caja'
import { useFiltrosCajaEnUrl } from '../hooks/use-filtros-caja-en-url'
import { BotonPdfCaja } from './BotonPdfCaja'
import { FiltrosCaja } from './FiltrosCaja'
import { MovimientosCaja } from './MovimientosCaja'
import { ResumenDelDia } from './ResumenDelDia'

export type CajaDiariaProps = {
  /** Abre el detalle de un cobro o una anulación; lo conecta `app/` con `useDetallePagoEnUrl().abrir`. */
  onAbrirPago: (pagoId: number) => void
  /**
   * URL del listado de liquidaciones en el segmento: un pago a profesor abre
   * `${rutaLiquidaciones}/${profesorId}/${mes}`.
   */
  rutaLiquidaciones: string
}

/**
 * "Caja diaria" (HU-46), en `/gerente/caja`: todo el dinero que entró y salió del centro en un día.
 * El día va en la URL (`?fecha=`) y se recorre con las flechas (reusa `NavegacionFecha` de
 * `agendas`, que ya resuelve anterior / siguiente / hoy / selector); los filtros de la lista,
 * también (`?tipo=`, `?formaPago=`).
 *
 * - Todo se rotula con la `fecha` de la respuesta, no con la pedida: sin `?fecha=` el día lo decide
 *   la API (hoy en la zona del negocio). Mientras llega el día nuevo se ve el anterior atenuado.
 * - No se consultan días futuros: la flecha "Día siguiente" y el selector se recortan a hoy
 *   (`fechaElegible`), así que en hoy la flecha no avanza. Una fecha futura que llegue por URL la
 *   rechaza la API y el 400 sale junto al selector.
 * - El resumen es siempre el del día completo; `tipo` y `formaPago` recortan sólo la lista.
 * - Nada se calcula acá: los signos, los totales y el reparto son los que manda la API.
 */
export function CajaDiaria({ onAbrirPago, rutaLiquidaciones }: CajaDiariaProps) {
  const { filtros, hoy, irAFecha, cambiar, limpiar } = useFiltrosCajaEnUrl()
  const query = useCaja(aParams(filtros))
  const { data } = query

  const error = query.isError ? interpretarErrorCaja(query.error) : null
  const enEspera = query.isPlaceholderData
  // El día que se rotula: el de la respuesta; mientras no hay (primera carga o error), el de la URL
  // o el de hoy, que es lo que la API usaría.
  const fecha = data?.fecha ?? filtros.fecha ?? hoy
  const conFiltros = hayFiltros(filtros)

  return (
    <div className="space-y-6">
      <Card className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <NavegacionFecha
            fecha={fecha}
            esActual={fecha === hoy}
            onAnterior={() => irAFecha(sumarDias(fecha, -1))}
            onSiguiente={() => irAFecha(sumarDias(fecha, 1))}
            onActual={() => irAFecha(hoy)}
            onCambiarFecha={irAFecha}
          />
          <BotonPdfCaja fecha={data?.fecha ?? null} />
        </div>

        {error?.campos.fecha && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">{error.campos.fecha}</AlertDescription>
          </Alert>
        )}
      </Card>

      {data ? (
        <ResumenDelDia resumen={data.resumen} enEspera={enEspera} />
      ) : (
        !error && (
          <Card className="gap-3" role="status" aria-busy aria-label="Cargando el resumen del día">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-48" />
          </Card>
        )
      )}

      <Card>
        <FiltrosCaja
          filtros={filtros}
          onCambiar={cambiar}
          onLimpiar={limpiar}
          puedeLimpiar={conFiltros}
          errores={error?.tipo === 'validacion' ? error.campos : undefined}
        />
      </Card>

      {error ? (
        error.mensaje && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center gap-3">
              {error.mensaje}
              {error.reintentar && (
                <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>
                  <RotateCw />
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )
      ) : data ? (
        data.movimientos.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon={Banknote}
              title={conFiltros ? textoSinResultados(data.fecha) : textoSinMovimientos(data.fecha)}
              description={conFiltros ? 'Probá con otro tipo o otra forma de pago.' : undefined}
            >
              {conFiltros && (
                <Button type="button" variant="outline" onClick={limpiar}>
                  Limpiar filtros
                </Button>
              )}
            </EmptyState>
          </Card>
        ) : (
          <Card className="gap-0 overflow-hidden p-0">
            <MovimientosCaja
              movimientos={data.movimientos}
              fecha={data.fecha}
              onAbrirPago={onAbrirPago}
              rutaLiquidaciones={rutaLiquidaciones}
              enEspera={enEspera}
            />
          </Card>
        )
      ) : (
        <Card
          className="gap-3"
          role="status"
          aria-busy
          aria-label="Cargando los movimientos del día"
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </Card>
      )}
    </div>
  )
}
