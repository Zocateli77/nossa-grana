import { buildActionOperations, normalizeAiActionDraft, type SupabaseOperation } from '../../../../src/lib/aiActions'
import { errorResponse, json } from '../../../_lib/http'
import { authenticateWorkspace, createServiceSupabase, type ServiceSupabase } from '../../../_lib/supabase'

export async function POST(request: Request) {
  const id = draftIdFromUrl(request.url)
  if (!id) return json({ error: 'Rascunho nao informado.' }, 400)

  try {
    const supabase = createServiceSupabase()
    const { data: draftRow, error: draftError } = await supabase
      .from('ai_action_drafts')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (draftError) throw draftError
    if (!draftRow) return json({ error: 'Rascunho nao encontrado.' }, 404)

    const auth = await authenticateWorkspace(request, supabase, String(draftRow.workspace_id))
    if (draftRow.status !== 'pending') return json({ error: 'Rascunho ja foi processado.' }, 409)

    const draft = normalizeAiActionDraft({
      type: draftRow.type,
      title: draftRow.title,
      summary: draftRow.summary,
      payload: draftRow.payload,
      impact: draftRow.impact ?? undefined,
    })

    const operations = buildActionOperations(draft)
    const results = []
    for (const operation of operations) {
      results.push(await applyOperation(supabase, String(draftRow.workspace_id), operation))
    }

    const { data: updated, error: updateError } = await supabase
      .from('ai_action_drafts')
      .update({
        status: 'confirmed',
        confirmed_by: auth.user.id,
        confirmed_at: new Date().toISOString(),
        result: { operations: results },
        error: null,
      })
      .eq('id', id)
      .eq('workspace_id', draftRow.workspace_id)
      .select('id,type,title,summary,payload,impact,status,result,confirmed_at')
      .single()

    if (updateError) throw updateError

    return json({ action: updated, results })
  } catch (error) {
    await markFailed(id, error)
    const status = error instanceof Error && /sessao|workspace|acesso/i.test(error.message) ? 401 : 500
    return errorResponse(error, status)
  }
}

async function applyOperation(supabase: ServiceSupabase, workspaceId: string, operation: SupabaseOperation) {
  const values = { ...operation.values, workspace_id: workspaceId }

  if (operation.method === 'insert') {
    const { data, error } = await supabase.from(operation.table).insert(values).select('*')
    if (error) throw error
    return { table: operation.table, method: operation.method, data }
  }

  if (operation.method === 'update') {
    const query = supabase.from(operation.table).update(values).eq('workspace_id', workspaceId)
    for (const [key, value] of Object.entries(operation.match ?? {})) query.eq(key, value)
    const { data, error } = await query.select('*')
    if (error) throw error
    return { table: operation.table, method: operation.method, data }
  }

  const { data, error } = await supabase
    .from(operation.table)
    .upsert(values, { onConflict: operation.onConflict })
    .select('*')
  if (error) throw error
  return { table: operation.table, method: operation.method, data }
}

async function markFailed(id: string, error: unknown) {
  try {
    const message = error instanceof Error ? error.message : 'Erro inesperado.'
    const supabase = createServiceSupabase()
    await supabase.from('ai_action_drafts').update({ status: 'failed', error: message }).eq('id', id).eq('status', 'pending')
  } catch {
    // best effort
  }
}

function draftIdFromUrl(url: string) {
  const parts = new URL(url).pathname.split('/').filter(Boolean)
  const confirmIndex = parts.lastIndexOf('confirm')
  return confirmIndex > 0 ? decodeURIComponent(parts[confirmIndex - 1]) : ''
}
