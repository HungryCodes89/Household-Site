import DashboardClient from './dashboard-client'
import { SHEET_CSV_URL, parseBudgetCsv, type BudgetData } from '@/lib/budget'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getBudget(): Promise<BudgetData | { error: string }> {
  try {
    const res = await fetch(SHEET_CSV_URL, { next: { revalidate: 300 } })
    if (!res.ok) return { error: `Sheet fetch failed: ${res.status}` }
    const csv = await res.text()
    return parseBudgetCsv(csv)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'fetch error' }
  }
}

export default async function DashboardPage() {
  const data = await getBudget()
  return <DashboardClient data={data} />
}
