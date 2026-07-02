import { useState } from 'react'
import { PiggyBank, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'

export function LoginPage() {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const { error } = await entrar(email.trim(), senha)
    if (error) setErro(error)
    setCarregando(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-b from-secondary to-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg mb-4">
            <PiggyBank className="h-8 w-8" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">Nossa Grana</h1>
          <p className="text-sm text-muted-foreground mt-1">Paz com o dinheiro, todo dia.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {erro && (
            <p className="text-sm text-destructive" role="alert" aria-live="assertive">
              {erro}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={carregando} aria-busy={carregando}>
            {carregando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Entrando…
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
