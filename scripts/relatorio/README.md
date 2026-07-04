# Relatório financeiro por e-mail

Envia automaticamente um relatório do casal por e-mail **segunda, quarta, sexta e domingo**
às **08:00 (horário de Brasília)**, via GitHub Actions.

- **Resumo do mês** vem sempre (renda, gasto, sobra, % comprometido).
- As seções extras variam por dia: **seg** → envelopes no limite; **qua** → insights;
  **sex** → maiores gastos; **dom** → recapão (tudo).

## Arquivos

- `dados.mjs` — lê o Supabase e monta o snapshot (renda, envelopes, insights, maiores gastos).
- `html.mjs` — gera o HTML com o design system do app (teal, cards, verde/âmbar/vermelho).
- `enviar.mjs` — orquestra: coleta → gera → envia (Gmail API).
- `../../.github/workflows/relatorio-financeiro.yml` — o agendamento (cron).

## Testar localmente

```bash
# gera o HTML sem enviar (usa env.Supabase.txt); salva scripts/relatorio/preview.html
node scripts/relatorio/enviar.mjs --dry-run

# força o dia da semana p/ ver as seções (0=dom, 1=seg, 3=qua, 5=sex)
node scripts/relatorio/enviar.mjs --dry-run --dia=0
```

## Secrets do GitHub (repo `nossa-grana`)

O workflow lê estes secrets. Adicione em **Settings → Secrets and variables → Actions**
(ou via `gh secret set NOME --repo Zocateli77/nossa-grana`):

| Secret | O que é | Onde pegar |
|---|---|---|
| `DATABASE_URL` | Connection string do **pooler** do Supabase (IPv4 — obrigatório no Actions; a conexão direta é só IPv6). | Dashboard Supabase → Settings → Database → **Session pooler** (porta 5432). Formato: `postgresql://postgres.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:5432/postgres` |
| `GMAIL_CLIENT_ID` | OAuth do Gmail (mesmas credenciais do ZocLife). | Vercel do ZocLife / Google Cloud Console |
| `GMAIL_CLIENT_SECRET` | idem | idem |
| `GMAIL_REFRESH_TOKEN` | idem | idem |
| `GMAIL_FROM_EMAIL` | e-mail que envia (o mesmo do ZocLife). | idem |

Valores **não sensíveis** (destinatários, login, URL do app) ficam direto no workflow, fáceis de editar.

## Disparo manual (teste)

Aba **Actions → Relatório financeiro por e-mail → Run workflow**. Isso roda na hora e envia
de verdade — bom para validar os secrets antes do 1º agendamento.

> ⚠️ Cron só dispara a partir do branch **default (`main`)**. Este código precisa estar em `main`
> para o agendamento entrar em vigor.
