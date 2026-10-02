'use client'

import { useState } from 'react'
import { AlertCircle, Printer, SearchX } from 'lucide-react'

import {
  BotonVolverImprimir,
  Campo,
  Campos,
  SeccionImpresa,
} from '@/components/impresion/campo-impreso'
import { DocumentoOficial } from '@/components/impresion/DocumentoOficial'
import {
  CeldaImpresa,
  CierreImpreso,
  EncabezadoImpreso,
  EncabezadosImpresos,
  FilaImpresa,
  TablaImpresa,
} from '@/components/impresion/tabla-impresa'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useNombreSesion } from '@/features/auth/hooks/use-nombre-sesion'
import { useCentro } from '@/features/centro/hooks/use-centro'
import { useImprimirCuandoEsteListo } from '@/hooks/use-imprimir'
import { rangoHoras } from '@/utils/horas'
import { formatearPesos } from '@/utils/moneda'

import {
  fechaDocumento,
  textoNumero,
  textoNumeroComprobante,
  textoRegistradoPor,
} from '../formato-pagos'
import { useComprobante } from '../hooks/use-comprobante'
import type { Comprobante } from '../pagos.types'

type ComprobantePagoProps = {
  /** El `[pagoId]` de la URL, tal cual: uno que no es un entero positivo se trata como 404. */
  pagoId: string
  /** Adónde va "Volver" si la pestaña no tiene historial ni se puede cerrar (URL pegada). */
  rutaRespaldo: string
}

/**
 * Comprobante de un pago (HU-15), como hoja de impresión (docs/arquitectura-frontend.md →
 * Documentos imprimibles). Se imprime solo una vez, cuando están el comprobante, los datos del
 * centro, la sesión y el logo; "Imprimir" lo repite. Sin los datos del centro no se imprime: un
 * documento oficial sin encabezado no sirve. Los importes son los de la API, sin sumar nada.
 */
export function ComprobantePago({ pagoId, rutaRespaldo }: ComprobantePagoProps) {
  const id = /^\d+$/.test(pagoId) ? Number(pagoId) : 0
  // Sin pegarle a la API: ni al comprobante ni al centro.
  if (!Number.isSafeInteger(id) || id <= 0) return <PagoNoExiste rutaRespaldo={rutaRespaldo} />
  return <ComprobanteDelPago pagoId={id} rutaRespaldo={rutaRespaldo} />
}

