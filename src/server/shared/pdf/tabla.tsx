import { Children, cloneElement, isValidElement, type ReactNode } from 'react'
import { StyleSheet, Text, View } from '@react-pdf/renderer'
import {
  BORDE_FINO,
  BORDE_GRUESO,
  COLORES,
  SEPARACION_BLOQUES,
  TEXTO,
  espaciado,
  px,
} from './estilos'

// Tabla de un documento que puede ocupar varias hojas (el comprobante de pago: hasta 200 turnos).
// Mismo lenguaje que los campos: encabezados en cobalto y en mayúsculas, filas con un separador
// suave e importes a la derecha. Al paginar: el encabezado se repite en cada hoja, ninguna fila se
// parte y el cierre no se parte ni queda solo en la última hoja. Hay dos aspectos, los de las hojas
// que se imprimían: filas con separador (el comprobante) o `alternada`, con un fondo suave fila
// por medio y sin separador (los listados de turnos).
//
// Sin contexto ni hooks: un Route Handler de Next se compila con el React de servidor, que no
// tiene `createContext` ni `useContext`. Las columnas llegan a cada fila con `cloneElement`.

export type ColumnaPdf = {
  titulo: string
  /** Ancho relativo al de las demás columnas (son proporciones, no puntos). */
  ancho: number
  /** Columna de importes: alineada a la derecha. */
  numerica?: boolean
}

const estilos = StyleSheet.create({
  encabezados: {
    flexDirection: 'row',
    borderBottomWidth: BORDE_GRUESO,
    borderBottomColor: COLORES.cobaltoSuave,
  },
  encabezado: {
    ...TEXTO.etiquetaTabla,
    fontWeight: 700,
    color: COLORES.cobalto,
    letterSpacing: espaciado.ancho(TEXTO.etiquetaTabla.fontSize),
    textTransform: 'uppercase',
  },
  fila: {
    flexDirection: 'row',
    borderBottomWidth: BORDE_FINO,
    borderBottomColor: COLORES.borde,
  },
  filaSinSeparador: { flexDirection: 'row' },
  filaAlternada: { backgroundColor: COLORES.fondoAlterno },
  celda: { paddingVertical: px(8), paddingRight: px(12) },
  celdaNumerica: { paddingRight: 0 },
  texto: { ...TEXTO.normal },
  textoNumerico: { textAlign: 'right' },
  cierre: { gap: SEPARACION_BLOQUES },
  cierreDeTabla: { marginTop: SEPARACION_BLOQUES },
})

/** El ancho de la columna `indice` como porcentaje del de la tabla, con su relleno adentro. */
function estiloDeCelda(columnas: readonly ColumnaPdf[], indice: number) {
  const total = columnas.reduce((suma, columna) => suma + columna.ancho, 0)
  const columna = columnas[indice]
  return [
    estilos.celda,
    { width: `${columna && total > 0 ? (columna.ancho / total) * 100 : 0}%` },
    columna?.numerica ? estilos.celdaNumerica : {},
  ]
}

type TablaPdfProps = {
  columnas: readonly ColumnaPdf[]
  /** Filas pares con un fondo suave, en lugar del separador entre filas. */
  alternada?: boolean
  /**
   * Lo que cierra el documento después de la tabla (un `CierrePdf` con los totales y el pie). Va
   * pegado a la última fila: no se parte ni queda solo en la última hoja.
   */
  cierre?: ReactNode
  /** Las `FilaPdf`, como hijas directas (reciben de acá las columnas). */
  children?: ReactNode
}

type FilaPdfProps = {
  /** Las pone `TablaPdf`: no se pasan a mano. */
  columnas?: readonly ColumnaPdf[]
  /** La pone `TablaPdf` cuando es `alternada`: la fila va sin separador. */
  sinSeparador?: boolean
  /** Las `CeldaPdf`, en el orden de las columnas. */
  children: ReactNode
}

export function TablaPdf({ columnas, alternada = false, cierre, children }: TablaPdfProps) {
  const filas = Children.toArray(children).map((fila, i) => (
    // Una fila no se parte entre dos hojas.
    <View key={i} wrap={false} style={alternada && i % 2 === 1 ? estilos.filaAlternada : {}}>
      {isValidElement<FilaPdfProps>(fila)
        ? cloneElement(fila, { columnas, sinSeparador: alternada })
        : fila}
    </View>
  ))
  const ultima = filas.pop()

  return (
    <View>
      {/* `fixed`: se repite arriba de la tabla en cada hoja que ocupa. */}
      <View fixed style={estilos.encabezados}>
        {columnas.map((columna, i) => (
          <View key={i} style={estiloDeCelda(columnas, i)}>
            <Text style={[estilos.encabezado, columna.numerica ? estilos.textoNumerico : {}]}>
              {columna.titulo}
            </Text>
          </View>
        ))}
      </View>
      {filas}
      {/* La última fila y el cierre pasan juntos de hoja. */}
      <View wrap={false}>
        {ultima}
        {cierre ? <View style={estilos.cierreDeTabla}>{cierre}</View> : null}
      </View>
    </View>
  )
}

/** Una fila: sus `CeldaPdf`, en el orden de las columnas (de ahí salen el ancho y la alineación). */
export function FilaPdf({ columnas = [], sinSeparador = false, children }: FilaPdfProps) {
  return (
    <View style={sinSeparador ? estilos.filaSinSeparador : estilos.fila}>
      {Children.toArray(children).map((celda, i) => (
        <View key={i} style={estiloDeCelda(columnas, i)}>
          <Text style={[estilos.texto, columnas[i]?.numerica ? estilos.textoNumerico : {}]}>
            {celda}
          </Text>
        </View>
      ))}
    </View>
  )
}

/** El texto de una celda. */
export function CeldaPdf({ children }: { children: ReactNode }) {
  return <Text>{children}</Text>
}

/**
 * Bloque de cierre de un documento (totales, observaciones y pie): no se parte entre dos hojas.
 * Después de una tabla se pasa por su prop `cierre`, para que además se lleve la última fila.
 */
export function CierrePdf({ children }: { children: ReactNode }) {
  return (
    <View wrap={false} style={estilos.cierre}>
      {children}
    </View>
  )
}
