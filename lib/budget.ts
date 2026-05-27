export type LedgerRow = {
  date: string          // raw / display date
  iso: string | null    // YYYY-MM-DD
  income: number
  expenses: number
  description: string
  balance: number
  category?: string
}

export type BudgetData = {
  totalInvested: number
  currentBalance: number
  totalIncome: number
  totalExpenses: number
  net: number
  rows: LedgerRow[]
  generatedAt: string
}

// Categorize a description into a bucket. Order matters — first match wins.
const CATEGORY_RULES: Array<{ name: string; test: RegExp }> = [
  { name: 'Printing',  test: /print|firebird/i },
  { name: 'Shipping',  test: /ship|postage|mail/i },
  { name: 'Bank Fees', test: /acct|account|bank|fee/i },
  { name: 'Web',       test: /square ?space|domain|host|web/i },
  { name: 'Sales',     test: /sale|scotland|jamie|order|shop/i },
]
export function categorize(description: string): string {
  for (const r of CATEGORY_RULES) if (r.test.test(description)) return r.name
  return 'Other'
}

// Pretty date for display: "2026-05-23" → "May 23 2026"
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export function formatDisplayDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${MONTH_NAMES[m - 1]} ${d} ${y}`
}
