import DashboardClient from './dashboard-client'
import { loadBudget } from '@/lib/budget-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const data = await loadBudget()
  return <DashboardClient data={data} />
}
