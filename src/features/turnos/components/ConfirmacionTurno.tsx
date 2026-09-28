'use client'

import Link from 'next/link'
import { CalendarCheck, CalendarX, Eye, Plus, UserRoundPlus } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dato, Datos } from '@/components/ui/datos'
import { nombreDiaSemana } from '@/utils/dias-semana'

import {
  lineasFechasSinTurno,
  textoHorario,
  textoRangoPedido,
  textoRangoTurno,
} from '../formato-turnos'
import { agruparTurnosPorHora } from '../seleccion-turno'
import {
  ESTADO_TURNO_LABEL,
  TIPO_TURNO_LABEL,
  type TurnoCrear,
  type TurnosAlta,
} from '../turnos.types'

type ConfirmacionTurnoProps = {
  alta: TurnosAlta
  /** El pedido que se aceptó (tipo y rango pedidos). */
  pedido: TurnoCrear
  /** URL que abre el detalle de un turno como modal sobre esta pantalla. */
  hrefDetalle: (turnoId: number) => string
  /** Se llama al abrir un detalle con el link en esta pestaña (para cerrarlo con Atrás). */
  onVerDetalle: () => void
  onRegistrarOtro: () => void
  onRegistrarOtroMismoAlumno: () => void
}

/**
 * Confirmación del alta (reemplaza al formulario): los datos del turno, cada hora con sus tramos
 * (un recurrente con fechas salteadas se guarda en varios) y las fechas que quedaron sin turno.
 */
export function ConfirmacionTurno({
  alta,
  pedido,
  hrefDetalle,
  onVerDetalle,
  onRegistrarOtro,
  onRegistrarOtroMismoAlumno,
}: ConfirmacionTurnoProps) {
  const [primero] = alta.turnos
  const horas = agruparTurnosPorHora(alta.turnos)
  const sinTurno = lineasFechasSinTurno(alta.fechasSinTurno)

  return (
    <Card className="gap-6" role="region" aria-labelledby="confirmacion-titulo">
      <div className="flex items-start gap-3">
        <span className="bg-confirmado/10 flex size-10 shrink-0 items-center justify-center rounded-full">
          <CalendarCheck className="text-confirmado size-5" aria-hidden />
        </span>
        <div>
          <h2 id="confirmacion-titulo" className="text-xl font-semibold">
            Turno agendado
          </h2>
          <p className="text-muted-foreground text-sm">
            {alta.cantidad === 1
              ? 'Se registró 1 turno.'
              : `Se registraron ${alta.cantidad} turnos.`}
          </p>
        </div>
      </div>

      {primero && (
        <Datos>
          <Dato
            label="Alumno"
            valor={`${primero.alumno.apellido}, ${primero.alumno.nombre} (DNI ${primero.alumno.dni})`}
          />
          <Dato label="Materia" valor={primero.materia.nombre} />
          <Dato
            label="Profesor"
            valor={`${primero.profesor.apellido}, ${primero.profesor.nombre}`}
          />
          <Dato label="Día" valor={nombreDiaSemana(primero.diaSemana)} />
          <Dato label="Aula" valor={primero.aula.nombre} />
          <Dato
            label="Estado"
            valor={<Badge variant="confirmado">{ESTADO_TURNO_LABEL[primero.estado]}</Badge>}
          />
          <Dato label="Tipo" valor={TIPO_TURNO_LABEL[pedido.tipo]} />
          <Dato label="Fechas" valor={textoRangoPedido(pedido)} />
        </Datos>
      )}

      <section aria-labelledby="horas-creadas" className="space-y-3">
        <h3 id="horas-creadas" className="text-sm font-semibold">
          Horas agendadas
        </h3>
        {alta.cantidad > horas.length && (
          <p className="text-muted-foreground text-sm">
            Se creó en {alta.cantidad} tramos porque hay fechas sin lugar.
          </p>
        )}
        <ul className="divide-border border-border divide-y rounded-lg border">
          {horas.map((hora) => (
            <li key={hora.bloqueId} className="space-y-2 px-4 py-3">
              <p className="text-sm font-medium">
                Hora {textoHorario(hora.horaInicio, hora.horaFin)}
              </p>
              <ul className="space-y-1">
                {hora.tramos.map((tramo) => (
                  <li
                    key={tramo.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-muted-foreground">{textoRangoTurno(tramo)}</span>
                    <Link
                      href={hrefDetalle(tramo.id)}
                      scroll={false}
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) onVerDetalle()
                      }}
                      className="text-cobalto inline-flex items-center gap-1 font-medium hover:underline"
                    >
                      <Eye className="size-3.5" aria-hidden />
                      Ver detalle
                      <span className="sr-only"> del turno {textoRangoTurno(tramo)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {sinTurno.length > 0 && (
        <Alert>
          <CalendarX className="text-urgente size-4" />
          <AlertTitle className="line-clamp-none">En estas fechas no hay turno</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {sinTurno.map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" size="lg" onClick={onRegistrarOtroMismoAlumno}>
          <UserRoundPlus />
          Registrar otro para este alumno
        </Button>
        <Button size="lg" onClick={onRegistrarOtro}>
          <Plus />
          Registrar otro turno
        </Button>
      </div>
    </Card>
  )
}
