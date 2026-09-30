import type { SupabaseClient } from '@supabase/supabase-js'

import { insertSteps, type BuilderStepInput } from '@/lib/automations/steps-tree'
import {
  validateStepsForActivation,
  validateTriggerForActivation,
} from '@/lib/automations/validate'
import { validateFlowForActivation } from '@/lib/flows/validate'
import { loadEmbeddingsKey } from '@/lib/ai/config'
import { ingestDocument } from '@/lib/ai/knowledge'
import type {
  KitFlow,
  KitInstallReport,
  KitSection,
  StarterKit,
} from './types'

/**
 * Ids the installer created or found, keyed by the names kit content
 * uses to reference them.
 */
export interface KitRefs {
  /** Lower-cased tag name → tag id. */
  tags: Map<string, string>
  pipelineId: string | null
  /** Lower-cased stage name → stage id (within `pipelineId`). */
  stages: Map<string, string>
}

const key = (name: string) => name.trim().toLowerCase()

/**
 * Swap kit name references for real ids: `tag_name` → `tag_id`,
 * `pipeline_name` / `stage_name` → `pipeline_id` / `stage_id`. An
 * unresolved name becomes an empty id, which the activation validators
 * then report instead of the row silently pointing nowhere.
 */
export function resolveRefs(
  config: Record<string, unknown>,
  refs: KitRefs,
): Record<string, unknown> {
  const { tag_name, pipeline_name, stage_name, ...rest } = config
  const out: Record<string, unknown> = { ...rest }
  if (typeof tag_name === 'string') {
    out.tag_id = refs.tags.get(key(tag_name)) ?? ''
    // Display-only: the flow builder summarises a Tag node by this
    // label instead of the bare id. The engines ignore it.
    out.tag_label = tag_name
  }
  if (typeof pipeline_name === 'string') {
    out.pipeline_id = refs.pipelineId ?? ''
  }
  if (typeof stage_name === 'string') {
    out.stage_id = refs.stages.get(key(stage_name)) ?? ''
  }
  return out
}

/** A kit flow with every node's references resolved. */
export function resolveFlow(flow: KitFlow, refs: KitRefs) {
  return {
    ...flow,
    nodes: flow.nodes.map((n) => ({ ...n, config: resolveRefs(n.config, refs) })),
  }
}

function emptyReport(): KitInstallReport {
  const sections: KitSection[] = [
    'tags',
    'pipeline',
    'flows',
    'automations',
    'templates',
    'knowledge',
    'quickReplies',
  ]
  return {
    created: Object.fromEntries(sections.map((s) => [s, []])) as unknown as KitInstallReport['created'],
    skipped: Object.fromEntries(sections.map((s) => [s, []])) as unknown as KitInstallReport['skipped'],
    warnings: [],
  }
}

interface InstallArgs {
  /** Service-role client — the caller has already checked the role. */
  db: SupabaseClient
  accountId: string
  userId: string
  kit: StarterKit
}

/**
 * Install a starter kit into an account.
 *
 * Idempotent by name: anything the account already has with the same
 * name (tag, pipeline, stage, flow, automation, template, knowledge
 * doc, quick reply) is reused or left alone, so a second click only
 * fills gaps. Flows and automations are activated only when they pass
 * the same validators the builders use; otherwise they're saved as
 * drafts and reported as warnings.
 *
 * Throws only for failures that make the rest meaningless (tags or
 * pipeline could not be created); per-item failures become warnings.
 */
export async function installStarterKit({
  db,
  accountId,
  userId,
  kit,
}: InstallArgs): Promise<KitInstallReport> {
  const report = emptyReport()

  const refs: KitRefs = {
    tags: await installTags(db, accountId, userId, kit, report),
    pipelineId: null,
    stages: new Map(),
  }
  const pipeline = await installPipeline(db, accountId, userId, kit, report)
  refs.pipelineId = pipeline.pipelineId
  refs.stages = pipeline.stages

  await installFlows(db, accountId, userId, kit, refs, report)
  await installAutomations(db, accountId, userId, kit, refs, report)
  await installTemplates(db, accountId, userId, kit, report)
  await installKnowledge(db, accountId, userId, kit, report)
  await installQuickReplies(db, accountId, userId, kit, report)
  await applyAiPrompt(db, accountId, kit, report)

  return report
}

