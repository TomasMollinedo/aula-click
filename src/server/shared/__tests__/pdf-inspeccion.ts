// Lectura mínima de un PDF generado, para los tests (no es un parser: alcanza para lo que escribe
// react-pdf). Evita sumar una dependencia sólo para contar páginas o leer un metadato.

/** Cantidad de hojas: los objetos `/Type /Page` (sin contar el árbol `/Pages`). */
export function contarPaginas(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length
}

/**
 * Un metadato del diccionario de información (`Title`, `Author`, `Creator`, `Producer`), o `null`
 * si no está. react-pdf los escribe como objetos aparte, en UTF-16BE con BOM.
 */
export function metadato(pdf: Buffer, clave: string): string | null {
  const texto = pdf.toString('latin1')
  const referencia = new RegExp(`/${clave} (\\d+) 0 R`).exec(texto)
  if (!referencia) return null
  const objeto = new RegExp(`\\n${referencia[1]} 0 obj\\r?\\n\\(([\\s\\S]*?)\\)\\r?\\nendobj`).exec(
    texto,
  )
  if (!objeto?.[1]) return null
  const bytes = Buffer.from(objeto[1].replace(/\\([\\()])/g, '$1'), 'latin1')
  if (bytes[0] !== 0xfe || bytes[1] !== 0xff) return bytes.toString('latin1')
  let salida = ''
  for (let i = 2; i + 1 < bytes.length; i += 2) {
    salida += String.fromCharCode((bytes[i]! << 8) | bytes[i + 1]!)
  }
  return salida
}

/** El idioma del documento (`/Lang`), o `null`. */
export function idioma(pdf: Buffer): string | null {
  return /\/Lang \(([^)]*)\)/.exec(pdf.toString('latin1'))?.[1] ?? null
}
