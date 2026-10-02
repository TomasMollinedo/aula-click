import { Path, Svg } from '@react-pdf/renderer'
import { ALTO_LOGO } from '@/server/shared/pdf/estilos'

// El logo del centro para los documentos en PDF, vectorial. Es `assets/logo.svg` (el que sirve
// `GET /centro/logo`) traducido a las primitivas de react-pdf, que no dibuja un SVG como imagen:
// SI CAMBIA UNO, CAMBIA EL OTRO.

/** El `viewBox` de `assets/logo.svg`: 114 × 91. */
const ANCHO = 114
const ALTO = 91

const MARINO = '#1a1e33'
const COBALTO = '#3552cc'

/** La N que sube en flecha. */
const N =
  'M100.2 21.69 L75.24 33.9 L81.9 38.34 L61.23 69.34 L36.5 10 L24 10 L24 70 L36 64 L36 40 L58.77 94.66 L91.88 44.99 L98.54 49.43 Z'

/** `alto` en puntos (por defecto, el del encabezado de un documento); el ancho sale de la proporción. */
export function LogoCentroPdf({ alto = ALTO_LOGO }: { alto?: number }) {
  const trazo = {
    fill: 'none',
    stroke: MARINO,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const
  return (
    <Svg viewBox={`3 7 ${ANCHO} ${ALTO}`} style={{ width: (alto * ANCHO) / ALTO, height: alto }}>
      {/* Libro abierto (azul del sidebar) */}
      <Path d="M60 94 C46 86 27 83 7 84 V30" strokeWidth={5} {...trazo} />
      <Path d="M60 94 C74 86 93 83 113 84 V30" strokeWidth={5} {...trazo} />
      <Path d="M55 86 C43 80 29 77 15 77 V24" strokeWidth={3} {...trazo} />
      <Path d="M65 86 C77 80 91 77 105 77 V24" strokeWidth={3} {...trazo} />
      {/* La N (cobalto), recortada en blanco sobre las hojas. react-pdf no tiene
          `paint-order="stroke"`: va dos veces, primero el trazo blanco y encima el relleno. */}
      <Path d={N} fill="none" stroke="#ffffff" strokeWidth={3} strokeLinejoin="miter" />
      <Path d={N} fill={COBALTO} />
    </Svg>
  )
}