function ComprobanteDelPago({ pagoId, rutaRespaldo }: { pagoId: number; rutaRespaldo: string }) {
  const comprobante = useComprobante(pagoId)
  const centro = useCentro()
  // "Emitido por" es quien imprime; quien registró el pago va en el pie (decisión T-111).
  const emitidoPor = useNombreSesion()
  const [logoListo, setLogoListo] = useState(false)

  const datos =
    comprobante.data && centro.data && emitidoPor !== null
      ? { comprobante: comprobante.data, centro: centro.data, emitidoPor }
      : null
  const listo = !!datos && logoListo
  useImprimirCuandoEsteListo(listo)

  // El 404 no se reintenta: con el primer fallo ya se sabe que el pago no existe.
  if (comprobante.failureReason?.status === 404) {
    return <PagoNoExiste rutaRespaldo={rutaRespaldo} />
  }

  const error = comprobante.error
    ? {
        mensaje:
          comprobante.error.status === 403
            ? 'No tenés permiso para ver este comprobante'
            : comprobante.error.message,
        reintentar: comprobante.error.status === 403 ? undefined : () => comprobante.refetch(),
      }
    : centro.error && !centro.data
      ? {
          mensaje: 'No se pudieron cargar los datos del centro',
          reintentar: () => centro.refetch(),
        }
      : null

  return (
    <>
      <BarraDeAcciones rutaRespaldo={rutaRespaldo} puedeImprimir={listo} />

      {error && (
        <div className="mx-auto max-w-[190mm]">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
              {error.mensaje}
              {error.reintentar && (
                <Button variant="outline" size="sm" onClick={error.reintentar}>
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {!error && !datos && <CargandoComprobante />}

      {!error && datos && (
        <DocumentoOficial
          titulo="Comprobante de pago"
          referencia={textoNumero(datos.comprobante.numeroComprobante)}
          emitidoPor={datos.emitidoPor}
          centro={datos.centro}
          onLogoListo={() => setLogoListo(true)}
        >
          <ContenidoComprobante comprobante={datos.comprobante} />
        </DocumentoOficial>
      )}
    </>
  )
}

function ContenidoComprobante({ comprobante }: { comprobante: Comprobante }) {
  const { alumno, turnos } = comprobante
  return (
    <div className="space-y-5">
      <SeccionImpresa>
        <Campos>
          <Campo label="Alumno" valor={`${alumno.nombre} ${alumno.apellido}`} />
          <Campo label="DNI" valor={alumno.dni} />
          <Campo label="Fecha de pago" valor={fechaDocumento(comprobante.fechaPago)} />
          <Campo label="Forma de pago" valor={comprobante.formaPago.nombre} />
        </Campos>
      </SeccionImpresa>

      <TablaImpresa titulo={textoNumeroComprobante(comprobante.numeroComprobante)}>
        <EncabezadosImpresos>
          <EncabezadoImpreso>Fecha</EncabezadoImpreso>
          <EncabezadoImpreso>Horario</EncabezadoImpreso>
          <EncabezadoImpreso>Materia</EncabezadoImpreso>
          <EncabezadoImpreso>Profesor</EncabezadoImpreso>
          <EncabezadoImpreso numerica>Importe</EncabezadoImpreso>
        </EncabezadosImpresos>
        <tbody>
          {turnos.map((turno) => (
            <FilaImpresa key={`${turno.turnoId}|${turno.fecha}`}>
              <CeldaImpresa className="whitespace-nowrap tabular-nums">
                {fechaDocumento(turno.fecha)}
              </CeldaImpresa>
              <CeldaImpresa className="whitespace-nowrap tabular-nums">
                {rangoHoras(turno.horaInicio, turno.horaFin)}
              </CeldaImpresa>
              <CeldaImpresa>{turno.materia.nombre}</CeldaImpresa>
              <CeldaImpresa>
                {turno.profesor.nombre} {turno.profesor.apellido}
              </CeldaImpresa>
              <CeldaImpresa numerica>{formatearPesos(turno.importe)}</CeldaImpresa>
            </FilaImpresa>
          ))}
        </tbody>
      </TablaImpresa>

      <CierreImpreso>
        <Totales comprobante={comprobante} />

        {comprobante.observaciones && (
          <SeccionImpresa>
            <Campo
              label="Observaciones"
              valor={<span className="whitespace-pre-line">{comprobante.observaciones}</span>}
            />
          </SeccionImpresa>
        )}

        <footer className="border-t border-black/20 pt-3 text-xs">
          <p className="text-black/70">
            {textoRegistradoPor(comprobante.registradoPor, comprobante.registradoEl)}
          </p>
          <p className="mt-1 text-black/50">Comprobante interno de pago · No válido como factura</p>
        </footer>
      </CierreImpreso>
    </div>
  )
}

/** El total, destacado, y lo que se recibió y se devolvió, si se informó. Todo de la API. */
function Totales({ comprobante }: { comprobante: Comprobante }) {
  const { total, montoRecibido, vuelto } = comprobante
  return (
    <dl className="ml-auto w-72 rounded-xl border border-black/10 bg-black/1.5 px-6 py-5">
      <div className="flex items-baseline justify-between gap-6">
        <dt className="text-cobalto text-[11px] font-bold tracking-widest uppercase">Total</dt>
        <dd className="text-2xl font-semibold text-black tabular-nums">{formatearPesos(total)}</dd>
      </div>
      {(montoRecibido !== null || vuelto !== null) && (
        <div className="mt-3 space-y-1 border-t border-black/10 pt-3 text-sm">
          {montoRecibido !== null && (
            <div className="flex items-baseline justify-between gap-6">
              <dt className="text-black/70">Monto recibido</dt>
              <dd className="tabular-nums">{formatearPesos(montoRecibido)}</dd>
            </div>
          )}
          {vuelto !== null && (
            <div className="flex items-baseline justify-between gap-6">
              <dt className="text-black/70">Vuelto</dt>
              <dd className="tabular-nums">{formatearPesos(vuelto)}</dd>
            </div>
          )}
        </div>
      )}
    </dl>
  )
}

/**
 * "Volver" y, a su derecha, "Imprimir": si se cancela el diálogo que se abre solo, es la forma de
 * volver a imprimir. Sólo en pantalla (`data-no-imprimir` de `BotonVolverImprimir`).
 */
function BarraDeAcciones({
  rutaRespaldo,
  puedeImprimir,
}: {
  rutaRespaldo: string
  puedeImprimir: boolean
}) {
  return (
    <BotonVolverImprimir rutaRespaldo={rutaRespaldo}>
      <Button size="sm" onClick={() => window.print()} disabled={!puedeImprimir}>
        <Printer />
        Imprimir
      </Button>
    </BotonVolverImprimir>
  )
}

function PagoNoExiste({ rutaRespaldo }: { rutaRespaldo: string }) {
  return (
    <>
      <BarraDeAcciones rutaRespaldo={rutaRespaldo} puedeImprimir={false} />
      <EmptyState
        icon={SearchX}
        title="El pago no existe"
        description="Puede que el enlace sea incorrecto."
      />
    </>
  )
}

function CargandoComprobante() {
  return (
    <div aria-busy className="mx-auto max-w-[190mm] space-y-6 p-10">
      <span className="sr-only">Cargando el comprobante…</span>
      <div className="flex items-center gap-4">
        <Skeleton className="size-16" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="h-6 w-64" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  )
}
