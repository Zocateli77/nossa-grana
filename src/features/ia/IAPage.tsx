import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Send, Sparkles, Wand2 } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import type { AiActionDraftRecord } from '@/types/db'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface UsageSummary {
  budgetUsd: number
  spentUsd: number
  remainingUsd: number
  warning: boolean
  blocked: boolean
}

interface ChatResponse {
  message: string
  conversationId: string
  actions: AiActionDraftRecord[]
  usage: UsageSummary
  openAiSkipped?: boolean
}

const QUICK_PROMPTS = [
  'Como estamos gastando neste mes?',
  'Onde podemos ajustar os envelopes para caber um gasto novo?',
  'Quais gastos parecem repetidos ou desnecessarios?',
  'Se comprarmos algo de R$ 500, onde compensar?',
]

export function IAPage() {
  const { session } = useAuth()
  const { workspaceAtivo } = useWorkspace()
  const { mesRef } = useApp()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [actions, setActions] = useState<AiActionDraftRecord[]>([])
  const [usage, setUsage] = useState<UsageSummary>({ budgetUsd: 5, spentUsd: 0, remainingUsd: 5, warning: false, blocked: false })
  const [isSending, setIsSending] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const prompt = params.get('prompt')
    if (prompt) setInput(prompt)
  }, [params])

  const pendingActions = useMemo(() => actions.filter((action) => action.status === 'pending'), [actions])
  const pctUsage = usage.budgetUsd > 0 ? Math.min(100, (usage.spentUsd / usage.budgetUsd) * 100) : 0

  async function sendMessage(prompt = input) {
    const message = prompt.trim()
    if (!message || !session?.access_token || !workspaceAtivo) return

    setError(null)
    setIsSending(true)
    setInput('')
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: message }
    setMessages((current) => [...current, userMessage])

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${session.access_token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationId,
          workspaceId: workspaceAtivo.id,
          mesRef,
        }),
      })
      const data = (await response.json()) as ChatResponse & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Nao foi possivel conversar com a IA.')

      setConversationId(data.conversationId)
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: data.message }])
      setActions((current) => [...data.actions, ...current])
      setUsage(data.usage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setIsSending(false)
    }
  }

  async function confirmAction(action: AiActionDraftRecord) {
    if (!session?.access_token) return
    setConfirmingId(action.id)
    setError(null)
    try {
      const response = await fetch(`/api/ai/actions/${encodeURIComponent(action.id)}/confirm`, {
        method: 'POST',
        headers: { authorization: `Bearer ${session.access_token}` },
      })
      const data = (await response.json()) as { action?: AiActionDraftRecord; error?: string }
      if (!response.ok || !data.action) throw new Error(data.error || 'Nao foi possivel confirmar a acao.')
      setActions((current) => current.map((item) => (item.id === action.id ? data.action! : item)))
      await queryClient.invalidateQueries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Concierge financeira</p>
          <h1 className="text-xl font-extrabold tracking-tight">IA</h1>
        </div>
        <Card className="p-3 sm:w-64">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-muted-foreground">Credito IA</span>
            <span className={cn('font-semibold tabular-nums', usage.warning && 'text-warning-foreground')}>
              {usd(usage.spentUsd)} / {usd(usage.budgetUsd)}
            </span>
          </div>
          <Progress value={pctUsage} className="mt-2 h-2" indicatorClassName={usage.warning ? 'bg-warning' : 'bg-primary'} />
          <p className="mt-1 text-xs text-muted-foreground">Restam {usd(usage.remainingUsd)} estimados</p>
        </Card>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <section className="space-y-3">
          <Card className="p-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border bg-card px-3 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Wand2 className="h-4 w-4" />
                  {prompt}
                </button>
              ))}
            </div>
          </Card>

          <Card className="min-h-[22rem] p-4">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center text-center text-muted-foreground">
                  <Sparkles className="mb-3 h-8 w-8 text-primary" />
                  <p className="max-w-sm text-sm">
                    Pergunte sobre gastos, envelopes, desejos, metas ou contas. Qualquer mudanca vira rascunho para confirmar.
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                        message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                ))
              )}
              {isSending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pensando nos numeros...
                </div>
              )}
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void sendMessage()
                }}
                rows={3}
                className="min-h-20 flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Pergunte sobre gastos, ajustes de envelope ou uma compra que voces estao pensando..."
              />
              <Button type="button" size="icon" className="h-20 w-12" disabled={isSending || !input.trim()} onClick={() => void sendMessage()}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </Card>
        </section>

        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Acoes pendentes</h2>
            <Badge variant={pendingActions.length ? 'default' : 'muted'}>{pendingActions.length}</Badge>
          </div>
          {actions.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">Quando a IA sugerir uma mudanca, ela aparece aqui antes de salvar.</Card>
          ) : (
            actions.map((action) => (
              <Card key={action.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant={action.status === 'confirmed' ? 'success' : action.status === 'failed' ? 'destructive' : 'default'}>
                      {labelStatus(action.status)}
                    </Badge>
                    <h3 className="mt-2 text-sm font-semibold leading-snug">{action.title}</h3>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{action.summary}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-primary">Ver payload</summary>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-muted p-2 text-[11px] leading-relaxed">
                    {JSON.stringify(action.payload, null, 2)}
                  </pre>
                </details>
                <Button
                  type="button"
                  className="mt-3 w-full"
                  disabled={action.status !== 'pending' || confirmingId === action.id}
                  onClick={() => void confirmAction(action)}
                >
                  {confirmingId === action.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {action.status === 'confirmed' ? 'Confirmado' : 'Confirmar'}
                </Button>
              </Card>
            ))
          )}
        </aside>
      </div>
    </div>
  )
}

function labelStatus(status: AiActionDraftRecord['status']) {
  if (status === 'confirmed') return 'confirmada'
  if (status === 'failed') return 'falhou'
  if (status === 'rejected') return 'rejeitada'
  return 'pendente'
}

function usd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}
