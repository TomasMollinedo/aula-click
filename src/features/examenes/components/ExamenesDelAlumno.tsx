'use client'

import { type ReactNode, useState } from 'react'
import { AlertCircle, CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { Role } from '@/types'

import type { ExamenItem } from '../examenes.types'
import {
  etiquetaTipo,
  fechaExamen,
  textoCargadoPor,
  textoDiasRestantes,
  textoModificadoPor,
} from '../formato-examenes'
import { useExamenes } from '../hooks/use-examenes'
import { useMateriasExamen } from '../hooks/use-materias-examen'
import { ConfirmarEliminarExamen } from './ConfirmarEliminarExamen'
import { ExamenDialog } from './ExamenDialog'

export type ExamenesDelAlumnoProps = {
  alumnoId: number
  /**
   * Rol de quien mira: mesa de entradas administra cualquier examen; el profesor, solo los de las
   * materias que le dicta a este alumno. Es ayuda visual: lo que decide es el 403 de la API.
   */
  rol: Role
}

/** Qué formulario está abierto: el alta o la edición de un examen (por id, se lee de la lista). */
type Formulario = { tipo: 'nuevo' } | { tipo: 'editar'; examenId: number }

/**
 * Pestaña "Exámenes" de la ficha del alumno (HU-17): próximos (con los días que faltan, de la API)
 * y pasados, "+ Nuevo examen" y, por fila, editar y eliminar.
 */
export function ExamenesDelAlumno({ alumnoId, rol }: ExamenesDelAlumnoProps) {
  const { data, isLoading, isError, error, refetch } = useExamenes(alumnoId)
  const materias = useMateriasExamen(alumnoId)

  // `formulario` se conserva al cerrar, así el diálogo no cambia de contenido mientras se va.
  const [formulario, setFormulario] = useState<Formulario>({ tipo: 'nuevo' })
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [aEliminar, setAEliminar] = useState<ExamenItem | null>(null)

  const abrir = (cual: Formulario) => {
    setFormulario(cual)
    setFormularioAbierto(true)
  }

  const buscar = (id: number) =>
    [...(data?.proximos ?? []), ...(data?.pasados ?? [])].find((e) => e.id === id)
  const examenEditado = formulario.tipo === 'editar' ? buscar(formulario.examenId) : undefined

  // El profesor solo administra los exámenes de las materias que dicta: son las ofrecibles.
  const puedeAdministrar = (examen: ExamenItem) =>
    rol !== 'PROFESOR' || (materias.data ?? []).some((m) => m.id === examen.materia.id)
  const sinMaterias = materias.data?.length === 0

  const acciones = (examen: ExamenItem) =>
    puedeAdministrar(examen) && (
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Editar el examen de ${examen.materia.nombre}`}
          onClick={() => abrir({ tipo: 'editar', examenId: examen.id })}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive"
          aria-label={`Eliminar el examen de ${examen.materia.nombre}`}
          onClick={() => setAEliminar(examen)}
        >
          <Trash2 />
        </Button>
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {sinMaterias
            ? rol === 'PROFESOR'
              ? 'No le dictás ninguna materia a este alumno: no podés cargarle exámenes.'
              : 'No hay materias activas para cargar un examen.'
            : 'Los exámenes determinan la prioridad de los turnos del alumno.'}
        </p>
        <Button
          size="lg"
          onClick={() => abrir({ tipo: 'nuevo' })}
          disabled={isError || !materias.data || sinMaterias}
        >
          <Plus />
          Nuevo examen
        </Button>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
            {error?.status === 403
              ? 'No tenés permiso para ver los exámenes de este alumno'
              : (error?.message ?? 'Ocurrió un error inesperado')}
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading || !data ? (
        <Card>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </Card>
      ) : data.proximos.length === 0 && data.pasados.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={CalendarClock}
            title="Sin exámenes"
            description="Este alumno todavía no tiene exámenes cargados."
          />
        </Card>
      ) : (
        <>
          <SeccionExamenes
            titulo="Próximos"
            vacio="No tiene exámenes próximos."
            examenes={data.proximos}
            acciones={acciones}
          />
          {data.pasados.length > 0 && (
            <SeccionExamenes titulo="Pasados" examenes={data.pasados} acciones={acciones} />
          )}
        </>
      )}

      <ExamenDialog
        alumnoId={alumnoId}
        open={formularioAbierto}
        examen={examenEditado}
        onCerrar={() => setFormularioAbierto(false)}
        editarExistente={(id) =>
          buscar(id) ? () => abrir({ tipo: 'editar', examenId: id }) : null
        }
      />
      <ConfirmarEliminarExamen examen={aEliminar} onCerrar={() => setAEliminar(null)} />
    </div>
  )
}

function SeccionExamenes({
  titulo,
  vacio,
  examenes,
  acciones,
}: {
  titulo: string
  /** Texto si la sección no tiene exámenes. */
  vacio?: string
  examenes: ExamenItem[]
  acciones: (examen: ExamenItem) => ReactNode
}) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">
        {titulo} <span className="text-muted-foreground font-normal">({examenes.length})</span>
      </h3>
      {examenes.length === 0 ? (
        <p className="text-muted-foreground text-sm">{vacio}</p>
      ) : (
        <Card className="divide-border gap-0 divide-y p-0">
          {examenes.map((examen) => {
            const modificado = textoModificadoPor(examen)
            return (
              <article key={examen.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{examen.materia.nombre}</span>
                    <Badge variant="outline">{etiquetaTipo(examen.tipo)}</Badge>
                    {examen.diasRestantes !== null && (
                      <Badge variant="accent">{textoDiasRestantes(examen.diasRestantes)}</Badge>
                    )}
                  </div>
                  <p className="text-sm">{fechaExamen(examen.fecha)}</p>
                  {examen.observaciones && (
                    <p className="text-muted-foreground text-sm break-words whitespace-pre-line">
                      {examen.observaciones}
                    </p>
                  )}
                  <div className="text-muted-foreground space-y-0.5 text-xs">
                    <p>{textoCargadoPor(examen)}</p>
                    {modificado && <p>{modificado}</p>}
                  </div>
                </div>
                {acciones(examen)}
              </article>
            )
          })}
        </Card>
      )}
    </section>
  )
}
