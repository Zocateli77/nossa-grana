import { useState } from 'react'
import { Moon, Sun, LogOut, Users, Wallet, PiggyBank, Check } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { useDados } from '@/hooks/useDados'
import { useSalvarRenda } from '@/hooks/useMutations'
import { mesAtualRef } from '@/lib/dates'
import { money } from '@/lib/format'
import { MoneyInput } from '@/components/MoneyInput'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SecaoTitulo, Carregando } from '@/components/Estados'
import { themeColors } from '@/lib/utils'

export function ConfigPage() {
  const { salarioBase, setSalarioBase, tema, alternarTema } = useApp()
  const { sair, session } = useAuth()
  const { dados, isLoading } = useDados()
  const salvarRenda = useSalvarRenda()
  const [salario, setSalario] = useState(salarioBase)
  const [salvoSalario, setSalvoSalario] = useState(false)
  const [erroSalario, setErroSalario] = useState<string | null>(null)

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

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight mb-4">Configurações</h1>

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
