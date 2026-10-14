'use client'

import { AlertCircle, CheckCheck } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { rangoHoras } from '@/utils/horas'

import type { ClaseAsistencia, PlazoAsistencia } from '../asistencias.types'
import { mensajeErrorRegistro } from '../errores-asistencias'
import { MENSAJE_REGISTRADA } from '../formato-asistencias'
import { useRegistrarAsistencias } from '../hooks/use-registrar-asistencias'
import { registrosMarcarTodos } from '../registro-asistencia'
import { FilaAsistencia } from './FilaAsistencia'

/** La firma de lo registrado en una fila: si cambia, la fila se vuelve a montar con esos valores. */
function claveFila(fila: ClaseAsistencia['filas'][number]): string {
  return fila.ocurrencias
    .map((h) => `${h.turnoId}|${h.fecha}|${JSON.stringify(h.asistencia)}`)
    .join(';')
}

/**
 * Una tarjeta por clase: horario, materia y aula, "Marcar todos presentes" (las filas sin
 * registrar) y una fila por alumno.
 */
export function TarjetaClase({
  clase,
  plazo,
  editable,
}: {
  clase: ClaseAsistencia
  plazo: PlazoAsistencia
  editable: boolean
}) {
  const toast = useToast()
  const registrar = useRegistrarAsistencias()
  const [error, setError] = useState<string | null>(null)
  const materias = [...new Set(clase.filas.map((f) => f.materia.nombre))].join(', ')
  const sinRegistrar = registrosMarcarTodos(clase)

  function marcarTodos() {
    setError(null)
    registrar.mutate(
      { registros: sinRegistrar },
      {
        onSuccess: () => toast.success(MENSAJE_REGISTRADA),
        onError: (e) => setError(mensajeErrorRegistro(e)),
      },
    )
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{rangoHoras(clase.horaInicio, clase.horaFin)}</h2>
          <p className="text-muted-foreground text-sm">
            {materias ? `${materias} · ` : ''}
            {clase.aula.nombre}
          </p>
        </div>
        {editable && sinRegistrar.length > 0 && (
          <Button
            variant="outline"
            onClick={marcarTodos}
            disabled={registrar.isPending}
            className="w-full sm:w-auto"
          >
            <CheckCheck aria-hidden />
            Marcar todos presentes
          </Button>
        )}
      </div>

      {error && (
        <div className="px-4 pt-4 sm:px-6">
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {clase.filas.length === 0 ? (
        <p className="text-muted-foreground px-4 py-4 text-sm sm:px-6">
          Los alumnos de esta hora siguen desde una hora anterior: están en esa clase.
        </p>
      ) : (
        <ul className="divide-y">
          {clase.filas.map((fila) => (
            <FilaAsistencia key={claveFila(fila)} fila={fila} plazo={plazo} editable={editable} />
          ))}
        </ul>
      )}
    </Card>
  )
}
