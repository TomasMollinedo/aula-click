'use client'

import { type ReactNode, useMemo, useState } from 'react'
import { AlertCircle, RotateCw } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { SolicitudRegistrarPago } from '@/types/pago'
import { cn } from '@/utils/cn'

import { type FilaDeCuenta, aCobrar } from '../a-cobrar'
import { interpretarErrorCuenta } from '../errores-cuentas'
import { type FiltrosCuenta as Filtros, aParams, hayFiltros } from '../filtros-cuenta'
import { avisoDelTope, etiquetaTotal, textoFiltrosActivos, textoSinFilas } from '../formato-cuentas'
import { useCuentaDelAlumno } from '../hooks/use-cuenta-del-alumno'
import { useDialogoDePago } from '../hooks/use-dialogo-de-pago'
import { useFiltrosCuenta } from '../hooks/use-filtros-cuenta'
import { useNombresDeFiltros } from '../hooks/use-nombres-de-filtros'
import {
  SELECCION_VACIA,
  type Seleccion,
  alternar,
  ordenarComoSeMuestran,
  podar,
  quitarTodos,
  resumenSeleccion,
  seleccionarTodos,
} from '../seleccion'
import { BarraSeleccion } from './BarraSeleccion'
import { FiltrosCuenta } from './FiltrosCuenta'
import { OcurrenciasTabla } from './OcurrenciasTabla'
import { SeccionOcurrencias, SinFilas } from './SeccionOcurrencias'
import { TotalDestacado } from './TotalDestacado'

export type PagosDelAlumnoProps = {
  alumnoId: number
  /**
   * El diálogo de registrar un pago. Lo compone `app/` (es de `features/pagos`): recibe lo que
   * necesita `RegistrarPagoDialog`.
   */
  renderRegistrarPago: (pago: SolicitudRegistrarPago) => ReactNode
}

/**
 * Pestaña "Pagos" de la ficha del alumno (HU-16): total adeudado, filtros (período, materia y
 * profesor, en la URL junto a `?tab=pagos`), y turnos adeudados y próximos con una sola selección
 * para cobrarlos juntos. Importes, totales y qué sección aplica al período los manda la API: una
 * sección que llega `null` no se muestra; el cliente solo suma lo tildado (`resumenSeleccion`).
 *
 * **Filtrar es podar:** la selección se poda contra la cuenta que se ve (lo cobrado, lo cancelado
 * y lo que un filtro saca de la vista salen de ella, porque no se cobra lo que no se ve), pero solo
 * con datos reales. Mientras llega la cuenta de un filtro nuevo se sigue viendo la anterior
 * (`isPlaceholderData`), atenuada y sin poder tildar ni cobrar.
 */
