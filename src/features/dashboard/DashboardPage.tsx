import { Link } from 'react-router-dom'
import { AlertTriangle, TrendingUp, Landmark, Wallet, Target, ArrowRight, CalendarClock } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useDados } from '@/hooks/useDados'
import {
  envelopesDoMes,
  resumoMes,
  reservaInvestimento,
  reservaImpostos,
  mesadas,
  progressoMeta,
  ehParcelado,
  lancsDoMes,
} from '@/lib/calc'
import { money } from '@/lib/format'
import { MonthSelector } from '@/components/layout/MonthSelector'
import { EnvelopeCard } from '@/components/EnvelopeCard'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Carregando, SecaoTitulo } from '@/components/Estados'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { mesRef, salarioBase } = useApp()
  const { dados, isLoading } = useDados()

  if (isLoading) return <Carregando />

  const resumo = resumoMes(dados, mesRef, salarioBase)
  const invest = reservaInvestimento(dados, mesRef)
  const impostos = reservaImpostos(dados, mesRef)
  const envs = envelopesDoMes(dados, mesRef)
  const meusMesadas = mesadas(dados, mesRef)
  const metasTop = dados.metas.filter((m) => !m.concluida).slice(0, 3)
  const compromissos = lancsDoMes(dados.lancamentos, mesRef)
    .filter((l) => ehParcelado(l))
    .sort((a, b) => Number(b.valor) - Number(a.valor))
    .slice(0, 5)

  return (
    <div className="space-y-1">
      <header className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm text-muted-foreground">Olá! 👋</p>
          <h1 className="text-xl font-extrabold tracking-tight">Visão do mês</h1>
        </div>
        <MonthSelector />
      </header>

      {/* Sobra do mês */}
      <Card className="overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Disponível livre</span>
            <Badge variant={resumo.disponivelLivre >= 0 ? 'success' : 'destructive'}>
              {resumo.disponivelLivre >= 0 ? 'No azul' : 'Acima da renda'}
            </Badge>
          </div>
          <p className={cn('text-4xl font-extrabold tracking-tight mt-1', resumo.disponivelLivre >= 0 ? 'text-success' : 'text-destructive')}>
            {money(resumo.disponivelLivre)}
          </p>
          {resumo.disponivelLivre < 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Seu plano está {money(Math.abs(resumo.disponivelLivre))} acima da renda — ajuste um envelope.
            </p>
          )}
          <Cascata resumo={resumo} />
        </div>
      </Card>

      {/* Reservas */}
      <SecaoTitulo>Reservado do topo</SecaoTitulo>
      <div className="grid grid-cols-2 gap-3">
        <ReservaCard titulo="Investimento" icon={TrendingUp} feito={invest.executado} total={invest.planejado} cor="text-success" />
        <ReservaCard titulo="Impostos" icon={Landmark} feito={impostos.executado} total={impostos.planejado} cor="text-foreground" />
      </div>

      {/* Mesadas */}
      {meusMesadas.length > 0 && (
        <>
          <SecaoTitulo>Mesadas</SecaoTitulo>
          <div className="grid grid-cols-2 gap-3">
            {meusMesadas.map((m) => (
              <Card key={m.categoria.id} className="p-4">
                <div className="flex items-center gap-2">
                  <CategoriaIcon icone="wallet" cor={m.pessoa?.cor} className="h-8 w-8" size={16} />
                  <span className="font-semibold text-sm truncate">{m.pessoa?.nome ?? m.categoria.nome}</span>
                </div>
                <p className="mt-2 text-lg font-bold">{money(m.resta)}</p>
                <p className="text-xs text-muted-foreground">de {money(m.estabelecido)} · livre</p>
                <Progress value={m.pct * 100} className="mt-2" indicatorClassName={m.pct >= 1 ? 'bg-destructive' : 'bg-primary'} />
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Envelopes */}
      <SecaoTitulo acao={<Link to="/orcamentos" className="text-xs font-medium text-primary inline-flex items-center gap-1">Ver todos <ArrowRight className="h-3 w-3" /></Link>}>
        Envelopes
      </SecaoTitulo>
      <div className="grid gap-3 sm:grid-cols-2">
        {envs.map((env) => (
          <EnvelopeCard key={env.categoria.id} env={env} />
        ))}
      </div>

      {/* Compromissos / parcelas */}
      {compromissos.length > 0 && (
        <>
          <SecaoTitulo>Parcelas do mês</SecaoTitulo>
          <Card className="divide-y">
            {compromissos.map((l) => (
              <div key={l.id} className="flex items-center gap-3 p-3">
                <CalendarClock className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{l.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.parcela_atual}/{l.parcela_total} · faltam {(l.parcela_total ?? 0) - (l.parcela_atual ?? 0)}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{money(l.valor)}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Metas */}
      {metasTop.length > 0 && (
        <>
          <SecaoTitulo acao={<Link to="/metas" className="text-xs font-medium text-primary inline-flex items-center gap-1">Ver metas <ArrowRight className="h-3 w-3" /></Link>}>
            Metas
          </SecaoTitulo>
          <div className="space-y-3">
            {metasTop.map((m) => {
              const p = progressoMeta(m, dados.lancamentos)
              return (
                <Link key={m.id} to={`/metas/${m.id}`}>
                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      <CategoriaIcon icone={m.icone ?? 'target'} cor={m.cor} className="h-8 w-8" size={16} />
                      <span className="font-semibold text-sm flex-1 truncate">{m.nome}</span>
                      <span className="text-xs text-muted-foreground">{Math.round(p.pct * 100)}%</span>
                    </div>
                    <Progress value={p.pct * 100} className="mt-2" indicatorClassName="bg-primary" />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {money(m.valor_atual)} de {money(m.valor_alvo)} · faltam {money(p.falta)}
                    </p>
                  </Card>
                </Link>
              )
            })}
          </div>
        </>
      )}

      <div className="h-4" />
    </div>
  )
}

function ReservaCard({ titulo, icon: Icon, feito, total, cor }: { titulo: string; icon: typeof TrendingUp; feito: number; total: number; cor: string }) {
  const pct = total > 0 ? (feito / total) * 100 : 0
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={cn('h-4 w-4', cor)} /> {titulo}
      </div>
      <p className="mt-2 text-lg font-bold">{money(feito)}</p>
      <p className="text-xs text-muted-foreground">de {money(total)}{total > feito ? ` · faltam ${money(total - feito)}` : ''}</p>
      <Progress value={pct} className="mt-2" indicatorClassName="bg-success" />
    </Card>
  )
}

function Cascata({ resumo }: { resumo: ReturnType<typeof resumoMes> }) {
  const partes = [
    { nome: 'Investir', valor: resumo.reservadoInvestimento, cls: 'bg-success' },
    { nome: 'Impostos', valor: resumo.reservadoImpostos, cls: 'bg-slate-400' },
    { nome: 'Gastos', valor: resumo.orcadoGastosMesada, cls: 'bg-primary' },
    { nome: 'Sobra', valor: Math.max(0, resumo.disponivelLivre), cls: 'bg-emerald-300' },
  ]
  const base = Math.max(resumo.renda, resumo.comprometido, 1)
  return (
    <div className="mt-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {partes.map((p) => (
          <div key={p.nome} className={p.cls} style={{ width: `${(p.valor / base) * 100}%` }} title={`${p.nome}: ${money(p.valor)}`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Renda <b className="text-foreground">{money(resumo.renda)}</b></span>
        <span>Comprometido <b className="text-foreground">{money(resumo.comprometido)}</b></span>
      </div>
    </div>
  )
}
