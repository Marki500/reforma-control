import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('AI usage migration enforces per-user and global daily limits', async () => {
  const schemaSql = await readFile(new URL('../supabase/migrations/00026_ai_usage_limits.sql', import.meta.url), 'utf8')
  const limitSql = await readFile(new URL('../supabase/migrations/00028_increase_ai_user_daily_limit.sql', import.meta.url), 'utf8')
  assert.match(schemaSql, /CREATE TABLE IF NOT EXISTS public\.ai_usage_daily/)
  assert.match(limitSql, /v_user_limit CONSTANT INTEGER:=10/)
  assert.match(limitSql, /v_global_limit CONSTANT INTEGER:=40/)
  assert.match(limitSql, /Europe\/Madrid/)
  assert.match(limitSql, /pg_advisory_xact_lock/)
})

test('free-only server blocks paid model or PDF engine configuration', async () => {
  const server = await readFile(new URL('../server.js', import.meta.url), 'utf8')
  assert.match(server, /openRouterModel !== 'openrouter\/free'/)
  assert.match(server, /openRouterPdfEngine !== 'pdf-text'/)
  assert.match(server, /groqFreeModels\.has\(groqModel\)/)
  assert.match(server, /AI_PAID_CONFIG_BLOCKED/)
  assert.match(server, /reserve_ai_usage/)
})

test('Groq uses an allowlisted model and keeps the free OpenRouter fallback', async () => {
  const server = await readFile(new URL('../server.js', import.meta.url), 'utf8')
  assert.match(server, /GROQ_MODEL \|\| 'qwen\/qwen3\.8-27b'/)
  assert.match(server, /type: 'json_schema'/)
  assert.match(server, /strict: true/)
  assert.match(server, /requestGroqBudgetAnalysisWithFallback/)
  assert.match(server, /if \(!openRouterApiKey\) throw primaryError/)
})
