'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { BotonVolverImprimir, SeccionImpresa } from '@/components/impresion/campo-impreso'
import { DocumentoOficial } from '@/components/impresion/DocumentoOficial'
import { ESTADO_TURNO, ETIQUETA_PRIORIDAD } from '@/components/turno/indicadores-turno'
import { listarAgenda } from '@/features/agendas/api/agendas.api'
import type { AgendaItem, AgendaListadoParams } from '@/features/agendas/agendas.types'
import { authClient } from '@/features/auth/auth-client'
import { useCentro } from '@/features/centro/hooks/use-centro'
import { useImprimirCuandoEsteListo } from '@/hooks/use-imprimir'
import type { EstadoOcurrencia, PrioridadOcurrencia } from '@/types/ocurrencia'
import { fechaConDia } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

// Hoja de impresión de la agenda diaria (HU-11, T-60): `DocumentoOficial` con todas las filas del
// día (no sólo la página visible) y los datos del centro (`useCentro`, T-64). Se imprime sola al
// cargar (`useImprimirCuandoEsteListo`).

const PAGE_SIZE_MAXIMO = 100

/** Todas las filas de `GET /agendas/diaria`, juntando páginas de a `PAGE_SIZE_MAXIMO`. */
async function listarAgendaCompleta(
  params: Omit<AgendaListadoParams, 'page' | 'pageSize'>,
): Promise<AgendaItem[]> {
  const primera = await listarAgenda({ ...params, page: 1, pageSize: PAGE_SIZE_MAXIMO })
  if (primera.meta.totalPages <= 1) return primera.data

  const restantes = await Promise.all(
    Array.from({ length: primera.meta.totalPages - 1 }, (_, i) =>
      listarAgenda({ ...params, page: i + 2, pageSize: PAGE_SIZE_MAXIMO }),
    ),
  )
  return [primera, ...restantes].flatMap((pagina) => pagina.data)
}

export default function ImprimirAgendaPage() {
  const searchParams = useSearchParams()
  const fecha = searchParams.get('fecha') ?? ''
  const profesorIdParam = searchParams.get('profesorId')
  const profesorId = profesorIdParam ? Number(profesorIdParam) : undefined
  const estado = (searchParams.get('estado') as EstadoOcurrencia | null) ?? undefined
  const prioridad = (searchParams.get('prioridad') as PrioridadOcurrencia | null) ?? undefined

  const agenda = useQuery({
    queryKey: ['agendas', 'imprimir', { fecha, profesorId, estado, prioridad }],
    queryFn: () => listarAgendaCompleta({ fecha, profesorId, estado, prioridad }),
  })
  const centro = useCentro()
  const { data: session } = authClient.useSession()
  const [logoListo, setLogoListo] = useState(false)

  const listo = Boolean(agenda.data && centro.data && session) && logoListo
  useImprimirCuandoEsteListo(listo)

  if (agenda.isLoading || centro.isLoading) {
    return (
      <>
        <BotonVolverImprimir />
        <p className="text-muted-foreground p-10 text-sm">Preparando el documento…</p>
      </>
    )
  }

  if (agenda.isError || centro.isError || !agenda.data || !centro.data || !session) {
    return (
      <>
        <BotonVolverImprimir />
        <p className="text-destructive p-10 text-sm">
          No se pudo armar el documento. Volvé y probá de nuevo desde la agenda.
        </p>
      </>
    )
  }

  const emitidoPor = [session.user.name, session.user.apellido].filter(Boolean).join(' ')
  const primerProfesor = agenda.data[0]?.profesor
  const filtros = [
    profesorId != null &&
      `Profesor: ${primerProfesor ? `${primerProfesor.nombre} ${primerProfesor.apellido}` : `#${profesorId}`}`,
    estado && `Estado: ${ESTADO_TURNO[estado].etiqueta}`,
    prioridad && `Prioridad: ${ETIQUETA_PRIORIDAD[prioridad]}`,
  ].filter((texto): texto is string => Boolean(texto))

  return (
    <>
      <BotonVolverImprimir />
      <DocumentoOficial
        titulo="Agenda diaria"
        emitidoPor={emitidoPor}
        centro={centro.data}
        onLogoListo={() => setLogoListo(true)}
      >
        <SeccionImpresa>
          <p className="text-lg font-semibold text-black">{fechaConDia(fecha)}</p>
          {filtros.length > 0 && (
            <p className="text-dorado mt-1 text-xs font-bold tracking-wide uppercase">
              {filtros.join(' · ')}
            </p>
          )}
        </SeccionImpresa>

        {agenda.data.length === 0 ? (
          <p className="mt-5 text-sm text-black/70">No hay turnos para este día.</p>
        ) : (
          <table className="mt-5 w-full border-collapse text-sm">
            <thead>
              <tr className="border-dorado/50 border-b-2 text-left">
                <th className="text-dorado py-2 pr-3 text-[11px] font-bold tracking-wide uppercase">
                  Horario
                </th>
                <th className="text-dorado py-2 pr-3 text-[11px] font-bold tracking-wide uppercase">
                  Alumno
                </th>
                <th className="text-dorado py-2 pr-3 text-[11px] font-bold tracking-wide uppercase">
                  Profesor
                </th>
                <th className="text-dorado py-2 pr-3 text-[11px] font-bold tracking-wide uppercase">
                  Materia
                </th>
                <th className="text-dorado py-2 pr-3 text-[11px] font-bold tracking-wide uppercase">
                  Aula
                </th>
                <th className="text-dorado py-2 text-[11px] font-bold tracking-wide uppercase">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {agenda.data.map((turno, i) => (
                <tr
                  key={`${turno.turnoId}-${turno.fecha}`}
                  className={i % 2 === 1 ? 'bg-black/2' : undefined}
                >
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {rangoHoras(turno.horaInicio, turno.horaFin)}
                  </td>
                  <td className="py-2 pr-3">
                    {turno.alumno.nombre} {turno.alumno.apellido}
                  </td>
                  <td className="py-2 pr-3">
                    {turno.profesor.nombre} {turno.profesor.apellido}
                  </td>
                  <td className="py-2 pr-3">{turno.materia.nombre}</td>
                  <td className="py-2 pr-3">{turno.aula.nombre}</td>
                  <td className="py-2">{ESTADO_TURNO[turno.estado].etiqueta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DocumentoOficial>
    </>
  )
}
