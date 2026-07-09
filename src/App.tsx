import { useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useCriarWorkspace } from '@/hooks/useWorkspace'
import { Button } from '@/components/ui/button'
import { useApp } from '@/contexts/AppContext'
import { useLancamentos } from '@/hooks/useDados'
import { useReabastecerRecorrencias } from '@/hooks/useMutations'
import { mesesComDados, seriesParaReabastecer } from '@/lib/calc'
import { mesAtualRef } from '@/lib/dates'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { AnaliseDashboardPage } from '@/features/dashboard/AnaliseDashboardPage'
import { LancamentosPage } from '@/features/lancamentos/LancamentosPage'
import { NovoLancamentoPage } from '@/features/lancamentos/NovoLancamentoPage'
import { MassaPage } from '@/features/massa/MassaPage'
import { OrcamentosPage } from '@/features/orcamentos/OrcamentosPage'
import { ContasPage } from '@/features/contas/ContasPage'
import { MetasPage } from '@/features/metas/MetasPage'
import { MetaDetalhePage } from '@/features/metas/MetaDetalhePage'
import { FuturoPage } from '@/features/futuro/FuturoPage'
import { DividasPage } from '@/features/dividas/DividasPage'
import { DesejosPage } from '@/features/desejos/DesejosPage'
import { ConfigPage } from '@/features/config/ConfigPage'

function TelaCarregando() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )
}

/** Fallback quando o usuário está logado mas não tem nenhum espaço (provision falhou). */
function TelaSemWorkspace() {
  const { sair } = useAuth()
  const criar = useCriarWorkspace()
  const [erro, setErro] = useState<string | null>(null)

  async function criarEspaco() {
    setErro(null)
    try {
      await criar.mutateAsync('Meu espaço')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar seu espaço. Tente novamente.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-xl font-extrabold">Vamos criar seu espaço</h1>
        <p className="text-muted-foreground max-w-xs">
          Um espaço guarda suas contas, envelopes e lançamentos. Crie o seu para começar a se organizar.
        </p>
      </div>
      <div className="w-full max-w-xs space-y-3">
        <Button className="w-full" onClick={criarEspaco} disabled={criar.isPending} aria-busy={criar.isPending}>
          {criar.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Criando…
            </>
          ) : (
            'Criar meu espaço'
          )}
        </Button>
        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
        <Button variant="ghost" className="w-full" onClick={() => void sair()} disabled={criar.isPending}>
          Sair
        </Button>
      </div>
    </div>
  )
}

/** Na 1ª carga, se o mês atual não tem lançamentos, abre no mês mais recente com dados. */
function useMesInicialAutomatico() {
  const { mesRef, setMesRef } = useApp()
  const { data, isSuccess } = useLancamentos()
  const jaAjustou = useRef(false)
  useEffect(() => {
    if (!isSuccess || jaAjustou.current || !data) return
    jaAjustou.current = true
    const meses = mesesComDados(data)
    const temNoAtual = meses.includes(mesAtualRef())
    if (!temNoAtual && meses.length > 0 && mesRef === mesAtualRef()) setMesRef(meses[0])
  }, [isSuccess, data, mesRef, setMesRef])
}

/** Janela rolante: na 1ª carga, materializa os meses que faltam das recorrências (até +12). */
function useReabastecimentoRolante() {
  const { data, isSuccess } = useLancamentos()
  const reabastecer = useReabastecerRecorrencias()
  const jaRodou = useRef(false)
  useEffect(() => {
    if (!isSuccess || jaRodou.current || !data) return
    jaRodou.current = true
    const novas = seriesParaReabastecer({ lancamentos: data })
    if (novas.length) reabastecer.mutate(novas)
  }, [isSuccess, data])
}

function AppAutenticado() {
  useMesInicialAutomatico()
  useReabastecimentoRolante()
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<AnaliseDashboardPage />} />
        <Route path="/lancamentos" element={<LancamentosPage />} />
        <Route path="/lancamentos/novo" element={<NovoLancamentoPage />} />
        <Route path="/lancamentos/:id/editar" element={<NovoLancamentoPage />} />
        <Route path="/massa" element={<MassaPage />} />
        <Route path="/orcamentos" element={<OrcamentosPage />} />
        <Route path="/contas" element={<ContasPage />} />
        <Route path="/contas/:id" element={<ContasPage />} />
        <Route path="/metas" element={<MetasPage />} />
        <Route path="/metas/:id" element={<MetaDetalhePage />} />
        <Route path="/futuro" element={<FuturoPage />} />
        <Route path="/dividas" element={<DividasPage />} />
        <Route path="/desejos" element={<DesejosPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  const { session, carregando: authCarregando } = useAuth()
  const { carregando: wsCarregando, workspaceAtivo } = useWorkspace()
  if (authCarregando) return <TelaCarregando />
  if (!session) return <LoginPage />
  if (wsCarregando) return <TelaCarregando />
  if (!workspaceAtivo) return <TelaSemWorkspace />
  return <AppAutenticado />
}
