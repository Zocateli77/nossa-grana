import type { SupabaseClient } from '@supabase/supabase-js'
import type { Categoria, Conta, Desejo, Lancamento, Meta, Orcamento, Pessoa, Renda, Workspace } from '../../src/types/db'
import { emailRunKey, injectAiFooterIntoEmail, type EmailReportForAi } from '../../src/lib/aiEmail'
import { optionalEnv, requiredEnv } from './env'
import { writeReportFooterWithAi } from './openai'

type Db = SupabaseClient

interface FinanceData {
  workspace: Workspace | null
  pessoas: Pessoa[]
  categorias: Categoria[]
  contas: Conta[]
  metas: Meta[]
  desejos: Desejo[]
  orcamentos: Orcamento[]
  rendas: Renda[]
  lancamentos: Lancamento[]
}

export interface WeeklyReportResult {
  workspaceId: string
  status: 'sent' | 'skipped' | 'failed'
  runKey: string
  recipients: string[]
  providerMessageId?: string
  reason?: string
}

export async function buildFinancialSnapshot(supabase: Db, workspaceId: string, baseDateIso = todaySaoPaulo()) {
  const mesRef = monthRef(baseDateIso)
  const data = await loadFinanceData(supabase, workspaceId)
  const report = buildReportFromData(data, mesRef)

  return {
    workspace: data.workspace ? { id: data.workspace.id, nome: data.workspace.nome } : { id: workspaceId },
    gerado_em: new Date().toISOString(),
    mes_referencia: mesRef,
    resumo: report.resumo,
    envelopes: report.envelopes,
    insights: report.insights,
    maiores_gastos: report.maiores,
    contas: data.contas.map((c) => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      limite: c.limite,
      ativo: c.ativo,
    })),
    metas: data.metas.map((m) => ({
      id: m.id,
      nome: m.nome,
      valor_alvo: Number(m.valor_alvo),
      valor_atual: Number(m.valor_atual),
      data_alvo: m.data_alvo,
      concluida: m.concluida,
    })),
    desejos: data.desejos.map((d) => ({
      id: d.id,
      nome: d.nome,
      status: d.status,
      valor_total: Number(d.valor_total),
      parcela_total: d.parcela_total,
      mes_inicio: d.mes_inicio,
      prioridade: d.prioridade,
    })),
    categorias: data.categorias.map((c) => ({
      id: c.id,
      nome: c.nome,
      grupo: c.grupo,
      tipo_reserva: c.tipo_reserva,
      ativo: c.ativo,
    })),
    ultimos_lancamentos: [...data.lancamentos]
      .sort((a, b) => (a.data === b.data ? (a.criado_em < b.criado_em ? 1 : -1) : a.data < b.data ? 1 : -1))
      .slice(0, 80)
      .map((l) => ({
        id: l.id,
        descricao: l.privado ? 'Gasto privado' : l.descricao,
        descricao_real_visivel_para_ia: l.descricao,
        valor: Number(l.valor),
        data: l.data,
        tipo: l.tipo,
        status: l.status,
        pago: l.pago,
        privado: l.privado,
        categoria_id: l.categoria_id,
        conta_id: l.conta_id,
        dono_id: l.dono_id,
      })),
  }
}

export async function buildWeeklyReport(supabase: Db, workspaceId: string, baseDateIso = todaySaoPaulo()) {
  const data = await loadFinanceData(supabase, workspaceId)
  const report = buildReportFromData(data, monthRef(baseDateIso))
  const ai = await writeReportFooterWithAi(report)
  const notes = ai.result.notes.slice(0, 3)
  return {
    snapshot: report,
    notes,
    html: renderWeeklyReportHtml(report, notes, data.workspace?.nome ?? 'Nossa Grana'),
    usage: ai.usage,
  }
}

