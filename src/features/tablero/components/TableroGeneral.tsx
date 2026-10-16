'use client'

import type { ReactNode } from 'react'

import { formatearPesos } from '@/utils/moneda'

import {
  ETIQUETA_FORMA_PAGO,
  formatearCantidad,
  formatearPorcentaje,
  nombreDeProfesor,
  rotuloALaFecha,
  rotuloDelPeriodo,
} from '../formato-tablero'
import { CODIGOS_FORMA_PAGO, type Tablero } from '../tablero.types'
import { GraficoDona, ItemLeyenda } from './GraficoDona'
import { TarjetaIndicador, ValorIndicador } from './TarjetaIndicador'
import { TarjetaRanking } from './TarjetaRanking'

/**
 * La sección "General" del tablero (HU-21, con los agregados de HU-39): primero el dinero (lo que
 * más se mira), con lo cobrado separado por forma de pago, después los turnos y la ocupación con
 * sus gráficos, la asistencia y los alumnos, y al final las materias y los profesores.
 *
 * Cada tarjeta se rotula con el período **de la respuesta**, no con el elegido, así los números que
 * quedan atenuados mientras llegan los nuevos nunca se leen como del período nuevo. El total
 * adeudado es a la fecha, no del período. Los porcentajes, la ocupación y los rankings los calcula
 * la API; los gráficos sólo los dibujan.
 */
