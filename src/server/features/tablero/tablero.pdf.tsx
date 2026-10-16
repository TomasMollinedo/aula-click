import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { EncabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import { textoMes } from '@/server/features/liquidaciones/liquidaciones.condiciones'
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
import { CeldaPdf, FilaPdf, TablaPdf, type ColumnaPdf } from '@/server/shared/pdf/tabla'
import {
  NOMBRE_FORMA_DE_PAGO,
  formatearCantidad,
  formatearPorcentaje,
  nombreProfesor,
  textoPeriodo,
  textoClasesCerradas,
  textoRangoConDias,
  tituloTablero,
  tituloTableroAsistencia,
  tituloTableroFinanzas,
} from './tablero.formato'
import type {
  Tablero,
  TableroAsistenciaCompleta,
  TableroFinanzasCompleta,
} from './tablero.validation'

// El tablero del gerente en PDF, una plantilla por sección (HU-21, T-130; HU-39, T-112; HU-47,
// T-128). Solo presentación: recibe lo que devuelve el service y no recalcula nada (porcentajes,
// ocupación, tops, tablas y márgenes son los de la API). Mismo contenido y mismo orden que la
// pantalla. "General": primero el dinero (con lo cobrado por forma de pago), después los turnos y la
// ocupación con sus gráficos, la asistencia y, al final, las materias y los profesores. "Asistencia"
// y "Finanzas": los números principales y sus tablas completas, que pueden ocupar varias hojas.

export type DatosTableroPdf = EncabezadoDeDocumento & { tablero: Tablero }
export type DatosTableroAsistenciaPdf = EncabezadoDeDocumento & {
  tablero: TableroAsistenciaCompleta
}
export type DatosTableroFinanzasPdf = EncabezadoDeDocumento & { tablero: TableroFinanzasCompleta }

// Los colores de los gráficos son los de la pantalla: cobalto, `cancelado` y `piedra`.
const COLOR_ACTIVOS = COLORES.cobalto
const COLOR_CANCELADOS = '#6f1f2a'
const COLOR_LIBRES = '#c5beaa'
// Los de la asistencia son los de los badges de estado de la pantalla (realizado, ausente y sin
// registrar).
const COLOR_PRESENTE = '#86d17a'
const COLOR_AUSENTE = '#f5b94f'
const COLOR_SIN_REGISTRAR = '#c9c3b0'
const COLOR_CERRADO = '#55503f'
// Un poco más chicos que el de por defecto: con la asistencia, el tablero sigue entrando en una hoja.
const DIAMETRO_DONA = px(88)
// Una forma de pago por color en la leyenda de lo cobrado.
const FORMAS_DE_PAGO = [
  { codigo: 'EFECTIVO', color: COLORES.cobalto },
  { codigo: 'TRANSFERENCIA', color: '#2f7d6d' },
  { codigo: 'DEBITO', color: COLOR_LIBRES },
] as const

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
  nota: { ...TEXTO.chico, color: COLORES.texto60 },
  tabla: { gap: px(6) },
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
            {/* Los anulados no suman: las tres formas dan el total cobrado. */}
            <LeyendaPdf
              items={FORMAS_DE_PAGO.map(({ codigo, color }) => ({
                color,
                etiqueta: NOMBRE_FORMA_DE_PAGO[codigo],
                valor: formatearPesos(pagos.cobradoPorForma[codigo]),
              }))}
            />
          </Tarjeta>
          {/* La deuda es a la fecha, de todos los alumnos: no depende del período. */}
          <Tarjeta titulo="Total adeudado" rotulo={`A la fecha: ${fechaDocumento(hoy)}`}>
            <Text style={estilos.valor}>{formatearPesos(pagos.totalAdeudado)}</Text>
          </Tarjeta>
        </Seccion>

        <Seccion titulo="Turnos, ocupación y asistencia">
          <Tarjeta titulo="Turnos del período" rotulo={delPeriodo}>
            {/* `ocupacion.turnos` son los no cancelados: junto a los cancelados, el total. */}
            <DonaPdf
              diametro={DIAMETRO_DONA}
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
              diametro={DIAMETRO_DONA}
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

          <Tarjeta titulo="Alumnos" rotulo={delPeriodo}>
            <LeyendaPdf
              items={[
                {
                  color: COLOR_ACTIVOS,
                  etiqueta: 'Alumnos atendidos',
                  valor: formatearCantidad(alumnos.atendidos),
                },
                {
                  color: COLOR_LIBRES,
                  etiqueta: 'Alumnos nuevos',
                  valor: formatearCantidad(alumnos.nuevos),
                },
              ]}
            />
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

/** Los bytes del PDF del tablero ("General"). */
export function renderizarTableroPdf(datos: DatosTableroPdf): Promise<Buffer> {
  return renderizarPdf(<TableroPdf {...datos} />)
}

// Proporciones de las columnas (no puntos). Sin ningún dato de los alumnos: sólo agregados.
const COLUMNAS_CIFRAS: readonly ColumnaPdf[] = [
  { titulo: 'Registradas', ancho: 13, numerica: true },
  { titulo: '%', ancho: 7, numerica: true },
  { titulo: 'Cerrados', ancho: 12, numerica: true },
  { titulo: '%', ancho: 7, numerica: true },
  { titulo: 'Sin reg.', ancho: 12, numerica: true },
  { titulo: '%', ancho: 7, numerica: true },
]

const COLUMNAS_TABLA_PROFESORES: readonly ColumnaPdf[] = [
  { titulo: 'Profesor', ancho: 23 },
  ...COLUMNAS_CIFRAS,
  // Alineada a la derecha, como las cifras: así no se pega a la columna de al lado.
  { titulo: 'Estado', ancho: 14, numerica: true },
]

const COLUMNAS_TABLA_MATERIAS: readonly ColumnaPdf[] = [
  { titulo: 'Materia', ancho: 42 },
  ...COLUMNAS_CIFRAS,
]

type Cifras = TableroAsistenciaCompleta['profesores'][number]

/**
 * Las seis celdas numéricas de una fila, en el orden de `COLUMNAS_CIFRAS`. Es una función y no un
 * componente: `FilaPdf` reparte sus hijas directas entre las columnas.
 */
function celdasDeCifras(fila: Cifras | TableroAsistenciaCompleta['materias'][number]) {
  const deTotal = (cantidad: number) =>
    `${formatearCantidad(cantidad)} de ${formatearCantidad(fila.total)}`
  return [
    deTotal(fila.asistenciasRegistradas),
    formatearPorcentaje(fila.porcentajeRegistrado),
    deTotal(fila.cerradosSinRegistrar),
    formatearPorcentaje(fila.porcentajeCerrados),
    deTotal(fila.sinRegistrar),
    formatearPorcentaje(fila.porcentajeSinRegistrar),
  ].map((texto, i) => <CeldaPdf key={i}>{texto}</CeldaPdf>)
}

const NOTA_TABLAS_ASISTENCIA =
  'Cada cifra es sobre el total de turnos que ya pasaron. Registradas: turnos con la asistencia marcada. Cerrados: turnos que cerró el sistema porque pasaron los 7 días que tiene el profesor para marcar la asistencia. Sin reg.: turnos que todavía están dentro de esos 7 días.'

/** Una tabla con su título y la aclaración de sus columnas. Puede ocupar varias hojas. */
function SeccionTabla({
  titulo,
  nota,
  children,
}: {
  titulo: string
  nota: string
  children: ReactNode
}) {
  return (
    <View style={estilos.tabla}>
      {/* El título no queda solo al final de una hoja: se queda con las primeras filas. */}
      <View minPresenceAhead={90} style={estilos.seccion}>
        <Text style={estilos.tituloSeccion}>{titulo}</Text>
        <Text style={estilos.nota}>{nota}</Text>
      </View>
      {children}
    </View>
  )
}

export function TableroAsistenciaPdf({ tablero, ...encabezado }: DatosTableroAsistenciaPdf) {
  const { periodo, hoy, resumen, profesores, materias } = tablero
  const delPeriodo = `Período: ${textoPeriodo(periodo.desde, periodo.hasta)}`

  return (
    <DocumentoOficialPdf
      titulo={tituloTableroAsistencia(periodo.desde, periodo.hasta)}
      {...encabezado}
    >
      <View style={estilos.contenido}>
        <Text style={estilos.rango}>{textoRangoConDias(periodo.desde, periodo.hasta)}</Text>

        <Seccion titulo="Resumen">
          <Tarjeta titulo="Asistencia del centro" rotulo={delPeriodo}>
            <DonaPdf
              diametro={DIAMETRO_DONA}
              centro={{ valor: formatearCantidad(resumen.total), texto: 'turnos' }}
              segmentos={[
                { valor: resumen.presentes.cantidad, color: COLOR_PRESENTE },
                { valor: resumen.ausentes.cantidad, color: COLOR_AUSENTE },
                { valor: resumen.sinRegistrar.cantidad, color: COLOR_SIN_REGISTRAR },
                { valor: resumen.cerrados.cantidad, color: COLOR_CERRADO },
              ]}
            />
            <LeyendaPdf
              items={[
                {
                  color: COLOR_PRESENTE,
                  etiqueta: 'Presentes',
                  valor: formatearCantidad(resumen.presentes.cantidad),
                  detalle: formatearPorcentaje(resumen.presentes.porcentaje),
                },
                {
                  color: COLOR_AUSENTE,
                  etiqueta: 'Ausentes',
                  valor: formatearCantidad(resumen.ausentes.cantidad),
                  detalle: formatearPorcentaje(resumen.ausentes.porcentaje),
                },
                {
                  color: COLOR_SIN_REGISTRAR,
                  etiqueta: 'Sin registrar',
                  valor: formatearCantidad(resumen.sinRegistrar.cantidad),
                  detalle: formatearPorcentaje(resumen.sinRegistrar.porcentaje),
                },
                {
                  color: COLOR_CERRADO,
                  etiqueta: 'Cerrados por el sistema',
                  valor: formatearCantidad(resumen.cerrados.cantidad),
                  detalle: formatearPorcentaje(resumen.cerrados.porcentaje),
                },
              ]}
            />
            <Text style={estilos.rotulo}>
              Total de turnos: {formatearCantidad(resumen.total)}. «Sin registrar» todavía están
              dentro de los 7 días para marcar la asistencia.
            </Text>
          </Tarjeta>
          <Tarjeta titulo="Cerrados por el sistema" rotulo={delPeriodo}>
            <Text style={estilos.valorMediano}>{formatearCantidad(resumen.cerrados.cantidad)}</Text>
            <Text style={estilos.rotulo}>
              {resumen.clasesCerradas
                ? `Son ${textoClasesCerradas(resumen.clasesCerradas)}.`
                : 'El sistema no cerró ningún turno en este período.'}
            </Text>
          </Tarjeta>
          {/* No depende del período: son las clases de los últimos 7 días, hasta hoy. */}
          <Tarjeta titulo="Profesores sin registrar" rotulo={`A la fecha: ${fechaDocumento(hoy)}`}>
            <Text style={estilos.valorMediano}>
              {formatearCantidad(resumen.profesoresSinRegistrar)}
            </Text>
            <Text style={estilos.rotulo}>
              Con clases de los últimos 7 días sin asistencia marcada.
            </Text>
          </Tarjeta>
        </Seccion>

        <SeccionTabla titulo="Por profesor" nota={NOTA_TABLAS_ASISTENCIA}>
          {profesores.length === 0 ? (
            <Text style={estilos.rotulo}>No hay turnos en este período.</Text>
          ) : (
            <TablaPdf columnas={COLUMNAS_TABLA_PROFESORES} alternada>
              {profesores.map((fila) => (
                <FilaPdf key={fila.profesor.id}>
                  <CeldaPdf>{nombreProfesor(fila.profesor)}</CeldaPdf>
                  {celdasDeCifras(fila)}
                  <CeldaPdf>{fila.noRegistraAsistencia ? 'No registra' : ''}</CeldaPdf>
                </FilaPdf>
              ))}
            </TablaPdf>
          )}
        </SeccionTabla>

        <SeccionTabla titulo="Por materia" nota={NOTA_TABLAS_ASISTENCIA}>
          {materias.length === 0 ? (
            <Text style={estilos.rotulo}>No hay turnos en este período.</Text>
          ) : (
            <TablaPdf columnas={COLUMNAS_TABLA_MATERIAS} alternada>
              {materias.map((fila) => (
                <FilaPdf key={fila.materia.id}>
                  <CeldaPdf>{fila.materia.nombre}</CeldaPdf>
                  {celdasDeCifras(fila)}
                </FilaPdf>
              ))}
            </TablaPdf>
          )}
        </SeccionTabla>
      </View>
    </DocumentoOficialPdf>
  )
}

/** Los bytes del PDF del tablero ("Asistencia"), con las tablas completas. */
export function renderizarTableroAsistenciaPdf(datos: DatosTableroAsistenciaPdf): Promise<Buffer> {
  return renderizarPdf(<TableroAsistenciaPdf {...datos} />)
}

// Proporciones de las columnas de "Finanzas" (no puntos). Importes en pesos, alineados a la derecha.
const COLUMNAS_TABLA_FINANZAS: readonly ColumnaPdf[] = [
  { titulo: 'Profesor', ancho: 18 },
  { titulo: 'Turnos', ancho: 7, numerica: true },
  { titulo: 'Cobrado', ancho: 15, numerica: true },
  { titulo: 'Centro', ancho: 15, numerica: true },
  { titulo: 'Profesor', ancho: 15, numerica: true },
  { titulo: 'Pagado', ancho: 15, numerica: true },
  { titulo: 'Saldo', ancho: 15, numerica: true },
]

const COLUMNAS_TABLA_EVOLUCION: readonly ColumnaPdf[] = [
  { titulo: 'Mes', ancho: 31 },
  { titulo: 'Total cobrado', ancho: 23, numerica: true },
  { titulo: 'Margen del centro', ancho: 23, numerica: true },
  { titulo: 'Pagado a profesores', ancho: 23, numerica: true },
]

const NOTA_TABLA_FINANZAS =
  'Turnos y Cobrado: turnos cobrados en el período, sin pagos anulados. Centro y Profesor: el reparto de esos cobros; un turno cobrado y cerrado sin registrar va entero al centro. Pagado: liquidaciones pagadas con fecha de transferencia en el período. Saldo: lo que se le debe a la fecha de hoy; negativo, un saldo a descontar.'

const NOTA_TABLA_EVOLUCION =
  'Cobrado y margen por fecha de pago; pagado a profesores por fecha de transferencia. El último mes llega hasta el fin del período.'

export function TableroFinanzasPdf({ tablero, ...encabezado }: DatosTableroFinanzasPdf) {
  const { periodo, hoy, resumen, profesores, evolucion } = tablero
  const delPeriodo = `Período: ${textoPeriodo(periodo.desde, periodo.hasta)}`

  return (
    <DocumentoOficialPdf
      titulo={tituloTableroFinanzas(periodo.desde, periodo.hasta)}
      {...encabezado}
    >
      <View style={estilos.contenido}>
        <Text style={estilos.rango}>{textoRangoConDias(periodo.desde, periodo.hasta)}</Text>

        <Seccion titulo="Cobrado y margen del centro">
          <Tarjeta titulo="Total cobrado" rotulo={delPeriodo}>
            <Text style={estilos.valorMediano}>{formatearPesos(resumen.totalCobrado)}</Text>
          </Tarjeta>
          <Tarjeta titulo="Margen del centro" rotulo={delPeriodo}>
            <Text style={estilos.valorMediano}>{formatearPesos(resumen.margenCentro.importe)}</Text>
            <Text style={estilos.nota}>
              {formatearPorcentaje(resumen.margenCentro.porcentaje)} del total cobrado
            </Text>
            {resumen.incluyeSinRegistrar > 0 && (
              <Text style={estilos.nota}>
                Incluye {formatearPesos(resumen.incluyeSinRegistrar)} de turnos sin asistencia
                registrada
              </Text>
            )}
          </Tarjeta>
        </Seccion>

        <Seccion titulo="Profesores">
          <Tarjeta titulo="Pagado a profesores" rotulo={delPeriodo}>
            <Text style={estilos.valorMediano}>{formatearPesos(resumen.pagadoAProfesores)}</Text>
          </Tarjeta>
          {/* El saldo es a la fecha: no depende del período. */}
          <Tarjeta titulo="Saldo a pagar a profesores" rotulo={`A hoy: ${fechaDocumento(hoy)}`}>
            <Text style={estilos.valorMediano}>
              {formatearPesos(resumen.saldoAPagarAProfesores)}
            </Text>
          </Tarjeta>
        </Seccion>

        <SeccionTabla titulo="Por profesor" nota={NOTA_TABLA_FINANZAS}>
          {profesores.length === 0 ? (
            <Text style={estilos.rotulo}>No hay cobros, pagos ni saldos en este período.</Text>
          ) : (
            <TablaPdf columnas={COLUMNAS_TABLA_FINANZAS} alternada>
              {profesores.map((fila) => (
                <FilaPdf key={fila.profesor.id}>
                  <CeldaPdf>{nombreProfesor(fila.profesor)}</CeldaPdf>
                  <CeldaPdf>{formatearCantidad(fila.turnosCobrados)}</CeldaPdf>
                  <CeldaPdf>{formatearPesos(fila.totalCobrado)}</CeldaPdf>
                  <CeldaPdf>{formatearPesos(fila.parteCentro)}</CeldaPdf>
                  <CeldaPdf>{formatearPesos(fila.parteProfesor)}</CeldaPdf>
                  <CeldaPdf>{formatearPesos(fila.pagado)}</CeldaPdf>
                  <CeldaPdf>{formatearPesos(fila.saldoPendiente)}</CeldaPdf>
                </FilaPdf>
              ))}
            </TablaPdf>
          )}
        </SeccionTabla>

        {/* Son 6 filas: la tabla no se parte entre dos hojas. */}
        <View wrap={false}>
          <SeccionTabla titulo="Evolución mensual" nota={NOTA_TABLA_EVOLUCION}>
            <TablaPdf columnas={COLUMNAS_TABLA_EVOLUCION} alternada>
              {evolucion.map((fila) => (
                <FilaPdf key={fila.mes}>
                  <CeldaPdf>{textoMes(fila.mes)}</CeldaPdf>
                  <CeldaPdf>{formatearPesos(fila.totalCobrado)}</CeldaPdf>
                  <CeldaPdf>{formatearPesos(fila.margenCentro)}</CeldaPdf>
                  <CeldaPdf>{formatearPesos(fila.pagadoAProfesores)}</CeldaPdf>
                </FilaPdf>
              ))}
            </TablaPdf>
          </SeccionTabla>
        </View>
      </View>
    </DocumentoOficialPdf>
  )
}

/** Los bytes del PDF del tablero ("Finanzas"), con la tabla por profesor completa. */
export function renderizarTableroFinanzasPdf(datos: DatosTableroFinanzasPdf): Promise<Buffer> {
  return renderizarPdf(<TableroFinanzasPdf {...datos} />)
}
