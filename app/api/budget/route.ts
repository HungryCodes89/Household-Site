import { NextResponse } from 'next/server'
import { loadBudget } from '@/lib/budget-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const data = await loadBudget()
  if ('error' in data) {
    return NextResponse.json(data, { status: 500 })
  }
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
