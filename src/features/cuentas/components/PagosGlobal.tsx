'use client'

import { type ReactNode, type Ref, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, RotateCw, X } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PaginationControls } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import type { PaginatedResponse } from '@/types'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'
import type { SolicitudRegistrarPago } from '@/types/pago'
import { cn } from '@/utils/cn'

import type { FilaDeCuenta } from '../a-cobrar'
import type { OcurrenciaDeCuentaGlobal } from '../cuentas.types'
import { interpretarErrorCuenta } from '../errores-cuentas'
import {
  type SeccionDeCuenta,
  aParams,
  aParamsGlobal,
  claveDeFiltros,
  hayFiltros,
} from '../filtros-cuenta'
import { avisoDelTope, etiquetaTotal, textoFiltrosActivos, textoSinFilas } from '../formato-cuentas'
import { useAdeudados } from '../hooks/use-adeudados'
import { useDetalleDeCuenta } from '../hooks/use-detalle-de-cuenta'
import { type AperturaDePago, useDialogoDePago } from '../hooks/use-dialogo-de-pago'
import { useFiltrosCuenta } from '../hooks/use-filtros-cuenta'
import { useNombresDeFiltros } from '../hooks/use-nombres-de-filtros'
import { useProximos } from '../hooks/use-proximos'
import { useTodosLosAdeudados } from '../hooks/use-todos-los-adeudados'
import {
  SELECCION_VACIA,
  type Seleccion,
  alternar,
  ordenarPorFecha,
  quitar,
  quitarTodos,
  resumenSeleccion,
  seleccionarTodos,
} from '../seleccion'
import { BarraSeleccion } from './BarraSeleccion'
import { FiltroAlumno } from './FiltroAlumno'
import { FiltrosCuenta } from './FiltrosCuenta'
import { OcurrenciasTabla } from './OcurrenciasTabla'
import { SeccionOcurrencias, SinFilas } from './SeccionOcurrencias'
import { TotalDestacado } from './TotalDestacado'

export type PagosGlobalProps = {
  /**
   * El diálogo de registrar un pago. Lo compone `app/` (es de `features/pagos`): recibe lo que
   * necesita `RegistrarPagoDialog`.
   */
  renderRegistrarPago: (pago: SolicitudRegistrarPago) => ReactNode
  /**
   * El detalle de un turno ("Ver detalle" de cada fila, `?detalle=&fecha=`). Lo compone `app/` con
   * el `DetalleTurno` del segmento, igual que en las agendas.
   */
  renderDetalle: RenderDetalleOcurrencia
}

const FILAS_VACIAS: readonly FilaDeCuenta[] = []

/**
 * Vista global de la deuda (`/mesa/pagos`, HU-16), con la misma estructura que la ficha: total
 * adeudado del filtro, filtros (alumno, período, materia y profesor), y "Turnos adeudados" y
 * "Próximos turnos", cada tabla con su paginación. Todo va en la URL
 * (`?alumnoId=&desde=&hasta=&materiaId=&profesorId=&pageAdeudados=&pageProximos=`, con
 * `router.replace`). Una sección con `aplica: false` no se muestra.
 *
 * - Un turno solo se cobra desde su detalle: "Ver detalle" de cada fila abre el detalle del turno
 *   (`renderDetalle`, en la URL junto a los filtros y las páginas). Sin alumno filtrado es la única
 *   forma de cobrar, porque un pago es de un solo alumno.
 * - Con alumno filtrado, además, casillas en las dos tablas y una barra de selección: adeudados y
 *   próximos se pueden cobrar juntos, y "Seleccionar todos los adeudados" tilda los de todas las
 *   páginas (los pide a la cuenta del alumno). La selección se conserva al paginar cualquiera de las dos y
 *   se vacía cuando cambia **cualquier** filtro. No se poda contra la página (solo está la actual):
 *   al cerrar el diálogo, si alguna de las dos listas se volvió a pedir mientras estaba abierto
 *   (cambió su `dataUpdatedAt`) o se está volviendo a pedir (`isFetching`: registrar invalida sin
 *   esperar el refetch), hubo un pago o un 409 y se sacan las ocurrencias de esa solicitud
 *   (`quitar`); si no, se canceló y queda igual. Al cerrar el detalle de un turno vale el mismo
 *   criterio, con ese turno: pudo cobrarse, cancelarse o reprogramarse desde ahí.
 * - Mientras una tabla muestra filas de un filtro o una página anterior (`isPlaceholderData`), no
 *   se puede tildar ni cobrar en ella, ni registrar el pago de la selección.
 * - Si al cobrar la última fila de la última página una tabla queda fuera de rango, pasa a su
 *   última página.
 */
