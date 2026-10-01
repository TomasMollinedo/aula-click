// Lo que otras features necesitan de la cancelación sin importar `cancelaciones.reglas.ts` (de otra
// feature solo se importan `*.repository` y `*.condiciones`, lo hace cumplir ESLint). Lo consume
// `ocurrencias`: el detalle de un turno pagado muestra "Cancelar" deshabilitado con el mismo mensaje
// con el que `POST /cancelaciones` lo rechaza. Sólo re-exporta: la implementación es la de
// `cancelaciones.reglas.ts`.

export { MENSAJES_NO_CANCELABLE } from './cancelaciones.reglas'
