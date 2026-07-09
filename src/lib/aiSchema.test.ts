import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('AI schema contract', () => {
  const schema = readFileSync(join(process.cwd(), 'scripts', 'schema.sql'), 'utf8')

  it('defines the AI persistence tables used by the concierge and weekly report', () => {
    for (const table of [
      'ai_conversations',
      'ai_messages',
      'ai_memories',
      'ai_action_drafts',
      'ai_usage_events',
      'email_report_runs',
      'report_preferences',
    ]) {
      expect(schema).toContain(`create table if not exists ${table}`)
    }
  })

  it('stores member email and isolates all AI tables by workspace RLS', () => {
    expect(schema).toContain('alter table profiles add column if not exists email text')
    expect(schema).toContain("foreach t in array array['ai_conversations','ai_messages','ai_memories','ai_action_drafts','ai_usage_events','email_report_runs','report_preferences']")
    expect(schema).toContain('workspace_id = current_workspace_id()')
  })
})
