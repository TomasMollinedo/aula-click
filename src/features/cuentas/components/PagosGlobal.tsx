'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, CircleCheck, RotateCw, Wallet, X } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationControls } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { useAlumno } from '@/features/alumnos/hooks/use-alumno'
import type { SolicitudRegistrarPago } from '@/types/pago'

import { aCobrar } from '../a-cobrar'
import { interpretarErrorCuenta } from '../errores-cuentas'
import { useAdeudados } from '../hooks/use-adeudados'
import { type AperturaDePago, useDialogoDePago } from '../hooks/use-dialogo-de-pago'
import { hrefFichaAlumno } from '../rutas-cuentas'
import {
  SELECCION_VACIA,
  type Seleccion,
  alternar,
  ordenarPorFecha,
  quitar,
  quitarTodos,
  resumenSeleccion,
} from '../seleccion'
import { BarraSeleccion } from './BarraSeleccion'
import { FiltroAlumno } from './FiltroAlumno'
import { OcurrenciasTabla } from './OcurrenciasTabla'
import { TotalDestacado } from './TotalDestacado'

export type PagosGlobalProps = {
  /**
   * El diálogo de registrar un pago. Lo compone `app/` (es de `features/pagos`): recibe lo que
   * necesita `RegistrarPagoDialog`.
   */
  renderRegistrarPago: (pago: SolicitudRegistrarPago) => ReactNode
}

/** Un entero >= 1 del query, o `null` si no viene o no es válido. */
function enteroPositivo(valor: string | null): number | null {
  const numero = Number(valor)
  return valor !== null && Number.isInteger(numero) && numero >= 1 ? numero : null
}

/**
 * Vista global de la deuda (`/mesa/pagos`, HU-16): total adeudado del filtro, adeudados paginados y
 * filtro por alumno. El alumno y la página van en la URL (`?alumnoId=12&page=2`, con
 * `router.replace`); un valor inválido se ignora (alumno) o se toma como 1 (página).
 *
 * - Sin filtro, se cobra de a un turno (la acción de cada fila, con el alumno de la fila).
 * - Con filtro, además, casillas y barra de selección. La selección se conserva entre páginas y
 *   se limpia al cambiar o quitar el filtro. No se poda contra la página (solo está la actual): al
 *   cerrar el diálogo, si los adeudados se volvieron a pedir mientras estaba abierto (cambió
 *   `dataUpdatedAt`) o se están volviendo a pedir (`isFetching`: registrar invalida sin esperar el
 *   refetch, así que el éxito se puede cerrar antes de que termine), hubo un pago o un 409 y se
 *   sacan las ocurrencias de esa solicitud (`quitar`); si no, se canceló y queda igual.
 * - Si al cobrar la última fila de la última página la página queda fuera de rango, pasa a la
 *   última que exista.
 */
