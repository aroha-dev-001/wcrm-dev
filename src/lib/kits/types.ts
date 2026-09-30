/**
 * Starter kits — a whole business setup (tags, pipeline, flows,
 * automations, message templates, AI knowledge, quick replies) that an
 * admin installs with one click instead of wiring each piece by hand.
 *
 * Kits are static modules, like the flow and automation template
 * galleries, but they reach across tables — a flow's "Tag contact" node
 * needs a tag id and an automation's "Create deal" step needs a
 * pipeline + stage id, none of which exist until install time. So kit
 * content references those by NAME (`tag_name`, `pipeline_name`,
 * `stage_name`) and the installer swaps in the ids it created or found
 * (see `resolveRefs` in ./install.ts).
 */

import type {
  AutomationStepType,
  AutomationTriggerType,
  MessageTemplate,
  TemplateButton,
  TemplateSampleValues,
} from '@/types'
import type { FlowFallbackPolicy, FlowNodeType } from '@/lib/flows/types'

export interface KitTag {
  name: string
  /** Hex colour, same palette the tag manager offers. */
  color: string
}

export interface KitPipeline {
  name: string
  stages: { name: string; color: string }[]
}

export interface KitFlowNode {
  node_key: string
  node_type: FlowNodeType
  /** Same shape as `flow_nodes.config`, except a set_tag node carries
   *  `tag_name` instead of `tag_id`. */
  config: Record<string, unknown>
}

export interface KitFlow {
  name: string
  description: string
  trigger_type: 'keyword' | 'first_inbound_message'
  trigger_config: Record<string, unknown>
  entry_node_id: string
  fallback_policy?: FlowFallbackPolicy
  nodes: KitFlowNode[]
}

export interface KitAutomationStep {
  step_type: AutomationStepType
  /** Same shape as `automation_steps.step_config`, except tag steps
   *  carry `tag_name` and create_deal carries `pipeline_name` +
   *  `stage_name`. */
  step_config: Record<string, unknown>
}

export interface KitAutomation {
  name: string
  description: string
  trigger_type: AutomationTriggerType
  /** tag_added triggers carry `tag_name` instead of `tag_id`. */
  trigger_config: Record<string, unknown>
  is_active: boolean
  steps: KitAutomationStep[]
}

export interface KitMessageTemplate {
  name: string
  category: MessageTemplate['category']
  language: string
  header_type?: 'text'
  header_content?: string
  body_text: string
  footer_text?: string
  buttons?: TemplateButton[]
  sample_values?: TemplateSampleValues
}

export interface KitKnowledgeDoc {
  title: string
  content: string
}

export interface KitQuickReply {
  title: string
  content_text: string
}

export interface StarterKit {
  slug: string
  name: string
  /** One line for the gallery card. */
  tagline: string
  /** Short paragraph shown in the install dialog. */
  description: string
  /** Messages a presenter can send from their phone to try the kit. */
  tryIt: { send: string; expect: string }[]
  tags: KitTag[]
  pipeline: KitPipeline
  flows: KitFlow[]
  automations: KitAutomation[]
  templates: KitMessageTemplate[]
  knowledge: KitKnowledgeDoc[]
  quickReplies: KitQuickReply[]
  /** Applied to the AI assistant only if one is configured and its
   *  business prompt is still empty — never overwrites the admin's. */
  aiSystemPrompt?: string
}

/** What the gallery needs — no node trees or message bodies. */
export interface StarterKitSummary {
  slug: string
  name: string
  tagline: string
  description: string
  tryIt: StarterKit['tryIt']
  counts: {
    flows: number
    automations: number
    tags: number
    templates: number
    knowledge: number
    quickReplies: number
    stages: number
  }
}

export interface KitInstallReport {
  created: Record<KitSection, string[]>
  /** Already present (matched by name), left untouched. */
  skipped: Record<KitSection, string[]>
  /** Non-fatal problems, e.g. a flow saved as draft because it didn't
   *  validate, or knowledge that couldn't be indexed. */
  warnings: string[]
}

export type KitSection =
  | 'tags'
  | 'pipeline'
  | 'flows'
  | 'automations'
  | 'templates'
  | 'knowledge'
  | 'quickReplies'
