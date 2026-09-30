import { BLOOM_BIOTECH_KIT } from './bloom-biotech'
import type { StarterKit, StarterKitSummary } from './types'

const KITS: Record<string, StarterKit> = {
  [BLOOM_BIOTECH_KIT.slug]: BLOOM_BIOTECH_KIT,
}

export function getStarterKit(slug: string): StarterKit | null {
  return KITS[slug] ?? null
}

export function listStarterKits(): StarterKitSummary[] {
  return Object.values(KITS).map((kit) => ({
    slug: kit.slug,
    name: kit.name,
    tagline: kit.tagline,
    description: kit.description,
    tryIt: kit.tryIt,
    counts: {
      flows: kit.flows.length,
      automations: kit.automations.length,
      tags: kit.tags.length,
      templates: kit.templates.length,
      knowledge: kit.knowledge.length,
      quickReplies: kit.quickReplies.length,
      stages: kit.pipeline.stages.length,
    },
  }))
}
