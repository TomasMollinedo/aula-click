import { Children, type ReactNode } from 'react'
import { StyleSheet, Text, View } from '@react-pdf/renderer'
import { BORDE_FINO, COLORES, RADIO_TARJETA, TEXTO, espaciado, px } from './estilos'

// Los datos de un documento: una tarjeta suave con las etiquetas en cobalto y sus valores.

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
