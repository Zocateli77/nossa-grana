// Utilitário LOCAL (não roda no CI): gera o refresh_token do Gmail e grava os 4
// secrets no repo do GitHub. Uso:
//   node scripts/relatorio/gerar-refresh-token.mjs "<caminho do client_secret_*.json>"
// Requer: googleapis instalado e `gh` autenticado no repo.
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { google } from 'googleapis'

const CLIENT_JSON = process.argv[2]
const REPO = process.env.REPO || 'Zocateli77/nossa-grana'
if (!CLIENT_JSON) {
  console.error('Passe o caminho do client_secret JSON como argumento.')
  process.exit(1)
}

const j = JSON.parse(readFileSync(CLIENT_JSON, 'utf8'))
const c = j.installed || j.web
if (!c) {
  console.error('JSON não parece ser um client OAuth do Google.')
  process.exit(1)
}
const clientId = c.client_id
const clientSecret = c.client_secret

const SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email']

function setSecret(name, val) {
  execFileSync('gh', ['secret', 'set', name, '--repo', REPO], { input: val, stdio: ['pipe', 'ignore', 'inherit'] })
}

const server = http.createServer(async (req, res) => {
  try {
    const port = server.address().port
    const redirect = `http://localhost:${port}`
    const u = new URL(req.url, redirect)
    const code = u.searchParams.get('code')
    if (!code) {
      res.writeHead(400).end('Sem code na URL.')
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(
      '<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>✅ Autorizado!</h2><p>Pode fechar esta aba e voltar ao terminal.</p></body></html>'
    )
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirect)
    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)
    if (!tokens.refresh_token) {
      console.error('\n✗ O Google não retornou refresh_token. Remova o acesso em myaccount.google.com/permissions e rode de novo.')
      server.close()
      process.exit(1)
    }
    const oauth2api = google.oauth2({ version: 'v2', auth: oauth2 })
    const { data } = await oauth2api.userinfo.get()
    const email = data.email

    console.log('\n→ Gravando secrets no repo ' + REPO + ' …')
    setSecret('GMAIL_CLIENT_ID', clientId)
    setSecret('GMAIL_CLIENT_SECRET', clientSecret)
    setSecret('GMAIL_REFRESH_TOKEN', tokens.refresh_token)
    setSecret('GMAIL_FROM_EMAIL', email)
    console.log(`\n✅ Pronto! Secrets GMAIL_* definidos no ${REPO}.`)
    console.log(`   Remetente (from): ${email}`)
    server.close()
    process.exit(0)
  } catch (e) {
    console.error('\n✗ Falhou:', e.message)
    server.close()
    process.exit(1)
  }
})

server.listen(0, 'localhost', () => {
  const port = server.address().port
  const redirect = `http://localhost:${port}`
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirect)
  const url = oauth2.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES })
  console.log('\n============================================================')
  console.log('1) Abra esta URL no navegador e autorize com a conta que vai ENVIAR os e-mails:\n')
  console.log(url)
  console.log('\n2) Aguardando autorização (servidor local em ' + redirect + ') …')
  console.log('============================================================')
})
