import { Circle, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import { COLORES, TEXTO, px } from './estilos'

// Gráficos simples para los documentos: un anillo (torta), una leyenda y barras horizontales. Solo
// dibujo, sin significado de negocio: reciben números ya calculados y colores. Vectoriales (Svg de
// react-pdf), así que salen nítidos al imprimir. Sin contexto ni hooks, como el resto de
// `shared/pdf/`.

/** El lado del viewBox del anillo; el trazo se dibuja sobre un círculo de `RADIO`. */
const LADO = 120
const RADIO = 46
const GROSOR = 14
/** Hueco entre dos segmentos contiguos, como fracción de la vuelta. */
const HUECO = 0.008

export type SegmentoDonaPdf = { valor: number; color: string }

const estilos = StyleSheet.create({
  dona: { position: 'relative', alignSelf: 'center' },
  centro: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centroValor: { fontSize: px(18), lineHeight: 1.2, fontWeight: 600, color: COLORES.marino },
  centroTexto: { ...TEXTO.etiqueta, color: COLORES.texto60 },
  leyenda: { gap: px(6) },
  itemLeyenda: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  izquierdaLeyenda: { flexDirection: 'row', alignItems: 'center', gap: px(8), flexShrink: 1 },
  punto: { width: px(10), height: px(10), borderRadius: px(5) },
  etiquetaLeyenda: { ...TEXTO.chico },
  valorLeyenda: { ...TEXTO.chico, fontWeight: 600 },
  detalleLeyenda: { ...TEXTO.chico, color: COLORES.texto60 },
  barras: { gap: px(10) },
  filaBarra: { gap: px(4) },
  textosBarra: { flexDirection: 'row', justifyContent: 'space-between', gap: px(8) },
  nombreBarra: { ...TEXTO.chico, flexShrink: 1, maxLines: 1, textOverflow: 'ellipsis' },
  cantidadBarra: { ...TEXTO.chico, fontWeight: 600 },
  pista: { height: px(7), borderRadius: px(3.5), backgroundColor: COLORES.borde },
  relleno: { height: px(7), borderRadius: px(3.5), backgroundColor: COLORES.cobalto },
  vacio: { ...TEXTO.chico, color: COLORES.texto70 },
})

/** El punto del círculo de radio `RADIO` a `fraccion` de la vuelta, empezando arriba y en sentido horario. */
function punto(fraccion: number): { x: number; y: number } {
  const angulo = fraccion * 2 * Math.PI - Math.PI / 2
  return { x: LADO / 2 + RADIO * Math.cos(angulo), y: LADO / 2 + RADIO * Math.sin(angulo) }
}

/** El arco del anillo entre dos fracciones de la vuelta. */
function arco(desde: number, hasta: number): string {
  const inicio = punto(desde)
  const fin = punto(hasta)
  const grande = hasta - desde > 0.5 ? 1 : 0
  return `M ${inicio.x} ${inicio.y} A ${RADIO} ${RADIO} 0 ${grande} 1 ${fin.x} ${fin.y}`
}

/**
 * Un anillo (torta) con `centro` escrito adentro. Cada segmento ocupa su parte de `total` (por
 * defecto, la suma de los valores): si `total` es mayor, el resto queda como pista vacía, y sin
 * nada que dibujar, solo la pista. Un segmento que ocupa toda la vuelta es un círculo.
 */
export function DonaPdf({
  segmentos,
  total,
  centro,
  diametro = px(104),
}: {
  segmentos: readonly SegmentoDonaPdf[]
  total?: number
  centro: { valor: string; texto?: string }
  diametro?: number
}) {
  const suma = segmentos.reduce((acumulado, { valor }) => acumulado + valor, 0)
  const base = Math.max(total ?? suma, suma)
  const visibles = segmentos.filter(({ valor }) => valor > 0)
  const hueco = visibles.length > 1 && base > 0 ? HUECO : 0

  let recorrido = 0
  const trazos = visibles.map(({ valor, color }, indice) => {
    const desde = recorrido / base
    recorrido += valor
    const hasta = recorrido / base
    return { clave: indice, color, desde, hasta }
  })

  return (
    <View style={[estilos.dona, { width: diametro, height: diametro }]}>
      <Svg width={diametro} height={diametro} viewBox={`0 0 ${LADO} ${LADO}`}>
        <Circle
          cx={LADO / 2}
          cy={LADO / 2}
          r={RADIO}
          fill="none"
          stroke={COLORES.borde}
          strokeWidth={GROSOR}
        />
        {base > 0 &&
          trazos.map(({ clave, color, desde, hasta }) =>
            hasta - desde >= 0.9999 ? (
              <Circle
                key={clave}
                cx={LADO / 2}
                cy={LADO / 2}
                r={RADIO}
                fill="none"
                stroke={color}
                strokeWidth={GROSOR}
              />
            ) : (
              <Path
                key={clave}
                d={arco(desde + hueco / 2, hasta - hueco / 2)}
                fill="none"
                stroke={color}
                strokeWidth={GROSOR}
              />
            ),
          )}
      </Svg>
      <View style={estilos.centro}>
        <Text style={estilos.centroValor}>{centro.valor}</Text>
        {centro.texto ? <Text style={estilos.centroTexto}>{centro.texto}</Text> : null}
      </View>
    </View>
  )
}

export type ItemLeyendaPdf = {
  color: string
  etiqueta: string
  valor: string
  detalle?: string
}

/** La leyenda de un gráfico: un punto del color de cada parte, qué es y su número. */
export function LeyendaPdf({ items }: { items: readonly ItemLeyendaPdf[] }) {
  return (
    <View style={estilos.leyenda}>
      {items.map(({ color, etiqueta, valor, detalle }) => (
        <View key={etiqueta} style={estilos.itemLeyenda}>
          <View style={estilos.izquierdaLeyenda}>
            <View style={[estilos.punto, { backgroundColor: color }]} />
            <Text style={estilos.etiquetaLeyenda}>{etiqueta}</Text>
          </View>
          <Text style={estilos.valorLeyenda}>
            {valor}
            {detalle ? <Text style={estilos.detalleLeyenda}>{`  ${detalle}`}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  )
}

export type ItemBarraPdf = { nombre: string; cantidad: number }

/**
 * Un top en barras horizontales: los ítems en el orden que llegan, cada uno con su cantidad. La
 * barra es relativa al ítem con más cantidad (ayuda visual: el número está escrito). Sin ítems
 * muestra `vacio`.
 */
export function BarrasPdf({ items, vacio }: { items: readonly ItemBarraPdf[]; vacio: string }) {
  if (items.length === 0) return <Text style={estilos.vacio}>{vacio}</Text>
  const maximo = Math.max(...items.map(({ cantidad }) => cantidad))
  return (
    <View style={estilos.barras}>
      {items.map(({ nombre, cantidad }, indice) => (
        <View key={`${indice}-${nombre}`} style={estilos.filaBarra}>
          <View style={estilos.textosBarra}>
            <Text style={estilos.nombreBarra}>{`${indice + 1}. ${nombre}`}</Text>
            <Text style={estilos.cantidadBarra}>{String(cantidad)}</Text>
          </View>
          <View style={estilos.pista}>
            <View
              style={[
                estilos.relleno,
                { width: `${maximo > 0 ? Math.round((cantidad / maximo) * 100) : 0}%` },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  )
}
