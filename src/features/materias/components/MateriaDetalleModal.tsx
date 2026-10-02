'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Undo2, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Dato, Datos } from '@/components/ui/datos'
import { DetalleModal, DetalleModalAccion } from '@/components/ui/detalle-modal'

import { useMateria } from '../hooks/use-materia'
import { ConfirmarBajaMateria } from './ConfirmarBajaMateria'
import { ConfirmarReactivacionMateria } from './ConfirmarReactivacionMateria'
import { PrecioMateria } from './PrecioMateria'
import { ProfesoresDeMateria } from './ProfesoresDeMateria'

type MateriaDetalleModalProps = {
  materiaId: number
  /** URL del listado de profesores en el segmento del rol; sin ella, los profesores van sin link. */
  rutaProfesores?: string
  /**
   * Muestra "Editar", "Dar de baja" y "Reactivar". Lo decide la página según el segmento (solo el
   * gerente); es ayuda visual: la seguridad es el 403 de la API.
   */
  puedeEscribir: boolean
  /** URL de la edición de esta materia (`?editar=<id>` sobre el listado). */
  hrefEditar: string
  /** Al ir a la edición con un link de este detalle (para que cerrarla vuelva a él). */
  onEditar: () => void
  onCerrar: () => void
}

// Detalle de una materia como modal (no tiene página propia, decisión T-34): sus datos con el
// precio, los profesores que la dictan y la trazabilidad. Desde acá el gerente la edita, la da de
// baja o la reactiva.
export function MateriaDetalleModal({
  materiaId,
  rutaProfesores,
  puedeEscribir,
  hrefEditar,
  onEditar,
  onCerrar,
}: MateriaDetalleModalProps) {
  const { data: materia, isLoading, error, refetch } = useMateria(materiaId)
  const [confirmando, setConfirmando] = useState<'baja' | 'reactivar' | null>(null)
  const activa = materia?.estado === 'ACTIVO'

  return (
    <>
      <DetalleModal
        titulo="Detalle de la materia"
        descripcion={
          materia && (
            <span className="flex flex-wrap items-center gap-2">
              {materia.nombre}
              <Badge variant={activa ? 'confirmado' : 'secondary'}>
                {activa ? 'Activa' : 'Dada de baja'}
              </Badge>
            </span>
          )
        }
        onCerrar={onCerrar}
        cargando={isLoading}
        error={error}
        onReintentar={() => refetch()}
        textoNoEncontrado="Materia no encontrada"
        auditoria={materia}
        acciones={
          puedeEscribir &&
          materia && (
            <>
              <DetalleModalAccion variant="accent" asChild>
                <Link href={hrefEditar} onClick={onEditar} scroll={false}>
                  <Pencil />
                  Editar
                </Link>
              </DetalleModalAccion>
              {activa ? (
                <DetalleModalAccion variant="destructive" onClick={() => setConfirmando('baja')}>
                  <Trash2 />
                  Dar de baja
                </DetalleModalAccion>
              ) : (
                <DetalleModalAccion
                  variant="confirmado"
                  onClick={() => setConfirmando('reactivar')}
                >
                  <Undo2 />
                  Reactivar
                </DetalleModalAccion>
              )}
            </>
          )
        }
      >
        {materia && (
          <div className="space-y-6">
            <Datos>
              <Dato label="Nombre" valor={materia.nombre} />
              <Dato label="Precio por hora" valor={<PrecioMateria materia={materia} />} />
              <Dato
                label="Descripción"
                valor={materia.descripcion ?? <span className="text-muted-foreground">—</span>}
              />
            </Datos>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">
                Profesores que la dictan
                {materia.profesores.length > 0 && ` (${materia.profesores.length})`}
              </h3>
              {materia.profesores.length > 0 ? (
                <ProfesoresDeMateria
                  profesores={materia.profesores}
                  rutaProfesores={rutaProfesores}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Ningún profesor tiene esta materia asignada.
                </p>
              )}
            </section>
          </div>
        )}
      </DetalleModal>

      <ConfirmarBajaMateria
        materia={confirmando === 'baja' && materia ? materia : null}
        rutaProfesores={rutaProfesores}
        onCerrar={() => setConfirmando(null)}
        // Dada de baja, el detalle ya no tiene nada que mostrar: se cierra y vuelve al listado.
        onDadaDeBaja={onCerrar}
      />

      {/* Reactivada, el detalle queda abierto y muestra el estado nuevo (la mutación lo actualiza). */}
      <ConfirmarReactivacionMateria
        materia={confirmando === 'reactivar' && materia ? materia : null}
        hrefEditar={hrefEditar}
        onEditar={onEditar}
        onCerrar={() => setConfirmando(null)}
      />
    </>
  )
}
