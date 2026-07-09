import { AI_BUDGET_USD, AI_WARNING_THRESHOLD, normalizeAiActionDraft } from '../../src/lib/aiActions'
import { askFinancialConcierge } from '../_lib/openai'
import { buildFinancialSnapshot } from '../_lib/report'
import { createServiceSupabase, authenticateWorkspace, type ServiceSupabase } from '../_lib/supabase'
import { errorResponse, json, readJsonBody } from '../_lib/http'

interface ChatBody {
  message?: string
  conversationId?: string | null
  workspaceId?: string | null
  mesRef?: string | null
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<ChatBody>(request)
    const message = String(body.message ?? '').trim()
    if (!message) return json({ error: 'Mensagem vazia.' }, 400)

    const supabase = createServiceSupabase()
    const auth = await authenticateWorkspace(request, supabase, body.workspaceId)
    const conversationId = await resolveConversation(supabase, auth.workspaceId, auth.user.id, body.conversationId, message)

    await supabase.from('ai_messages').insert({
      workspace_id: auth.workspaceId,
      conversation_id: conversationId,
      role: 'user',
      content: message,
    })

    const [snapshot, memories] = await Promise.all([
      buildFinancialSnapshot(supabase, auth.workspaceId, body.mesRef ?? undefined),
      loadMemories(supabase, auth.workspaceId),
    ])

    const ai = await askFinancialConcierge({ message, snapshot, memories })
    const actionDrafts = []
    for (const candidate of ai.result.actions ?? []) {
      actionDrafts.push(normalizeAiActionDraft(candidate))
    }

    const { data: assistantMessage, error: assistantError } = await supabase
      .from('ai_messages')
      .insert({
        workspace_id: auth.workspaceId,
        conversation_id: conversationId,
        role: 'assistant',
        content: ai.result.message,
        model: ai.usage.model,
        input_tokens: ai.usage.inputTokens,
        output_tokens: ai.usage.outputTokens,
      })
      .select('id')
      .single()
    if (assistantError) throw assistantError

    const insertedActions = actionDrafts.length
      ? await insertActionDrafts(supabase, auth.workspaceId, auth.user.id, conversationId, actionDrafts)
      : []

    await storeMemories(supabase, auth.workspaceId, auth.user.id, ai.result.memories ?? [])
    await storeUsage(supabase, auth.workspaceId, conversationId, assistantMessage?.id as string | undefined, ai.usage)

    return json({
      message: ai.result.message,
      conversationId,
      actions: insertedActions,
      memories: ai.result.memories ?? [],
      usage: await usageSummary(supabase, auth.workspaceId),
      openAiSkipped: ai.skipped,
    })
  } catch (error) {
    const status = error instanceof Error && /sessao|workspace|acesso/i.test(error.message) ? 401 : 500
    return errorResponse(error, status)
  }
}

async function resolveConversation(
  supabase: ServiceSupabase,
  workspaceId: string,
  userId: string,
  conversationId: string | null | undefined,
  message: string
) {
  if (conversationId) {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Conversa da IA nao encontrada.')
    return conversationId
  }

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      titulo: message.slice(0, 90),
    })
    .select('id')
    .single()
  if (error) throw error
  return String(data.id)
}

async function loadMemories(supabase: ServiceSupabase, workspaceId: string) {
  const { data, error } = await supabase
    .from('ai_memories')
    .select('key,value')
    .eq('workspace_id', workspaceId)
    .eq('status', 'aprovada')
    .order('atualizado_em', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []).map((row) => ({ key: String(row.key), value: String(row.value) }))
}

async function insertActionDrafts(
  supabase: ServiceSupabase,
  workspaceId: string,
  userId: string,
  conversationId: string,
  drafts: ReturnType<typeof normalizeAiActionDraft>[]
) {
  const { data, error } = await supabase
    .from('ai_action_drafts')
    .insert(
      drafts.map((draft) => ({
        workspace_id: workspaceId,
        conversation_id: conversationId,
        created_by: userId,
        type: draft.type,
        title: draft.title,
        summary: draft.summary,
        payload: draft.payload,
        impact: draft.impact ?? null,
        status: 'pending',
      }))
    )
    .select('id,type,title,summary,payload,impact,status,criado_em')

  if (error) throw error
  return data ?? []
}

async function storeMemories(
  supabase: ServiceSupabase,
  workspaceId: string,
  userId: string,
  memories: { key: string; value: string }[]
) {
  const rows = memories
    .filter((memory) => memory.key?.trim() && memory.value?.trim())
    .slice(0, 6)
    .map((memory) => ({
      workspace_id: workspaceId,
      key: memory.key.trim().slice(0, 80),
      value: memory.value.trim().slice(0, 500),
      status: 'aprovada',
      approved_by: userId,
    }))
  if (rows.length === 0) return
  const { error } = await supabase.from('ai_memories').upsert(rows, { onConflict: 'workspace_id,key' })
  if (error) throw error
}

async function storeUsage(
  supabase: ServiceSupabase,
  workspaceId: string,
  conversationId: string,
  messageId: string | undefined,
  usage: { model: string; inputTokens: number; outputTokens: number; usd: number }
) {
  if (!usage.inputTokens && !usage.outputTokens && !usage.usd) return
  const { error } = await supabase.from('ai_usage_events').insert({
    workspace_id: workspaceId,
    conversation_id: conversationId,
    message_id: messageId ?? null,
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_usd: usage.usd,
  })
  if (error) throw error
}

async function usageSummary(supabase: ServiceSupabase, workspaceId: string) {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const { data, error } = await supabase
    .from('ai_usage_events')
    .select('cost_usd')
    .eq('workspace_id', workspaceId)
    .gte('criado_em', start)
  if (error) throw error

  const spentUsd = round6((data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0))
  return {
    budgetUsd: AI_BUDGET_USD,
    spentUsd,
    remainingUsd: round6(Math.max(0, AI_BUDGET_USD - spentUsd)),
    warning: spentUsd >= AI_BUDGET_USD * AI_WARNING_THRESHOLD,
    blocked: false,
  }
}

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}