export function PagosDelAlumno({ alumnoId, renderRegistrarPago }: PagosDelAlumnoProps) {
  const { filtros: deLaUrl, cambiar, limpiar } = useFiltrosCuenta()
  // Los de la ficha: sin el alumno (es el de la ficha) ni páginas.
  const { desde, hasta, materiaId, profesorId } = deLaUrl
  const filtros = useMemo<Filtros>(
    () => ({ desde, hasta, materiaId, profesorId }),
    [desde, hasta, materiaId, profesorId],
  )

  const query = useCuentaDelAlumno(alumnoId, aParams(filtros))
  const cuenta = query.data
  const enEspera = query.isPlaceholderData

  // Adeudados y después próximos, cada uno en el orden de la API: así se muestran y así se cobran.
  const mostrada = useMemo<FilaDeCuenta[]>(
    () => (cuenta ? [...(cuenta.adeudados ?? []), ...(cuenta.proximos ?? [])] : []),
    [cuenta],
  )
  const nombres = useNombresDeFiltros(filtros, mostrada)

  // La poda se guarda (ajuste del estado durante el render, sin un efecto): si después se saca el
  // filtro, lo que había salido de la vista no vuelve tildado. `podar` devuelve la misma selección
  // si no cambió, así que no hay un render de más.
  const [seleccion, setSeleccion] = useState<Seleccion>(SELECCION_VACIA)
  if (cuenta && !enEspera) {
    const podada = podar(seleccion, mostrada)
    if (podada !== seleccion) setSeleccion(podada)
  }
  const resumen = useMemo(() => resumenSeleccion(seleccion), [seleccion])

  const {
    abrir: abrirDialogo,
    refugioRef,
    dialogo,
  } = useDialogoDePago<HTMLHeadingElement>({
    renderRegistrarPago,
    // Nada que ajustar al cerrar: lo cobrado desaparece de la cuenta y la poda lo saca.
    alCerrar: () => {},
  })

  const error = query.isError ? interpretarErrorCuenta(query.error) : null
  const alternarFila = (fila: FilaDeCuenta) => setSeleccion((actual) => alternar(actual, fila))
  const cobrarFila = (fila: FilaDeCuenta, boton: HTMLButtonElement) =>
    abrirDialogo({ alumnoId, ocurrencias: [aCobrar(fila)] }, boton)

  return (
    <div className="space-y-6">
      {cuenta ? (
        <Card>
          <TotalDestacado
            etiqueta={etiquetaTotal(filtros)}
            importe={cuenta.totalAdeudado}
            detalle={textoFiltrosActivos({ ...filtros, ...nombres, alumno: null })}
            className={cn(enEspera && 'opacity-60')}
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
        <FiltrosCuenta
          filtros={filtros}
          nombres={nombres}
          onCambiar={cambiar}
          onLimpiar={limpiar}
          puedeLimpiar={hayFiltros(filtros)}
          errores={error?.tipo === 'filtros' ? error.campos : undefined}
          errorGeneral={error?.tipo === 'filtros' ? error.mensaje : null}
        />
      </Card>

      {query.isPending ? (
        <ListasCargando />
      ) : error ? (
        // El error de los filtros ya está junto a ellos.
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
      ) : (
        cuenta && (
          // Sin `overflow` en la tarjeta: la barra queda fija al scrollear (ver `BarraSeleccion`).
          <Card className="gap-0 p-0">
            <BarraSeleccion
              className="border-border border-b px-6 py-4"
              resumen={resumen}
              onSeleccionarTodos={
                cuenta.adeudados
                  ? () => setSeleccion((actual) => seleccionarTodos(actual, cuenta.adeudados ?? []))
                  : undefined
              }
              seleccionarTodosDeshabilitado={cuenta.adeudados?.length === 0}
              onQuitar={() => setSeleccion(quitarTodos())}
              onRegistrar={(boton) =>
                abrirDialogo(
                  { alumnoId, ocurrencias: ordenarComoSeMuestran(seleccion, mostrada) },
                  boton,
                )
              }
              enEspera={enEspera}
            />

            <div className="overflow-hidden rounded-b-2xl">
              {cuenta.adeudados && (
                <SeccionOcurrencias
                  id="cuenta-adeudados"
                  titulo="Turnos adeudados"
                  tituloRef={refugioRef}
                >
                  {cuenta.adeudados.length === 0 ? (
                    <SinFilas>{textoSinFilas('adeudados', filtros)}</SinFilas>
                  ) : (
                    <OcurrenciasTabla
                      etiqueta="Turnos adeudados"
                      filas={cuenta.adeudados}
                      conEstado
                      seleccion={seleccion}
                      onAlternar={alternarFila}
                      onCobrar={cobrarFila}
                      enEspera={enEspera}
                    />
                  )}
                </SeccionOcurrencias>
              )}

              {cuenta.proximos && (
                <SeccionOcurrencias
                  id="cuenta-proximos"
                  titulo="Próximos turnos"
                  // El refugio del foco es el título de la primera sección que se ve.
                  tituloRef={cuenta.adeudados ? undefined : refugioRef}
                  aviso={avisoDelTope(filtros, cuenta.limiteCobro)}
                  className={cn(cuenta.adeudados && 'border-border border-t')}
                >
                  {cuenta.proximos.length === 0 ? (
                    <SinFilas>{textoSinFilas('proximos', filtros)}</SinFilas>
                  ) : (
                    <OcurrenciasTabla
                      etiqueta="Próximos turnos"
                      filas={cuenta.proximos}
                      seleccion={seleccion}
                      onAlternar={alternarFila}
                      onCobrar={cobrarFila}
                      enEspera={enEspera}
                    />
                  )}
                </SeccionOcurrencias>
              )}
            </div>
          </Card>
        )
      )}

      {dialogo}
    </div>
  )
}

/** La forma de las listas mientras llega la cuenta por primera vez. */
function ListasCargando() {
  return (
    <Card className="gap-3" aria-busy aria-label="Cargando los pagos del alumno">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="mt-3 h-5 w-40" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </Card>
  )
}
