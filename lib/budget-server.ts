import { createClient } from '@/lib/supabase/server'
import type { BudgetData, LedgerRow, TransactionItem } from '@/lib/budget'

// Server-only: pulls transactions + items + meta from Supabase, computes
// derived fields (running balance, totals, items grouping), shapes into
// BudgetData for the dashboard.
export async function loadBudget(): Promise<BudgetData | { error: string }> {
  const supabase = createClient()

  const [txRes, itemsRes, metaRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, occurred_at, kind, amount, description, category')
      .order('occurred_at', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('transaction_items')
      .select('id, transaction_id, item_name, quantity, unit_price, notes')
      .order('created_at', { ascending: true }),
    supabase.from('meta').select('total_invested').eq('id', 1).single(),
  ])

  if (txRes.error) return { error: `transactions: ${txRes.error.message}` }
  if (itemsRes.error) return { error: `transaction_items: ${itemsRes.error.message}` }
  if (metaRes.error && metaRes.error.code !== 'PGRST116') {
    return { error: `meta: ${metaRes.error.message}` }
  }

  const totalInvested = Number(metaRes.data?.total_invested ?? 0)

  const itemsByTx = new Map<string, TransactionItem[]>()
  for (const it of itemsRes.data ?? []) {
    const unitPrice = Number(it.unit_price)
    const arr = itemsByTx.get(it.transaction_id) ?? []
    arr.push({
      id: it.id,
      item_name: it.item_name,
      quantity: it.quantity,
      unit_price: unitPrice,
      line_total: it.quantity * unitPrice,
      notes: it.notes,
    })
    itemsByTx.set(it.transaction_id, arr)
  }

  // Compute running balance: starts at 0 and walks the ledger.
  // (The starting balance from the sheet was a snapshot from before the
  // visible period — total_invested captures the lifetime capital separately.)
  let running = 0
  const rows: LedgerRow[] = (txRes.data ?? []).map(t => {
    const income = t.kind === 'income' ? Number(t.amount) : 0
    const expenses = t.kind === 'expense' ? Number(t.amount) : 0
    running = running + income - expenses
    const items = itemsByTx.get(t.id) ?? []
    const itemsTotal = items.reduce((s, it) => s + it.line_total, 0)
    return {
      id: t.id,
      date: t.occurred_at,
      iso: t.occurred_at,
      income,
      expenses,
      description: t.description ?? '',
      balance: running,
      category: t.category ?? undefined,
      items,
      itemsTotal,
      hasItems: items.length > 0,
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
