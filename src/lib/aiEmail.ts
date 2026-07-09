import { money } from './format'

export interface EmailEnvelope {
  nome: string
  gasto: number
  estabelecido: number
  pct: number
  estourou: boolean
}

export interface EmailInsight {
  tipo: string
  texto: string
}

export interface EmailMajorExpense {
  descricao: string
  valor: number
  categoria: string | null
  data: string
}

export interface EmailReportForAi {
  resumo: {
    renda: number
    gasto: number
    sobra: number
    pctRenda: number
  }
  envelopes: EmailEnvelope[]
  insights: EmailInsight[]
  maiores: EmailMajorExpense[]
}

export function buildAiFooterNotes(report: EmailReportForAi): string[] {
  const estourado = report.envelopes.find((env) => env.estourou)
  const noLimite = report.envelopes.find((env) => !env.estourou && env.pct >= 0.9) ?? report.envelopes[0]
  const maior = report.maiores[0]

  const alerta = estourado
    ? `${estourado.nome} passou do envelope em ${money(estourado.gasto - estourado.estabelecido)}; vale decidir se isso foi excecao ou novo padrao.`
    : report.insights[0]?.texto || `O mes esta com ${Math.round(report.resumo.pctRenda * 100)}% da renda comprometida.`

  const sugestao = noLimite
    ? `${noLimite.nome} esta em ${Math.round(noLimite.pct * 100)}% do envelope; uma pausa curta nessa categoria protege a sobra.`
    : `Com sobra prevista de ${money(report.resumo.sobra)}, revisem antes de criar novos compromissos.`

  const pergunta = maior
    ? `O gasto ${maior.descricao} em ${maior.categoria ?? 'sem categoria'} precisa se repetir no proximo mes?`
    : 'Qual gasto planejado ainda pode esperar uma semana antes de virar compromisso?'

  return [alerta, sugestao, pergunta]
}

export function injectAiFooterIntoEmail(html: string, notes: string[]) {
  const footer = renderAiFooter(notes)
  const appFooterIndex = html.indexOf('<footer')
  if (appFooterIndex >= 0) return `${html.slice(0, appFooterIndex)}${footer}${html.slice(appFooterIndex)}`

  const reportFooterIndex = html.indexOf('<tr><td style="padding:18px 32px;')
  if (reportFooterIndex >= 0) return `${html.slice(0, reportFooterIndex)}${footer}${html.slice(reportFooterIndex)}`

  return html.replace('</body>', `${footer}</body>`)
}

export function emailRunKey(workspaceId: string, isoDate: string) {
  return `${workspaceId}:${isoDate}:weekly-report`
}

function renderAiFooter(notes: string[]) {
  const items = notes
    .slice(0, 3)
    .map(
      (note) =>
        `<li style="margin:0 0 8px;color:#1f2d33;font-size:14px;line-height:1.45;">${escapeHtml(note)}</li>`
    )
    .join('')

  return `
  <tr><td style="padding:18px 32px 0;">
    <div style="border:1px solid #d9ebe7;background:#f4f8f7;border-radius:14px;padding:16px 18px;">
      <div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#0f766e;font-weight:800;margin-bottom:10px;">Notas da IA</div>
      <ol style="padding-left:20px;margin:0;">${items}</ol>
    </div>
  </td></tr>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
