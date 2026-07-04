// Orquestrador do relatório financeiro por e-mail.
//   node scripts/relatorio/enviar.mjs            → coleta, gera e ENVIA
//   node scripts/relatorio/enviar.mjs --dry-run  → gera e salva HTML (não envia)
//   node scripts/relatorio/enviar.mjs --dia=0     → força o dia da semana (teste)
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { coletarDados, hojeSaoPaulo } from './dados.mjs'
import { gerarHtml } from './html.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const DRY = process.argv.includes('--dry-run')
const diaArg = process.argv.find((a) => a.startsWith('--dia='))

const LOGIN_EMAIL = process.env.LOGIN_EMAIL || 'zocateli2001@gmail.com'
const DESTINOS = (process.env.RELATORIO_TO || 'zocateli2001@gmail.com,theleeeh@gmail.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/** Conexão pg: usa DATABASE_URL (CI) ou env.Supabase.txt (local). */
function criarClient() {
  if (process.env.DATABASE_URL) {
    return new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 })
  }
  const txt = readFileSync(join(ROOT, 'env.Supabase.txt'), 'utf8')
  const out = {}
  for (const l of txt.split(/\r?\n/)) {
    const i = l.indexOf(':')
    if (i > 0) out[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim()
  }
  const ref = new URL(out['url']).hostname.split('.')[0]
  return new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password: out['senha'],
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  })
}

async function enviarEmail({ to, subject, html }) {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  const from = process.env.GMAIL_FROM_EMAIL
  if (!clientId || !clientSecret || !refreshToken || !from) {
    throw new Error('Credenciais do Gmail ausentes (GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN/FROM_EMAIL).')
  }
  const { google } = await import('googleapis')
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
  oauth2.setCredentials({ refresh_token: refreshToken })
  const gmail = google.gmail({ version: 'v1', auth: oauth2 })
  const message = [
    `From: Nossa Grana <${from}>`,
    `To: ${to.join(', ')}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\r\n')
  const raw = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
}

async function main() {
  const hoje = hojeSaoPaulo()
  const client = criarClient()
  await client.connect()
  let dados
  try {
    dados = await coletarDados(client, { hoje, loginEmail: LOGIN_EMAIL })
  } finally {
    await client.end()
  }

  // permite forçar o dia da semana em teste (--dia=0..6)
  if (diaArg) {
    const { secoesDoDia } = await import('./dados.mjs')
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
    const n = Number(diaArg.split('=')[1])
    dados.dia = dias[n]
    dados.secoes = secoesDoDia(n)
  }

  const html = gerarHtml(dados)
  const subject = `Nossa Grana — Planejando ${dados.mesNomeCap} (${dados.dia})`

  if (DRY) {
    const out = join(ROOT, 'scripts', 'relatorio', 'preview.html')
    writeFileSync(out, html, 'utf8')
    console.log(`✓ DRY-RUN — HTML salvo em ${out}`)
    console.log(`  Assunto: ${subject}`)
    console.log(`  Seções: resumo + ${Object.keys(dados.secoes).join(', ') || '(só resumo)'}`)
    console.log(`  Renda ${dados.resumo.renda} · Gasto ${dados.resumo.gasto} · Sobra ${dados.resumo.sobra}`)
    return
  }

  await enviarEmail({ to: DESTINOS, subject, html })
  console.log(`✅ Relatório enviado para ${DESTINOS.join(', ')} — ${subject}`)
}

main().catch((e) => {
  console.error('✗ Falhou:', e.message)
  process.exit(1)
})
