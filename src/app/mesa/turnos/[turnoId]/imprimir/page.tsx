'use client'

import { use, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import {
  BotonVolverImprimir,
  Campo,
  Campos,
  SeccionImpresa,
} from '@/components/impresion/campo-impreso'
import { DocumentoOficial } from '@/components/impresion/DocumentoOficial'
import { authClient } from '@/features/auth/auth-client'
import { useCentro } from '@/features/centro/hooks/use-centro'
import { useOcurrencia } from '@/features/ocurrencias/hooks/use-ocurrencia'
import { useImprimirCuandoEsteListo } from '@/hooks/use-imprimir'
import { fechaConDia, fechaCorta } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

// Hoja de impresión de un turno (HU-11, T-60): `DocumentoOficial` con los datos de T-43 (vía el
// hook de T-44) y los del centro (vía `useCentro`, T-64). Se imprime sola al cargar
// (`useImprimirCuandoEsteListo`), con el diálogo nativo del navegador: ahí se guarda como PDF.
export default function ImprimirTurnoPage({
  params,
}: PageProps<'/mesa/turnos/[turnoId]/imprimir'>) {
  const { turnoId } = use(params)
  const searchParams = useSearchParams()
  const fecha = searchParams.get('fecha') ?? ''

  const ocurrencia = useOcurrencia({ turnoId: Number(turnoId), fecha })
  const centro = useCentro()
  const { data: session } = authClient.useSession()
  const [logoListo, setLogoListo] = useState(false)

  const listo = Boolean(ocurrencia.data && centro.data && session) && logoListo
  useImprimirCuandoEsteListo(listo)

  if (ocurrencia.isLoading || centro.isLoading) {
    return (
      <>
        <BotonVolverImprimir />
        <p className="text-muted-foreground p-10 text-sm">Preparando el documento…</p>
      </>
    )
  }

  if (ocurrencia.isError || centro.isError || !ocurrencia.data || !centro.data || !session) {
    return (
      <>
        <BotonVolverImprimir />
        <p className="text-destructive p-10 text-sm">
          No se pudo armar el documento. Volvé y probá de nuevo desde el detalle del turno.
        </p>
      </>
    )
  }

  const turno = ocurrencia.data
  const emitidoPor = [session.user.name, session.user.apellido].filter(Boolean).join(' ')

  return (
    <>
      <BotonVolverImprimir />
      <DocumentoOficial
        titulo="Detalle del turno"
        emitidoPor={emitidoPor}
        centro={centro.data}
        onLogoListo={() => setLogoListo(true)}
      >
        <div className="space-y-5">
          <SeccionImpresa>
            <Campos>
              <Campo label="Alumno" valor={`${turno.alumno.nombre} ${turno.alumno.apellido}`} />
              <Campo label="DNI" valor={turno.alumno.dni} />
              <Campo label="Materia" valor={turno.materia.nombre} />
              <Campo
                label="Profesor"
                valor={`${turno.profesor.nombre} ${turno.profesor.apellido}`}
              />
              <Campo label="Aula" valor={turno.aula.nombre} />
              <Campo label="Día y horario" valor={fechaConDia(turno.fecha)} />
              <Campo label="Horario" valor={rangoHoras(turno.horaInicio, turno.horaFin)} />
              <Campo
                label="Tipo"
                valor={turno.tipo === 'RECURRENTE' ? 'Recurrente' : 'Sesión única'}
              />
              {turno.tipo === 'RECURRENTE' && (
                <Campo
                  label="Período de la serie"
                  valor={`${fechaCorta(turno.serie.fechaInicio)} – ${
                    turno.serie.fechaFin ? fechaCorta(turno.serie.fechaFin) : 'sin fin'
                  }`}
                />
              )}
            </Campos>
          </SeccionImpresa>

          <SeccionImpresa>
            <Campo label="Temas a trabajar" valor={turno.temas} />
          </SeccionImpresa>
        </div>
      </DocumentoOficial>
    </>
  )
}