export async function sendWorkspaceWeeklyReport(supabase: Db, workspaceId: string, baseDateIso = todaySaoPaulo()): Promise<WeeklyReportResult> {
  const runKey = emailRunKey(workspaceId, baseDateIso)
  const inserted = await createPendingRun(supabase, workspaceId, runKey, baseDateIso)
  if (!inserted) return { workspaceId, status: 'skipped', runKey, recipients: [], reason: 'already_sent_or_pending' }

  try {
    const recipients = await getReportRecipients(supabase, workspaceId)
    if (recipients.length === 0) {
      await markRunFailed(supabase, workspaceId, runKey, [], [], 'Nenhum destinatario encontrado.')
      return { workspaceId, status: 'failed', runKey, recipients, reason: 'no_recipients' }
    }

    const report = await buildWeeklyReport(supabase, workspaceId, baseDateIso)
    await storeAiUsage(supabase, workspaceId, report.usage.model, report.usage.inputTokens, report.usage.outputTokens, report.usage.usd)

    const providerMessageId = await sendReportEmailViaResend({
      to: recipients,
      subject: `Nossa Grana - relatorio de domingo (${formatDateBr(baseDateIso)})`,
      html: report.html,
    })

    await supabase
      .from('email_report_runs')
      .update({
        status: 'sent',
        recipients,
        ai_notes: report.notes,
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
        error: null,
      })
      .eq('workspace_id', workspaceId)
      .eq('run_key', runKey)

    return { workspaceId, status: 'sent', runKey, recipients, providerMessageId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado.'
    await markRunFailed(supabase, workspaceId, runKey, [], [], message)
    return { workspaceId, status: 'failed', runKey, recipients: [], reason: message }
  }
}

export async function getWorkspacesForWeeklyReport(supabase: Db) {
  const { data: workspaces, error: workspaceError } = await supabase.from('workspaces').select('id,nome')
  if (workspaceError) throw workspaceError

  const { data: prefs, error: prefError } = await supabase
    .from('report_preferences')
    .select('workspace_id,enabled,send_day,send_hour')
  if (prefError) throw prefError

  const prefByWorkspace = new Map((prefs ?? []).map((p) => [String(p.workspace_id), p]))
  return (workspaces ?? [])
    .filter((ws) => prefByWorkspace.get(String(ws.id))?.enabled !== false)
    .filter((ws) => (prefByWorkspace.get(String(ws.id))?.send_day ?? 0) === 0)
    .map((ws) => ({ id: String(ws.id), nome: String(ws.nome ?? 'Workspace') }))
}

export function todaySaoPaulo(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

async function loadFinanceData(supabase: Db, workspaceId: string): Promise<FinanceData> {
  const [
    workspace,
    pessoas,
    categorias,
    contas,
    metas,
    desejos,
    orcamentos,
    rendas,
    lancamentos,
  ] = await Promise.all([
    supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
    table<Pessoa>(supabase, 'pessoas', workspaceId),
    table<Categoria>(supabase, 'categorias', workspaceId),
    table<Conta>(supabase, 'contas', workspaceId),
    table<Meta>(supabase, 'metas', workspaceId),
    table<Desejo>(supabase, 'desejos', workspaceId),
    table<Orcamento>(supabase, 'orcamentos', workspaceId),
    table<Renda>(supabase, 'rendas', workspaceId),
    table<Lancamento>(supabase, 'lancamentos', workspaceId),
  ])

  if (workspace.error) throw workspace.error

  return {
    workspace: (workspace.data as Workspace | null) ?? null,
    pessoas,
    categorias,
    contas,
    metas,
    desejos,
    orcamentos,
    rendas,
    lancamentos,
  }
}

async function table<T>(supabase: Db, name: string, workspaceId: string): Promise<T[]> {
  const { data, error } = await supabase.from(name).select('*').eq('workspace_id', workspaceId)
  if (error) throw error
  return (data ?? []) as T[]
}

function buildReportFromData(data: FinanceData, mesRef: string): EmailReportForAi {
  const lancamentosMes = data.lancamentos.filter((l) => l.data >= mesRef && l.data <= endOfMonthIso(mesRef))
  const renda = rendaEfetiva(data.rendas, mesRef)
  const saidas = lancamentosMes.filter((l) => l.tipo !== 'receita')
  const gasto = saidas.reduce((sum, l) => sum + Number(l.valor), 0)
  const categoriaById = new Map(data.categorias.map((c) => [c.id, c]))

  const envelopes = data.categorias
    .filter((c) => c.ativo && (c.tipo_reserva === 'gasto' || c.tipo_reserva === 'mesada'))
    .map((categoria) => {
      const estabelecido = orcamentoEfetivo(data.orcamentos, categoria.id, mesRef, renda)
      const gastoCategoria = saidas
        .filter((l) => l.categoria_id === categoria.id)
        .reduce((sum, l) => sum + Number(l.valor), 0)
      return {
        nome: categoria.nome,
        gasto: gastoCategoria,
        estabelecido,
        pct: estabelecido > 0 ? gastoCategoria / estabelecido : gastoCategoria > 0 ? 1 : 0,
        estourou: estabelecido > 0 && gastoCategoria > estabelecido,
      }
    })
    .filter((env) => env.estabelecido > 0 || env.gasto > 0)
    .sort((a, b) => b.pct - a.pct)

  const maiores = [...saidas]
    .sort((a, b) => Number(b.valor) - Number(a.valor))
    .slice(0, 5)
    .map((l) => ({
      descricao: l.privado ? 'Gasto privado' : l.descricao,
      valor: Number(l.valor),
      categoria: l.categoria_id ? categoriaById.get(l.categoria_id)?.nome ?? null : null,
      data: l.data,
    }))

  const insights = buildInsights(renda, gasto, envelopes)

  return {
    resumo: {
      renda,
      gasto,
      sobra: renda - gasto,
      pctRenda: renda > 0 ? gasto / renda : 0,
    },
    envelopes,
    insights,
    maiores,
  }
}

function buildInsights(renda: number, gasto: number, envelopes: EmailReportForAi['envelopes']) {
  const insights: { tipo: string; texto: string }[] = []
  const estourados = envelopes.filter((env) => env.estourou)
  if (estourados.length > 0) {
    insights.push({
      tipo: 'alerta',
      texto: `${estourados.length} envelope(s) passaram do combinado neste mes.`,
    })
  }
  if (renda > 0 && gasto / renda >= 0.85) {
    insights.push({
      tipo: 'renda',
      texto: `Os gastos ja chegaram a ${Math.round((gasto / renda) * 100)}% da renda prevista.`,
    })
  }
  if (insights.length === 0) {
    insights.push({ tipo: 'ok', texto: 'O mes esta sem estouro relevante nos envelopes acompanhados.' })
  }
  return insights
}

function renderWeeklyReportHtml(report: EmailReportForAi, notes: string[], workspaceName: string) {
  const appUrl = optionalEnv('APP_URL') || '#'
  const topEnvelopes = report.envelopes.slice(0, 6)
  const rows = topEnvelopes
    .map(
      (env) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eef2f1;color:#1f2d33;">${escapeHtml(env.nome)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eef2f1;text-align:right;color:#1f2d33;">${money(env.gasto)} de ${money(env.estabelecido)}</td>
        </tr>`
    )
    .join('')

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;background:#f4f8f7;font-family:Inter,Arial,sans-serif;color:#1f2d33;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;">
    <tr><td style="padding:28px 32px 12px;">
      <div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#0f766e;font-weight:800;">${escapeHtml(workspaceName)}</div>
      <h1 style="font-size:26px;line-height:1.2;margin:8px 0 4px;">Relatorio de domingo</h1>
      <p style="margin:0;color:#64748b;font-size:14px;">Resumo financeiro automatico do Nossa Grana.</p>
    </td></tr>
    <tr><td style="padding:12px 32px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding:16px;border:1px solid #d9ebe7;border-radius:10px;">
            <div style="font-size:12px;color:#64748b;">Renda</div>
            <div style="font-size:20px;font-weight:800;">${money(report.resumo.renda)}</div>
          </td>
          <td style="width:12px;"></td>
          <td style="padding:16px;border:1px solid #d9ebe7;border-radius:10px;">
            <div style="font-size:12px;color:#64748b;">Gasto</div>
            <div style="font-size:20px;font-weight:800;">${money(report.resumo.gasto)}</div>
          </td>
          <td style="width:12px;"></td>
          <td style="padding:16px;border:1px solid #d9ebe7;border-radius:10px;">
            <div style="font-size:12px;color:#64748b;">Sobra</div>
            <div style="font-size:20px;font-weight:800;">${money(report.resumo.sobra)}</div>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:10px 32px 0;">
      <h2 style="font-size:17px;margin:0 0 8px;">Envelopes em destaque</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows || '<tr><td style="padding:10px 0;color:#64748b;">Sem envelopes com movimento.</td></tr>'}</table>
    </td></tr>
    <tr><td style="padding:18px 32px;color:#64748b;font-size:13px;">
      <a href="${escapeHtml(appUrl)}" style="color:#0f766e;font-weight:700;">Abrir Nossa Grana</a>
    </td></tr>
  </table>
</body>
</html>`

  return injectAiFooterIntoEmail(html, notes)
}

async function getReportRecipients(supabase: Db, workspaceId: string) {
  const { data: pref, error: prefError } = await supabase
    .from('report_preferences')
    .select('recipients_mode,recipients')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (prefError) throw prefError

  if (pref?.recipients_mode === 'custom') return uniqueEmails((pref.recipients as string[]) ?? [])

  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
  if (membersError) throw membersError

  const userIds = (members ?? []).map((m) => String(m.user_id))
  if (userIds.length === 0) return []

  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('user_id,email').in('user_id', userIds)
  if (profilesError) throw profilesError

  const emails = (profiles ?? []).map((p) => String(p.email ?? '')).filter(Boolean)
  const missing = userIds.filter((id) => !profiles?.some((p) => p.user_id === id && p.email))
  for (const userId of missing) {
    const { data } = await supabase.auth.admin.getUserById(userId)
    if (data.user?.email) emails.push(data.user.email)
  }

  return uniqueEmails(emails)
}

async function createPendingRun(supabase: Db, workspaceId: string, runKey: string, reportDate: string) {
  const { error } = await supabase.from('email_report_runs').insert({
    workspace_id: workspaceId,
    run_key: runKey,
    report_date: reportDate,
    status: 'pending',
  })
  if (!error) return true
  if (String(error.code) === '23505' || /duplicate key/i.test(error.message)) return false
  throw error
}

async function markRunFailed(
  supabase: Db,
  workspaceId: string,
  runKey: string,
  recipients: string[],
  notes: string[],
  error: string
) {
  await supabase
    .from('email_report_runs')
    .update({ status: 'failed', recipients, ai_notes: notes, error })
    .eq('workspace_id', workspaceId)
    .eq('run_key', runKey)
}

async function storeAiUsage(
  supabase: Db,
  workspaceId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
) {
  if (!inputTokens && !outputTokens && !costUsd) return
  await supabase.from('ai_usage_events').insert({
    workspace_id: workspaceId,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
  })
}

export async function sendReportEmailViaResend(input: { to: string[]; subject: string; html: string }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${requiredEnv('RESEND_API_KEY')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: requiredEnv('EMAIL_FROM'),
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.message || data?.error || 'Resend falhou ao enviar email.')
  return String(data?.id || data?.data?.id || '')
}

function rendaEfetiva(rendas: Renda[], mesRef: string) {
  const exata = rendas.find((r) => r.mes_referencia === mesRef)
  if (exata) return Number(exata.valor)
  const recorrente = rendas
    .filter((r) => r.recorrente && r.mes_referencia <= mesRef)
    .sort((a, b) => (a.mes_referencia < b.mes_referencia ? 1 : -1))[0]
  return recorrente ? Number(recorrente.valor) : 0
}

function orcamentoEfetivo(orcamentos: Orcamento[], categoriaId: string, mesRef: string, renda: number) {
  const row =
    orcamentos.find((o) => o.categoria_id === categoriaId && o.mes_referencia === mesRef) ??
    orcamentos
      .filter((o) => o.categoria_id === categoriaId && o.recorrente && o.mes_referencia <= mesRef)
      .sort((a, b) => (a.mes_referencia < b.mes_referencia ? 1 : -1))[0]
  if (!row) return 0
  if (row.tipo_valor === 'percentual') return round2((Number(row.percentual ?? 0) / 100) * renda)
  return Number(row.valor_estabelecido)
}

function monthRef(dateIso: string) {
  return `${dateIso.slice(0, 7)}-01`
}

function endOfMonthIso(mesRef: string) {
  const [year, month] = mesRef.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

function uniqueEmails(emails: string[]) {
  return Array.from(new Set(emails.map((email) => email.trim().toLowerCase()).filter((email) => /\S+@\S+\.\S+/.test(email))))
}

function formatDateBr(iso: string) {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(value) ? value : 0)
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