// ------------------------------------------------------------

async function installTags(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  kit: StarterKit,
  report: KitInstallReport,
): Promise<Map<string, string>> {
  const { data, error } = await db
    .from('tags')
    .select('id, name')
    .eq('account_id', accountId)
  if (error) throw new Error(`Could not read tags: ${error.message}`)

  const ids = new Map<string, string>()
  for (const t of (data ?? []) as { id: string; name: string }[]) {
    ids.set(key(t.name), t.id)
  }

  const missing = kit.tags.filter((t) => !ids.has(key(t.name)))
  for (const t of kit.tags) {
    if (ids.has(key(t.name))) report.skipped.tags.push(t.name)
  }
  if (missing.length > 0) {
    const { data: inserted, error: insErr } = await db
      .from('tags')
      .insert(
        missing.map((t) => ({
          account_id: accountId,
          user_id: userId,
          name: t.name,
          color: t.color,
        })),
      )
      .select('id, name')
    if (insErr) throw new Error(`Could not create tags: ${insErr.message}`)
    for (const t of (inserted ?? []) as { id: string; name: string }[]) {
      ids.set(key(t.name), t.id)
      report.created.tags.push(t.name)
    }
  }
  return ids
}

async function installPipeline(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  kit: StarterKit,
  report: KitInstallReport,
): Promise<{ pipelineId: string; stages: Map<string, string> }> {
  const { data: existing, error } = await db
    .from('pipelines')
    .select('id, name')
    .eq('account_id', accountId)
  if (error) throw new Error(`Could not read pipelines: ${error.message}`)

  let pipelineId =
    ((existing ?? []) as { id: string; name: string }[]).find(
      (p) => key(p.name) === key(kit.pipeline.name),
    )?.id ?? null

  if (pipelineId) {
    report.skipped.pipeline.push(kit.pipeline.name)
  } else {
    const { data: created, error: insErr } = await db
      .from('pipelines')
      .insert({ account_id: accountId, user_id: userId, name: kit.pipeline.name })
      .select('id')
      .single()
    if (insErr || !created) {
      throw new Error(`Could not create pipeline: ${insErr?.message ?? 'no row returned'}`)
    }
    pipelineId = (created as { id: string }).id
    report.created.pipeline.push(kit.pipeline.name)
  }

  const { data: stageRows, error: stageErr } = await db
    .from('pipeline_stages')
    .select('id, name, position')
    .eq('pipeline_id', pipelineId)
  if (stageErr) throw new Error(`Could not read pipeline stages: ${stageErr.message}`)

  const stages = new Map<string, string>()
  let nextPosition = 0
  for (const s of (stageRows ?? []) as { id: string; name: string; position: number }[]) {
    stages.set(key(s.name), s.id)
    nextPosition = Math.max(nextPosition, (s.position ?? 0) + 1)
  }

  const missing = kit.pipeline.stages.filter((s) => !stages.has(key(s.name)))
  if (missing.length > 0) {
    const { data: inserted, error: insErr } = await db
      .from('pipeline_stages')
      .insert(
        missing.map((s, i) => ({
          pipeline_id: pipelineId,
          name: s.name,
          color: s.color,
          position: nextPosition + i,
        })),
      )
      .select('id, name')
    if (insErr) throw new Error(`Could not create pipeline stages: ${insErr.message}`)
    for (const s of (inserted ?? []) as { id: string; name: string }[]) {
      stages.set(key(s.name), s.id)
    }
  }

  return { pipelineId: pipelineId!, stages }
}

async function existingNames(
  db: SupabaseClient,
  table: string,
  column: string,
  accountId: string,
): Promise<Set<string>> {
  const { data, error } = await db.from(table).select(column).eq('account_id', accountId)
  if (error) throw new Error(`Could not read ${table}: ${error.message}`)
  return new Set(
    ((data ?? []) as unknown as Record<string, string>[]).map((r) => key(String(r[column] ?? ''))),
  )
}

