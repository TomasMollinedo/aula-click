'use client'

import { type ReactNode, useState } from 'react'
import { AlertCircle, CalendarClock, ClipboardPen, Pencil, Plus, Trash2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationControls } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import type { Role } from '@/types'
import type { ExamenItem } from '../examenes.types'
import {
  fechaExamen,
  textoCargadoPor,
  textoDiasRestantes,
  textoModificadoPor,
  textoNotaCargadaPor,
  textoNotaModificadaPor,
  textoRendidosSinNota,
} from '../formato-examenes'
import { useExamenes } from '../hooks/use-examenes'
import { usePaginaPasados } from '../hooks/use-pagina-pasados'
import { paginar, textoMostrando } from '../pagina-pasados'
import { BadgeNota } from './BadgeNota'
import { ConfirmarEliminarExamen } from './ConfirmarEliminarExamen'
import { ExamenDialog } from './ExamenDialog'
import { NotaDialog } from './NotaDialog'

export type ExamenesDelAlumnoProps = {
  alumnoId: number
  /**
   * Rol de quien mira. Solo elige el texto de ayuda: qué examen se puede editar o eliminar
   * (`administrable`) y en qué materias se puede cargar uno lo dice la API.
   */
  rol: Role
}

/** Qué formulario está abierto: el alta o la edición de un examen (por id, se lee de la lista). */
type Formulario = { tipo: 'nuevo' } | { tipo: 'editar'; examenId: number }

/**
 * Pestaña "Exámenes" de la ficha del alumno (HU-17): próximos (con los días que faltan, de la API)
 * y pasados, "+ Nuevo examen" y, por fila, editar y eliminar. Los rendidos muestran su nota, y
 * "Cargar nota" o "Editar nota" según `cargarNota` de la API (HU-34).
 */
export function ExamenesDelAlumno({ alumnoId, rol }: ExamenesDelAlumnoProps) {
  const { data, isLoading, isError, error, refetch } = useExamenes(alumnoId)
  // Los pasados se paginan en la pantalla: la API los manda todos (`pagina-pasados.ts`).
  const paginaPasados = usePaginaPasados()
  const pasados = paginar(data?.pasados ?? [], paginaPasados.page)

  // `formulario` se conserva al cerrar, así el diálogo no cambia de contenido mientras se va.
  const [formulario, setFormulario] = useState<Formulario>({ tipo: 'nuevo' })
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [aEliminar, setAEliminar] = useState<ExamenItem | null>(null)
  const [aCalificar, setACalificar] = useState<ExamenItem | null>(null)

  const abrir = (cual: Formulario) => {
    setFormulario(cual)
    setFormularioAbierto(true)
  }

  const buscar = (id: number) =>
    [...(data?.proximos ?? []), ...(data?.pasados ?? [])].find((e) => e.id === id)
  const examenEditado = formulario.tipo === 'editar' ? buscar(formulario.examenId) : undefined

  // Qué examen se puede editar y eliminar lo dice la API (el profesor, solo los de sus materias).
  // Cargar la nota: lo dice `cargarNota` de la API (rendido y de una materia propia). El profesor
  // ve las notas de las otras materias en sólo lectura.
  const acciones = (examen: ExamenItem) =>
    (examen.administrable || examen.cargarNota) && (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        {examen.cargarNota && (
          <Button variant="outline" size="sm" onClick={() => setACalificar(examen)}>
            <ClipboardPen />
            {examen.resultado === null ? 'Cargar nota' : 'Editar nota'}
          </Button>
        )}
        {examen.administrable && (
          <>
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
          </>
        )}
      </div>
    )
  const avisoSinNota = data ? textoRendidosSinNota(data.rendidosSinNota) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Los exámenes determinan la prioridad de los turnos del alumno.
          {rol === 'PROFESOR' &&
            ' Solo podés cargar, editar y eliminar los de las materias que le dictás.'}
        </p>
        <Button size="lg" onClick={() => abrir({ tipo: 'nuevo' })} disabled={isError}>
          <Plus />
          Nuevo examen
        </Button>
      </div>

      {avisoSinNota && (
        <Alert>
          <ClipboardPen className="size-4" />
          <AlertDescription className="text-foreground">{avisoSinNota}</AlertDescription>
        </Alert>
      )}

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
            <SeccionExamenes
              titulo="Pasados"
              total={data.pasados.length}
              examenes={pasados.items}
              acciones={acciones}
              pie={
                <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted-foreground text-sm">
                    {textoMostrando(pasados.page, data.pasados.length)}
                  </p>
                  <PaginationControls
                    page={pasados.page}
                    totalPages={pasados.totalPages}
                    onPageChange={paginaPasados.cambiar}
                  />
                </div>
              }
            />
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
      <NotaDialog examen={aCalificar} onCerrar={() => setACalificar(null)} />
    </div>
  )
}

function SeccionExamenes({
  titulo,
  total,
  vacio,
  examenes,
  acciones,
  pie,
}: {
  titulo: string
  /** El pie de la tarjeta (la paginación de los pasados), dentro de ella. */
  pie?: ReactNode
  /** Cuántos tiene la sección en total (con paginación, más que los que se muestran). */
  total?: number
  /** Texto si la sección no tiene exámenes. */
  vacio?: string
  examenes: ExamenItem[]
  acciones: (examen: ExamenItem) => ReactNode
}) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">
        {titulo}{' '}
        <span className="text-muted-foreground font-normal">({total ?? examenes.length})</span>
      </h3>
      {examenes.length === 0 ? (
        <p className="text-muted-foreground text-sm">{vacio}</p>
      ) : (
        <Card className="divide-border gap-0 divide-y p-0">
          {examenes.map((examen) => {
            const modificado = textoModificadoPor(examen)
            const notaCargada = textoNotaCargadaPor(examen)
            const notaModificada = textoNotaModificadaPor(examen)
            // Los pasados muestran la nota, "Ausente" o "Sin nota"; uno de hoy, sólo si ya la tiene.
            const conNota = examen.pasado || examen.resultado !== null
            return (
              <article key={examen.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{examen.materia.nombre}</span>
                    {examen.diasRestantes !== null && (
                      <Badge variant="accent">{textoDiasRestantes(examen.diasRestantes)}</Badge>
                    )}
                    {conNota && <BadgeNota resultado={examen.resultado} nota={examen.nota} />}
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
                    {notaCargada && <p>{notaCargada}</p>}
                    {notaModificada && <p>{notaModificada}</p>}
                  </div>
                </div>
                {acciones(examen)}
              </article>
            )
          })}
          {pie}
        </Card>
      )}
    </section>
  )
}
