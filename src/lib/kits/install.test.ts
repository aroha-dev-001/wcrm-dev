import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const h = vi.hoisted(() => ({
  steps: [] as { automationId: string; steps: unknown[] }[],
  ingested: [] as string[],
}))

vi.mock('@/lib/automations/steps-tree', () => ({
  insertSteps: vi.fn(async (automationId: string, steps: unknown[]) => {
    h.steps.push({ automationId, steps })
    return null
  }),
}))
vi.mock('@/lib/ai/config', () => ({
  loadEmbeddingsKey: async () => ({ key: null, corrupt: false }),
}))
vi.mock('@/lib/ai/knowledge', () => ({
  ingestDocument: vi.fn(async (_db: unknown, _acct: string, _cfg: unknown, id: string) => {
    h.ingested.push(id)
  }),
}))

import { installStarterKit, resolveRefs } from './install'
import { BLOOM_BIOTECH_KIT as kit } from './bloom-biotech'

// ------------------------------------------------------------
// Minimal in-memory stand-in for the service-role client: enough of
// PostgREST's builder (select / eq / insert / update / delete / single
// / maybeSingle / await) for the installer's queries.
// ------------------------------------------------------------

type Row = Record<string, unknown>

function fakeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = structuredClone(seed)
  let seq = 0

  function from(table: string) {
    const filters: [string, unknown][] = []
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let inserted: Row[] = []
    let patch: Row = {}
    const all = () => (tables[table] ??= [])
    const hit = (r: Row) => filters.every(([c, v]) => r[c] === v)

    const exec = (): { data: Row[] | null; error: null } => {
      if (op === 'insert') return { data: inserted, error: null }
      if (op === 'update') {
        all().filter(hit).forEach((r) => Object.assign(r, patch))
        return { data: null, error: null }
      }
      if (op === 'delete') {
        tables[table] = all().filter((r) => !hit(r))
        return { data: null, error: null }
      }
      return { data: all().filter(hit), error: null }
    }

    const b = {
      select: () => b,
      order: () => b,
      eq: (c: string, v: unknown) => {
        filters.push([c, v])
        return b
      },
      insert: (rows: Row | Row[]) => {
        op = 'insert'
        inserted = (Array.isArray(rows) ? rows : [rows]).map((r) => ({
          id: `${table}-${++seq}`,
          created_at: new Date(2026, 0, 1, 0, 0, seq).toISOString(),
          ...r,
        }))
        all().push(...inserted)
        return b
      },
      update: (p: Row) => {
        op = 'update'
        patch = p
        return b
      },
      delete: () => {
        op = 'delete'
        return b
      },
      single: async () => {
        const row = exec().data?.[0] ?? null
        return { data: row, error: row ? null : { message: 'no rows' } }
      },
      maybeSingle: async () => ({ data: exec().data?.[0] ?? null, error: null }),
      then: (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(exec()).then(resolve, reject),
    }
    return b
  }

  return { db: { from } as unknown as SupabaseClient, tables }
}

const ACCOUNT = 'acct-1'
const USER = 'user-1'

beforeEach(() => {
  h.steps = []
  h.ingested = []
})

describe('resolveRefs', () => {
  const refs = {
    tags: new Map([['wants quote', 'tag-9']]),
    pipelineId: 'p-1',
    stages: new Map([['interested', 's-2']]),
  }

  it('swaps names for ids and keeps a display label for tags', () => {
    expect(resolveRefs({ mode: 'add', tag_name: 'Wants Quote', next_node_key: 'x' }, refs)).toEqual({
      mode: 'add',
      tag_id: 'tag-9',
      tag_label: 'Wants Quote',
      next_node_key: 'x',
    })
    expect(
      resolveRefs({ pipeline_name: 'Sales', stage_name: 'Interested', title: 'T' }, refs),
    ).toEqual({ pipeline_id: 'p-1', stage_id: 's-2', title: 'T' })
  })

  it('leaves an unknown name as an empty id for the validators to catch', () => {
    expect(resolveRefs({ tag_name: 'Nope' }, refs).tag_id).toBe('')
  })
})