async function installFlows(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  kit: StarterKit,
  refs: KitRefs,
  report: KitInstallReport,
) {
  const names = await existingNames(db, 'flows', 'name', accountId)

  // Sequential on purpose: creation order is the tie-break when two
  // keyword flows match the same message (see bloom-biotech.ts).
  for (const kitFlow of kit.flows) {
    if (names.has(key(kitFlow.name))) {
      report.skipped.flows.push(kitFlow.name)
      continue
    }
    const flow = resolveFlow(kitFlow, refs)
    const blockers = validateFlowForActivation(
      {
        name: flow.name,
        trigger_type: flow.trigger_type,
        trigger_config: flow.trigger_config,
        entry_node_id: flow.entry_node_id,
      },
      flow.nodes,
    ).filter((i) => i.severity === 'error')
    const status = blockers.length === 0 ? 'active' : 'draft'
    if (blockers.length > 0) {
      report.warnings.push(
        `"${flow.name}" was saved as a draft: ${blockers.map((b) => b.message).join(' ')}`,
      )
    }

    const { data: row, error } = await db
      .from('flows')
      .insert({
        account_id: accountId,
        user_id: userId,
        name: flow.name,
        description: flow.description,
        status,
        trigger_type: flow.trigger_type,
        trigger_config: flow.trigger_config,
        entry_node_id: flow.entry_node_id,
        ...(flow.fallback_policy ? { fallback_policy: flow.fallback_policy } : {}),
      })
      .select('id')
      .single()
    if (error || !row) {
      report.warnings.push(`Could not create flow "${flow.name}": ${error?.message ?? 'no row returned'}`)
      continue
    }
    const flowId = (row as { id: string }).id

    const { error: nodesErr } = await db.from('flow_nodes').insert(
      flow.nodes.map((n) => ({
        flow_id: flowId,
        node_key: n.node_key,
        node_type: n.node_type,
        config: n.config,
      })),
    )
    if (nodesErr) {
      // Don't leave an empty (possibly active) shell behind.
      await db.from('flows').delete().eq('id', flowId)
      report.warnings.push(`Could not create flow "${flow.name}": ${nodesErr.message}`)
      continue
    }
    report.created.flows.push(flow.name)
  }
}

async function installAutomations(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  kit: StarterKit,
  refs: KitRefs,
  report: KitInstallReport,
) {
  const names = await existingNames(db, 'automations', 'name', accountId)

  for (const auto of kit.automations) {
    if (names.has(key(auto.name))) {
      report.skipped.automations.push(auto.name)
      continue
    }
    const triggerConfig = resolveRefs(auto.trigger_config, refs)
    const steps = auto.steps.map((s) => ({
      step_type: s.step_type,
      step_config: resolveRefs(s.step_config, refs),
    }))

    let isActive = auto.is_active
    if (isActive) {
      const issues = [
        ...validateTriggerForActivation(auto.trigger_type, triggerConfig),
        ...validateStepsForActivation(steps),
      ]
      if (issues.length > 0) {
        isActive = false
        report.warnings.push(
          `"${auto.name}" was saved switched off: ${issues.map((i) => i.message).join('; ')}`,
        )
      }
    }

    const { data: row, error } = await db
      .from('automations')
      .insert({
        account_id: accountId,
        user_id: userId,
        name: auto.name,
        description: auto.description,
        trigger_type: auto.trigger_type,
        trigger_config: triggerConfig,
        is_active: isActive,
      })
      .select('id')
      .single()
    if (error || !row) {
      report.warnings.push(`Could not create automation "${auto.name}": ${error?.message ?? 'no row returned'}`)
      continue
    }
    const automationId = (row as { id: string }).id

    const stepErr = await insertSteps(automationId, steps as BuilderStepInput[])
    if (stepErr) {
      await db.from('automations').delete().eq('id', automationId)
      report.warnings.push(`Could not create automation "${auto.name}": ${stepErr}`)
      continue
    }
    report.created.automations.push(auto.name)
  }
}

