import { LoginHero } from '@/features/auth/components/LoginHero'
import { LoginPanel } from '@/features/auth/components/LoginPanel'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      <LoginHero />
      <LoginPanel />
    </main>
  )
}
