/**
 * Helpers that let the template editor speak plain language while the
 * stored template keeps Meta's exact format:
 *
 *   - a name typed as "Order confirmation" is saved as
 *     `order_confirmation` (Meta allows only a-z, 0-9 and _);
 *   - personal details are inserted as chips, and whatever numbers the
 *     body ends up with are renumbered to the contiguous {{1}}, {{2}}…
 *     Meta requires, so deleting a detail never breaks submission;
 *   - the preview fills each {{n}} with its example value.
 */

import { extractVariableIndices } from './template-validators'

/** "Order confirmation 2" → "order_confirmation_2". */
export function toTemplateName(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[\s-]/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

/** "order_confirmation" → "Order confirmation" (display only). */
export function humanizeTemplateName(name: string): string {
  const spaced = name.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Renumber `{{n}}` placeholders so the distinct numbers present become
 * 1..k in ascending order ("{{2}} {{5}}" → "{{1}} {{2}}"). Ascending —
 * not order of appearance — because sample values are kept aligned to
 * the sorted indices (see `extractVariableIndices`), so the samples
 * array stays valid unchanged.
 */
export function renumberVariables(text: string): string {
  const indices = extractVariableIndices(text)
  const mapping = new Map(indices.map((n, i) => [n, i + 1]))
  return text.replace(/\{\{(\d+)\}\}/g, (whole, raw: string) => {
    const next = mapping.get(Number(raw))
    return next ? `{{${next}}}` : whole
  })
}

/**
 * Replace each `{{n}}` with its example value for the preview. `samples`
 * is aligned to the sorted distinct indices, matching the editor's
 * sample rows; a missing sample renders as `[n]`.
 */
export function fillPlaceholders(text: string, samples: string[]): string {
  const indices = extractVariableIndices(text)
  const byIndex = new Map(indices.map((n, i) => [n, samples[i]?.trim() ?? '']))
  return text.replace(/\{\{(\d+)\}\}/g, (_, raw: string) => {
    const value = byIndex.get(Number(raw))
    return value ? value : `[${raw}]`
  })
}

/** The next free placeholder number for a body. */
export function nextVariableNumber(text: string): number {
  const indices = extractVariableIndices(text)
  return indices.length === 0 ? 1 : indices[indices.length - 1] + 1
}

/** Personal details offered as one-tap chips, with a review example. */
export const VARIABLE_PRESETS = [
  { key: 'name', example: 'Ravi' },
  { key: 'product', example: 'Bio Sanjiveeni' },
  { key: 'order', example: 'BB-1024' },
  { key: 'date', example: '12 October' },
  { key: 'amount', example: '₹2,500' },
  { key: 'other', example: '' },
] as const

export type VariablePresetKey = (typeof VARIABLE_PRESETS)[number]['key']

/**
 * Languages by name. Values are Meta's codes (which must match exactly
 * — `en` and `en_US` are different templates on Meta's side).
 */
export const TEMPLATE_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'hi', label: 'Hindi · हिन्दी' },
  { code: 'kn', label: 'Kannada · ಕನ್ನಡ' },
  { code: 'ta', label: 'Tamil · தமிழ்' },
  { code: 'te', label: 'Telugu · తెలుగు' },
  { code: 'ml', label: 'Malayalam · മലയാളം' },
  { code: 'mr', label: 'Marathi · मराठी' },
  { code: 'bn', label: 'Bengali · বাংলা' },
  { code: 'gu', label: 'Gujarati · ગુજરાતી' },
  { code: 'pa', label: 'Punjabi · ਪੰਜਾਬੀ' },
  { code: 'ur', label: 'Urdu · اردو' },
  { code: 'es', label: 'Spanish · Español' },
  { code: 'es_ES', label: 'Spanish (Spain)' },
  { code: 'es_MX', label: 'Spanish (Mexico)' },
  { code: 'pt_BR', label: 'Portuguese (Brazil)' },
  { code: 'pt_PT', label: 'Portuguese (Portugal)' },
  { code: 'fr', label: 'French · Français' },
  { code: 'de', label: 'German · Deutsch' },
  { code: 'it', label: 'Italian · Italiano' },
  { code: 'nl', label: 'Dutch · Nederlands' },
  { code: 'pl', label: 'Polish · Polski' },
  { code: 'ru', label: 'Russian · Русский' },
  { code: 'tr', label: 'Turkish · Türkçe' },
  { code: 'lt', label: 'Lithuanian · Lietuvių' },
  { code: 'ar', label: 'Arabic · العربية' },
  { code: 'id', label: 'Indonesian · Bahasa Indonesia' },
  { code: 'ko', label: 'Korean · 한국어' },
]

export interface TemplateExample {
  /** Suggested name; the user can change it. */
  title: string
  category: 'Marketing' | 'Utility'
  body: string
  samples: string[]
  /** What each {{n}} is, in order — labels the example-value rows. */
  details: VariablePresetKey[]
  footer?: string
  quickReplies?: string[]
}

/** "Start from an example" — ready-to-submit bodies, samples filled. */
export const TEMPLATE_EXAMPLES: TemplateExample[] = [
  {
    title: 'Welcome new customer',
    category: 'Marketing',
    body: 'Hi {{1}} 👋 Thanks for connecting with us! Reply to this message any time and our team will be happy to help.',
    samples: ['Ravi'],
    details: ['name'],
    quickReplies: ['Show me products'],
  },
  {
    title: 'Order confirmed',
    category: 'Utility',
    body: 'Hi {{1}}, your order {{2}} is confirmed ✅ We will message you here as soon as it is dispatched.',
    samples: ['Ravi', 'BB-1024'],
    details: ['name', 'order'],
  },
  {
    title: 'Payment reminder',
    category: 'Utility',
    body: 'Hi {{1}}, a friendly reminder that your payment of {{2}} is due on {{3}}. Reply here if you have any questions.',
    samples: ['Ravi', '₹2,500', '12 October'],
    details: ['name', 'amount', 'date'],
  },
  {
    title: 'Special offer',
    category: 'Marketing',
    body: 'Hi {{1}} 🎉 This week only: {{2}}. Reply to this message to place your order.',
    samples: ['Ravi', '10% off on all products'],
    details: ['name', 'other'],
    footer: 'Reply STOP to opt out',
  },
  {
    title: 'Follow up',
    category: 'Marketing',
    body: 'Hi {{1}}, just checking in — do you have any questions about {{2}}? We are happy to help.',
    samples: ['Ravi', 'our products'],
    details: ['name', 'product'],
    quickReplies: ['Yes, call me', 'No, thanks'],
  },
  {
    title: 'Appointment reminder',
    category: 'Utility',
    body: 'Hi {{1}}, this is a reminder of your visit on {{2}} at {{3}}. Reply here if you need to reschedule.',
    samples: ['Ravi', '12 October', '10:30 AM'],
    details: ['name', 'date', 'other'],
  },
]
