import { useState } from 'react'
import { PiggyBank, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'

type Modo = 'entrar' | 'cadastrar'

export function LoginPage() {
  const { entrar, cadastrar } = useAuth()
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  function trocarModo(novo: Modo) {
    setModo(novo)
    setErro(null)
    setSucesso(null)
    setConfirmarSenha('')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setSucesso(null)

    if (modo === 'cadastrar' && senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }
    if (modo === 'cadastrar' && senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setCarregando(true)
    if (modo === 'entrar') {
      const { error } = await entrar(email.trim(), senha)
      if (error) setErro(error)
    } else {
      const { error, precisaConfirmar } = await cadastrar(email.trim(), senha)
      if (error) {
        setErro(error)
      } else if (precisaConfirmar) {
        setSucesso('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
      } else {
        setSucesso('Conta criada com sucesso! Você já pode usar o app.')
      }
    }
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

        <div className="flex rounded-xl border bg-muted/50 p-1 mb-4">
          <button
            type="button"
            onClick={() => trocarModo('entrar')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              modo === 'entrar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => trocarModo('cadastrar')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              modo === 'cadastrar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
            }`}
          >
            Criar conta
          </button>
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
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {modo === 'cadastrar' && (
            <div className="space-y-1.5">
              <Label htmlFor="confirmarSenha">Confirmar senha</Label>
              <Input
                id="confirmarSenha"
                type="password"
                autoComplete="new-password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          )}
          {erro && (
            <p className="text-sm text-destructive" role="alert" aria-live="assertive">
              {erro}
            </p>
          )}
          {sucesso && (
            <p className="text-sm text-green-600 dark:text-green-400" role="status" aria-live="polite">
              {sucesso}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={carregando} aria-busy={carregando}>
            {carregando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {modo === 'entrar' ? 'Entrando…' : 'Criando conta…'}
              </>
            ) : modo === 'entrar' ? (
              'Entrar'
            ) : (
              'Criar conta'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
