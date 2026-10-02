// Tokens de los documentos oficiales en PDF. Son los del documento que antes se imprimía desde el
// navegador (Tailwind), pasados a puntos: el navegador imprime a 96 dpi, así que 1 px = 0,75 pt.
// Los negros con opacidad van como su gris equivalente sobre blanco.

/** Píxeles de CSS → puntos del PDF (`px(16)` → 12). */
export const px = (pixeles: number): number => pixeles * 0.75

export const COLORES = {
  /** `--color-cobalto`: etiquetas, encabezados de tabla y la línea bajo el encabezado. */
  cobalto: '#3552cc',
  /** Cobalto al 40 % sobre blanco: el borde del encabezado de las tablas. */
  cobaltoSuave: '#aebaeb',
  /** `--sidebar`: el nombre del centro, el título y la referencia. */
  marino: '#1a1e33',
  negro: '#000000',
  /** `text-black/80`, `/70`, `/60` y `/50`. */
  texto80: '#333333',
  texto70: '#4d4d4d',
  texto60: '#666666',
  texto50: '#808080',
  /** `border-black/10` y `/20`. */
  borde: '#e6e6e6',
  bordeFuerte: '#cccccc',
  /** `bg-black/1.5` (tarjetas) y `bg-black/2` (filas alternadas). */
  fondoSuave: '#fbfbfb',
  fondoAlterno: '#fafafa',
} as const

/**
 * Hoja A4 con los márgenes efectivos de la impresión anterior (medidos sobre los PDF de
 * referencia): 58,34 pt a los costados, 48 pt arriba y los 15 mm del `@page` abajo.
 */
export const PAGINA = {
  margenHorizontal: 58.34,
  margenSuperior: 48,
  margenInferior: 42.52,
} as const

/** Un borde de 1 px: el navegador lo imprimía de medio punto. */
export const BORDE_FINO = 0.5
/** Un borde de 2 px (la línea del encabezado y la del encabezado de las tablas). */
export const BORDE_GRUESO = px(2)
/** `rounded-xl`. */
export const RADIO_TARJETA = px(12)
/** Separación entre los bloques de un documento (`space-y-5`). */
export const SEPARACION_BLOQUES = px(20)
/** Alto del logo en el encabezado (`h-14`); el ancho sale de la proporción del logo. */
export const ALTO_LOGO = px(56)

/**
 * Tamaño y alto de línea de cada texto de Tailwind que usan los documentos. El alto de línea es
 * un múltiplo del tamaño, como en el navegador.
 */
export const TEXTO = {
  /** `text-[10px]` dentro de un `text-xs`: las etiquetas del encabezado. */
  etiquetaEncabezado: { fontSize: px(10), lineHeight: 4 / 3 },
  /** `text-[10px]` suelto: las etiquetas de los campos. */
  etiqueta: { fontSize: px(10), lineHeight: 1.5 },
  /** `text-[11px]` en una tabla o un total. */
  etiquetaTabla: { fontSize: px(11), lineHeight: 20 / 14 },
  /** `text-xs`. */
  chico: { fontSize: px(12), lineHeight: 4 / 3 },
  /** `text-sm`. */
  normal: { fontSize: px(14), lineHeight: 20 / 14 },
  /** `text-[15px]`: el valor de un campo. */
  campo: { fontSize: px(15), lineHeight: 1.5 },
  /** `text-xl leading-tight`: el nombre del centro. */
  centro: { fontSize: px(20), lineHeight: 1.25 },
  /** `text-2xl`: el título, la referencia y los totales. */
  titulo: { fontSize: px(24), lineHeight: 4 / 3 },
} as const

/** `tracking-*` de Tailwind, en puntos para un tamaño de letra dado. */
export const espaciado = {
  /** `tracking-widest` (0,1 em). */
  muyAncho: (fontSize: number) => fontSize * 0.1,
  /** `tracking-wide` (0,025 em). */
  ancho: (fontSize: number) => fontSize * 0.025,
  /** `tracking-tight` (-0,025 em). */
  apretado: (fontSize: number) => fontSize * -0.025,
}
