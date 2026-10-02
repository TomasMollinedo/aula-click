// Lo que otras features necesitan de `centro` para armar un documento oficial en PDF (el
// encabezado): los datos, el logo y `encabezadoDeDocumento`, que junta los dos con quién emite el
// documento y cuándo. Se re-exportan desde acá para que nadie los copie ni importe otro archivo de
// la feature (arquitectura-backend.md → Dependencias entre features). `centro` no tiene tabla, así
// que acá no hay consultas.

export { DATOS_CENTRO } from './centro.datos'
export type { Centro } from './centro.validation'
export { LogoCentroPdf } from './centro.logo-pdf'
export { encabezadoDeDocumento, type EncabezadoDeDocumento } from './centro.documento'
