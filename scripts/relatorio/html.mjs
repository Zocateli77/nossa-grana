// Gera o HTML do relatório por e-mail com o design system do Nossa Grana.
// Table-based + estilos inline (compatível com Gmail/Apple Mail/Outlook).
import { brl } from './dados.mjs'

const C = {
  primary: '#0f766e',
  primaryDark: '#0b5e57',
  text: '#1f2d33',
  muted: '#64748b',
  border: '#e6efec',
  card: '#ffffff',
  page: '#eef2f1',
  success: '#15945a',
  warning: '#d97706',
  warnBar: '#f59e0b',
  danger: '#dc2626',
  soft: '#f4f8f7',
}

const APP_URL = process.env.APP_URL || 'https://nossa-grana.vercel.app'

function barra(pct) {
  const p = Math.min(100, Math.max(0, Math.round(pct * 100)))
  const cor = pct >= 1 ? C.danger : pct >= 0.8 ? C.warnBar : C.primary
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
      <tr><td style="background:${C.border};border-radius:999px;height:10px;padding:0;">
        <table width="${p}%" cellpadding="0" cellspacing="0"><tr>
          <td style="background:${cor};border-radius:999px;height:10px;font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
      </td></tr>
    </table>`
}

function secaoTitulo(txt) {
  return `<h2 style="margin:28px 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:${C.primary};font-weight:700;">${txt}</h2>`
}

function statCell(label, valor, cor = C.text) {
  return `
    <td width="33%" style="padding:0 6px;vertical-align:top;">
      <div style="background:${C.soft};border:1px solid ${C.border};border-radius:12px;padding:14px 12px;text-align:center;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${C.muted};font-weight:600;">${label}</div>
        <div style="font-size:18px;font-weight:800;color:${cor};margin-top:4px;white-space:nowrap;">${valor}</div>
      </div>
    </td>`
}

function resumoBloco(r) {
  const pctTxt = r.renda > 0 ? `${Math.round(r.pctRenda * 100)}% da renda` : 'defina sua renda'
  const sobraCor = r.sobra >= 0 ? C.success : C.danger
  const partes = []
  if (r.gasto > 0) partes.push(`${brl(r.gasto)} agendado`)
  if (r.jaPago > 0) partes.push(`${brl(r.jaPago)} já pago`)
  if (r.investido > 0) partes.push(`investir ${brl(r.investido)}`)
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
      <tr>
        ${statCell('Renda prevista', brl(r.renda))}
        ${statCell('Comprometido', brl(r.gasto), r.pctRenda >= 1 ? C.danger : C.text)}
        ${statCell('Sobra prevista', brl(r.sobra), sobraCor)}
      </tr>
    </table>
    <div style="margin-top:14px;">
      <div style="font-size:13px;color:${C.muted};">
        Comprometido <strong style="color:${C.text};">${brl(r.gasto)}</strong> de ${brl(r.renda)} · <strong style="color:${r.pctRenda >= 1 ? C.danger : C.text};">${pctTxt}</strong>
      </div>
      ${barra(r.pctRenda)}
      <div style="font-size:12px;color:${C.muted};margin-top:6px;">${partes.join(' · ') || 'Nada agendado ainda.'}</div>
    </div>`
}

function envelopesBloco(envs) {
  if (!envs.length) return `<p style="margin:0;color:${C.muted};font-size:14px;">Nenhum envelope no limite. 👍</p>`
  return envs
    .slice(0, 6)
    .map((e) => {
      const pctTxt = `${Math.round(e.pct * 100)}%`
      const cor = e.estourou ? C.danger : e.pct >= 0.9 ? C.warning : C.text
      const nota = e.estourou ? `estourou ${brl(e.gasto - e.estabelecido)}` : `${brl(e.gasto)} de ${brl(e.estabelecido)}`
      return `
      <div style="padding:10px 0;border-bottom:1px solid ${C.border};">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:14px;font-weight:600;color:${C.text};">${e.nome}</td>
          <td align="right" style="font-size:14px;font-weight:700;color:${cor};">${pctTxt}</td>
        </tr></table>
        ${barra(e.pct)}
        <div style="font-size:12px;color:${C.muted};margin-top:5px;">${nota}</div>
      </div>`
    })
    .join('')
}

function insightsBloco(ins) {
  if (!ins.length) return `<p style="margin:0;color:${C.muted};font-size:14px;">Sem novidades relevantes por aqui.</p>`
  return ins
    .map((i) => {
      const cor = i.tipo === 'positivo' ? C.success : C.warning
      const icone = i.tipo === 'positivo' ? '✅' : '📈'
      return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr>
        <td width="24" style="vertical-align:top;font-size:15px;">${icone}</td>
        <td style="font-size:14px;color:${C.text};line-height:1.5;border-left:3px solid ${cor};padding-left:10px;">${i.texto}</td>
      </tr></table>`
    })
    .join('')
}

function maioresBloco(gastos) {
  if (!gastos.length) return `<p style="margin:0;color:${C.muted};font-size:14px;">Nenhum gasto registrado ainda.</p>`
  return gastos
    .map((g) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:8px 0;border-bottom:1px solid ${C.border};"><tr>
        <td style="font-size:14px;color:${C.text};">
          <strong>${g.descricao}</strong>
          <div style="font-size:12px;color:${C.muted};">${g.categoria ?? 'Sem categoria'} · ${g.data.slice(8, 10)}/${g.data.slice(5, 7)}</div>
        </td>
        <td align="right" style="font-size:15px;font-weight:700;color:${C.text};white-space:nowrap;">${brl(g.valor)}</td>
      </tr></table>`)
    .join('')
}

export function gerarHtml(d) {
  const { resumo, secoes } = d
  const partes = [secaoTitulo(`Resumo de ${d.mesNome}`), resumoBloco(resumo)]
  if (secoes.envelopes) partes.push(secaoTitulo('Envelopes no limite'), envelopesBloco(d.envelopes))
  if (secoes.insights) partes.push(secaoTitulo('Percebi que…'), insightsBloco(d.insights))
  if (secoes.maiores) partes.push(secaoTitulo('Maiores contas do mês'), maioresBloco(d.maiores))

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nossa Grana</title></head>
<body style="margin:0;padding:0;background:${C.page};font-family:Inter,-apple-system,Segoe UI,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:24px 12px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.card};border-radius:18px;overflow:hidden;border:1px solid ${C.border};box-shadow:0 6px 24px rgba(15,118,110,0.08);">
  <tr><td style="padding:28px 32px;background:linear-gradient(135deg,${C.primary},${C.primaryDark});">
    <div style="font-size:13px;color:#bfe9e2;letter-spacing:1px;text-transform:uppercase;font-weight:600;">🐷 Nossa Grana</div>
    <div style="font-size:22px;color:#ffffff;font-weight:800;margin-top:6px;">Planejando ${d.mesNomeCap}</div>
    <div style="font-size:13px;color:#cdeee8;margin-top:2px;">${d.dia} · ${d.dataExtenso}</div>
  </td></tr>
  <tr><td style="padding:8px 32px 24px;">
    ${partes.join('')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr><td align="center">
      <a href="${APP_URL}" style="display:inline-block;background:${C.primary};color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:12px;font-weight:700;font-size:15px;">Abrir o Nossa Grana</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:18px 32px;background:${C.soft};border-top:1px solid ${C.border};text-align:center;">
    <div style="font-size:12px;color:${C.muted};line-height:1.6;">Relatório automático do casal · seg, qua, sex e dom.<br>Paz com o dinheiro, todo dia. 💚</div>
  </td></tr>
</table>
</td></tr></table></body></html>`
}
