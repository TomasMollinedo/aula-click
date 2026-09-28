'use client'

import type { TurnoVigenteProfesor } from '../profesores.types'
import { textoVigencia } from '../turnos-vigentes'

/** Cuántos turnos se muestran: los demás se ven en la agenda, no en el diálogo. */
const MAX_TURNOS = 3

type TurnosQueImpidenLaBajaProps = {
  turnos: TurnoVigenteProfesor[]
}

/**
 * Una muestra de los turnos vigentes que impiden la baja del profesor (409 `TURNOS_VIGENTES`):
 * los **tres más próximos** (la API los devuelve por fecha), con alumno, materia y cuándo ocurren.
 * El resto no se lista —el diálogo quedaría interminable—: cuántos son lo dice el resumen de
 * arriba y se ven en la agenda. Sólo lectura: cancelar o reasignar un turno no está en este
 * incremento.
 */
export function TurnosQueImpidenLaBaja({ turnos }: TurnosQueImpidenLaBajaProps) {
  const visibles = turnos.slice(0, MAX_TURNOS)

  return (
    <div className="space-y-2">
      <ul className="divide-border border-border divide-y rounded-lg border">
        {visibles.map((turno, i) => (
          <li key={i} className="px-4 py-3 text-sm">
            <span className="block truncate">
              <span className="font-medium">{turno.alumno.apellido}</span>, {turno.alumno.nombre}
            </span>
            <span className="text-muted-foreground">
              {turno.materia.nombre} · {textoVigencia(turno)}
            </span>
          </li>
        ))}
      </ul>

      {turnos.length > MAX_TURNOS && (
        <p className="text-muted-foreground text-sm">
          Se muestran los {MAX_TURNOS} turnos más próximos. Para ver todos, entrá a la agenda.
        </p>
      )}
    </div>
  )
}
