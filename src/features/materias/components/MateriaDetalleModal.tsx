'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dato, Datos } from '@/components/ui/datos'
import { DetalleModal } from '@/components/ui/detalle-modal'

import { useMateria } from '../hooks/use-materia'
import { ConfirmarBajaMateria } from './ConfirmarBajaMateria'
import { ProfesoresDeMateria } from './ProfesoresDeMateria'

type MateriaDetalleModalProps = {
  materiaId: number
  /** URL del listado de profesores en el segmento del rol (por ejemplo `/mesa/profesores`). */
  rutaProfesores: string
  onCerrar: () => void
}

// Detalle de una materia como modal (no tiene página propia, decisión T-34): sus datos, los
// profesores que la dictan y la trazabilidad. Desde acá se la da de baja.
export function MateriaDetalleModal({
  materiaId,
  rutaProfesores,
  onCerrar,
}: MateriaDetalleModalProps) {
  const { data: materia, isLoading, error, refetch } = useMateria(materiaId)
  const [confirmandoBaja, setConfirmandoBaja] = useState(false)
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
          activa && (
            <Button size="lg" variant="destructive" onClick={() => setConfirmandoBaja(true)}>
              <Trash2 />
              Dar de baja
            </Button>
          )
        }
      >
        {materia && (
          <div className="space-y-6">
            <Datos>
              <Dato label="Nombre" valor={materia.nombre} />
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
        materia={confirmandoBaja && materia ? materia : null}
        rutaProfesores={rutaProfesores}
        onCerrar={() => setConfirmandoBaja(false)}
        // Dada de baja, el detalle ya no tiene nada que mostrar: se cierra y vuelve al listado.
        onDadaDeBaja={onCerrar}
      />
    </>
  )
}
