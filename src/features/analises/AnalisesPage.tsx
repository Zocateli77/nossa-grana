import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Info,
  ReceiptText,
  TrendingDown,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useApp } from '@/contexts/AppContext'
import { useDados } from '@/hooks/useDados'
import { analiseMensal, byId, type GastoConta, type InsightFinanceiro } from '@/lib/calc'
import { dataCurta, money, moneyCompact, pct } from '@/lib/format'
import { MonthSelector } from '@/components/layout/MonthSelector'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Carregando, SecaoTitulo, Vazio } from '@/components/Estados'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
}

export function AnalisesPage() {
  const { mesRef, salarioBase } = useApp()
  const { dados, isLoading } = useDados()

  if (isLoading) return <Carregando />

  const analise = analiseMensal(dados, mesRef, salarioBase)
  const catMap = byId(dados.categorias)
  const contaMap = byId(dados.contas)
  const semGastos = analise.gastoTotal <= 0
  const barraCor = analise.pctRenda >= 1 ? 'bg-destructive' : analise.pctRenda >= 0.8 ? 'bg-warning' : 'bg-primary'
  const saldoCor = analise.saldo >= 0 ? 'text-success' : 'text-destructive'

  const categoriaChart = analise.porCategoria.slice(0, 6).map((g) => ({
    nome: g.categoria.nome,
    total: g.total,
    cor: g.categoria.cor ?? 'hsl(var(--primary))',
  }))
  const contaChart = analise.porConta.slice(0, 6).map((g) => ({
    nome: g.nome,
    total: g.total,
    cor: g.conta?.cor ?? '#64748b',
  }))
  const linhaChart = analise.serieDiaria.map((d) => ({
    dia: Number(d.data.slice(8, 10)),
    data: dataCurta(d.data),
    acumulado: d.acumulado,
    total: d.total,
  }))

  return (
    <div>
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Analise mensal</p>
          <h1 className="text-xl font-extrabold tracking-tight">Gastos do mes</h1>
        </div>
        <MonthSelector />
      </header>

      <Card className="overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Total comprometido</span>
            <Badge variant={analise.pctRenda >= 1 ? 'destructive' : analise.pctRenda >= 0.8 ? 'warning' : 'success'}>
              {analise.renda > 0 ? pct(analise.pctRenda) : 'sem renda'}
            </Badge>
          </div>
          <p className={cn('mt-1 text-4xl font-extrabold tracking-tight', analise.pctRenda >= 1 && 'text-destructive')}>
            {money(analise.gastoTotal)}
          </p>
          <div className="mt-4">
            <Progress value={analise.renda > 0 ? analise.pctRenda * 100 : 0} indicatorClassName={barraCor} />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Renda <b className="text-foreground">{money(analise.renda)}</b></span>
              <span>Saldo <b className={saldoCor}>{money(analise.saldo)}</b></span>
              <span>Media/dia <b className="text-foreground">{money(analise.mediaDia)}</b></span>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard titulo="Ja pago" valor={analise.gastoPago} icon={ReceiptText} />
        <KpiCard titulo="Previsto" valor={analise.gastoPrevisto} icon={Info} />
        <KpiCard titulo="Saidas" valor={analise.saidasTotais} icon={TrendingDown} />
        <KpiCard titulo="Saldo" valor={analise.saldo} icon={Wallet} cor={saldoCor} />
      </div>

      {semGastos ? (
        <Vazio icon={BarChart3} titulo="Sem gastos neste mes" descricao="Quando houver lancamentos, a analise aparece aqui." />
      ) : (
        <>
          {analise.insights.length > 0 && (
            <>
              <SecaoTitulo>Alertas e achados</SecaoTitulo>
              <div className="grid gap-3 sm:grid-cols-2">
                {analise.insights.slice(0, 4).map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </>
          )}

          <SecaoTitulo>Onde gastou</SecaoTitulo>
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Por categoria</span>
                <Badge variant="muted">{analise.porCategoria.length}</Badge>
              </div>
              <BarListChart data={categoriaChart} />
              <div className="mt-3 space-y-2.5">
                {analise.porCategoria.slice(0, 5).map((g) => (
                  <Link key={g.categoria.id} to={`/lancamentos?categoria=${g.categoria.id}`} className="flex items-center gap-2.5">
                    <CategoriaIcon icone={g.categoria.icone} cor={g.categoria.cor} className="h-8 w-8" size={15} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{g.categoria.nome}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{money(g.total)}</span>
                      </div>
                      <Progress value={g.pct * 100} className="mt-1 h-1.5" indicatorClassName="bg-primary" />
                    </div>
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Por conta/cartao</span>
                <Badge variant="muted">{analise.porConta.length}</Badge>
              </div>
              <BarListChart data={contaChart} />
              <div className="mt-3 space-y-2.5">
                {analise.porConta.slice(0, 5).map((g) => (
                  <ContaLinha key={g.conta?.id ?? 'sem-conta'} gasto={g} />
                ))}
              </div>
            </Card>
          </div>

          <SecaoTitulo>Ritmo do mes</SecaoTitulo>
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Acumulado diario</span>
              <Badge variant={analise.gastoPrevisto > 0 ? 'default' : 'muted'}>
                {analise.gastoPrevisto > 0 ? `${money(analise.gastoPrevisto)} previsto` : 'sem previstos'}
              </Badge>
            </div>
            <div className="h-48 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={linhaChart} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={(v) => moneyCompact(Number(v))} tick={{ fontSize: 11 }} width={54} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    formatter={(v: number, n: string) => [money(v), n === 'acumulado' ? 'Acumulado' : 'Dia']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.data ?? ''}
                    contentStyle={tooltipStyle}
                  />
                  <Line type="monotone" dataKey="acumulado" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <SecaoTitulo
            acao={
              <Link to="/lancamentos" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                Ver extrato <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            Maiores impactos
          </SecaoTitulo>
          <Card className="divide-y">
            {analise.maiores.map((l) => {
              const cat = l.categoria_id ? catMap.get(l.categoria_id) : undefined
              const conta = l.conta_id ? contaMap.get(l.conta_id) : undefined
              return (
                <div key={l.id} className="flex items-center gap-3 p-3">
                  <CategoriaIcon icone={cat?.icone} cor={cat?.cor} className="h-9 w-9" size={16} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.privado ? 'Gasto livre' : l.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {dataCurta(l.data)}
                      {cat ? ` · ${cat.nome}` : ' · Sem categoria'}
                      {conta ? ` · ${conta.nome}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{money(l.valor)}</span>
                </div>
              )
            })}
          </Card>
        </>
      )}

      <div className="h-4" />
    </div>
  )
}

function KpiCard({
  titulo,
  valor,
  icon: Icon,
  cor,
}: {
  titulo: string
  valor: number
  icon: typeof ReceiptText
  cor?: string
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={cn('mt-1 text-base font-bold tabular-nums', cor)}>{money(valor)}</p>
    </Card>
  )
}

function InsightCard({ insight }: { insight: InsightFinanceiro }) {
  const Icon = insight.severidade === 'danger' ? AlertTriangle : insight.severidade === 'success' ? CheckCircle2 : Info
  const variant = insight.severidade === 'danger' ? 'destructive' : insight.severidade === 'warning' ? 'warning' : insight.severidade === 'success' ? 'success' : 'default'
  const content = (
    <Card className="p-4 transition-colors hover:bg-accent/40">
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', insight.severidade === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{insight.titulo}</p>
            {insight.valor != null && <Badge variant={variant}>{money(insight.valor)}</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{insight.descricao}</p>
        </div>
      </div>
    </Card>
  )
  return insight.href ? <Link to={insight.href}>{content}</Link> : content
}

function BarListChart({ data }: { data: { nome: string; total: number; cor: string }[] }) {
  if (!data.length) return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Sem dados</div>
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" hide />
          <YAxis dataKey="nome" type="category" width={86} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval={0} />
          <Tooltip formatter={(v: number) => money(v)} contentStyle={tooltipStyle} />
          <Bar dataKey="total" radius={[0, 8, 8, 0]} barSize={18}>
            {data.map((d) => (
              <Cell key={d.nome} fill={d.cor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ContaLinha({ gasto }: { gasto: GastoConta }) {
  const content = (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${gasto.conta?.cor ?? '#64748b'}1f`, color: gasto.conta?.cor ?? '#64748b' }}
      >
        <CreditCard className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">{gasto.nome}</span>
          <span className="shrink-0 font-semibold tabular-nums">{money(gasto.total)}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Progress value={gasto.pct * 100} className="h-1.5" indicatorClassName="bg-primary" />
          <span className="w-9 text-right text-xs text-muted-foreground">{pct(gasto.pct)}</span>
        </div>
      </div>
    </div>
  )

  return gasto.conta ? <Link to={`/lancamentos?conta=${gasto.conta.id}`}>{content}</Link> : content
}
