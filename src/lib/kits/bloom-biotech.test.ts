import { describe, expect, it } from 'vitest'

import { BLOOM_BIOTECH_KIT as kit } from './bloom-biotech'
import { resolveFlow, resolveRefs, type KitRefs } from './install'
import { validateFlowForActivation } from '@/lib/flows/validate'
import { matchesKeywordTrigger } from '@/lib/flows/engine'
import type { KeywordTriggerConfig } from '@/lib/flows/types'
import {
  validateStepsForActivation,
  validateTriggerForActivation,
} from '@/lib/automations/validate'
import { validateTemplatePayload } from '@/lib/whatsapp/template-validators'
import { INTERACTIVE_LIMITS } from '@/lib/whatsapp/meta-api'

// ------------------------------------------------------------
// The kit is installed straight into a live account and its flows go
// active immediately, so every piece must pass the same validators the
// builders and the Meta submit route use — and the keyword routing
// must send the demo's messages to the right flow.
// ------------------------------------------------------------

/** Refs as the installer would build them, every kit name resolved. */
function fakeRefs(): KitRefs {
  return {
    tags: new Map(kit.tags.map((t) => [t.name.toLowerCase(), `tag-${t.name}`])),
    pipelineId: 'pipeline-1',
    stages: new Map(kit.pipeline.stages.map((s) => [s.name.toLowerCase(), `stage-${s.name}`])),
  }
}

describe('Bloom Biotech kit — flows', () => {
  it.each(kit.flows.map((f) => [f.name, f] as const))(
    '%s passes activation validation with no warnings',
    (_name, kitFlow) => {
      const flow = resolveFlow(kitFlow, fakeRefs())
      const issues = validateFlowForActivation(
        {
          name: flow.name,
          trigger_type: flow.trigger_type,
          trigger_config: flow.trigger_config,
          entry_node_id: flow.entry_node_id,
        },
        flow.nodes,
      )
      expect(issues).toEqual([])
    },
  )

  it('every tag a flow sets is a kit tag', () => {
    const tagNames = new Set(kit.tags.map((t) => t.name))
    for (const flow of kit.flows) {
      for (const node of flow.nodes.filter((n) => n.node_type === 'set_tag')) {
        expect(tagNames).toContain(node.config.tag_name)
      }
    }
  })

  it('keeps every customer-facing body within WhatsApp limits', () => {
    for (const flow of kit.flows) {
      for (const node of flow.nodes) {
        const c = node.config as { text?: string; prompt_text?: string; footer_text?: string }
        if (node.node_type === 'send_buttons' || node.node_type === 'send_list') {
          expect(c.text!.length).toBeLessThanOrEqual(INTERACTIVE_LIMITS.bodyMaxLength)
        }
        if (node.node_type === 'send_message') {
          expect(c.text!.length).toBeLessThanOrEqual(4096)
        }
        if (c.footer_text) {
          expect(c.footer_text.length).toBeLessThanOrEqual(INTERACTIVE_LIMITS.footerMaxLength)
        }
      }
    }
  })

  // The order the webhook tries them in: creation order = kit order.
  function routeTo(text: string, isFirstInbound = false): string | null {
    let fallback: string | null = null
    for (const flow of kit.flows) {
      const cfg = flow.trigger_config as unknown as KeywordTriggerConfig
      if (matchesKeywordTrigger(text, cfg)) return flow.name
      if (isFirstInbound && cfg.also_on_first_message) fallback ??= flow.name
    }
    return fallback
  }

  it.each([
    ['Hi', 'Bloom · Welcome menu'],
    ['hello!', 'Bloom · Welcome menu'],
    ['Namaskara', 'Bloom · Welcome menu'],
    ['products', 'Bloom · Product enquiry'],
    ['What is the price of Bio Astra?', 'Bloom · Product enquiry'],
    ['hi, I want to order', 'Bloom · Product enquiry'],
    ['I want a dealership', 'Bloom · Dealer & bulk enquiry'],
    ['hi, can I become a distributor?', 'Bloom · Dealer & bulk enquiry'],
  ])('routes "%s" to %s', (text, flow) => {
    expect(routeTo(text)).toBe(flow)
  })

  it('does not fire the welcome menu on words that merely contain "hi"', () => {
    expect(routeTo('which one is best for coffee?')).toBeNull()
    expect(routeTo('this is great')).toBeNull()
  })

  it("greets a new customer's first message even without a keyword", () => {
    expect(routeTo('Good morning', true)).toBe('Bloom · Welcome menu')
    expect(routeTo('Good morning', false)).toBeNull()
  })
})

describe('Bloom Biotech kit — automations', () => {
  it.each(kit.automations.map((a) => [a.name, a] as const))(
    '%s validates once references resolve',
    (_name, auto) => {
      const refs = fakeRefs()
      const steps = auto.steps.map((s) => ({
        step_type: s.step_type,
        step_config: resolveRefs(s.step_config, refs),
      }))
      expect([
        ...validateTriggerForActivation(auto.trigger_type, resolveRefs(auto.trigger_config, refs)),
        ...validateStepsForActivation(steps),
      ]).toEqual([])
    },
  )

  it('never adds a per-message responder, so the AI assistant stays available', () => {
    // The AI auto-reply stands down whenever an active
    // new_message_received / keyword_match automation exists.
    for (const auto of kit.automations) {
      expect(['new_message_received', 'keyword_match']).not.toContain(auto.trigger_type)
    }
  })
})

describe('Bloom Biotech kit — message templates', () => {
  it.each(kit.templates.map((t) => [t.name, t] as const))('%s passes Meta pre-flight', (_n, tpl) => {
    expect(() => validateTemplatePayload(tpl)).not.toThrow()
  })
})
