'use client'

import { use, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import type { EstadoTurno } from '@/components/turno/indicadores-turno'
import { BotonVolverImprimir, SeccionImpresa } from '@/components/impresion/campo-impreso'
import { DocumentoOficial } from '@/components/impresion/DocumentoOficial'
import { ESTADO_TURNO, ETIQUETA_PRIORIDAD } from '@/components/turno/indicadores-turno'
import { useAlumno } from '@/features/alumnos/hooks/use-alumno'
import { authClient } from '@/features/auth/auth-client'
import { useCentro } from '@/features/centro/hooks/use-centro'
import { useOcurrenciasDelAlumno } from '@/features/ocurrencias/hooks/use-ocurrencias-del-alumno'
import { useImprimirCuandoEsteListo } from '@/hooks/use-imprimir'
import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'
import { fechaConDia, fechaCorta } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

/** `turnoId:fecha` de cada tildado (armado por `AccionPdfTurnosAlumno`) → el conjunto de claves. */
function clavesDeSeleccion(param: string | null): Set<string> | null {
  if (!param) return null
  return new Set(param.split(','))
}

/**
 * Qué turnos van en la hoja (T-67): con `seleccion` en la URL, sólo esos (tildados en la lista,
 * ignora `estado`: una selección explícita ya dice qué imprimir). Si no, los del `estado` elegido,
 * o todos si no se filtró ninguno.
 */
function filtrarParaImprimir(
  turnos: OcurrenciaDeAlumno[],
  seleccion: Set<string> | null,
  estado: EstadoTurno | null,
): OcurrenciaDeAlumno[] {
  if (seleccion) return turnos.filter((turno) => seleccion.has(`${turno.turnoId}:${turno.fecha}`))
  if (estado) return turnos.filter((turno) => turno.estado === estado)
  return turnos
}

// Hoja de impresión de los turnos de un alumno (no es de ningún ticket, se agregó aparte de T-60,
// con el mismo patrón: `DocumentoOficial`, `useCentro` y se imprime sola al cargar). El mes (o año)
// y el filtro de estado o la selección los elige quien imprime, en `AccionPdfTurnosAlumno`.
export default function ImprimirTurnosAlumnoPage({
  params,
}: PageProps<'/mesa/alumnos/[alumnoId]/turnos/imprimir'>) {
  const { alumnoId } = use(params)
  const searchParams = useSearchParams()
  const desde = searchParams.get('desde') ?? undefined
  const hasta = searchParams.get('hasta') ?? undefined
  const estado = (searchParams.get('estado') as EstadoTurno | null) ?? null
  const seleccion = clavesDeSeleccion(searchParams.get('seleccion'))

  const alumno = useAlumno(Number(alumnoId))
  const turnos = useOcurrenciasDelAlumno({ alumnoId: Number(alumnoId), desde, hasta })
  const centro = useCentro()
  const { data: session } = authClient.useSession()
  const [logoListo, setLogoListo] = useState(false)

  const listo = Boolean(alumno.data && turnos.data && centro.data && session) && logoListo
  useImprimirCuandoEsteListo(listo)

  if (alumno.isLoading || turnos.isLoading || centro.isLoading) {
    return (
      <>
        <BotonVolverImprimir />
        <p className="text-muted-foreground p-10 text-sm">Preparando el documento…</p>
      </>
    )
  }

  if (
    alumno.isError ||
    turnos.isError ||
    centro.isError ||
    !alumno.data ||
    !turnos.data ||
    !centro.data ||
    !session
  ) {
    return (
      <>
        <BotonVolverImprimir />
        <p className="text-destructive p-10 text-sm">
          No se pudo armar el documento. Volvé y probá de nuevo desde la ficha del alumno.
        </p>
      </>
    )
  }

  const emitidoPor = [session.user.name, session.user.apellido].filter(Boolean).join(' ')
  const turnosAImprimir = filtrarParaImprimir(turnos.data, seleccion, estado)

  return (
    <>
      <BotonVolverImprimir />
      <DocumentoOficial
        titulo="Turnos del alumno"
        emitidoPor={emitidoPor}
        centro={centro.data}
        onLogoListo={() => setLogoListo(true)}
      >
        <SeccionImpresa>
          <p className="text-lg font-semibold text-black">
            {alumno.data.nombre} {alumno.data.apellido}
          </p>
          <p className="text-black/70">DNI {alumno.data.dni}</p>
          {desde && hasta && (
            <p className="text-cobalto mt-1 text-xs font-bold tracking-wide uppercase">
              {fechaCorta(desde)} – {fechaCorta(hasta)}
              {seleccion && ` · Selección (${turnosAImprimir.length})`}
              {!seleccion && estado && ` · Estado: ${ESTADO_TURNO[estado].etiqueta}`}
            </p>
          )}
        </SeccionImpresa>

        {turnosAImprimir.length === 0 ? (
          <p className="mt-5 text-sm text-black/70">Sin turnos en ese rango.</p>
        ) : (
          <table className="mt-5 w-full border-collapse text-sm">
            <thead>
              <tr className="border-cobalto/40 border-b-2 text-left">
                <th className="text-cobalto py-2 pr-3 text-[11px] font-bold tracking-wide uppercase">
                  Fecha
                </th>
                <th className="text-cobalto py-2 pr-3 text-[11px] font-bold tracking-wide uppercase">
                  Horario
                </th>
                <th className="text-cobalto py-2 pr-3 text-[11px] font-bold tracking-wide uppercase">
                  Materia
                </th>
                <th className="text-cobalto py-2 pr-3 text-[11px] font-bold tracking-wide uppercase">
                  Profesor
                </th>
                <th className="text-cobalto py-2 pr-3 text-[11px] font-bold tracking-wide uppercase">
                  Estado
                </th>
                <th className="text-cobalto py-2 text-[11px] font-bold tracking-wide uppercase">
                  Prioridad
                </th>
              </tr>
            </thead>
            <tbody>
              {turnosAImprimir.map((turno, i) => (
                <tr
                  key={`${turno.turnoId}-${turno.fecha}`}
                  className={i % 2 === 1 ? 'bg-black/2' : undefined}
                >
                  <td className="py-2 pr-3 whitespace-nowrap">{fechaConDia(turno.fecha)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {rangoHoras(turno.horaInicio, turno.horaFin)}
                  </td>
                  <td className="py-2 pr-3">{turno.materia.nombre}</td>
                  <td className="py-2 pr-3">
                    {turno.profesor.nombre} {turno.profesor.apellido}
                  </td>
                  <td className="py-2 pr-3">{ESTADO_TURNO[turno.estado].etiqueta}</td>
                  <td className="py-2">
                    {turno.prioridad ? ETIQUETA_PRIORIDAD[turno.prioridad] : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DocumentoOficial>
    </>
  )
}
