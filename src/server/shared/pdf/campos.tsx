import { Children, type ReactNode } from 'react'
import { StyleSheet, Text, View } from '@react-pdf/renderer'
import { BORDE_FINO, COLORES, RADIO_TARJETA, TEXTO, espaciado, px } from './estilos'

// Los datos de un documento: una tarjeta suave con las etiquetas en cobalto y sus valores, o con
// un dato destacado (de quién o de qué día es el documento) y, si no hay nada que listar, un mensaje.

const estilos = StyleSheet.create({
  seccion: {
    padding: px(24),
    borderWidth: BORDE_FINO,
    borderColor: COLORES.borde,
    borderRadius: RADIO_TARJETA,
    backgroundColor: COLORES.fondoSuave,
  },
  campos: { gap: px(20) },
  filaCampos: { flexDirection: 'row', gap: px(32) },
  columna: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  etiqueta: {
    ...TEXTO.etiqueta,
    fontWeight: 700,
    color: COLORES.cobalto,
    letterSpacing: espaciado.muyAncho(TEXTO.etiqueta.fontSize),
    textTransform: 'uppercase',
  },
  valor: { ...TEXTO.campo, marginTop: px(4) },
  destacado: { ...TEXTO.destacado, fontWeight: 600 },
  detalle: { ...TEXTO.base, color: COLORES.texto70 },
  nota: {
    ...TEXTO.chico,
    fontWeight: 700,
    color: COLORES.cobalto,
    letterSpacing: espaciado.ancho(TEXTO.chico.fontSize),
    textTransform: 'uppercase',
    marginTop: px(4),
  },
  mensaje: { ...TEXTO.normal, color: COLORES.texto70 },
})

/** La tarjeta. No se parte entre dos hojas. */
export function SeccionPdf({ children }: { children: ReactNode }) {
  return (
    <View wrap={false} style={estilos.seccion}>
      {children}
    </View>
  )
}

/** Grilla de dos columnas iguales para los `CampoPdf`, de a dos por renglón. */
export function CamposPdf({ children }: { children: ReactNode }) {
  const campos = Children.toArray(children)
  const filas: ReactNode[][] = []
  for (let i = 0; i < campos.length; i += 2) filas.push(campos.slice(i, i + 2))
  return (
    <View style={estilos.campos}>
      {filas.map((fila, i) => (
        <View key={i} style={estilos.filaCampos}>
          <View style={estilos.columna}>{fila[0]}</View>
          <View style={estilos.columna}>{fila[1]}</View>
        </View>
      ))}
    </View>
  )
}

/**
 * Etiqueta y valor. Sin valor (`null`, `undefined` o `''`) muestra `—`. Los saltos de línea del
 * valor se respetan.
 */
export function CampoPdf({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <View>
      <Text style={estilos.etiqueta}>{label}</Text>
      <Text style={estilos.valor}>{valor || '—'}</Text>
    </View>
  )
}

/**
 * El contenido de una `SeccionPdf` que encabeza un listado: el dato destacado (el alumno, el día),
 * un detalle debajo (el DNI) y una nota en cobalto y en mayúsculas (el rango, los filtros).
 */
export function DestacadoPdf({
  titulo,
  detalle,
  nota,
}: {
  titulo: string
  detalle?: string | null
  nota?: string | null
}) {
  return (
    <View>
      <Text style={estilos.destacado}>{titulo}</Text>
      {detalle ? <Text style={estilos.detalle}>{detalle}</Text> : null}
      {nota ? <Text style={estilos.nota}>{nota}</Text> : null}
    </View>
  )
}

/** Un renglón suelto en lugar de la tabla: no hay nada que listar ("Sin turnos en ese rango."). */
export function MensajePdf({ children }: { children: string }) {
  return <Text style={estilos.mensaje}>{children}</Text>
}
