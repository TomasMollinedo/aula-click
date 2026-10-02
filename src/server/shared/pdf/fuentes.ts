import { join } from 'node:path'
import { Font } from '@react-pdf/renderer'

// Geist, la fuente de la app, para los documentos en PDF. Los TTF estáticos son los del repo
// oficial (vercel/geist-font, licencia OFL: `fuentes/OFL.txt`) y viven en el repo: el PDF se arma
// en el servidor, sin red. La ruta es relativa a la raíz del proyecto (`process.cwd()`), igual
// que el logo de `centro`: funciona en `pnpm dev` y en `pnpm build && pnpm start`.

export const FUENTE = 'Geist'

const CARPETA = join(process.cwd(), 'src/server/shared/pdf/fuentes')

const PESOS = [
  ['Geist-Regular.ttf', 400],
  ['Geist-Medium.ttf', 500],
  ['Geist-SemiBold.ttf', 600],
  ['Geist-Bold.ttf', 700],
] as const

let registradas = false

/** Registra Geist (400, 500, 600 y 700) una sola vez por proceso. La llama `renderizarPdf`. */
export function registrarFuentes(): void {
  if (registradas) return
  Font.register({
    family: FUENTE,
    fonts: PESOS.map(([archivo, fontWeight]) => ({ src: join(CARPETA, archivo), fontWeight })),
  })
  // Sin separación en sílabas: una palabra pasa entera al renglón siguiente.
  Font.registerHyphenationCallback((palabra) => [palabra])
  registradas = true
}
