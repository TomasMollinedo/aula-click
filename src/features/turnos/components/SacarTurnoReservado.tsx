'use client'

import Link from 'next/link'
import { CalendarDays, CalendarPlus, CircleCheck, Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dato, Datos } from '@/components/ui/datos'
import { nombreDiaSemana } from '@/utils/dias-semana'

import { lineasFechasSinTurno } from '../formato-turnos'
import type { MiTurnoReservado } from '../mis-turnos.types'
import { textoFechasPortal, textoHorasElegidas } from '../sacar-turno'

type SacarTurnoReservadoProps = {
  reservado: MiTurnoReservado
  /** "Mi calendario" del portal (`/portal/calendario`). */
  hrefMiCalendario: string
  onSacarOtro: () => void
}

/**
 * "Turno reservado" (HU-29): el resumen que devuelve la API (un tramo por hora y por fechas
 * seguidas, y las fechas que quedaron sin turno), el aviso de que cancelar o reprogramar se hace
 * por la mesa de entrada y el acceso a "Mi calendario".
 */
export function SacarTurnoReservado({
  reservado,
  hrefMiCalendario,
  onSacarOtro,
}: SacarTurnoReservadoProps) {
  // Horas distintas (una por `bloqueId`), en el orden de la API.
  const horas = reservado.turnos.filter(
    (turno, i, turnos) => turnos.findIndex((t) => t.bloqueId === turno.bloqueId) === i,
  )
  // Los tramos con las mismas fechas (varias horas el mismo día) se muestran una vez.
  const fechas = [
    ...new Set(
      reservado.turnos.map((turno) => textoFechasPortal({ ...turno, tipo: reservado.tipo })),
    ),
  ]
  const sinTurno = lineasFechasSinTurno(reservado.fechasSinTurno)

  return (
    <Card role="region" aria-labelledby="turno-reservado" className="gap-5">
      <div className="flex items-start gap-3">
        <CircleCheck className="text-confirmado mt-0.5 size-6 shrink-0" aria-hidden />
        <div className="min-w-0">
          <h2 id="turno-reservado" className="text-lg leading-7 font-semibold">
            Turno reservado
          </h2>
          <p className="text-muted-foreground text-sm">Ya está en tu calendario.</p>
        </div>
      </div>

      <Datos>
        <Dato label="Materia" valor={reservado.materia.nombre} />
        <Dato
          label="Profesor"
          valor={`${reservado.profesor.nombre} ${reservado.profesor.apellido}`}
        />
        <Dato label="Aula" valor={reservado.aula.nombre} />
        <Dato
          label="Día y horario"
          valor={`${nombreDiaSemana(reservado.diaSemana)} ${textoHorasElegidas(horas)}`}
        />
        <Dato
          label="Fechas"
          className="sm:col-span-2"
          valor={
            fechas.length === 1 ? (
              fechas[0]
            ) : (
              <ul className="list-disc space-y-1 pl-5">
                {fechas.map((texto) => (
                  <li key={texto}>{texto}</li>
                ))}
              </ul>
            )
          }
        />
        {sinTurno.length > 0 && (
          <Dato
            label="Fechas sin turno (completas)"
            className="sm:col-span-2"
            valor={
              <ul className="list-disc space-y-1 pl-5">
                {sinTurno.map((linea) => (
                  <li key={linea}>{linea}</li>
                ))}
              </ul>
            }
          />
        )}
      </Datos>

      <p className="bg-canvas flex items-start gap-2 rounded-lg p-3 text-sm">
        <Info className="text-cobalto mt-0.5 size-4 shrink-0" aria-hidden />
        Para cancelar o reprogramar un turno, comunicate con la mesa de entrada.
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" onClick={onSacarOtro}>
          <CalendarPlus />
          Sacar otro turno
        </Button>
        <Button asChild size="lg">
          <Link href={hrefMiCalendario}>
            <CalendarDays />
            Ir a Mi calendario
          </Link>
        </Button>
      </div>
    </Card>
  )
}
