# Desejos Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/desejos` Kanban screen where planned purchases are simulated before becoming real `lancamentos`.

**Architecture:** Add a first-class `desejos` table, TypeScript types, data hooks, mutation hooks, calculation helpers, and a mobile-first feature page. Confirming a purchase inserts real installment rows through `expandirSerie` and then archives the desire as bought.

**Tech Stack:** React, Vite, TypeScript, Tailwind, Supabase, TanStack Query, existing UI components, existing `calc.ts` business rules.

---

### Task 1: Data Model And Calculation

**Files:**
- Modify: `scripts/schema.sql`
- Modify: `scripts/setup.mjs`
- Modify: `src/types/db.ts`
- Modify: `src/lib/calc.ts`
- Create: `scripts/desejos-viabilidade.test.mjs`
- Modify: `package.json`

- [ ] Add `desejos` schema with RLS, authenticated policy, indexes, and `atualizado_em` trigger.
- [ ] Add `Desejo`, `NovoDesejo`, `StatusDesejo`, `PrioridadeDesejo` types.
- [ ] Add `viabilidadeDesejo` and `resumoDesejos` helpers.
- [ ] Add `npm run test:desejos` using the same esbuild-based test style as the analytics test.
- [ ] Verify RED: `npm run test:desejos` fails before `viabilidadeDesejo` exists.
- [ ] Verify GREEN: `npm run test:desejos` passes after helpers exist.

### Task 2: Data Hooks And Purchase Confirmation

**Files:**
- Modify: `src/hooks/useDados.ts`
- Modify: `src/hooks/useMutations.ts`

- [ ] Fetch `desejos` in `useDados`.
- [ ] Add `useSalvarDesejo`, `useExcluirDesejo`, and `useConfirmarCompraDesejo`.
- [ ] `useConfirmarCompraDesejo` must insert expanded `lancamentos` first, then mark the desire as `comprado`; if insert fails, do not update the desire.
- [ ] Invalidate `desejos`, `lancamentos`, and `metas` where needed.

### Task 3: Desejos UI

**Files:**
- Create: `src/features/desejos/DesejosPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/nav.ts`

- [ ] Add `/desejos` route and a secondary menu item.
- [ ] Build Kanban columns: `desejo`, `avaliando`, `planejado`, `pronto`.
- [ ] Add a compact bought-history section for `comprado` and `arquivado`.
- [ ] Add create/edit dialog with name, description, value, installments, month, category, account, person, priority, and status.
- [ ] Add card actions for edit, move status, confirm purchase, and archive.
- [ ] Add confirmation dialog that creates real purchase rows.

### Task 4: Verification

**Files:**
- No new files.

- [ ] Run `npm run test:desejos`.
- [ ] Run `npm run build`.
- [ ] Start Vite and check `http://127.0.0.1:5173/desejos` returns 200.
- [ ] Review `git diff --stat` and make sure only this feature is included.
