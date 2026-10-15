'use client'

import { Pencil } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { OcurrenciaDetalle } from '@/types/ocurrencia'

import {
  horasOfrecidasDelDetalle,
  tieneAsistenciaRegistrada,
  valoresDeAsistencia,
} from '../registro-asistencia'
import { FormularioAsistencia } from './FormularioAsistencia'

export type RegistrarAsistenciaTurnoProps = {
  /** Lo que usa del detalle del turno (`GET /ocurrencias/{turnoId}/{fecha}`). */
  ocurrencia: Pick<
    OcurrenciaDetalle,
    'turnoId' | 'fecha' | 'horaInicio' | 'alumno' | 'asistencia' | 'acciones'
  >
  horasSeguidas: OcurrenciaDetalle['horasSeguidas']
}

/**
 * Registrar o corregir la asistencia desde el detalle del turno (HU-22, T-85). Solo se muestra si
 * la API lo permite (`acciones.registrarAsistencia.visible`: el profesor del turno, con el plazo
 * abierto). Sin asistencia, el formulario directo; con asistencia, "Corregir", que lo abre con lo de
 * esa hora. Lo registrado ya lo muestra el detalle (sección "Asistencia"): acá no se repite.
 * "Aplicar también a…" ofrece las horas seguidas que la API marca `registrable`. Al guardar, el
 * detalle se vuelve a pedir solo (`useRegistrarAsistencias` invalida las ocurrencias).
 */
export function RegistrarAsistenciaTurno({
  ocurrencia,
  horasSeguidas,
}: RegistrarAsistenciaTurnoProps) {
  const [corrigiendo, setCorrigiendo] = useState(false)

  if (!ocurrencia.acciones.registrarAsistencia.visible) return null

  const registrada = tieneAsistenciaRegistrada(ocurrencia.asistencia)

  if (registrada && !corrigiendo) {
    return (
      <Button
        size="lg"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => setCorrigiendo(true)}
      >
        <Pencil aria-hidden />
        Corregir
      </Button>
    )
  }

  return (
    <div className="border-border border-t pt-4">
      <h4 className="mb-3 text-sm font-semibold">
        {registrada ? 'Corregir la asistencia' : 'Registrar la asistencia'}
      </h4>
      <FormularioAsistencia
        // Al corregir, abre con lo registrado de esa hora; tras guardar, el detalle trae lo nuevo.
        key={registrada ? 'corregir' : 'registrar'}
        etiqueta={`Asistencia de ${ocurrencia.alumno.apellido}, ${ocurrencia.alumno.nombre}`}
        valoresIniciales={valoresDeAsistencia(registrada ? ocurrencia.asistencia : null)}
        hora={ocurrencia}
        horasOfrecidas={horasOfrecidasDelDetalle(horasSeguidas)}
        onGuardado={() => setCorrigiendo(false)}
        onCancelar={registrada ? () => setCorrigiendo(false) : undefined}
      />
    </div>
  )
}
