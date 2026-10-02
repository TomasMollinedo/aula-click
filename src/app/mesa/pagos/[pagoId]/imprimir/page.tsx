import { ComprobantePago } from '@/features/pagos/components/ComprobantePago'

// Hoja de impresión del comprobante de un pago (HU-15), con el patrón de las hojas de T-60: dentro
// del `AppShell`, que no sale al imprimir. La abren, en otra pestaña, "Imprimir comprobante" del
// diálogo de registrar un pago y "Ver comprobante" del detalle de un turno pagado. La página sólo
// compone: el documento vive en `features/pagos`.
export default async function ImprimirComprobantePage({
  params,
}: PageProps<'/mesa/pagos/[pagoId]/imprimir'>) {
  const { pagoId } = await params
  return <ComprobantePago pagoId={pagoId} rutaRespaldo="/mesa/pagos" />
}