async function installTemplates(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  kit: StarterKit,
  report: KitInstallReport,
) {
  const { data, error } = await db
    .from('message_templates')
    .select('name, language')
    .eq('account_id', accountId)
  if (error) {
    report.warnings.push(`Could not read message templates: ${error.message}`)
    return
  }
  const have = new Set(
    ((data ?? []) as { name: string; language: string | null }[]).map(
      (t) => `${t.name}|${t.language ?? ''}`,
    ),
  )

  for (const tpl of kit.templates) {
    if (have.has(`${tpl.name}|${tpl.language}`)) {
      report.skipped.templates.push(tpl.name)
      continue
    }
    // Saved as local drafts: submitting to Meta is a deliberate step
    // (it starts a review and can't be taken back), so the admin does
    // it from Settings → Templates with one click per template.
    const { error: insErr } = await db.from('message_templates').insert({
      account_id: accountId,
      user_id: userId,
      name: tpl.name,
      category: tpl.category,
      language: tpl.language,
      header_type: tpl.header_type ?? null,
      header_content: tpl.header_content ?? null,
      body_text: tpl.body_text,
      footer_text: tpl.footer_text ?? null,
      buttons: tpl.buttons ?? null,
      sample_values: tpl.sample_values ?? null,
      status: 'DRAFT',
    })
    if (insErr) {
      report.warnings.push(`Could not save template "${tpl.name}": ${insErr.message}`)
      continue
    }
    report.created.templates.push(tpl.name)
  }
}

async function installKnowledge(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  kit: StarterKit,
  report: KitInstallReport,
) {
  if (kit.knowledge.length === 0) return
  const titles = await existingNames(db, 'ai_knowledge_documents', 'title', accountId)
  const { key: embeddingsApiKey } = await loadEmbeddingsKey(db, accountId)

  for (const doc of kit.knowledge) {
    if (titles.has(key(doc.title))) {
      report.skipped.knowledge.push(doc.title)
      continue
    }
    const { data: row, error } = await db
      .from('ai_knowledge_documents')
      .insert({ account_id: accountId, created_by: userId, title: doc.title, content: doc.content })
      .select('id')
      .single()
    if (error || !row) {
      report.warnings.push(`Could not save knowledge "${doc.title}": ${error?.message ?? 'no row returned'}`)
      continue
    }
    try {
      await ingestDocument(db, accountId, { embeddingsApiKey }, (row as { id: string }).id, doc.content)
    } catch (err) {
      // ingestDocument stores the chunks before rethrowing an embedding
      // failure, so keyword search still works — say so, don't fail.
      report.warnings.push(
        `"${doc.title}" is saved but semantic indexing failed (${err instanceof Error ? err.message : String(err)}); keyword search still works.`,
      )
    }
    report.created.knowledge.push(doc.title)
  }
}

async function installQuickReplies(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  kit: StarterKit,
  report: KitInstallReport,
) {
  if (kit.quickReplies.length === 0) return
  const titles = await existingNames(db, 'quick_replies', 'title', accountId)
  for (const qr of kit.quickReplies) {
    if (titles.has(key(qr.title))) {
      report.skipped.quickReplies.push(qr.title)
      continue
    }
    const { error } = await db.from('quick_replies').insert({
      account_id: accountId,
      user_id: userId,
      title: qr.title,
      kind: 'text',
      content_text: qr.content_text,
    })
    if (error) {
      report.warnings.push(`Could not save quick reply "${qr.title}": ${error.message}`)
      continue
    }
    report.created.quickReplies.push(qr.title)
  }
}

async function applyAiPrompt(
  db: SupabaseClient,
  accountId: string,
  kit: StarterKit,
  report: KitInstallReport,
) {
  if (!kit.aiSystemPrompt) return
  const { data, error } = await db
    .from('ai_configs')
    .select('id, system_prompt')
    .eq('account_id', accountId)
    .maybeSingle()
  if (error || !data) return
  const current = (data as { system_prompt: string | null }).system_prompt
  if (current && current.trim()) return
  const { error: updErr } = await db
    .from('ai_configs')
    .update({ system_prompt: kit.aiSystemPrompt, updated_at: new Date().toISOString() })
    .eq('id', (data as { id: string }).id)
  if (updErr) {
    report.warnings.push(`Could not set the AI assistant's business prompt: ${updErr.message}`)
  }
}
