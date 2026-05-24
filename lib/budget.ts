export type LedgerRow = {
  date: string
  iso: string | null
  income: number
  expenses: number
  description: string
  balance: number
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

export const SHEET_ID = '14P8O5_GYiAlmHM9j7jKQ-jmK4m9mj76QjNAV98FfPKE'
export const SHEET_GID = '145798617'
export const SHEET_CSV_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') { inQuotes = false }
      else { field += c }
    } else {
      if (c === '"') { inQuotes = true }
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else { field += c }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

function parseMoney(s: string): number {
  if (!s) return 0
  const n = parseFloat(s.replace(/[$,\s]/g, ''))
  return isNaN(n) ? 0 : n
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}
function parseDate(s: string): string | null {
  if (!s) return null
  const m = s.trim().toLowerCase().match(/^([a-z]{3})\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (!m) return null
  const mm = MONTHS[m[1]]
  if (!mm) return null
  return `${m[3]}-${mm}-${String(m[2]).padStart(2, '0')}`
}

export function parseBudgetCsv(csv: string): BudgetData {
  const grid = parseCsv(csv)
  const dataRows = grid.slice(1).filter(r => r.some(c => c && c.trim() !== ''))

  const rows: LedgerRow[] = dataRows.map(r => ({
    date: r[1] ?? '',
    iso: parseDate(r[1] ?? ''),
    income: parseMoney(r[2] ?? ''),
    expenses: parseMoney(r[3] ?? ''),
    description: r[4] ?? '',
    balance: parseMoney(r[5] ?? ''),
  }))

  const totalInvested = parseMoney(dataRows[0]?.[0] ?? '')
  const currentBalance = rows.length ? rows[rows.length - 1].balance : 0
  const totalIncome = rows.reduce((s, r) => s + r.income, 0)
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0)

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
