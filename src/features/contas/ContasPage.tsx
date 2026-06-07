import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, Wallet, Banknote, HandCoins } from 'lucide-react'
import { useDados } from '@/hooks/useDados'
import { useApp } from '@/contexts/AppContext'
import { byId, lancsDoMes, totalContaMes } from '@/lib/calc'
import { money, dataCurta } from '@/lib/format'
import type { TipoConta } from '@/types/db'
import { MonthSelector } from '@/components/layout/MonthSelector'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Carregando } from '@/components/Estados'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const ICON: Record<TipoConta, typeof CreditCard> = {
  cartao_credito: CreditCard,
  conta: Wallet,
  dinheiro: Banknote,
  emprestimo: HandCoins,
}
const ROTULO: Record<TipoConta, string> = {
  cartao_credito: 'Cartão de crédito',
  conta: 'Conta',
  dinheiro: 'Dinheiro / Pix',
  emprestimo: 'Empréstimo',
}

export function ContasPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { mesRef } = useApp()
  const { dados, isLoading } = useDados()
  const catMap = useMemo(() => byId(dados.categorias), [dados.categorias])

  if (isLoading) return <Carregando />

  // ----- detalhe -----
  if (id) {
    const conta = dados.contas.find((c) => c.id === id)
    if (!conta) return null
    const lancs = lancsDoMes(dados.lancamentos, mesRef)
      .filter((l) => l.conta_id === id)
      .sort((a, b) => (a.data < b.data ? 1 : -1))
    const total = lancs.reduce((s, l) => s + Number(l.valor), 0)
    const Icon = ICON[conta.tipo]
    return (
      <div>
        <header className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/contas')}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-xl font-extrabold tracking-tight truncate">{conta.nome}</h1>
        </header>
        <Card className="p-5 mb-4" style={{ borderColor: (conta.cor ?? '') + '55' }}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" /> {ROTULO[conta.tipo]}</div>
          <p className="text-3xl font-extrabold mt-1">{money(total)}</p>
          <p className="text-xs text-muted-foreground">total no mês{conta.dia_vencimento ? ` · vence dia ${conta.dia_vencimento}` : ''}</p>
        </Card>
        <div className="rounded-2xl border bg-card divide-y overflow-hidden">
          {lancs.map((l) => {
            const cat = l.categoria_id ? catMap.get(l.categoria_id) : undefined
            return (
              <div key={l.id} className="flex items-center gap-3 p-3">
                <CategoriaIcon icone={cat?.icone} cor={cat?.cor} className="h-9 w-9" size={16} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate text-sm">{l.privado ? 'Gasto livre' : l.descricao}</p>
                  <p className="text-xs text-muted-foreground">{dataCurta(l.data)}{l.parcela_total && l.parcela_total > 1 ? ` · ${l.parcela_atual}/${l.parcela_total}` : ''}</p>
                </div>
                <span className="font-semibold tabular-nums">{money(l.valor)}</span>
              </div>
            )
          })}
          {lancs.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">Sem lançamentos neste mês.</p>}
        </div>
      </div>
    )
  }

  // ----- lista -----
  const contasComTotal = dados.contas
    .map((c) => ({ conta: c, total: totalContaMes(dados.lancamentos, c.id, mesRef) }))
    .sort((a, b) => b.total - a.total)
  const totalGeral = contasComTotal.reduce((s, x) => s + x.total, 0)

  return (
    <div>
      <header className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-extrabold tracking-tight">Contas & Cartões</h1>
        <MonthSelector />
      </header>
      <Card className="p-4 mb-4">
        <span className="text-sm text-muted-foreground">Total do mês (todas as contas)</span>
        <p className="text-2xl font-extrabold">{money(totalGeral)}</p>
      </Card>
      <div className="space-y-2">
        {contasComTotal.map(({ conta, total }) => {
          const Icon = ICON[conta.tipo]
          const dono = dados.pessoas.find((p) => p.id === conta.dono_id)
          return (
            <button key={conta.id} onClick={() => navigate(`/contas/${conta.id}`)} className="w-full text-left">
              <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: (conta.cor ?? '#14b8a6') + '22', color: conta.cor ?? '#14b8a6' }}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{conta.nome}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{ROTULO[conta.tipo]}</span>
                    {dono && dono.nome !== 'Compartilhado' && <Badge variant="muted">{dono.nome}</Badge>}
                  </div>
                </div>
                <span className="font-bold tabular-nums">{money(total)}</span>
              </Card>
            </button>
          )
        })}
      </div>
    </div>
  )
}
