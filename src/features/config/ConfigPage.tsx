import { useState } from 'react'
import { Moon, Sun, LogOut, Users, Wallet, PiggyBank, Check } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { useDados } from '@/hooks/useDados'
import { money } from '@/lib/format'
import { MoneyInput } from '@/components/MoneyInput'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SecaoTitulo } from '@/components/Estados'

export function ConfigPage() {
  const { salarioBase, setSalarioBase, tema, alternarTema } = useApp()
  const { sair, session } = useAuth()
  const { dados } = useDados()
  const [salario, setSalario] = useState(salarioBase)
  const [salvoSalario, setSalvoSalario] = useState(false)

  function salvarSalario() {
    setSalarioBase(salario)
    setSalvoSalario(true)
    setTimeout(() => setSalvoSalario(false), 1500)
  }

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight mb-4">Configurações</h1>

      <SecaoTitulo>Renda</SecaoTitulo>
      <Card className="p-4">
        <Label className="flex items-center gap-2 text-foreground mb-2"><Wallet className="h-4 w-4" /> Salário / renda base do mês</Label>
        <div className="flex gap-2">
          <MoneyInput value={salario} onChange={setSalario} />
          <Button onClick={salvarSalario}>{salvoSalario ? <Check className="h-4 w-4" /> : 'Salvar'}</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Usado para calcular o "disponível livre". Atual: {money(salarioBase)}</p>
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
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.cor ?? '#999' }} /> {p.nome}
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
