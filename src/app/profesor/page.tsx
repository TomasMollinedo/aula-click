import { redirect } from 'next/navigation'

// La raíz del segmento no tiene pantalla propia: es a donde llega el login y el logo del Header,
// así que lleva a la primera del Sidebar.
export default function ProfesorPage() {
  redirect('/profesor/agenda')
}
