import { redirect } from 'next/navigation'

// El inicio del portal es "Mi calendario" (T-80).
export default function PortalPage() {
  redirect('/portal/calendario')
}
