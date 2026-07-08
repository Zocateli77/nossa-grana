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
| `SUPABASE_URL` | URL do projeto Supabase. | `env.Supabase.txt` (Url) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role (bypassa RLS; acesso via REST/HTTPS — funciona no Actions, ao contrário da conexão direta IPv6). | `env.Supabase.txt` (service_role) |
| `GMAIL_CLIENT_ID` | OAuth do Gmail (client Desktop do Google). | `client_secret_*.json` do Google Cloud |
| `GMAIL_CLIENT_SECRET` | idem | idem |
| `GMAIL_REFRESH_TOKEN` | Gerado 1x pelo fluxo de consentimento. | `node scripts/relatorio/gerar-refresh-token.mjs "<client_secret.json>"` |
| `GMAIL_FROM_EMAIL` | e-mail que envia. | definido pelo gerador (a conta que você autorizar) |

O script `gerar-refresh-token.mjs` faz o fluxo OAuth (abre URL, você autoriza) e **grava os 4 secrets GMAIL_* automaticamente** via `gh`.

Valores **não sensíveis** (workspace, destinatários, URL do app) ficam direto no workflow, fáceis de editar.

## Disparo manual (teste)

Aba **Actions → Relatório financeiro por e-mail → Run workflow**. Isso roda na hora e envia
de verdade — bom para validar os secrets antes do 1º agendamento.

> ⚠️ Cron só dispara a partir do branch **default (`main`)**. Este código precisa estar em `main`
> para o agendamento entrar em vigor.
