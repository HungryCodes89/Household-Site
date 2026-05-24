import { NextResponse } from 'next/server'
import { SHEET_CSV_URL, parseBudgetCsv } from '@/lib/budget'

export const revalidate = 300

export async function GET() {
  try {
    const res = await fetch(SHEET_CSV_URL, { next: { revalidate: 300 } })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Sheet fetch failed: ${res.status}` },
        { status: 502 },
      )
    }
    const csv = await res.text()
    const data = parseBudgetCsv(csv)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