export function PagosGlobal({ renderRegistrarPago, renderDetalle }: PagosGlobalProps) {
  const { filtros, paginas, cambiar, cambiarPagina, limpiar } = useFiltrosCuenta()
  const { alumnoId } = filtros

  const adeudados = useAdeudados(aParamsGlobal(filtros, paginas.adeudados))
  const proximos = useProximos(aParamsGlobal(filtros, paginas.proximos))

  const filas = useMemo(
    () => [...(adeudados.data?.data ?? FILAS_VACIAS), ...(proximos.data?.data ?? FILAS_VACIAS)],
    [adeudados.data, proximos.data],
  )
  const nombres = useNombresDeFiltros(filtros, filas)

  // La selección es de un filtro: se vacía cuando cambia cualquiera de ellos, también con Atrás
  // (ajuste del estado durante el render, sin un efecto). Paginar no la toca.
  const clave = claveDeFiltros(filtros)
  const [seleccion, setSeleccion] = useState<Seleccion>(SELECCION_VACIA)
  const [claveDeLaSeleccion, setClaveDeLaSeleccion] = useState(clave)
  if (claveDeLaSeleccion !== clave) {
    setClaveDeLaSeleccion(clave)
    setSeleccion(SELECCION_VACIA)
  }
  const resumen = useMemo(() => resumenSeleccion(seleccion), [seleccion])

  // "Seleccionar todos los adeudados" (con alumno filtrado): los de todas las páginas, no solo los
  // de la que se ve. Si entran en la página actual se toman de ahí; si no, se piden a la cuenta del
  // alumno, con los mismos filtros. Si el filtro cambió mientras llegaban, no se tildan.
  const toast = useToast()
  const todosLosAdeudados = useTodosLosAdeudados()
  const claveActual = useRef(clave)
  useEffect(() => {
    claveActual.current = clave
  })
  const seleccionarTodosLosAdeudados = async () => {
    if (alumnoId === null) return
    const pedida = clave
    const pagina = adeudados.isPlaceholderData ? undefined : adeudados.data
    try {
      const todos =
        pagina && pagina.meta.totalPages <= 1
          ? pagina.data
          : await todosLosAdeudados.traer(alumnoId, aParams(filtros))
      if (claveActual.current === pedida) {
        setSeleccion((actual) => seleccionarTodos(actual, todos))
      }
    } catch {
      toast.error('No se pudieron seleccionar todos los adeudados. Intentá de nuevo.')
    }
  }

  // Se leen en el render (no solo dentro de `alCerrar`): TanStack Query re-renderiza solo por las
  // propiedades leídas al renderizar, y sin eso el cierre vería valores viejos.
  const actualizado = { adeudados: adeudados.dataUpdatedAt, proximos: proximos.dataUpdatedAt }
  const pidiendo = adeudados.isFetching || proximos.isFetching
  // `pidiendo`: el éxito se ve antes de que termine el refetch de la invalidación (el
  // `useRegistrarPago` no la espera), así que cerrar enseguida todavía no cambió los datos.
  const cambioDesde = (alAbrir: typeof actualizado) =>
    pidiendo ||
    actualizado.adeudados !== alAbrir.adeudados ||
    actualizado.proximos !== alAbrir.proximos

  const actualizadoAlAbrir = useRef(actualizado)
  const {
    abrir: abrirDialogo,
    refugioRef,
    dialogo,
  } = useDialogoDePago<HTMLHeadingElement>({
    renderRegistrarPago,
    alCerrar: ({ ocurrencias }) => {
      if (cambioDesde(actualizadoAlAbrir.current)) {
        setSeleccion((actual) => quitar(actual, ocurrencias))
      }
    },
  })
  const abrir = (solicitud: AperturaDePago, boton: HTMLElement) => {
    actualizadoAlAbrir.current = actualizado
    abrirDialogo(solicitud, boton)
  }

  // "Ver detalle" de una fila. Lo que se haga en el detalle (cobrar, cancelar, reprogramar)
  // invalida las dos listas: al cerrarlo, con el mismo criterio que el diálogo, ese turno sale de
  // la selección.
  const actualizadoAlAbrirDetalle = useRef(actualizado)
  const {
    abrir: abrirDetalle,
    detalle,
    cerrar: cerrarDetalle,
  } = useDetalleDeCuenta({
    refugioRef,
    alCerrar: (ocurrencia) => {
      if (cambioDesde(actualizadoAlAbrirDetalle.current)) {
        setSeleccion((actual) => quitar(actual, [ocurrencia]))
      }
    },
  })
  const verDetalle = (fila: FilaDeCuenta, boton: HTMLButtonElement) => {
    actualizadoAlAbrirDetalle.current = actualizado
    abrirDetalle(fila, boton)
  }

  // Página fuera de rango (se cobró la última fila de la última página, o una URL vieja): cada
  // tabla se corrige por separado.
  useCorregirPagina(adeudados, paginas.adeudados, (p) => cambiarPagina('adeudados', p))
  useCorregirPagina(proximos, paginas.proximos, (p) => cambiarPagina('proximos', p))

  const conAlumno = alumnoId !== null
  const enEspera = adeudados.isPlaceholderData || proximos.isPlaceholderData
  // Un error de cualquiera de las dos lecturas ocupa el lugar de las dos secciones (un filtro
  // inválido o un alumno inexistente las hace fallar a las dos por lo mismo).
  const error =
    adeudados.isError || proximos.isError
      ? interpretarErrorCuenta(adeudados.error ?? proximos.error)
      : null
  const hayFilas = (adeudados.data?.meta.total ?? 0) > 0 || (proximos.data?.meta.total ?? 0) > 0
  const conBarra = conAlumno && hayFilas
  // El refugio del foco es el título de la primera sección que se ve.
  const seVenAdeudados = adeudados.data?.aplica !== false

  const tabla = (
    etiqueta: string,
    datos: readonly OcurrenciaDeCuentaGlobal[],
    seccion: SeccionDeCuenta,
    enEsperaDeLaTabla: boolean,
  ) => (
    <OcurrenciasTabla
      etiqueta={etiqueta}
      filas={datos}
      conAlumno
      conEstado={seccion === 'adeudados'}
      seleccion={conAlumno ? seleccion : undefined}
      onAlternar={
        conAlumno ? (fila) => setSeleccion((actual) => alternar(actual, fila)) : undefined
      }
      onVerDetalle={verDetalle}
      enEspera={enEsperaDeLaTabla}
    />
  )

  return (
    <div className="space-y-6">
      {adeudados.data ? (
        <Card>
          <TotalDestacado
            etiqueta={etiquetaTotal(filtros)}
            importe={adeudados.data.totalAdeudado}
            detalle={textoFiltrosActivos({ ...filtros, ...nombres })}
            className={cn(adeudados.isPlaceholderData && 'opacity-60')}
          />
        </Card>
      ) : (
        adeudados.isPending && (
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
          renderAlumno={(id) => (
            <FiltroAlumno
              id={id}
              value={alumnoId}
              nombre={nombres.alumno}
              noEncontrado={error?.tipo === 'noEncontrado'}
              onChange={(nuevo) => cambiar({ alumnoId: nuevo })}
            />
          )}
        />
      </Card>

      {error ? (
        // El error de los filtros ya está junto a ellos.
        error.tipo !== 'filtros' && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center gap-3">
              {error.mensaje}
              {error.reintentar && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (adeudados.isError) adeudados.refetch()
                    if (proximos.isError) proximos.refetch()
                  }}
                >
                  <RotateCw />
                  Reintentar
                </Button>
              )}
              {error.tipo === 'noEncontrado' && conAlumno && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => cambiar({ alumnoId: null })}
                >
                  <X />
                  Quitar el filtro de alumno
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )
      ) : (
        // Sin `overflow` en la tarjeta: la barra queda fija al scrollear (ver `BarraSeleccion`).
        <Card className="gap-0 p-0">
          {conBarra && (
            <BarraSeleccion
              className="border-border border-b px-6 py-4"
              resumen={resumen}
              onSeleccionarTodos={
                adeudados.data?.aplica ? () => void seleccionarTodosLosAdeudados() : undefined
              }
              seleccionarTodosDeshabilitado={
                adeudados.data?.meta.total === 0 || todosLosAdeudados.cargando
              }
              onQuitar={() => setSeleccion(quitarTodos())}
              onRegistrar={(boton) =>
                alumnoId !== null &&
                abrir({ alumnoId, ocurrencias: ordenarPorFecha(seleccion) }, boton)
              }
              enEspera={enEspera}
            />
          )}

          <div className={cn('overflow-hidden rounded-b-2xl', !conBarra && 'rounded-t-2xl')}>
            <SeccionGlobal
              id="pagos-adeudados"
              titulo="Turnos adeudados"
              tituloRef={seVenAdeudados ? refugioRef : undefined}
              query={adeudados}
              page={paginas.adeudados}
              onPageChange={(p) => cambiarPagina('adeudados', p)}
              textoVacio={textoSinFilas('adeudados', filtros)}
              renderTabla={(datos, espera) => tabla('Turnos adeudados', datos, 'adeudados', espera)}
            />

            <SeccionGlobal
              id="pagos-proximos"
              titulo="Próximos turnos"
              tituloRef={seVenAdeudados ? undefined : refugioRef}
              query={proximos}
              page={paginas.proximos}
              onPageChange={(p) => cambiarPagina('proximos', p)}
              textoVacio={textoSinFilas('proximos', filtros)}
              aviso={
                proximos.data?.aplica ? avisoDelTope(filtros, proximos.data.limiteCobro) : null
              }
              className={cn(seVenAdeudados && 'border-border border-t')}
              renderTabla={(datos, espera) => tabla('Próximos turnos', datos, 'proximos', espera)}
            />
          </div>
        </Card>
      )}

      {dialogo}
      {detalle && renderDetalle({ ...detalle, onCerrar: cerrarDetalle })}
    </div>
  )
}

