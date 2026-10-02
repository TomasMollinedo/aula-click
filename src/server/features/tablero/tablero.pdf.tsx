import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { EncabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import { fechaDocumento, formatearPesos } from '@/server/shared/formato'
import { DocumentoOficialPdf } from '@/server/shared/pdf/documento'
import {
  BORDE_FINO,
  COLORES,
  RADIO_TARJETA,
  SEPARACION_BLOQUES,
  TEXTO,
  espaciado,
  px,
} from '@/server/shared/pdf/estilos'
import { BarrasPdf, DonaPdf, LeyendaPdf } from '@/server/shared/pdf/graficos'
import { renderizarPdf } from '@/server/shared/pdf/renderizar'
import {
  formatearCantidad,
  formatearPorcentaje,
  nombreProfesor,
  textoPeriodo,
  textoRangoConDias,
  tituloTablero,
} from './tablero.formato'
import type { Tablero } from './tablero.validation'

// El tablero del gerente en PDF (HU-21, T-130). Solo presentación: recibe lo que devuelve el service
// del JSON y no recalcula nada (porcentajes, ocupación y tops son los de la API). Mismo contenido y
// mismo orden que la pantalla: primero el dinero, después los turnos y la ocupación con sus
// gráficos y, al final, las materias y los profesores. Los indicadores que dependen de la
// asistencia no se muestran, igual que en la pantalla.

export type DatosTableroPdf = EncabezadoDeDocumento & { tablero: Tablero }

// Los colores de los gráficos son los de la pantalla: cobalto, `cancelado` y `piedra`.
const COLOR_ACTIVOS = COLORES.cobalto
const COLOR_CANCELADOS = '#6f1f2a'
const COLOR_LIBRES = '#c5beaa'

const estilos = StyleSheet.create({
  contenido: { gap: SEPARACION_BLOQUES },
  seccion: { gap: px(10) },
  tituloSeccion: {
    ...TEXTO.etiqueta,
    fontWeight: 700,
    color: COLORES.texto60,
    letterSpacing: espaciado.muyAncho(TEXTO.etiqueta.fontSize),
    textTransform: 'uppercase',
  },
  fila: { flexDirection: 'row', gap: px(14) },
  columna: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  tarjeta: {
    padding: px(16),
    gap: px(10),
    borderWidth: BORDE_FINO,
    borderColor: COLORES.borde,
    borderRadius: RADIO_TARJETA,
    backgroundColor: COLORES.fondoSuave,
  },
  tituloTarjeta: { ...TEXTO.normal, fontWeight: 600, color: COLORES.marino },
  rotulo: { ...TEXTO.chico, color: COLORES.texto60 },
  valor: { fontSize: px(26), lineHeight: 1.2, fontWeight: 600, color: COLORES.marino },
  valorMediano: { fontSize: px(22), lineHeight: 1.2, fontWeight: 600, color: COLORES.marino },
  rango: { ...TEXTO.base, color: COLORES.texto70 },
})

/** Una tarjeta del tablero: qué se mide, a qué período o fecha corresponde y su contenido. */
function Tarjeta({
  titulo,
  rotulo,
  children,
}: {
  titulo: string
  rotulo: string
  children: ReactNode
}) {
  return (
    <View wrap={false} style={[estilos.tarjeta, estilos.columna]}>
      <View>
        <Text style={estilos.tituloTarjeta}>{titulo}</Text>
        <Text style={estilos.rotulo}>{rotulo}</Text>
      </View>
      {children}
    </View>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    // No se parte: el título no queda solo al final de una hoja.
    <View wrap={false} style={estilos.seccion}>
      <Text style={estilos.tituloSeccion}>{titulo}</Text>
      <View style={estilos.fila}>{children}</View>
    </View>
  )
}

export function TableroPdf({ tablero, ...encabezado }: DatosTableroPdf) {
  const { periodo, hoy, turnos, ocupacion, alumnos, pagos } = tablero
  // El período de la respuesta, igual que en la pantalla.
  const delPeriodo = `Período: ${textoPeriodo(periodo.desde, periodo.hasta)}`
  // Lo que queda de la capacidad de las clases; si bajaron una capacidad y hay de más, 0.
  const lugaresLibres = Math.max(ocupacion.capacidad - ocupacion.turnos, 0)

  return (
    // El título dice qué período es ("Tablero semanal") y debajo, de qué día a qué día.
    <DocumentoOficialPdf titulo={tituloTablero(periodo.desde, periodo.hasta)} {...encabezado}>
      <View style={estilos.contenido}>
        <Text style={estilos.rango}>{textoRangoConDias(periodo.desde, periodo.hasta)}</Text>

        <Seccion titulo="Pagos">
          <Tarjeta titulo="Total cobrado" rotulo={delPeriodo}>
            <Text style={estilos.valor}>{formatearPesos(pagos.totalCobrado)}</Text>
          </Tarjeta>
          {/* La deuda es a la fecha, de todos los alumnos: no depende del período. */}
          <Tarjeta titulo="Total adeudado" rotulo={`A la fecha: ${fechaDocumento(hoy)}`}>
            <Text style={estilos.valor}>{formatearPesos(pagos.totalAdeudado)}</Text>
          </Tarjeta>
        </Seccion>

        <Seccion titulo="Turnos y ocupación">
          <Tarjeta titulo="Turnos del período" rotulo={delPeriodo}>
            {/* `ocupacion.turnos` son los no cancelados: junto a los cancelados, el total. */}
            <DonaPdf
              centro={{ valor: formatearCantidad(turnos.total), texto: 'turnos' }}
              segmentos={[
                { valor: ocupacion.turnos, color: COLOR_ACTIVOS },
                { valor: turnos.cancelados.cantidad, color: COLOR_CANCELADOS },
              ]}
            />
            <LeyendaPdf
              items={[
                {
                  color: COLOR_ACTIVOS,
                  etiqueta: 'Activos',
                  valor: formatearCantidad(ocupacion.turnos),
                },
                {
                  color: COLOR_CANCELADOS,
                  etiqueta: 'Cancelados',
                  valor: formatearCantidad(turnos.cancelados.cantidad),
                  detalle: formatearPorcentaje(turnos.cancelados.porcentaje),
                },
              ]}
            />
          </Tarjeta>

          <Tarjeta titulo="Ocupación de las clases" rotulo={delPeriodo}>
            {/* El anillo se llena hasta el 100 %; el número del centro es el real (puede superarlo). */}
            <DonaPdf
              total={ocupacion.capacidad}
              centro={{ valor: formatearPorcentaje(ocupacion.porcentaje), texto: 'ocupado' }}
              segmentos={[
                {
                  valor: Math.min(ocupacion.turnos, ocupacion.capacidad),
                  color: COLOR_ACTIVOS,
                },
                { valor: lugaresLibres, color: COLOR_LIBRES },
              ]}
            />
            <LeyendaPdf
              items={[
                {
                  color: COLOR_ACTIVOS,
                  etiqueta: 'Lugares ocupados',
                  valor: formatearCantidad(ocupacion.turnos),
                },
                {
                  color: COLOR_LIBRES,
                  etiqueta: 'Lugares libres',
                  valor: formatearCantidad(lugaresLibres),
                },
              ]}
            />
          </Tarjeta>

          <Tarjeta titulo="Alumnos nuevos" rotulo={delPeriodo}>
            <Text style={estilos.valorMediano}>{formatearCantidad(alumnos.nuevos)}</Text>
          </Tarjeta>
        </Seccion>

        <Seccion titulo="Materias y profesores">
          <Tarjeta titulo="Materias con más demanda" rotulo={delPeriodo}>
            <BarrasPdf
              vacio="No hay turnos en este período."
              items={tablero.materiasConMasDemanda.map(({ materia, cantidad }) => ({
                nombre: materia.nombre,
                cantidad,
              }))}
            />
          </Tarjeta>
          <Tarjeta titulo="Profesores con más turnos" rotulo={delPeriodo}>
            <BarrasPdf
              vacio="No hay turnos en este período."
              items={tablero.profesoresConMasTurnos.map(({ profesor, cantidad }) => ({
                nombre: nombreProfesor(profesor),
                cantidad,
              }))}
            />
          </Tarjeta>
        </Seccion>
      </View>
    </DocumentoOficialPdf>
  )
}

/** Los bytes del PDF del tablero. */
export function renderizarTableroPdf(datos: DatosTableroPdf): Promise<Buffer> {
  return renderizarPdf(<TableroPdf {...datos} />)
}
