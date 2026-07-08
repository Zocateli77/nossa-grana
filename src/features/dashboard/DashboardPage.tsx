import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, TrendingUp, Landmark, ArrowRight, CalendarClock, PiggyBank, CheckCircle2, Loader2 } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useDados } from '@/hooks/useDados'
import { useMarcarLancamentosComoPagos } from '@/hooks/useMutations'
import {
  envelopesDoMes,
  resumoMes,
  resumoReal,
  gastosPorCategoria,
  maioresGastos,
  reservaInvestimento,
  reservaImpostos,
  mesadas,
  progressoMeta,
  ehParcelado,
  lancsDoMes,
  lancamentosAPagarNoMes,
  byId,
  faturasAVencer,
} from '@/lib/calc'
import { money, pct, dataCurta } from '@/lib/format'
import { MonthSelector } from '@/components/layout/MonthSelector'
import { EnvelopeCard } from '@/components/EnvelopeCard'
import { ContasDoMesCard } from '@/components/ContasDoMesCard'
import { InsightsCard } from '@/components/InsightsCard'
import { OnboardingCard } from '@/components/OnboardingCard'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Carregando, SecaoTitulo } from '@/components/Estados'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { mesRef, salarioBase } = useApp()
  const { dados, isLoading } = useDados()
  const marcarPagos = useMarcarLancamentosComoPagos()
  const [confirmarPagamento, setConfirmarPagamento] = useState(false)

  if (isLoading) return <Carregando />

  const real = resumoReal(dados, mesRef, salarioBase)
  const resumo = resumoMes(dados, mesRef, salarioBase)
  const invest = reservaInvestimento(dados, mesRef)
  const impostos = reservaImpostos(dados, mesRef)
  const topCategorias = gastosPorCategoria(dados, mesRef).slice(0, 6)
  const top = maioresGastos(dados.lancamentos, mesRef, 5)
  const catMap = byId(dados.categorias)
  const envs = envelopesDoMes(dados, mesRef)
  const aPagar = lancamentosAPagarNoMes(dados.lancamentos, mesRef)
  const totalAPagar = aPagar.reduce((s, l) => s + Number(l.valor), 0)
  const meusMesadas = mesadas(dados, mesRef)
  const metasTop = dados.metas.filter((m) => !m.concluida).slice(0, 3)
  const compromissos = lancsDoMes(dados.lancamentos, mesRef)
    .filter((l) => ehParcelado(l))
    .sort((a, b) => Number(b.valor) - Number(a.valor))
    .slice(0, 5)
  const faturas = faturasAVencer(dados)

  const pctR = real.pctRenda
  const heroCor = pctR >= 1 ? 'text-destructive' : pctR >= 0.8 ? 'text-warning-foreground' : 'text-foreground'
  const barraCor = pctR >= 1 ? 'bg-destructive' : pctR >= 0.8 ? 'bg-warning' : 'bg-primary'

  async function confirmarTudoPago() {
    await marcarPagos.mutateAsync(aPagar.map((l) => l.id))
    setConfirmarPagamento(false)
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm text-muted-foreground">Olá! 👋</p>
          <h1 className="text-xl font-extrabold tracking-tight">Visão do mês</h1>
        </div>
        <MonthSelector />
      </header>

      {/* Onboarding — só na 1ª vez, até concluir/dispensar */}
      <OnboardingCard dados={dados} />

      {/* Faturas de cartão a vencer */}
      {faturas.length > 0 && (
        <div className="space-y-2">
          {faturas.map(({ conta, fatura }) => (
            <Link key={conta.id} to={`/contas/${conta.id}`} className="block">
              <Card
                className={cn(
                  'p-3 flex items-center gap-3 border',
                  fatura.vencida ? 'border-destructive/40 bg-destructive/5' : 'border-warning/40 bg-warning/5'
                )}
              >
                <CalendarClock className={cn('h-5 w-5 shrink-0', fatura.vencida ? 'text-destructive' : 'text-warning-foreground')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    Fatura {conta.nome} · {money(fatura.total)}
                  </p>
                  <p className={cn('text-xs', fatura.vencida ? 'text-destructive' : 'text-muted-foreground')}>
                    {fatura.vencida
                      ? `venceu ${dataCurta(fatura.ciclo.vencimentoISO)}`
                      : fatura.diasAteVencimento === 0
                        ? 'vence hoje'
                        : `vence em ${fatura.diasAteVencimento} ${fatura.diasAteVencimento === 1 ? 'dia' : 'dias'} · ${dataCurta(fatura.ciclo.vencimentoISO)}`}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Hero — quanto você já gastou de verdade */}
      <Card className="overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Você já gastou neste mês</span>
            {real.entradas > 0 ? (
              <Badge variant={pctR >= 1 ? 'destructive' : pctR >= 0.8 ? 'warning' : 'success'}>
                {Math.round(pctR * 100)}% da renda
              </Badge>
            ) : (
              <Badge variant="muted">defina sua renda</Badge>
            )}
          </div>
          <p className={cn('text-4xl font-extrabold tracking-tight mt-1', heroCor)}>{money(real.jaPago)}</p>
          {real.previstoRestante > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              + {money(real.previstoRestante)} previstos ainda neste mês
            </p>
          )}

          <div className="mt-4">
            <Progress value={real.entradas > 0 ? Math.min(100, pctR * 100) : 0} indicatorClassName={barraCor} />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Renda <b className="text-foreground">{money(real.entradas)}</b></span>
              <span>Sobra real <b className={real.saldoReal >= 0 ? 'text-success' : 'text-destructive'}>{money(real.saldoReal)}</b></span>
              <span>Média/dia <b className="text-foreground">{money(real.mediaDia)}</b></span>
            </div>
          </div>

          <Button
            type="button"
            className="mt-4 w-full"
            disabled={aPagar.length === 0 || marcarPagos.isPending}
            onClick={() => setConfirmarPagamento(true)}
          >
            {marcarPagos.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {aPagar.length > 0 ? 'Paguei tudo que devia este mês' : 'Tudo pago neste mês'}
          </Button>

          {real.saldoReal < 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Você já comprometeu {money(Math.abs(real.saldoReal))} além da renda deste mês.
            </p>
          )}
        </div>
      </Card>

      {/* Mini-stats do realizado */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat titulo="Gasto" valor={real.totalGasto} />
        <MiniStat titulo="Investido" valor={real.investido} cor="text-success" />
        <MiniStat titulo="Sobra" valor={real.saldoReal} cor={real.saldoReal >= 0 ? 'text-success' : 'text-destructive'} />
      </div>

      {/* Contas do mês — agenda de contas a pagar */}
      <ContasDoMesCard lancamentos={dados.lancamentos} mesRef={mesRef} catMap={catMap} />

      {/* Insights — comparação com a média recente */}
      <InsightsCard dados={dados} mesRef={mesRef} />

      {/* Com o que você gastou — por categoria */}
      {topCategorias.length > 0 && (
        <>
          <SecaoTitulo
            acao={
              <Link to="/lancamentos" className="text-xs font-medium text-primary inline-flex items-center gap-1">
                Ver extrato <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            Com o que você gastou
          </SecaoTitulo>
          <Card className="p-4 space-y-3">
            {topCategorias.map((g) => (
              <Link key={g.categoria.id} to={`/lancamentos?categoria=${g.categoria.id}`} className="block">
                <div className="flex items-center gap-3">
                  <CategoriaIcon icone={g.categoria.icone} cor={g.categoria.cor} className="h-8 w-8 shrink-0" size={15} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{g.categoria.nome}</span>
                      <span className="text-sm font-semibold tabular-nums">{money(g.total)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(4, g.pct * 100)}%`, backgroundColor: g.categoria.cor ?? 'hsl(var(--primary))' }}
                        />
                      </div>
                      <span className="w-9 text-right text-xs text-muted-foreground">{pct(g.pct)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </Card>
        </>
      )}

      {/* Maiores gastos do mês */}
      {top.length > 0 && (
        <>
          <SecaoTitulo>Maiores gastos</SecaoTitulo>
          <Card className="divide-y">
            {top.map((l) => {
              const cat = l.categoria_id ? catMap.get(l.categoria_id) : undefined
              return (
                <div key={l.id} className="flex items-center gap-3 p-3">
                  <CategoriaIcon icone={cat?.icone} cor={cat?.cor} className="h-9 w-9 shrink-0" size={16} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{l.privado ? 'Gasto livre' : l.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {dataCurta(l.data)}
                      {cat ? ` · ${cat.nome}` : ''}
                      {l.parcela_total && l.parcela_total > 1 ? ` · ${l.parcela_atual}/${l.parcela_total}` : ''}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{money(l.valor)}</span>
                </div>
              )
            })}
          </Card>
        </>
      )}

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

      {/* Plano do mês (planejamento — secundário) */}
      <SecaoTitulo acao={<Link to="/orcamentos" className="text-xs font-medium text-primary inline-flex items-center gap-1">Ajustar <ArrowRight className="h-3 w-3" /></Link>}>
        Plano do mês
      </SecaoTitulo>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><PiggyBank className="h-4 w-4" /> Disponível livre (planejado)</span>
          <span className={cn('font-bold', resumo.disponivelLivre >= 0 ? 'text-success' : 'text-destructive')}>{money(resumo.disponivelLivre)}</span>
        </div>
        <Cascata resumo={resumo} />
      </Card>

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

      <Dialog open={confirmarPagamento} onOpenChange={setConfirmarPagamento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar tudo como pago?</DialogTitle>
            <DialogDescription>
              Você vai marcar {aPagar.length} lançamento{aPagar.length !== 1 ? 's' : ''} previsto{aPagar.length !== 1 ? 's' : ''} deste mês como pago{aPagar.length !== 1 ? 's' : ''}, somando {money(totalAPagar)}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setConfirmarPagamento(false)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" disabled={marcarPagos.isPending || aPagar.length === 0} onClick={confirmarTudoPago}>
              {marcarPagos.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="h-4" />
    </div>
  )
}

function MiniStat({ titulo, valor, cor }: { titulo: string; valor: number; cor?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={cn('mt-0.5 text-base font-bold tabular-nums', cor)}>{money(valor)}</p>
    </Card>
  )
}

function ReservaCard({ titulo, icon: Icon, feito, total, cor }: { titulo: string; icon: typeof TrendingUp; feito: number; total: number; cor: string }) {
  const pctv = total > 0 ? (feito / total) * 100 : 0
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={cn('h-4 w-4', cor)} /> {titulo}
      </div>
      <p className="mt-2 text-lg font-bold">{money(feito)}</p>
      <p className="text-xs text-muted-foreground">de {money(total)}{total > feito ? ` · faltam ${money(total - feito)}` : ''}</p>
      <Progress value={pctv} className="mt-2" indicatorClassName="bg-success" />
    </Card>
  )
}

function Cascata({ resumo }: { resumo: ReturnType<typeof resumoMes> }) {
  const partes = [
    { nome: 'Investir', valor: resumo.reservadoInvestimento, cls: 'bg-success' },
    { nome: 'Impostos', valor: resumo.reservadoImpostos, cls: 'bg-muted-foreground/60' },
    { nome: 'Gastos', valor: resumo.orcadoGastosMesada, cls: 'bg-primary' },
    { nome: 'Sobra', valor: Math.max(0, resumo.disponivelLivre), cls: 'bg-success/40' },
  ]
  const base = Math.max(resumo.renda, resumo.comprometido, 1)
  return (
    <div className="mt-3">
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
