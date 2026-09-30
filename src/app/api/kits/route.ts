import { NextResponse } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { getStarterKit, listStarterKits } from '@/lib/kits/registry'

/**
 * GET /api/kits
 *
 * The starter-kit gallery (any member), each entry flagged `installed`
 * when every one of its flows already exists in the account — matched
 * by name, the same rule the installer uses to skip.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const { data, error } = await supabase
      .from('flows')
      .select('name')
      .eq('account_id', accountId)
    if (error) {
      return NextResponse.json({ error: 'Failed to load kits' }, { status: 500 })
    }
    const flowNames = new Set(
      ((data ?? []) as { name: string }[]).map((f) => f.name.trim().toLowerCase()),
    )

    const kits = listStarterKits().map((summary) => {
      const kit = getStarterKit(summary.slug)!
      const installed = kit.flows.every((f) => flowNames.has(f.name.trim().toLowerCase()))
      return { ...summary, installed }
    })
    return NextResponse.json({ kits })
  } catch (err) {
    return toErrorResponse(err)
  }
}