export function TableroGeneral({ tablero }: { tablero: Tablero }) {
  const { turnos, ocupacion, alumnos, pagos } = tablero
  const delPeriodo = rotuloDelPeriodo(tablero.periodo)
  // Lo que queda de la capacidad de las clases; si bajaron una capacidad y hay de más, 0.
  const lugaresLibres = Math.max(ocupacion.capacidad - ocupacion.turnos, 0)

  return (
    <>
      <Seccion titulo="Pagos">
        <div className="grid gap-4 sm:grid-cols-2">
          <TarjetaIndicador titulo="Total cobrado" rotulo={delPeriodo}>
            <ValorIndicador destacado valor={formatearPesos(pagos.totalCobrado)} />
            {/* Las tres formas de pago siempre vienen, con 0 la que no tuvo cobros (HU-23). */}
            <dl className="space-y-2">
              {CODIGOS_FORMA_PAGO.map((forma) => (
                <div key={forma} className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground truncate">{ETIQUETA_FORMA_PAGO[forma]}</dt>
                  <dd className="shrink-0 font-semibold tabular-nums">
                    {formatearPesos(pagos.cobradoPorForma[forma])}
                  </dd>
                </div>
              ))}
            </dl>
          </TarjetaIndicador>
          {/* La deuda es a la fecha, de todos los alumnos: no cambia con el período. */}
          <TarjetaIndicador titulo="Total adeudado" rotulo={rotuloALaFecha(tablero.hoy)}>
            <ValorIndicador destacado valor={formatearPesos(pagos.totalAdeudado)} />
          </TarjetaIndicador>
        </div>
      </Seccion>

      <Seccion titulo="Turnos y ocupación">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TarjetaIndicador titulo="Turnos del período" rotulo={delPeriodo}>
            {/* `ocupacion.turnos` son los no cancelados: junto a los cancelados, el total. */}
            <GraficoDona
              descripcion={`${formatearCantidad(turnos.total)} turnos, ${formatearCantidad(turnos.cancelados.cantidad)} cancelados`}
              centro={{ valor: formatearCantidad(turnos.total), texto: 'turnos' }}
              segmentos={[
                { etiqueta: 'Activos', valor: ocupacion.turnos, claseColor: 'stroke-cobalto' },
                {
                  etiqueta: 'Cancelados',
                  valor: turnos.cancelados.cantidad,
                  claseColor: 'stroke-cancelado',
                },
              ]}
            />
            <ul className="space-y-2">
              <ItemLeyenda
                claseColor="bg-cobalto"
                etiqueta="Activos"
                valor={formatearCantidad(ocupacion.turnos)}
              />
              <ItemLeyenda
                claseColor="bg-cancelado"
                etiqueta="Cancelados"
                valor={formatearCantidad(turnos.cancelados.cantidad)}
                detalle={formatearPorcentaje(turnos.cancelados.porcentaje)}
              />
            </ul>
          </TarjetaIndicador>

          <TarjetaIndicador titulo="Ocupación de las clases" rotulo={delPeriodo}>
            <p className="text-muted-foreground -mt-2 text-xs">
              Lugares ocupados y libres en las clases que tienen turnos.
            </p>
            {/* El anillo se llena hasta el 100 %; el número del centro es el real (puede superarlo). */}
            <GraficoDona
              descripcion={`Ocupación ${formatearPorcentaje(ocupacion.porcentaje)}: ${formatearCantidad(ocupacion.turnos)} lugares ocupados y ${formatearCantidad(lugaresLibres)} libres`}
              total={ocupacion.capacidad}
              centro={{ valor: formatearPorcentaje(ocupacion.porcentaje), texto: 'ocupado' }}
              segmentos={[
                {
                  etiqueta: 'Ocupados',
                  valor: Math.min(ocupacion.turnos, ocupacion.capacidad),
                  claseColor: 'stroke-cobalto',
                },
                { etiqueta: 'Libres', valor: lugaresLibres, claseColor: 'stroke-piedra' },
              ]}
            />
            <ul className="space-y-2">
              <ItemLeyenda
                claseColor="bg-cobalto"
                etiqueta="Lugares ocupados"
                valor={formatearCantidad(ocupacion.turnos)}
              />
              <ItemLeyenda
                claseColor="bg-piedra"
                etiqueta="Lugares libres"
                valor={formatearCantidad(lugaresLibres)}
              />
            </ul>
          </TarjetaIndicador>

          <TarjetaIndicador titulo="Alumnos nuevos" rotulo={delPeriodo}>
            <ValorIndicador destacado valor={formatearCantidad(alumnos.nuevos)} />
          </TarjetaIndicador>

          {/*
            Asistencia (HU-22 y HU-39): los porcentajes son sobre los turnos **con asistencia
            registrada**, no sobre el total, así que suman 100 (salvo el redondeo).
          */}
          <TarjetaIndicador titulo="Asistencia de los turnos" rotulo={delPeriodo}>
            <ul className="space-y-2">
              <ItemLeyenda
                claseColor="bg-estado-realizado"
                etiqueta="Asistió"
                valor={formatearCantidad(turnos.asistio.cantidad)}
                detalle={formatearPorcentaje(turnos.asistio.porcentaje)}
              />
              <ItemLeyenda
                claseColor="bg-estado-ausente"
                etiqueta="No asistió"
                valor={formatearCantidad(turnos.noAsistio.cantidad)}
                detalle={formatearPorcentaje(turnos.noAsistio.porcentaje)}
              />
            </ul>
            <p className="text-muted-foreground text-xs">
              Sobre los turnos con asistencia registrada, no sobre el total del período.
            </p>
          </TarjetaIndicador>

          <TarjetaIndicador titulo="Alumnos atendidos" rotulo={delPeriodo}>
            <ValorIndicador destacado valor={formatearCantidad(alumnos.atendidos)} />
            <p className="text-muted-foreground -mt-2 text-xs">
              Alumnos distintos con al menos una clase realizada.
            </p>
          </TarjetaIndicador>
        </div>
      </Seccion>

      <Seccion titulo="Materias y profesores">
        <div className="grid gap-4 lg:grid-cols-2">
          <TarjetaRanking
            titulo="Materias con más demanda"
            rotulo={delPeriodo}
            vacio="No hay turnos en este período."
            items={tablero.materiasConMasDemanda.map(({ materia, cantidad }) => ({
              clave: materia.id,
              nombre: materia.nombre,
              cantidad,
            }))}
          />
          <TarjetaRanking
            titulo="Profesores con más turnos"
            rotulo={delPeriodo}
            vacio="No hay turnos en este período."
            items={tablero.profesoresConMasTurnos.map(({ profesor, cantidad }) => ({
              clave: profesor.id,
              nombre: nombreDeProfesor(profesor),
              cantidad,
            }))}
          />
        </div>
      </Seccion>
    </>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="space-y-3">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {titulo}
      </h2>
      {children}
    </section>
  )
}
