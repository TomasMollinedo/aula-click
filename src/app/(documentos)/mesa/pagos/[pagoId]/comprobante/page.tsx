import { ComprobantePago } from '@/features/pagos/components/ComprobantePago'

// Comprobante de un pago (HU-15), para imprimir o guardar como PDF. Lo abre "Imprimir comprobante"
// del diálogo de registrar un pago, en otra pestaña.
export default async function ComprobantePage({
  params,
}: PageProps<'/mesa/pagos/[pagoId]/comprobante'>) {
  const { pagoId } = await params
  return <ComprobantePago pagoId={pagoId} rutaVolver="/mesa/pagos" />
}
