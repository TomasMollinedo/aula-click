'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Printer, SearchX, X } from 'lucide-react'

import { DocumentoOficial } from '@/components/impresion/DocumentoOficial'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useCentro } from '@/features/centro/hooks/use-centro'
import { useImprimirCuandoEsteListo } from '@/hooks/use-imprimir'
import { formatearPesos } from '@/utils/moneda'

import { CENTRO_PROVISORIO } from '../centro-provisorio'
import {
  fechaDocumento,
  textoHorario,
  textoNumeroComprobante,
  textoRegistradoEl,
} from '../formato-pagos'
import { useComprobante } from '../hooks/use-comprobante'
import type { Comprobante } from '../pagos.types'

type ComprobantePagoProps = {
  /** El `[pagoId]` de la URL, tal cual: uno que no es un entero positivo se trata como 404. */
  pagoId: string
  /** Adónde volver con "Cerrar" si la pestaña no se puede cerrar (la abrió el usuario, no la app). */
  rutaVolver: string
}

/**
 * Comprobante de un pago (HU-15), como documento imprimible (docs/arquitectura-frontend.md →
 * Documentos imprimibles). Se imprime solo una vez, cuando están el comprobante, los datos del
 * centro y el logo. Sin los datos del centro no se imprime: un documento oficial sin encabezado no
 * sirve. Los importes son los de la API, sin sumar nada.
 */
export function ComprobantePago({ pagoId, rutaVolver }: ComprobantePagoProps) {
  const id = /^\d+$/.test(pagoId) ? Number(pagoId) : 0
  // Sin pegarle a la API: ni al comprobante ni al centro.
  if (!Number.isSafeInteger(id) || id <= 0) return <PagoNoExiste rutaVolver={rutaVolver} />
  return <ComprobanteDelPago pagoId={id} rutaVolver={rutaVolver} />
}

function ComprobanteDelPago({ pagoId, rutaVolver }: { pagoId: number; rutaVolver: string }) {
  const comprobante = useComprobante(pagoId)
  const centro = useCentro()
  const [logoListo, setLogoListo] = useState(false)

  // TEMPORAL (T-52, issue #129): mientras no existe `GET /centro` (T-64) responde 404, y el
  // comprobante usa los datos de prueba. Se mira `failureReason` para no esperar los reintentos.
  // Borrar esta línea (y `centro-provisorio.ts`) cuando T-64 esté mergeada: queda `centro.data`.
  const datosCentro =
    centro.data ?? (centro.failureReason?.status === 404 ? CENTRO_PROVISORIO : undefined)

  useImprimirCuandoEsteListo(!!comprobante.data && !!datosCentro && logoListo)

  // El 404 no se reintenta: con el primer fallo ya se sabe que el pago no existe.
  if (comprobante.failureReason?.status === 404) return <PagoNoExiste rutaVolver={rutaVolver} />

  const error = comprobante.error
    ? {
        mensaje:
          comprobante.error.status === 403
            ? 'No tenés permiso para ver este comprobante'
            : comprobante.error.message,
        reintentar: comprobante.error.status === 403 ? undefined : () => comprobante.refetch(),
      }
    : centro.error && !datosCentro
      ? {
          mensaje: 'No se pudieron cargar los datos del centro',
          reintentar: () => centro.refetch(),
        }
      : null

  const datos =
    comprobante.data && datosCentro ? { comprobante: comprobante.data, centro: datosCentro } : null

  return (
    <main className="bg-background min-h-screen">
      <BarraDeAcciones rutaVolver={rutaVolver} puedeImprimir={!!datos && logoListo} />

      {error && (
        <div className="mx-auto max-w-[190mm] px-10">
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
          titulo={`Comprobante de pago N° ${datos.comprobante.numeroComprobante}`}
          emitidoPor={`${datos.comprobante.registradoPor.nombre} ${datos.comprobante.registradoPor.apellido}`}
          centro={datos.centro}
          onLogoListo={() => setLogoListo(true)}
        >
          <ContenidoComprobante comprobante={datos.comprobante} />
        </DocumentoOficial>
      )}
    </main>
  )
}