describe('installStarterKit', () => {
  it('sets up a fresh account with everything wired and switched on', async () => {
    const { db, tables } = fakeDb()
    const report = await installStarterKit({ db, accountId: ACCOUNT, userId: USER, kit })

    expect(report.warnings).toEqual([])
    expect(report.created.tags).toHaveLength(kit.tags.length)
    expect(report.created.flows).toEqual(kit.flows.map((f) => f.name))
    expect(report.created.automations).toEqual(kit.automations.map((a) => a.name))
    expect(report.created.templates).toHaveLength(kit.templates.length)
    expect(report.created.knowledge).toHaveLength(kit.knowledge.length)
    expect(h.ingested).toHaveLength(kit.knowledge.length)

    // Flows: active, in kit order (creation order is the keyword tie-break).
    expect(tables.flows.map((f) => [f.name, f.status])).toEqual(
      kit.flows.map((f) => [f.name, 'active']),
    )

    // Every flow "Tag contact" node points at a tag that now exists.
    const tagIdByName = new Map(tables.tags.map((t) => [t.name, t.id]))
    const setTags = tables.flow_nodes.filter((n) => n.node_type === 'set_tag')
    expect(setTags.length).toBeGreaterThan(0)
    for (const n of setTags) {
      const cfg = n.config as { tag_id: string; tag_label: string }
      expect(cfg.tag_id).toBe(tagIdByName.get(cfg.tag_label))
    }

    // Automations: tag triggers and deal steps resolved to real ids.
    const quote = tables.automations.find((a) => a.name === 'Bloom · Price quote → assign to sales')!
    expect((quote.trigger_config as { tag_id: string }).tag_id).toBe(tagIdByName.get('Wants quote'))
    const pipeline = tables.pipelines[0]
    const interested = tables.pipeline_stages.find((s) => s.name === 'Interested')!
    const astra = tables.automations.find((a) => a.name === 'Bloom · Bio Astra enquiry → sales pipeline')!
    const astraSteps = h.steps.find((s) => s.automationId === astra.id)!.steps as {
      step_config: Record<string, unknown>
    }[]
    expect(astraSteps[0].step_config).toMatchObject({
      pipeline_id: pipeline.id,
      stage_id: interested.id,
      title: 'Bio Astra enquiry',
    })

    // The optional follow-up ships switched off; the rest are on.
    expect(tables.automations.filter((a) => !a.is_active).map((a) => a.name)).toEqual([
      'Bloom · Next-day quote follow-up',
    ])

    // Templates are local drafts only — nothing is sent to Meta.
    expect(new Set(tables.message_templates.map((t) => t.status))).toEqual(new Set(['DRAFT']))
  })

  it('is safe to run twice — the second run only skips', async () => {
    const { db, tables } = fakeDb()
    await installStarterKit({ db, accountId: ACCOUNT, userId: USER, kit })
    const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]))

    const again = await installStarterKit({ db, accountId: ACCOUNT, userId: USER, kit })

    expect(Object.values(again.created).flat()).toEqual([])
    expect(again.skipped.flows).toHaveLength(kit.flows.length)
    expect(again.skipped.automations).toHaveLength(kit.automations.length)
    expect(Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]))).toEqual(counts)
  })

  it('reuses an existing tag regardless of case instead of duplicating it', async () => {
    const { db, tables } = fakeDb({
      tags: [{ id: 'mine', account_id: ACCOUNT, name: 'new LEAD', color: '#000' }],
    })
    const report = await installStarterKit({ db, accountId: ACCOUNT, userId: USER, kit })

    expect(report.skipped.tags).toEqual(['New lead'])
    expect(tables.tags.filter((t) => String(t.name).toLowerCase() === 'new lead')).toHaveLength(1)
    const tagLeads = tables.automations.find((a) => a.name === 'Bloom · Tag new WhatsApp leads')!
    const steps = h.steps.find((s) => s.automationId === tagLeads.id)!.steps as {
      step_config: Record<string, unknown>
    }[]
    expect(steps[0].step_config.tag_id).toBe('mine')
  })

  it("fills an empty AI business prompt but never overwrites the admin's", async () => {
    const empty = fakeDb({ ai_configs: [{ id: 'ai-1', account_id: ACCOUNT, system_prompt: null }] })
    await installStarterKit({ db: empty.db, accountId: ACCOUNT, userId: USER, kit })
    expect(empty.tables.ai_configs[0].system_prompt).toBe(kit.aiSystemPrompt)

    const custom = fakeDb({ ai_configs: [{ id: 'ai-1', account_id: ACCOUNT, system_prompt: 'Mine' }] })
    await installStarterKit({ db: custom.db, accountId: ACCOUNT, userId: USER, kit })
    expect(custom.tables.ai_configs[0].system_prompt).toBe('Mine')
  })
})
