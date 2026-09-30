import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { installStarterKit } from '@/lib/kits/install'
import { getStarterKit } from '@/lib/kits/registry'

/**
 * POST /api/kits/[slug]/install  (admin+)
 *
 * Creates the kit's tags, pipeline, flows, automations, draft message
 * templates, knowledge docs and quick replies in the caller's account.
 * Admin because it writes settings-class rows (templates, knowledge,
 * the AI prompt) whose RLS policies require admin; the service-role
 * client below bypasses RLS, so the role is enforced here.
 *
 * Safe to call twice — anything that already exists by name is left
 * alone and reported under `skipped`.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const { accountId, userId } = await requireRole('admin')

    const limit = checkRateLimit(`kit-install:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const kit = getStarterKit(slug)
    if (!kit) {
      return NextResponse.json({ error: `Unknown kit "${slug}"` }, { status: 404 })
    }

    try {
      const report = await installStarterKit({ db: supabaseAdmin(), accountId, userId, kit })
      return NextResponse.json({ report })
    } catch (err) {
      console.error('[kits/install] failed:', err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Install failed' },
        { status: 500 },
      )
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}
