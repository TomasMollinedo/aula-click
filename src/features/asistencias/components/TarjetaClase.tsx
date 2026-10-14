'use client'

import { AlertCircle, CheckCheck } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { rangoHoras } from '@/utils/horas'

import type { PlazoAsistencia } from '../asistencias.types'
import { mensajeErrorRegistro } from '../errores-asistencias'
import { MENSAJE_REGISTRADA } from '../formato-asistencias'
import { useRegistrarAsistencias } from '../hooks/use-registrar-asistencias'
import { type ClaseDeHora, type FilaDeHora, registrosMarcarTodos } from '../registro-asistencia'
import { FilaAsistencia } from './FilaAsistencia'

/** La firma de lo registrado en una fila: si cambia, la fila se vuelve a montar con esos valores. */
function claveFila(fila: FilaDeHora): string {
  return `${fila.clave}|${JSON.stringify(fila.hora.asistencia)}`
}

/**
 * Una tarjeta por clase (una hora): horario, "Marcar todos presentes" al lado (los alumnos de esa
 * hora sin registrar), materias y aula, y una fila por cada alumno de esa hora.
 */
export function TarjetaClase({
  clase,
  plazo,
  editable,
}: {
  clase: ClaseDeHora
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
      <div className="space-y-1 border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{rangoHoras(clase.horaInicio, clase.horaFin)}</h2>
          {editable && sinRegistrar.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={marcarTodos}
              disabled={registrar.isPending}
            >
              <CheckCheck aria-hidden />
              Marcar todos presentes
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {materias ? `${materias} · ` : ''}
          {clase.aula.nombre}
        </p>
      </div>

      {error && (
        <div className="px-4 pt-4 sm:px-6">
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <ul className="divide-y">
        {clase.filas.map((fila) => (
          <FilaAsistencia key={claveFila(fila)} fila={fila} plazo={plazo} editable={editable} />
        ))}
      </ul>
    </Card>
  )
}