export function PagosGlobal({ renderRegistrarPago }: PagosGlobalProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const alumnoId = enteroPositivo(searchParams.get('alumnoId'))
  const page = enteroPositivo(searchParams.get('page')) ?? 1

  const irA = useCallback(
    (filtro: { alumnoId: number | null; page: number }) => {
      const params = new URLSearchParams()
      if (filtro.alumnoId !== null) params.set('alumnoId', String(filtro.alumnoId))
      if (filtro.page > 1) params.set('page', String(filtro.page))
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname],
  )

  const query = useAdeudados({ alumnoId: alumnoId ?? undefined, page })
  const alumnoQuery = useAlumno(alumnoId ?? 0)
  const alumno = alumnoId !== null ? alumnoQuery.data : undefined
  const nombreAlumno = alumno ? `${alumno.nombre} ${alumno.apellido}` : null

  // La selección es del filtro: se limpia al cambiarlo o quitarlo, también con Atrás (ajuste del
  // estado durante el render, sin un efecto).
  const [marcada, setMarcada] = useState<Seleccion>(SELECCION_VACIA)
  const [filtroDeLaSeleccion, setFiltroDeLaSeleccion] = useState(alumnoId)
  if (filtroDeLaSeleccion !== alumnoId) {
    setFiltroDeLaSeleccion(alumnoId)
    setMarcada(SELECCION_VACIA)
  }
  const resumen = useMemo(() => resumenSeleccion(marcada), [marcada])

  // Se leen en el render (no solo dentro de `alCerrar`): TanStack Query re-renderiza solo por las
  // propiedades leídas al renderizar, y sin eso el cierre vería valores viejos.
  const { dataUpdatedAt, isFetching } = query
  const actualizadoAlAbrir = useRef(0)
  const {
    abrir: abrirDialogo,
    refugioRef,
    dialogo,
  } = useDialogoDePago<HTMLHeadingElement>({
    renderRegistrarPago,
    alCerrar: ({ ocurrencias }) => {
      // `isFetching`: el éxito se ve antes de que termine el refetch de la invalidación (el
      // `useRegistrarPago` no la espera), así que cerrarlo enseguida todavía no cambió los datos.
      if (dataUpdatedAt !== actualizadoAlAbrir.current || isFetching) {
        setMarcada((actual) => quitar(actual, ocurrencias))
      }
    },
  })
  const abrir = (solicitud: AperturaDePago, boton: HTMLElement) => {
    actualizadoAlAbrir.current = dataUpdatedAt
    abrirDialogo(solicitud, boton)
  }

  // Página fuera de rango (se cobró la última fila de la última página, o una URL vieja).
  const totalPages = query.isPlaceholderData ? undefined : query.data?.meta.totalPages
  useEffect(() => {
    if (totalPages === undefined) return
    const ultima = Math.max(1, totalPages)
    if (page > ultima) irA({ alumnoId, page: ultima })
  }, [totalPages, page, alumnoId, irA])

  const conFiltro = alumnoId !== null
  const quitarFiltro = () => irA({ alumnoId: null, page: 1 })

  return (
    <div className="space-y-6">
      <Card className="gap-6">
        <FiltroAlumno
          alumnoId={alumnoId}
          alumno={alumno}
          noEncontrado={interpretarErrorCuenta(query.error).tipo === 'noEncontrado'}
          onElegir={(id) => irA({ alumnoId: id, page: 1 })}
          onQuitar={quitarFiltro}
        />
        {query.data ? (
          <TotalDestacado
            etiqueta={
              !conFiltro
                ? 'Total adeudado'
                : nombreAlumno
                  ? `Total adeudado de ${nombreAlumno}`
                  : 'Total adeudado del alumno'
            }
            importe={query.data.totalAdeudado}
          />
        ) : (
          query.isPending && (
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-40" />
            </div>
          )
        )}
      </Card>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex flex-col">
          <h2
            ref={refugioRef}
            tabIndex={-1}
            className="px-6 pt-6 pb-4 text-base font-semibold outline-none"
          >
            Turnos adeudados
          </h2>
          {conFiltro && query.data && query.data.meta.total > 0 && (
            <BarraSeleccion
              className="border-border border-y px-6 py-4"
              resumen={resumen}
              onQuitar={() => setMarcada(quitarTodos())}
              onRegistrar={(boton) =>
                alumnoId !== null &&
                abrir({ alumnoId, ocurrencias: ordenarPorFecha(marcada) }, boton)
              }
            />
          )}
        </div>

        {query.isPending ? (
          <div className="space-y-2 px-6 pb-6" aria-busy aria-label="Cargando los adeudados">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorAdeudados
            error={interpretarErrorCuenta(query.error)}
            conFiltro={conFiltro}
            onQuitarFiltro={quitarFiltro}
            onReintentar={() => query.refetch()}
          />
        ) : query.data.data.length === 0 && query.data.meta.total > 0 ? (
          // Página fuera de rango: el efecto de arriba ya la está corrigiendo.
          <div className="px-6 pb-6" aria-busy>
            <Skeleton className="h-12 w-full" />
          </div>
        ) : query.data.meta.total === 0 ? (
          conFiltro ? (
            <EmptyState
              icon={CircleCheck}
              title={
                nombreAlumno
                  ? `${nombreAlumno} no tiene turnos adeudados`
                  : 'El alumno no tiene turnos adeudados'
              }
              description="Los próximos turnos se cobran desde su cuenta."
              className="py-10"
            >
              <Button asChild variant="outline">
                <Link href={hrefFichaAlumno(alumnoId)}>
                  <Wallet />
                  Ver cuenta del alumno
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <EmptyState icon={CircleCheck} title="No hay turnos adeudados" className="py-10" />
          )
        ) : (
          <>
            <OcurrenciasTabla
              etiqueta="Turnos adeudados"
              filas={query.data.data}
              conAlumno
              conEstado
              seleccion={conFiltro ? marcada : undefined}
              onAlternar={
                conFiltro ? (fila) => setMarcada((actual) => alternar(actual, fila)) : undefined
              }
              onCobrar={(fila, boton) =>
                abrir(
                  {
                    alumnoId: 'alumno' in fila ? fila.alumno.id : (alumnoId ?? 0),
                    ocurrencias: [aCobrar(fila)],
                  },
                  boton,
                )
              }
              atenuada={query.isPlaceholderData}
            />
            <PieDePagina
              page={page}
              meta={query.data.meta}
              onPageChange={(p) => irA({ alumnoId, page: p })}
            />
          </>
        )}
      </Card>

      {dialogo}
    </div>
  )
}

function ErrorAdeudados({
  error,
  conFiltro,
  onQuitarFiltro,
  onReintentar,
}: {
  error: ReturnType<typeof interpretarErrorCuenta>
  conFiltro: boolean
  onQuitarFiltro: () => void
  onReintentar: () => void
}) {
  return (
    <div className="px-6 pb-6">
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription className="text-destructive flex flex-wrap items-center gap-3">
          {error.mensaje}
          {error.reintentar && (
            <Button type="button" size="sm" variant="outline" onClick={onReintentar}>
              <RotateCw />
              Reintentar
            </Button>
          )}
          {!error.reintentar && conFiltro && (
            <Button type="button" size="sm" variant="outline" onClick={onQuitarFiltro}>
              <X />
              Quitar filtro
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}

function PieDePagina({
  page,
  meta,
  onPageChange,
}: {
  page: number
  meta: { page: number; pageSize: number; total: number; totalPages: number }
  onPageChange: (page: number) => void
}) {
  return (
    <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-sm">
        Mostrando {(meta.page - 1) * meta.pageSize + 1}–
        {Math.min(meta.page * meta.pageSize, meta.total)} de {meta.total}{' '}
        {meta.total === 1 ? 'turno' : 'turnos'}
      </p>
      <PaginationControls page={page} totalPages={meta.totalPages} onPageChange={onPageChange} />
    </div>
  )
}