/** Lo que `SeccionGlobal` mira de `useAdeudados` o `useProximos`. */
type ConsultaDeSeccion = {
  data: (PaginatedResponse<OcurrenciaDeCuentaGlobal> & { aplica: boolean }) | undefined
  isPending: boolean
  isPlaceholderData: boolean
}

/**
 * Si la página pedida quedó después de la última (y los datos son los de esa página, no los de
 * placeholder), pasa a la última que exista.
 */
function useCorregirPagina(
  query: ConsultaDeSeccion,
  page: number,
  onCorregir: (page: number) => void,
) {
  const totalPages = query.isPlaceholderData ? undefined : query.data?.meta.totalPages
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

/**
 * Una sección de la vista global con su tabla paginada. Si la API dice que no aplica al período
 * (`aplica: false`), no se renderiza: ni título ni vacío.
 */
function SeccionGlobal({
  id,
  titulo,
  tituloRef,
  query,
  page,
  onPageChange,
  textoVacio,
  aviso,
  className,
  renderTabla,
}: {
  id: string
  titulo: string
  tituloRef?: Ref<HTMLHeadingElement>
  query: ConsultaDeSeccion
  page: number
  onPageChange: (page: number) => void
  textoVacio: string
  aviso?: string | null
  className?: string
  renderTabla: (filas: readonly OcurrenciaDeCuentaGlobal[], enEspera: boolean) => ReactNode
}) {
  const { data } = query
  if (data && !data.aplica) return null

  return (
    <SeccionOcurrencias
      id={id}
      titulo={titulo}
      tituloRef={tituloRef}
      aviso={aviso}
      className={className}
    >
      {!data ? (
        <div className="space-y-2 px-6 pb-6" aria-busy aria-label={`Cargando: ${titulo}`}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data.meta.total === 0 ? (
        <SinFilas>{textoVacio}</SinFilas>
      ) : data.data.length === 0 ? (
        // Página fuera de rango: `useCorregirPagina` ya la está corrigiendo.
        <div className="px-6 pb-6" aria-busy>
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <>
          {renderTabla(data.data, query.isPlaceholderData)}
          <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">
              Mostrando {(data.meta.page - 1) * data.meta.pageSize + 1}–
              {Math.min(data.meta.page * data.meta.pageSize, data.meta.total)} de {data.meta.total}{' '}
              {data.meta.total === 1 ? 'turno' : 'turnos'}
            </p>
            <PaginationControls
              page={page}
              totalPages={data.meta.totalPages}
              onPageChange={onPageChange}
            />
          </div>
        </>
      )}
    </SeccionOcurrencias>
  )
}
