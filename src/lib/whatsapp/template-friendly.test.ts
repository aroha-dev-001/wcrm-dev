import { describe, expect, it } from 'vitest'

import {
  fillPlaceholders,
  humanizeTemplateName,
  nextVariableNumber,
  renumberVariables,
  TEMPLATE_EXAMPLES,
  toTemplateName,
} from './template-friendly'
import { validateTemplatePayload } from './template-validators'

describe('template names', () => {
  it('turns a typed label into a valid Meta name', () => {
    expect(toTemplateName('Order confirmation')).toBe('order_confirmation')
    expect(toTemplateName('  Diwali Offer 2026! ')).toBe('diwali_offer_2026')
    expect(toTemplateName('follow-up')).toBe('follow_up')
  })

  it('round-trips a stored name through its display label', () => {
    for (const name of ['bloom_welcome', 'order_confirmation_2', 'a']) {
      expect(toTemplateName(humanizeTemplateName(name))).toBe(name)
    }
    expect(humanizeTemplateName('bloom_quote_followup')).toBe('Bloom quote followup')
  })
})

describe('renumberVariables', () => {
  it('closes gaps left by a deleted detail', () => {
    expect(renumberVariables('Hi {{1}}, order {{3}} ships {{4}}')).toBe(
      'Hi {{1}}, order {{2}} ships {{3}}',
    )
  })

  it('keeps ascending numbering so aligned samples stay valid', () => {
    expect(renumberVariables('{{5}} then {{2}} then {{5}}')).toBe('{{2}} then {{1}} then {{2}}')
  })

  it('leaves already-contiguous text untouched', () => {
    expect(renumberVariables('Hi {{1}} {{2}}')).toBe('Hi {{1}} {{2}}')
    expect(renumberVariables('No details')).toBe('No details')
  })
})

describe('fillPlaceholders', () => {
  it('fills each number from the sample aligned to it', () => {
    expect(fillPlaceholders('Hi {{1}}, order {{3}}', ['Ravi', 'BB-1'])).toBe('Hi Ravi, order BB-1')
  })

  it('shows a marker for a missing sample', () => {
    expect(fillPlaceholders('Hi {{1}}, {{2}}', ['Ravi', ' '])).toBe('Hi Ravi, [2]')
  })
})

describe('nextVariableNumber', () => {
  it('is one past the highest number used', () => {
    expect(nextVariableNumber('none')).toBe(1)
    expect(nextVariableNumber('{{1}} {{4}}')).toBe(5)
  })
})

describe('TEMPLATE_EXAMPLES', () => {
  it.each(TEMPLATE_EXAMPLES.map((e) => [e.title, e] as const))(
    '"%s" is ready to submit as-is',
    (_title, e) => {
      expect(() =>
        validateTemplatePayload({
          name: toTemplateName(e.title),
          category: e.category,
          language: 'en',
          body_text: e.body,
          footer_text: e.footer,
          buttons: e.quickReplies?.map((text) => ({ type: 'QUICK_REPLY' as const, text })),
          sample_values: { body: e.samples },
        }),
      ).not.toThrow()
    },
  )
})
