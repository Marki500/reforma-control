import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('AI usage migration enforces per-user and global daily limits', async () => {
  const sql = await readFile(new URL('../supabase/migrations/00026_ai_usage_limits.sql', import.meta.url), 'utf8')
  assert.match(sql, /v_user_used>=5/)
  assert.match(sql, /v_global_used>=40/)
  assert.match(sql, /Europe\/Madrid/)
  assert.match(sql, /pg_advisory_xact_lock/)
})

test('free-only server blocks paid model or PDF engine configuration', async () => {
  const server = await readFile(new URL('../server.js', import.meta.url), 'utf8')
  assert.match(server, /openRouterModel !== 'openrouter\/free'/)
  assert.match(server, /openRouterPdfEngine !== 'pdf-text'/)
  assert.match(server, /AI_PAID_CONFIG_BLOCKED/)
  assert.match(server, /reserve_ai_usage/)
})
