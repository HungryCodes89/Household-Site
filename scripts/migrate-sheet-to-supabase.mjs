#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// One-shot: pull the current Google Sheet ledger into the Supabase
// `transactions` + `meta` tables.
//
// Idempotent: skips a row if one already exists with the same
// (occurred_at, kind, amount, description).
//
// Usage:
//   1. Make sure .env.local has:
//        NEXT_PUBLIC_SUPABASE_URL
//        SUPABASE_SERVICE_ROLE_KEY   (NOT the anon key — service role bypasses RLS)
//   2. node scripts/migrate-sheet-to-supabase.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── tiny .env.local loader (no extra dep) ───────────────────────────────────
function loadDotEnv(path) {
  if (!existsSync(path)) return
  const txt = readFileSync(path, 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
}
loadDotEnv(resolve(ROOT, '.env.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY')
  console.error('Add them to .env.local before running this script.')
  process.exit(1)
}

const SHEET_ID = '14P8O5_GYiAlmHM9j7jKQ-jmK4m9mj76QjNAV98FfPKE'
const GID = '145798617'
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`

// ── CSV parser (RFC-4180-ish) ───────────────────────────────────────────────
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') { q = false }
      else field += c
    } else {
      if (c === '"') q = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') {}
      else field += c
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

const parseMoney = s => {
  if (!s) return 0
  const n = parseFloat(String(s).replace(/[$,\s]/g, ''))
  return isNaN(n) ? 0 : n
}

const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}
const parseDate = s => {
  if (!s) return null
  const m = String(s).trim().toLowerCase().match(/^([a-z]{3})\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (!m) return null
  const mm = MONTHS[m[1]]
  if (!mm) return null
  return `${m[3]}-${mm}-${String(m[2]).padStart(2, '0')}`
}

// ── crude category bucket — same rules as lib/budget.ts ─────────────────────
const CATEGORY_RULES = [
  { name: 'Printing',  test: /print|firebird/i },
  { name: 'Shipping',  test: /ship|postage|mail/i },
  { name: 'Bank Fees', test: /acct|account|bank|fee/i },
  { name: 'Web',       test: /square ?space|domain|host|web/i },
  { name: 'Sales',     test: /sale|scotland|jamie|order|shop/i },
]
const categorize = d => CATEGORY_RULES.find(r => r.test.test(d))?.name ?? 'Other'

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('→ Fetching sheet…')
  const res = await fetch(SHEET_URL)
  if (!res.ok) { console.error(`Sheet fetch failed: ${res.status}`); process.exit(2) }
  const csv = await res.text()
  const grid = parseCsv(csv)
  if (grid.length < 2) { console.error('Empty sheet'); process.exit(2) }

  const dataRows = grid.slice(1).filter(r => r.some(c => c && c.trim() !== ''))
  console.log(`  Parsed ${dataRows.length} data rows`)

  // total_invested lives on the first data row, column 0
  const totalInvested = parseMoney(dataRows[0]?.[0] ?? '')
  console.log(`  Total invested: $${totalInvested.toFixed(2)}`)

  // Map sheet rows → transactions
  const txs = dataRows.map(r => {
    const date = parseDate(r[1] ?? '')
    const income = parseMoney(r[2] ?? '')
    const expense = parseMoney(r[3] ?? '')
    const description = (r[4] ?? '').trim()
    const balance = parseMoney(r[5] ?? '')

    // Pick the dominant kind. If a row somehow has both, prefer expense.
    let kind, amount
    if (expense > 0) { kind = 'expense'; amount = expense }
    else             { kind = 'income';  amount = income }

    return { occurred_at: date, kind, amount, description, category: categorize(description), balance }
  }).filter(t => t.occurred_at && t.amount > 0)

  console.log(`  Built ${txs.length} valid transactions`)

  const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Update meta.total_invested
  const { error: metaErr } = await supa.from('meta').update({ total_invested: totalInvested }).eq('id', 1)
  if (metaErr) { console.error('meta update failed:', metaErr.message); process.exit(3) }
  console.log('✓ meta.total_invested set')

  // Idempotent insert: only add rows that aren't already there
  let added = 0, skipped = 0
  for (const t of txs) {
    const { data: existing, error: selErr } = await supa
      .from('transactions')
      .select('id')
      .eq('occurred_at', t.occurred_at)
      .eq('kind', t.kind)
      .eq('amount', t.amount)
      .eq('description', t.description)
      .limit(1)

    if (selErr) { console.error('select failed:', selErr.message); process.exit(4) }

    if (existing && existing.length > 0) { skipped++; continue }

    const { error: insErr } = await supa.from('transactions').insert(t)
    if (insErr) { console.error('insert failed:', insErr.message, t); process.exit(5) }
    added++
  }

  console.log(`✓ ${added} inserted, ${skipped} skipped (already present)`)
  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(99) })
