import { useState } from 'react'
import { Moon, Sun, LogOut, Users, Wallet, PiggyBank, Check, Home, Mail, UserPlus, X } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useDados } from '@/hooks/useDados'
import { useSalvarRenda } from '@/hooks/useMutations'
import {
  useMembros,
  useConvites,
  useConvitesPendentes,
  useCriarConvite,
  useRevogarConvite,
  useAceitarConvite,
} from '@/hooks/useWorkspace'
import { mesAtualRef } from '@/lib/dates'
import { money } from '@/lib/format'
import { MoneyInput } from '@/components/MoneyInput'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SecaoTitulo, Carregando } from '@/components/Estados'
import { themeColors } from '@/lib/utils'
import type { Convite } from '@/types/db'

export function ConfigPage() {
  const { salarioBase, setSalarioBase, tema, alternarTema } = useApp()
  const { sair, session } = useAuth()
  const { workspaceAtivo, workspaces, trocarWorkspace } = useWorkspace()
  const { dados, isLoading } = useDados()
  const salvarRenda = useSalvarRenda()
  const membros = useMembros(workspaceAtivo?.id)
  const convites = useConvites(workspaceAtivo?.id)
  const convitesPendentes = useConvitesPendentes()
  const criarConvite = useCriarConvite()
  const revogarConvite = useRevogarConvite()
  const aceitarConvite = useAceitarConvite()

  const [salario, setSalario] = useState(salarioBase)
  const [salvoSalario, setSalvoSalario] = useState(false)
  const [erroSalario, setErroSalario] = useState<string | null>(null)
  const [emailConvite, setEmailConvite] = useState('')
  const [erroConvite, setErroConvite] = useState<string | null>(null)
  const [sucessoConvite, setSucessoConvite] = useState(false)

  if (isLoading) return <Carregando />

  async function salvarSalario() {
    setErroSalario(null)
    setSalarioBase(salario)
    try {
      await salvarRenda.mutateAsync({ mes_referencia: mesAtualRef(), valor: salario, recorrente: true })
      setSalvoSalario(true)
      setTimeout(() => setSalvoSalario(false), 1500)
    } catch (e: unknown) {
      setErroSalario(e instanceof Error ? e.message : 'Erro ao salvar a renda.')
    }
  }

  async function enviarConvite() {
    if (!workspaceAtivo || !emailConvite.trim()) return
    setErroConvite(null)
    setSucessoConvite(false)
    try {
      await criarConvite.mutateAsync({ workspaceId: workspaceAtivo.id, email: emailConvite.trim() })
      setEmailConvite('')
      setSucessoConvite(true)
      setTimeout(() => setSucessoConvite(false), 2000)
    } catch (e: unknown) {
      setErroConvite(e instanceof Error ? e.message : 'Erro ao enviar convite.')
    }
  }

  async function aceitar(c: Convite & { workspaces?: { nome: string } }) {
    try {
      await aceitarConvite.mutateAsync(c)
    } catch (e: unknown) {
      setErroConvite(e instanceof Error ? e.message : 'Erro ao aceitar convite.')
    }
  }

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight mb-4">Configurações</h1>

      <SecaoTitulo>Espaço / Família</SecaoTitulo>
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Home className="h-4 w-4" />
          <span>Espaço ativo: <strong className="text-foreground">{workspaceAtivo?.nome ?? '—'}</strong></span>
        </div>

        {workspaces.length > 1 && (
          <div className="space-y-2">
            <Label>Trocar espaço</Label>
            <div className="flex flex-wrap gap-2">
              {workspaces.map((ws) => (
                <Button
                  key={ws.id}
                  variant={ws.id === workspaceAtivo?.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => trocarWorkspace(ws.id)}
                >
                  {ws.nome}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Users className="h-4 w-4" /> Membros
          </div>
          <div className="space-y-1">
            {(membros.data ?? []).map((m) => (
              <div key={m.user_id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-muted-foreground">{m.user_id.slice(0, 8)}…</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{m.papel}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Convidar por e-mail</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={emailConvite}
              onChange={(e) => setEmailConvite(e.target.value)}
            />
            <Button onClick={enviarConvite} disabled={criarConvite.isPending || !emailConvite.trim()}>
              {criarConvite.isPending ? 'Enviando…' : 'Convidar'}
            </Button>
          </div>
          {erroConvite && <p className="text-sm text-destructive" role="alert">{erroConvite}</p>}
          {sucessoConvite && <p className="text-sm text-green-600 dark:text-green-400">Convite enviado!</p>}
        </div>

        {(convites.data ?? []).filter((c) => c.status === 'pendente').length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2"><Mail className="h-4 w-4" /> Convites pendentes (enviados)</p>
            <div className="space-y-1">
              {(convites.data ?? []).filter((c) => c.status === 'pendente').map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive"
                    onClick={() => revogarConvite.mutate({ id: c.id, workspaceId: c.workspace_id })}
                    aria-label={`Revogar convite para ${c.email}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(convitesPendentes.data ?? []).length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Convites recebidos</p>
            <div className="space-y-2">
              {(convitesPendentes.data ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm rounded-lg border p-2">
                  <span>{(c as Convite & { workspaces?: { nome: string } }).workspaces?.nome ?? 'Espaço'}</span>
                  <Button size="sm" onClick={() => aceitar(c as Convite & { workspaces?: { nome: string } })}>
                    Aceitar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <SecaoTitulo>Renda</SecaoTitulo>
      <Card className="p-4">
        <Label className="flex items-center gap-2 text-foreground mb-2"><Wallet className="h-4 w-4" /> Renda prevista padrão</Label>
        <div className="flex gap-2">
          <MoneyInput value={salario} onChange={setSalario} />
          <Button onClick={salvarSalario} disabled={salvarRenda.isPending} aria-label={salvoSalario ? 'Renda salva' : 'Salvar renda'}>
            {salvarRenda.isPending ? 'Salvando…' : salvoSalario ? <Check className="h-4 w-4" /> : 'Salvar'}
          </Button>
        </div>
        {erroSalario && <p className="mt-2 text-sm text-destructive" role="alert">{erroSalario}</p>}
        <p className="text-xs text-muted-foreground mt-2">Base recorrente do "disponível livre". Em Envelopes você ajusta a renda mês a mês. Atual: {money(salarioBase)}</p>
      </Card>

      <SecaoTitulo>Aparência</SecaoTitulo>
      <Card className="p-4 flex items-center justify-between">
        <span className="font-medium">Tema</span>
        <Button variant="outline" onClick={alternarTema} className="gap-2">
          {tema === 'claro' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {tema === 'claro' ? 'Escuro' : 'Claro'}
        </Button>
      </Card>

      <SecaoTitulo>Pessoas</SecaoTitulo>
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><Users className="h-4 w-4" /> Donos possíveis de um gasto</div>
        <div className="flex flex-wrap gap-2">
          {dados.pessoas.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.cor ?? themeColors.mutedForeground }} /> {p.nome}
            </span>
          ))}
        </div>
      </Card>

      <SecaoTitulo>Conta</SecaoTitulo>
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Logado como</p>
        <p className="font-medium">{session?.user.email}</p>
        <Button variant="outline" className="mt-3 gap-2 text-destructive" onClick={sair}><LogOut className="h-4 w-4" /> Sair</Button>
      </Card>

      <div className="flex flex-col items-center gap-1 py-8 text-muted-foreground">
        <PiggyBank className="h-6 w-6 text-primary" />
        <p className="text-sm font-semibold">Nossa Grana</p>
        <p className="text-xs">Feito com calma, para ter paz com o dinheiro.</p>
      </div>
    </div>
  )
}
