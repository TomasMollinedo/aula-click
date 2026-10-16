'use client'

import { useEffect, useRef } from 'react'
import { AlertCircle, Receipt, RotateCw } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationControls } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'

import { interpretarErrorPagosRealizados } from '../errores-pagos-realizados'
import { aParams, filtraPorTurno, hayFiltros } from '../filtros-pagos-realizados'
import { useFiltrosPagosRealizados } from '../hooks/use-filtros-pagos-realizados'
import { usePagosRealizados } from '../hooks/use-pagos-realizados'
import { FiltrosPagosRealizados } from './FiltrosPagosRealizados'
import { PagosRealizadosTabla } from './PagosRealizadosTabla'
import { TotalesPagosRealizados } from './TotalesPagosRealizados'

export type PagosRealizadosProps = {
  /** El alumno de la ficha; sin él, la vista global (todos los alumnos). */
  alumnoId?: number
  /** Solo lectura, para el gerente: ve los pagos y sus detalles, sin acciones. */
  soloLectura?: boolean
  /** Abre el detalle de un pago; lo conecta `app/` con `useDetallePagoEnUrl().abrir`. */
  onAbrirPago: (pagoId: number) => void
}

/**
 * Subpestaña "Pagos realizados" (HU-36): en la ficha del alumno, en `/mesa/pagos` y en
 * `/gerente/pagos` (`soloLectura`). Arriba los totales del filtro según el estado (lo cobrado, lo
 * anulado y el detalle por forma de pago); después los filtros y la tabla paginada, del más reciente
 * al más antiguo. Todo lo calcula la API.
 *
 * - Los filtros van en la URL (`useFiltrosPagosRealizados`): el período por fecha de pago (por
 *   defecto, el mes en curso), materia, profesor, forma de pago, estado (por defecto, "Todos") y,
 *   en la vista global, alumno.
 * - El gerente tiene los mismos filtros (decisión T-169); la única diferencia es que el alumno no
 *   enlaza a su ficha.
 * - Si la página de la URL quedó fuera de rango, pasa a la última.
 */
export function PagosRealizados({
  alumnoId,
  soloLectura = false,
  onAbrirPago,
}: PagosRealizadosProps) {
  const conAlumno = alumnoId === undefined
  const { filtros, page, hoy, cambiar, cambiarPagina, limpiar } = useFiltrosPagosRealizados({
    conAlumno,
  })
  const query = usePagosRealizados(aParams(filtros, page, alumnoId))
  useCorregirPagina(
    query.isPlaceholderData ? undefined : query.data?.meta.totalPages,
    page,
    cambiarPagina,
  )

  const error = query.isError ? interpretarErrorPagosRealizados(query.error) : null
  const enEspera = query.isPlaceholderData

  return (
    <div className="space-y-6">
      {query.data ? (
        <Card>
          <TotalesPagosRealizados
            totales={query.data.totales}
            estado={filtros.estado}
            periodo={filtros}
            porTurno={filtraPorTurno(filtros)}
            enEspera={enEspera}
          />
        </Card>
      ) : (
        query.isPending && (
          <Card className="gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-40" />
          </Card>
        )
      )}

      <Card>
        <FiltrosPagosRealizados
          filtros={filtros}
          conAlumno={conAlumno}
          alumnoIdFicha={alumnoId}
          onCambiar={cambiar}
          onLimpiar={limpiar}
          puedeLimpiar={hayFiltros(filtros, hoy)}
          errores={error?.tipo === 'filtros' ? error.campos : undefined}
          errorGeneral={error?.tipo === 'filtros' ? error.mensaje : null}
        />
      </Card>

      {error ? (
        error.tipo !== 'filtros' && (
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
      ) : query.data ? (
        query.data.data.length === 0 ? (
          <Card className="p-0">
            <EmptyState icon={Receipt} title="No hay pagos en este período" />
          </Card>
        ) : (
          <Card className="gap-0 overflow-hidden p-0">
            <PagosRealizadosTabla
              pagos={query.data.data}
              conAlumno={conAlumno}
              enlazarAlumno={!soloLectura}
              onAbrirPago={onAbrirPago}
              enEspera={enEspera}
            />
            <PaginationControls
              className="border-t px-6 py-4"
              page={page}
              totalPages={query.data.meta.totalPages}
              onPageChange={cambiarPagina}
            />
          </Card>
        )
      ) : (
        <Card className="gap-3" aria-busy>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </Card>
      )}
    </div>
  )
}

/**
 * Si la página de la URL quedó fuera de rango (por ejemplo, un enlace viejo), pasa a la última. Con
 * datos de un filtro anterior no corrige: espera los reales.
 */
function useCorregirPagina(
  totalPages: number | undefined,
  page: number,
  onCorregir: (page: number) => void,
) {
  const corregir = useRef(onCorregir)
  useEffect(() => {
    corregir.current = onCorregir
  })
  useEffect(() => {
    if (totalPages === undefined) return
    const ultima = Math.max(1, totalPages)
    if (page > ultima) corregir.current(ultima)
  }, [totalPages, page])
}
