'use client'

import { Pencil, UserRound } from 'lucide-react'
import { useState } from 'react'

import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { rangoHoras } from '@/utils/horas'

import type { PlazoAsistencia } from '../asistencias.types'
import {
  OBSERVACION_CIERRE_SISTEMA,
  fechaCortaAsistencia,
  textoOtrasHoras,
} from '../formato-asistencias'
import {
  type FilaDeHora,
  otrasHorasSinRegistrar,
  seVeCompacta,
  textosRegistrados,
  valoresIniciales,
} from '../registro-asistencia'
import { FormularioAsistencia } from './FormularioAsistencia'

type Props = {
  fila: FilaDeHora
  /** El plazo del día (el mismo para todas las horas): lo manda la API. */
  plazo: PlazoAsistencia
  /** El plazo no venció: con `false`, todo en sólo lectura. */
  editable: boolean
}

/**
 * Una fila compacta: un alumno en una hora. Datos, estado, indicaciones de la clase anterior y, si
 * el día es editable, el registro (o la corrección). Si no, sólo lectura.
 */
export function FilaAsistencia({ fila, plazo, editable }: Props) {
  const { alumno, hora } = fila

  return (
    <li className="space-y-4 px-4 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        <Avatar className="size-10">
          {alumno.fotoUrl && <AvatarImage src={alumno.fotoUrl} alt="" />}
          <AvatarFallback>
            <UserRound aria-hidden className="size-5" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-semibold">
              {alumno.apellido}, {alumno.nombre}
            </p>
            <EstadoTurnoBadge estado={hora.estado} plazo={plazo} />
          </div>
          <p className="text-muted-foreground text-sm">
            {fila.materia.nombre} · {rangoHoras(hora.horaInicio, hora.horaFin)}
            {fila.otrasHoras.length > 0 && ` · también ${textoOtrasHoras(fila.otrasHoras)}`}
          </p>
          {fila.temas && (
            <p className="text-sm">
              <span className="text-muted-foreground">Temas a trabajar: </span>
              {fila.temas}
            </p>
          )}
        </div>
      </div>

      {fila.indicacionesAnteriores && (
        <div className="bg-canvas rounded-lg px-3 py-2 text-sm">
          <p className="text-muted-foreground text-xs font-medium">
            Indicaciones de la clase anterior (
            {fechaCortaAsistencia(fila.indicacionesAnteriores.fecha)})
          </p>
          <p className="whitespace-pre-line">{fila.indicacionesAnteriores.indicaciones}</p>
        </div>
      )}

      {editable ? <RegistroEditable fila={fila} /> : <Registrado fila={fila} />}
    </li>
  )
}

/**
 * Día editable. Una hora ya registrada se ve compacta, en sólo lectura, con "Corregir", que abre
 * el mismo formulario. Sin registrar, el formulario directo. Al guardar, vuelve a compacta.
 */
function RegistroEditable({ fila }: { fila: FilaDeHora }) {
  const compacta = seVeCompacta(fila)
  const [corrigiendo, setCorrigiendo] = useState(false)

  if (compacta && !corrigiendo) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Registrado fila={fila} />
        </div>
        <Button size="sm" variant="outline" onClick={() => setCorrigiendo(true)}>
          <Pencil aria-hidden />
          Corregir
        </Button>
      </div>
    )
  }
  return (
    <RegistroFila
      fila={fila}
      onGuardado={() => setCorrigiendo(false)}
      onCancelar={compacta ? () => setCorrigiendo(false) : undefined}
    />
  )
}

/** El formulario de la fila: estado, textos y "Aplicar también a…" sus otras horas. */
function RegistroFila({
  fila,
  onGuardado,
  onCancelar,
}: {
  fila: FilaDeHora
  onGuardado: () => void
  /** Sólo al corregir: cierra el formulario sin guardar. */
  onCancelar?: () => void
}) {
  return (
    <FormularioAsistencia
      etiqueta={`Asistencia de ${fila.alumno.apellido}, ${fila.alumno.nombre}`}
      valoresIniciales={valoresIniciales(fila)}
      hora={fila.hora}
      // Las otras horas del alumno sin registrar (las registradas se corrigen en su fila).
      horasOfrecidas={otrasHorasSinRegistrar(fila)}
      onGuardado={onGuardado}
      onCancelar={onCancelar}
    />
  )
}

/**
 * Lo registrado de la hora (compacto o sólo lectura): sólo los textos que tienen algo, en chico.
 * Un "Sin registrar" cerrado por el sistema muestra su observación de cierre.
 */
function Registrado({ fila }: { fila: FilaDeHora }) {
  const { asistencia, estado } = fila.hora
  if (!asistencia) {
    return estado === 'SIN_REGISTRAR' ? (
      <p className="text-muted-foreground text-sm">
        <span className="font-medium">Observación: </span>
        {OBSERVACION_CIERRE_SISTEMA}
      </p>
    ) : null
  }
  const textos = textosRegistrados(fila)
  if (textos.length === 0) return null
  return (
    <div className="space-y-0.5 text-sm">
      {textos.map(([etiqueta, texto]) => (
        <p key={etiqueta} className="whitespace-pre-line">
          <span className="text-muted-foreground">{etiqueta}: </span>
          {texto}
        </p>
      ))}
    </div>
  )
}
