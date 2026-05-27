import { createClient } from '@/lib/supabase/server'
import type { BudgetData, LedgerRow } from '@/lib/budget'

// Server-only: pulls transactions + meta from Supabase, computes derived
// fields (running balance, totals), shapes into BudgetData for the dashboard.
export async function loadBudget(): Promise<BudgetData | { error: string }> {
  const supabase = createClient()

  const [txRes, metaRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, occurred_at, kind, amount, description, category')
      .order('occurred_at', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('meta').select('total_invested').eq('id', 1).single(),
  ])

  if (txRes.error) return { error: `transactions: ${txRes.error.message}` }
  if (metaRes.error && metaRes.error.code !== 'PGRST116') {
    return { error: `meta: ${metaRes.error.message}` }
  }

  const totalInvested = Number(metaRes.data?.total_invested ?? 0)

  // Compute running balance: starts at 0 and walks the ledger.
  // (The starting balance from the sheet was a snapshot from before the
  // visible period — total_invested captures the lifetime capital separately.)
  let running = 0
  const rows: LedgerRow[] = (txRes.data ?? []).map(t => {
    const income = t.kind === 'income' ? Number(t.amount) : 0
    const expenses = t.kind === 'expense' ? Number(t.amount) : 0
    running = running + income - expenses
    return {
      date: t.occurred_at,
      iso: t.occurred_at,
      income,
      expenses,
      description: t.description ?? '',
      balance: running,
      category: t.category ?? undefined,
    }
  })

  // Opening-balance rows are carried-forward cash, not real income/expense —
  // exclude from totals but keep in the running-balance walk above.
  const totalIncome = rows.reduce(
    (s, r) => r.category === 'Opening Balance' ? s : s + r.income,
    0,
  )
  const totalExpenses = rows.reduce(
    (s, r) => r.category === 'Opening Balance' ? s : s + r.expenses,
    0,
  )
  const currentBalance = rows.length ? rows[rows.length - 1].balance : 0

  return {
    totalInvested,
    currentBalance,
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
    rows,
    generatedAt: new Date().toISOString(),
  }
}