function ContenidoComprobante({ comprobante }: { comprobante: Comprobante }) {
  const { alumno, turnos } = comprobante
  return (
    <div className="space-y-6 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
        <dt className="font-semibold">Fecha de pago</dt>
        <dd>{fechaDocumento(comprobante.fechaPago)}</dd>
        <dt className="font-semibold">Alumno</dt>
        <dd>
          {alumno.nombre} {alumno.apellido} · DNI {alumno.dni}
        </dd>
        <dt className="font-semibold">Forma de pago</dt>
        <dd>{comprobante.formaPago.nombre}</dd>
      </dl>

      <table className="w-full border-collapse">
        <caption className="sr-only">
          {textoNumeroComprobante(comprobante.numeroComprobante)}
        </caption>
        <thead>
          <tr className="border-b border-black/40 text-left">
            <th className="py-2 pr-3 font-semibold">Fecha</th>
            <th className="py-2 pr-3 font-semibold">Horario</th>
            <th className="py-2 pr-3 font-semibold">Materia</th>
            <th className="py-2 pr-3 font-semibold">Profesor</th>
            <th className="py-2 text-right font-semibold">Importe</th>
          </tr>
        </thead>
        <tbody>
          {turnos.map((turno) => (
            <tr key={`${turno.turnoId}|${turno.fecha}`} className="border-b border-black/10">
              <td className="py-2 pr-3">{fechaDocumento(turno.fecha)}</td>
              <td className="py-2 pr-3">{textoHorario(turno.horaInicio, turno.horaFin)}</td>
              <td className="py-2 pr-3">{turno.materia.nombre}</td>
              <td className="py-2 pr-3">
                {turno.profesor.nombre} {turno.profesor.apellido}
              </td>
              <td className="py-2 text-right tabular-nums">{formatearPesos(turno.importe)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-black/40">
            <th scope="row" colSpan={4} className="py-2 pr-3 text-right font-semibold">
              Total
            </th>
            <td className="py-2 text-right font-semibold tabular-nums">
              {formatearPesos(comprobante.total)}
            </td>
          </tr>
        </tfoot>
      </table>

      {(comprobante.montoRecibido !== null || comprobante.vuelto !== null) && (
        <dl className="ml-auto grid w-fit grid-cols-[auto_auto] gap-x-6 gap-y-1">
          {comprobante.montoRecibido !== null && (
            <>
              <dt className="font-semibold">Monto recibido</dt>
              <dd className="text-right tabular-nums">
                {formatearPesos(comprobante.montoRecibido)}
              </dd>
            </>
          )}
          {comprobante.vuelto !== null && (
            <>
              <dt className="font-semibold">Vuelto</dt>
              <dd className="text-right tabular-nums">{formatearPesos(comprobante.vuelto)}</dd>
            </>
          )}
        </dl>
      )}

      {comprobante.observaciones && (
        <div>
          <p className="font-semibold">Observaciones</p>
          <p className="whitespace-pre-line">{comprobante.observaciones}</p>
        </div>
      )}

      <p className="text-black/70">{textoRegistradoEl(comprobante.registradoEl)}</p>
    </div>
  )
}

/** "Imprimir" y "Cerrar", solo en pantalla (`data-no-imprimir`). */
function BarraDeAcciones({
  rutaVolver,
  puedeImprimir,
}: {
  rutaVolver: string
  puedeImprimir: boolean
}) {
  const router = useRouter()

  // Una pestaña que abrió la app (el enlace del diálogo) se puede cerrar; si el usuario entró por
  // URL, el navegador no la cierra y se vuelve a la pantalla de pagos.
  const cerrar = () => {
    window.close()
    if (!window.closed) router.push(rutaVolver)
  }

  return (
    <div data-no-imprimir className="mx-auto flex max-w-[190mm] justify-end gap-2 px-10 pt-6">
      <Button variant="outline" onClick={cerrar}>
        <X />
        Cerrar
      </Button>
      <Button onClick={() => window.print()} disabled={!puedeImprimir}>
        <Printer />
        Imprimir
      </Button>
    </div>
  )
}

function PagoNoExiste({ rutaVolver }: { rutaVolver: string }) {
  return (
    <main className="bg-background min-h-screen">
      <BarraDeAcciones rutaVolver={rutaVolver} puedeImprimir={false} />
      <EmptyState
        icon={SearchX}
        title="El pago no existe"
        description="Puede que el enlace sea incorrecto."
      />
    </main>
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
