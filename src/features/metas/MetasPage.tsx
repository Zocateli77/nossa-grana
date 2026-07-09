import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Target, Loader2, ChevronRight } from 'lucide-react'
import { useDados } from '@/hooks/useDados'
import { useSalvarMeta } from '@/hooks/useMutations'
import { progressoMeta } from '@/lib/calc'
import { money } from '@/lib/format'
import { mesCurto } from '@/lib/format'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { AIQuickLink } from '@/components/AIQuickLink'
import { Carregando, Vazio } from '@/components/Estados'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/MoneyInput'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { themeColors } from '@/lib/utils'

export function MetasPage() {
  const { dados, isLoading } = useDados()
  const [nova, setNova] = useState(false)
  if (isLoading) return <Carregando />

  return (
    <div>
      <header className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-extrabold tracking-tight">Metas</h1>
        <div className="flex items-center gap-2">
          <AIQuickLink prompt="Revise minhas metas e sugira prioridade de aportes para este mes." label="IA" />
          <Button size="sm" onClick={() => setNova(true)}><Plus className="h-4 w-4" /> Nova</Button>
        </div>
      </header>

      {dados.metas.length === 0 ? (
        <Vazio icon={Target} titulo="Sem metas ainda" descricao="Crie uma meta e veja a barra avançar a cada aporte." acao={<Button onClick={() => setNova(true)}>Criar meta</Button>} />
      ) : (
        <div className="space-y-3">
          {dados.metas.map((m) => {
            const p = progressoMeta(m, dados.lancamentos)
            return (
              <Link key={m.id} to={`/metas/${m.id}`}>
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <CategoriaIcon icone={m.icone ?? 'target'} cor={m.cor} className="h-10 w-10" size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{m.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {money(m.valor_atual)} de {money(m.valor_alvo)}{m.data_alvo ? ` · ${mesCurto(m.data_alvo)}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-bold">{Math.round(p.pct * 100)}%</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Progress value={p.pct * 100} className="mt-3" indicatorClassName="bg-primary" />
                  {p.falta > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Faltam {money(p.falta)}</p>}
                </Card>
              </Link>
            )
          })}
        </div>
      )}
      {nova && <NovaMetaDialog onClose={() => setNova(false)} />}
    </div>
  )
}

const TIPOS_META = [
  { v: 'investimento', l: 'Investimento' },
  { v: 'reserva_emergencia', l: 'Reserva de emergência' },
  { v: 'compra', l: 'Compra' },
  { v: 'viagem', l: 'Viagem' },
  { v: 'quitacao_divida', l: 'Quitar dívida' },
]

export function NovaMetaDialog({ onClose }: { onClose: () => void }) {
  const salvar = useSalvarMeta()
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('investimento')
  const [alvo, setAlvo] = useState(0)
  const [dataAlvo, setDataAlvo] = useState('')

  async function onSave() {
    if (!nome.trim() || alvo <= 0) return
    await salvar.mutateAsync({ nome: nome.trim(), tipo, valor_alvo: alvo, data_alvo: dataAlvo || null, cor: themeColors.success, icone: 'target' })
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova meta</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Viagem Chile" autoFocus /></div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS_META.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Valor alvo</Label><MoneyInput value={alvo} onChange={setAlvo} /></div>
          <div className="space-y-1.5"><Label>Data alvo (opcional)</Label><Input type="date" value={dataAlvo} onChange={(e) => setDataAlvo(e.target.value)} /></div>
          <Button className="w-full" onClick={onSave} disabled={salvar.isPending || !nome.trim() || alvo <= 0}>
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Criar meta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
