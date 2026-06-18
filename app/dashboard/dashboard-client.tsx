'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { categorize, type BudgetData, type LedgerRow, type TransactionItem } from '@/lib/budget'
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
  addTransactionItem,
  updateTransactionItem,
  deleteTransactionItem,
  type ItemInput,
  type TransactionInput,
} from './actions'
import LogoutButton from './logout-button'
import './dashboard.css'

type Props = { data: BudgetData | { error: string } }

export default function DashboardClient({ data }: Props) {
  if ('error' in data) {
    return (
      <main className="dash-shell">
        <div className="dash-grid" aria-hidden="true" />
        <div className="dash-grain" aria-hidden="true" />
        <div className="dash-error">
          <div className="dash-error-tag">SIGNAL LOST</div>
          <div className="dash-error-msg">{data.error}</div>
          <Link href="/" className="dash-error-back">[ Return to entrance ]</Link>
        </div>
      </main>
    )
  }

  return <Dashboard data={data} />
}

type LedgerView = 'overview' | 'income' | 'expense'

function Dashboard({ data }: { data: BudgetData }) {
  const { totalInvested, currentBalance, totalIncome, totalExpenses, net, rows } = data
  const [view, setView] = useState<LedgerView>('overview')
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.iso ?? '').localeCompare(b.iso ?? '')),
    [rows],
  )
  const recent = useMemo(() => [...sorted].reverse(), [sorted])

  // Ledger rows filtered by the active KPI view (newest first).
  const ledgerRows = useMemo(() => {
    if (view === 'income') return recent.filter(r => r.income > 0)
    if (view === 'expense') return recent.filter(r => r.expenses > 0)
    return recent
  }, [recent, view])

  const ledgerMeta = useMemo(() => {
    if (view === 'income') return { title: 'Income', sum: totalIncome, prefix: '+$' }
    if (view === 'expense') return { title: 'Expenses', sum: totalExpenses, prefix: '−$' }
    return { title: 'Overview · All Entries', sum: net, prefix: net >= 0 ? '+$' : '−$' }
  }, [view, totalIncome, totalExpenses, net])

  // Category breakdown — totals income/expense per bucket
  const categories = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number }>()
    for (const r of rows) {
      const c = categorize(r.description)
      const cur = map.get(c) ?? { income: 0, expenses: 0 }
      cur.income += r.income
      cur.expenses += r.expenses
      map.set(c, cur)
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, total: v.income + v.expenses }))
      .sort((a, b) => b.total - a.total)
  }, [rows])

  // 30-day burn (avg daily net over last 30d of activity) and runway
  const { burn, runway } = useMemo(() => {
    if (sorted.length === 0) return { burn: 0, runway: Infinity }
    const last = sorted[sorted.length - 1].iso
    const first = sorted[0].iso
    if (!last || !first) return { burn: 0, runway: Infinity }
    const days = Math.max(1, daysBetween(first, last))
    const dailyNet = (totalIncome - totalExpenses) / days
    const burn = -dailyNet // positive number means losing money per day
    const runway = burn > 0 ? currentBalance / burn / 30 : Infinity
    return { burn, runway }
  }, [sorted, totalIncome, totalExpenses, currentBalance])

  return (
    <main className="dash-shell">
      <div className="dash-grid" aria-hidden="true" />
      <div className="dash-grain" aria-hidden="true" />
      <div className="dash-scan" aria-hidden="true" />

      <Corner pos="tl" /> <Corner pos="tr" />
      <Corner pos="bl" /> <Corner pos="br" />

      <Header />

      <section className="dash-body">
        <div className="dash-kpis">
          <Kpi label="Overview"         value={rows.length}    suffix=" entries" tone="cream" fixed={0} hint="all data" onClick={() => setView('overview')} active={view === 'overview'} />
          <Kpi label="Account Balance"   value={currentBalance} prefix="$" tone="neon"   hint="current · view all" live onClick={() => setView('overview')} active={view === 'overview'} />
          <Kpi label="Income · Period"   value={totalIncome}    prefix="+$" tone="green"  hint={`${rows.filter(r => r.income > 0).length} entries · filter`} onClick={() => setView('income')} active={view === 'income'} />
          <Kpi label="Expenses · Period" value={totalExpenses}  prefix="-$" tone="amber"  hint={`${rows.filter(r => r.expenses > 0).length} entries · filter`} onClick={() => setView('expense')} active={view === 'expense'} />
          <Kpi label="Net · Period"      value={net}            prefix={net >= 0 ? '+$' : '-$'} absValue tone={net >= 0 ? 'green' : 'red'} hint="income − expenses" />
          <Kpi label="Cash Runway"       value={isFinite(runway) ? runway : 0} suffix=" mo" tone={isFinite(runway) ? 'neon' : 'cream'} hint={isFinite(runway) ? `@ $${burn.toFixed(2)}/day burn` : 'positive cashflow'} fixed={1} infinity={!isFinite(runway)} />
        </div>

        <div className="dash-row">
          <Panel title="Add Entry" tag="QUICK ADD">
            <AddEntryForm />
          </Panel>
        </div>

        <div className="dash-row">
          <Panel title="Balance Trajectory" tag="LIVE PLOT">
            <BalanceChart rows={sorted} />
          </Panel>
        </div>

        <div className="dash-row dash-row-split">
          <Panel title="Categories" tag="ALLOCATION">
            <CategoryBars cats={categories} />
          </Panel>
          <Panel
            title={ledgerMeta.title}
            tag={`${ledgerRows.length} · ${ledgerMeta.prefix}${fmt(Math.abs(ledgerMeta.sum), 2)}`}
          >
            <Ledger rows={ledgerRows} view={view} />
          </Panel>
        </div>
      </section>

      <Footer generatedAt={data.generatedAt} />
    </main>
  )
}

/* ─── Add Entry form ─── */
function todayISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function AddEntryForm() {
  const router = useRouter()
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [date, setDate] = useState(todayISO())
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(false)
    const amt = parseFloat(amount)
    const payload: TransactionInput = {
      kind,
      occurred_at: date,
      amount: amt,
      description,
      category: category || null,
    }
    startTransition(async () => {
      const res = await addTransaction(payload)
      if (res.ok) {
        setAmount('')
        setDescription('')
        setCategory('')
        setDate(todayISO())
        setDone(true)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <form className="dash-add" onSubmit={submit}>
      <div className="dash-add-toggle" role="tablist" aria-label="Entry type">
        <button
          type="button"
          role="tab"
          aria-selected={kind === 'expense'}
          className={`dash-add-tab ${kind === 'expense' ? 'is-active out' : ''}`}
          onClick={() => setKind('expense')}
          disabled={pending}
        >
          − Expense
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === 'income'}
          className={`dash-add-tab ${kind === 'income' ? 'is-active in' : ''}`}
          onClick={() => setKind('income')}
          disabled={pending}
        >
          + Sale
        </button>
      </div>

      <div className="dash-add-grid">
        <label className="dash-add-field">
          <span className="dash-add-label">Date</span>
          <input
            className="dash-add-input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            disabled={pending}
            required
          />
        </label>
        <label className="dash-add-field">
          <span className="dash-add-label">Amount</span>
          <input
            className="dash-add-input"
            type="number"
            min={0}
            step={0.01}
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            disabled={pending}
            required
          />
        </label>
        <label className="dash-add-field dash-add-field-wide">
          <span className="dash-add-label">Description</span>
          <input
            className="dash-add-input"
            type="text"
            placeholder={kind === 'income' ? 'e.g. Scotland order' : 'e.g. Firebird printing'}
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={pending}
          />
        </label>
        <label className="dash-add-field">
          <span className="dash-add-label">Category <span className="dash-add-opt">opt.</span></span>
          <input
            className="dash-add-input"
            type="text"
            placeholder="auto"
            value={category}
            onChange={e => setCategory(e.target.value)}
            disabled={pending}
          />
        </label>
      </div>

      <div className="dash-add-actions">
        <button type="submit" className={`dash-add-submit ${kind === 'income' ? 'in' : 'out'}`} disabled={pending}>
          {pending ? 'Recording…' : kind === 'income' ? 'Record sale' : 'Record expense'}
        </button>
        {error && <span className="dash-add-error">{error}</span>}
        {done && !error && <span className="dash-add-ok">✓ Added</span>}
      </div>
    </form>
  )
}

/* ─── Header ─── */
function Header() {
  return (
    <header className="dash-header">
      <div className="dash-brand">
        <Image
          src="/hh-logo.png"
          alt="HouseHold Records"
          width={56}
          height={56}
          className="dash-brand-logo"
          priority
        />
        <div className="dash-brand-text">
          <div className="dash-brand-name">HouseHold Records</div>
          <div className="dash-brand-sub">Financial Ops · Capsule 001</div>
        </div>
      </div>

      <div className="dash-brand-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/household-wordmark-white.png" alt="HOUSEHOLD EST. 2011" className="dash-wordmark" />
      </div>

      <div className="dash-header-meta">
        <LiveClock />
        <div className="dash-header-meta-row">
          <div className="dash-live">
            <span className="dash-live-dot" />
            <span>LIVE</span>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!now) return <div className="dash-clock">— · — · —</div>
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return <div className="dash-clock">{yyyy}·{mm}·{dd} <span>{hh}:{mi}:{ss}</span></div>
}

/* ─── KPI Tile ─── */
function Kpi({
  label, value, prefix = '', suffix = '', tone = 'cream',
  hint, fixed = 2, absValue = false, infinity = false, live = false,
  onClick, active = false,
}: {
  label: string
  value: number
  prefix?: string
  suffix?: string
  tone?: 'cream' | 'neon' | 'green' | 'amber' | 'red'
  hint?: string
  fixed?: number
  absValue?: boolean
  infinity?: boolean
  live?: boolean
  onClick?: () => void
  active?: boolean
}) {
  const displayed = useCountUp(value)
  const shown = absValue ? Math.abs(displayed) : displayed
  const formatted = infinity ? '∞' : fmt(shown, fixed)
  const clickable = !!onClick
  return (
    <div
      className={`dash-kpi dash-kpi-${tone} ${clickable ? 'is-clickable' : ''} ${active ? 'is-active' : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={clickable ? active : undefined}
      onKeyDown={clickable ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }) : undefined}
    >
      <div className="dash-kpi-label">
        <span>{label}</span>
        {live && <span className="dash-kpi-live"><span className="dash-live-dot" /></span>}
      </div>
      <div className="dash-kpi-value">
        <span className="dash-kpi-prefix">{infinity ? '' : prefix}</span>
        <span className="dash-kpi-num">{formatted}</span>
        <span className="dash-kpi-suffix">{suffix}</span>
      </div>
      {hint && <div className="dash-kpi-hint">{hint}</div>}
    </div>
  )
}

/* ─── Panel wrapper ─── */
function Panel({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="dash-panel">
      <div className="dash-panel-head">
        <div className="dash-panel-title">{title}</div>
        {tag && <div className="dash-panel-tag">{tag}</div>}
      </div>
      <div className="dash-panel-body">{children}</div>
    </div>
  )
}

/* ─── Balance trajectory chart ─── */
function BalanceChart({ rows }: { rows: LedgerRow[] }) {
  const W = 1000, H = 220, P = 24
  if (rows.length === 0) return <div className="dash-empty">No data</div>

  const xs = rows.map((_, i) => i)
  const ys = rows.map(r => r.balance)
  const minY = Math.min(...ys) * 0.95
  const maxY = Math.max(...ys) * 1.05
  const xScale = (i: number) => P + (i / Math.max(1, xs.length - 1)) * (W - P * 2)
  const yScale = (v: number) => H - P - ((v - minY) / Math.max(1, maxY - minY)) * (H - P * 2)

  const pts = rows.map((r, i) => `${xScale(i)},${yScale(r.balance)}`).join(' ')
  const areaPath = `M ${xScale(0)},${H - P} L ${pts.split(' ').join(' L ')} L ${xScale(rows.length - 1)},${H - P} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dash-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#7DF9FF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7DF9FF" stopOpacity="0" />
        </linearGradient>
        <filter id="balGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* gridlines */}
      {[0.25, 0.5, 0.75].map(t => (
        <line key={t} x1={P} x2={W - P} y1={P + t * (H - P * 2)} y2={P + t * (H - P * 2)}
              stroke="#1a1a1a" strokeDasharray="2 4" />
      ))}

      <path d={areaPath} fill="url(#balFill)" />
      <polyline points={pts} fill="none" stroke="#7DF9FF" strokeWidth="1.5" filter="url(#balGlow)"
                strokeLinejoin="round" strokeLinecap="round" />

      {rows.map((r, i) => (
        <g key={i}>
          <circle cx={xScale(i)} cy={yScale(r.balance)} r="2.5" fill="#7DF9FF" />
          <circle cx={xScale(i)} cy={yScale(r.balance)} r="6" fill="#7DF9FF" opacity="0.15" />
        </g>
      ))}

      {/* labels: first, last */}
      <text x={xScale(0)} y={H - 4} className="dash-chart-label" textAnchor="start">
        {rows[0].iso ?? rows[0].date}
      </text>
      <text x={xScale(rows.length - 1)} y={H - 4} className="dash-chart-label" textAnchor="end">
        {rows[rows.length - 1].iso ?? rows[rows.length - 1].date}
      </text>
      <text x={W - P} y={P + 4} className="dash-chart-label" textAnchor="end">
        ${fmt(maxY, 0)}
      </text>
      <text x={W - P} y={H - P} className="dash-chart-label" textAnchor="end">
        ${fmt(minY, 0)}
      </text>
    </svg>
  )
}

/* ─── Category bars ─── */
function CategoryBars({ cats }: { cats: Array<{ name: string; income: number; expenses: number; total: number }> }) {
  const max = Math.max(1, ...cats.map(c => c.total))
  return (
    <div className="dash-cats">
      {cats.map(c => {
        const incomeShare = c.income / max
        const expenseShare = c.expenses / max
        return (
          <div key={c.name} className="dash-cat">
            <div className="dash-cat-head">
              <span className="dash-cat-name">{c.name}</span>
              <span className="dash-cat-vals">
                {c.income > 0 && <span className="dash-cat-in">+${fmt(c.income, 2)}</span>}
                {c.expenses > 0 && <span className="dash-cat-out">-${fmt(c.expenses, 2)}</span>}
              </span>
            </div>
            <div className="dash-cat-bar">
              <div className="dash-cat-bar-in"  style={{ width: `${incomeShare * 100}%` }} />
              <div className="dash-cat-bar-out" style={{ width: `${expenseShare * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Ledger ─── */
function Ledger({ rows, view = 'overview' }: { rows: LedgerRow[]; view?: LedgerView }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (rows.length === 0) {
    const what = view === 'income' ? 'income' : view === 'expense' ? 'expenses' : 'entries'
    return <div className="dash-empty">No {what} yet.</div>
  }
  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="dash-ledger">
      <div className="dash-ledger-head">
        <span></span><span>Date</span><span>Description</span><span>Δ</span><span>Balance</span><span></span>
      </div>
      <div className="dash-ledger-body">
        {rows.map(r => {
          const delta = r.income > 0 ? r.income : -r.expenses
          const isOpen = expanded.has(r.id)

          if (editingId === r.id) {
            return (
              <div key={r.id} className="dash-ledger-group">
                <LedgerEditRow
                  row={r}
                  onDone={() => { setEditingId(null); setError(null) }}
                  setError={setError}
                />
              </div>
            )
          }

          return (
            <div key={r.id} className="dash-ledger-group">
              <div
                className={`dash-ledger-row ${r.hasItems ? 'has-items' : ''} ${isOpen ? 'is-open' : ''}`}
                onClick={r.hasItems ? () => toggle(r.id) : undefined}
                role={r.hasItems ? 'button' : undefined}
                aria-expanded={r.hasItems ? isOpen : undefined}
              >
                <span className="dash-ledger-chev">{r.hasItems ? (isOpen ? '▾' : '▸') : ''}</span>
                <span className="dash-ledger-date">{r.iso ?? r.date}</span>
                <span className="dash-ledger-desc">{r.description || categorize(r.description)}</span>
                <span className={`dash-ledger-delta ${delta >= 0 ? 'pos' : 'neg'}`}>
                  {delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta), 2)}
                </span>
                <span className="dash-ledger-bal">${fmt(r.balance, 2)}</span>
                <LedgerRowActions
                  row={r}
                  onEdit={() => { setEditingId(r.id); setError(null) }}
                  setError={setError}
                />
              </div>
              {isOpen && <ItemsBreakdown row={r} />}
            </div>
          )
        })}
      </div>
      {error && <div className="dash-ledger-error">{error}</div>}
    </div>
  )
}

function LedgerRowActions({
  row, onEdit, setError,
}: {
  row: LedgerRow
  onEdit: () => void
  setError: (msg: string | null) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    startTransition(async () => {
      const res = await deleteTransaction(row.id)
      if (res.ok) {
        router.refresh()
      } else {
        setError(res.error)
        setConfirming(false)
      }
    })
  }

  return (
    <span className="dash-ledger-rowact" onClick={stop}>
      {confirming ? (
        <>
          <button type="button" className="dash-items-btn danger" onClick={onDelete} disabled={pending}>
            {pending ? '…' : 'delete?'}
          </button>
          <button type="button" className="dash-items-btn" onClick={e => { stop(e); setConfirming(false) }} disabled={pending}>
            cancel
          </button>
        </>
      ) : (
        <>
          <button type="button" className="dash-items-btn" onClick={e => { stop(e); onEdit() }} aria-label="Edit entry">edit</button>
          <button type="button" className="dash-items-btn" onClick={e => { stop(e); setConfirming(true); setError(null) }} aria-label="Delete entry">del</button>
        </>
      )}
    </span>
  )
}

function LedgerEditRow({
  row, onDone, setError,
}: {
  row: LedgerRow
  onDone: () => void
  setError: (msg: string | null) => void
}) {
  const [kind, setKind] = useState<'expense' | 'income'>(row.income > 0 ? 'income' : 'expense')
  const [date, setDate] = useState(row.iso ?? '')
  const [amount, setAmount] = useState(String(row.income > 0 ? row.income : row.expenses))
  const [description, setDescription] = useState(row.description)
  const [category, setCategory] = useState(row.category && row.category !== 'Opening Balance' ? row.category : '')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const save = () => {
    const payload: TransactionInput = {
      kind,
      occurred_at: date,
      amount: parseFloat(amount),
      description,
      category: category || null,
    }
    startTransition(async () => {
      const res = await updateTransaction(row.id, payload)
      if (res.ok) { onDone(); router.refresh() }
      else setError(res.error)
    })
  }

  return (
    <div className="dash-ledger-edit">
      <div className="dash-add-toggle" role="tablist" aria-label="Entry type">
        <button type="button" role="tab" aria-selected={kind === 'expense'}
          className={`dash-add-tab ${kind === 'expense' ? 'is-active out' : ''}`}
          onClick={() => setKind('expense')} disabled={pending}>− Expense</button>
        <button type="button" role="tab" aria-selected={kind === 'income'}
          className={`dash-add-tab ${kind === 'income' ? 'is-active in' : ''}`}
          onClick={() => setKind('income')} disabled={pending}>+ Sale</button>
      </div>
      <div className="dash-ledger-edit-fields">
        <input className="dash-add-input" type="date" value={date}
          onChange={e => setDate(e.target.value)} disabled={pending} aria-label="Date" />
        <input className="dash-add-input" type="number" min={0} step={0.01} inputMode="decimal"
          value={amount} onChange={e => setAmount(e.target.value)} disabled={pending} aria-label="Amount" />
        <input className="dash-add-input" type="text" placeholder="Description" value={description}
          onChange={e => setDescription(e.target.value)} disabled={pending} aria-label="Description" />
        <input className="dash-add-input" type="text" placeholder="Category (auto)" value={category}
          onChange={e => setCategory(e.target.value)} disabled={pending} aria-label="Category" />
      </div>
      <div className="dash-ledger-edit-act">
        <button type="button" className="dash-items-btn primary" onClick={save} disabled={pending}>
          {pending ? '…' : 'save'}
        </button>
        <button type="button" className="dash-items-btn" onClick={onDone} disabled={pending}>cancel</button>
      </div>
    </div>
  )
}

function ItemsBreakdown({ row }: { row: LedgerRow }) {
  const parent = row.income > 0 ? row.income : row.expenses
  const diff = parent - row.itemsTotal
  const matches = Math.abs(diff) < 0.01

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="dash-items">
      <div className="dash-items-head">
        <span>Item</span><span>Qty</span><span>Unit</span><span>Total</span><span>Notes</span><span></span>
      </div>
      <div className="dash-items-body">
        {row.items.map(it =>
          editingId === it.id ? (
            <ItemEditRow
              key={it.id}
              mode="edit"
              item={it}
              onDone={() => { setEditingId(null); setError(null) }}
              setError={setError}
            />
          ) : (
            <ItemRow
              key={it.id}
              item={it}
              onEdit={() => { setEditingId(it.id); setError(null) }}
              setError={setError}
            />
          ),
        )}
        {adding && (
          <ItemEditRow
            mode="add"
            transactionId={row.id}
            onDone={() => { setAdding(false); setError(null) }}
            setError={setError}
          />
        )}
        {row.items.length === 0 && !adding && (
          <div className="dash-items-empty">No items yet.</div>
        )}
      </div>

      <div className="dash-items-actions">
        {!adding && (
          <button
            type="button"
            className="dash-items-add"
            onClick={() => { setAdding(true); setEditingId(null); setError(null) }}
          >
            + Add item
          </button>
        )}
        {error && <span className="dash-items-error">{error}</span>}
      </div>

      <div className="dash-items-foot">
        <div className="dash-items-foot-row">
          <span>Items total</span>
          <span>${fmt(row.itemsTotal, 2)}</span>
        </div>
        <div className="dash-items-foot-row">
          <span>Parent transaction</span>
          <span>${fmt(parent, 2)}</span>
        </div>
        {!matches && (
          <div className="dash-items-foot-row dash-items-mismatch">
            <span>Mismatch · items don&apos;t sum to parent</span>
            <span>{diff > 0 ? '+' : '−'}${fmt(Math.abs(diff), 2)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ItemRow({
  item, onEdit, setError,
}: {
  item: TransactionItem
  onEdit: () => void
  setError: (msg: string | null) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteTransactionItem(item.id)
      if (res.ok) {
        router.refresh()
      } else {
        setError(res.error)
        setConfirming(false)
      }
    })
  }

  return (
    <div className="dash-items-row">
      <span className="dash-items-name">{item.item_name}</span>
      <span className="dash-items-qty">{item.quantity}</span>
      <span className="dash-items-unit">${fmt(item.unit_price, 2)}</span>
      <span className="dash-items-total">${fmt(item.line_total, 2)}</span>
      <span className="dash-items-notes">{item.notes ?? ''}</span>
      <span className="dash-items-rowact">
        {confirming ? (
          <>
            <button type="button" className="dash-items-btn danger" onClick={onDelete} disabled={pending}>
              {pending ? '…' : 'delete?'}
            </button>
            <button type="button" className="dash-items-btn" onClick={() => setConfirming(false)} disabled={pending}>
              cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="dash-items-btn" onClick={onEdit} aria-label="Edit">edit</button>
            <button type="button" className="dash-items-btn" onClick={() => { setConfirming(true); setError(null) }} aria-label="Delete">del</button>
          </>
        )}
      </span>
    </div>
  )
}

type EditRowProps =
  | { mode: 'add'; transactionId: string; onDone: () => void; setError: (msg: string | null) => void; item?: undefined }
  | { mode: 'edit'; item: TransactionItem; onDone: () => void; setError: (msg: string | null) => void; transactionId?: undefined }

function ItemEditRow(props: EditRowProps) {
  const [name, setName] = useState(props.mode === 'edit' ? props.item.item_name : '')
  const [qty, setQty] = useState<number>(props.mode === 'edit' ? props.item.quantity : 1)
  const [unit, setUnit] = useState<number>(props.mode === 'edit' ? props.item.unit_price : 0)
  const [notes, setNotes] = useState(props.mode === 'edit' ? (props.item.notes ?? '') : '')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const livePreview = (Number.isFinite(qty) && Number.isFinite(unit)) ? qty * unit : 0

  const save = () => {
    const payload: ItemInput = {
      item_name: name,
      quantity: qty,
      unit_price: unit,
      notes: notes || null,
    }
    startTransition(async () => {
      const res = props.mode === 'edit'
        ? await updateTransactionItem(props.item.id, payload)
        : await addTransactionItem(props.transactionId, payload)
      if (res.ok) { props.onDone(); router.refresh() }
      else props.setError(res.error)
    })
  }

  return (
    <div className="dash-items-row dash-items-edit">
      <input
        className="dash-items-input"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Item name"
        autoFocus
        disabled={pending}
      />
      <input
        className="dash-items-input"
        type="number"
        min={1}
        step={1}
        value={qty}
        onChange={e => setQty(parseInt(e.target.value, 10) || 0)}
        disabled={pending}
      />
      <input
        className="dash-items-input"
        type="number"
        min={0}
        step={0.01}
        value={unit}
        onChange={e => setUnit(parseFloat(e.target.value) || 0)}
        disabled={pending}
      />
      <span className="dash-items-total dash-items-preview">${fmt(livePreview, 2)}</span>
      <input
        className="dash-items-input"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        disabled={pending}
      />
      <span className="dash-items-rowact">
        <button type="button" className="dash-items-btn primary" onClick={save} disabled={pending}>
          {pending ? '…' : 'save'}
        </button>
        <button type="button" className="dash-items-btn" onClick={props.onDone} disabled={pending}>
          cancel
        </button>
      </span>
    </div>
  )
}

/* ─── Footer ─── */
function Footer({ generatedAt }: { generatedAt: string }) {
  const t = new Date(generatedAt)
  const ago = formatRelative(t)
  return (
    <footer className="dash-footer">
      <span>HOUSEHOLD RECORDS · EST. 2011</span>
      <span className="dash-footer-mid">SIGNAL · {ago}</span>
      <Link href="/" className="dash-footer-back">[ exit ]</Link>
    </footer>
  )
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  return <span className={`dash-corner dash-corner-${pos}`} aria-hidden="true" />
}

/* ─── helpers ─── */
function useCountUp(target: number, durationMs = 900) {
  const [v, setV] = useState(0)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef(0)
  useEffect(() => {
    fromRef.current = v
    startRef.current = null
    let raf = 0
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t
      const p = Math.min(1, (t - startRef.current) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setV(fromRef.current + (target - fromRef.current) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])
  return v
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return Math.max(0, Math.round((db - da) / 86400000))
}

function formatRelative(t: Date): string {
  const now = Date.now()
  const diff = Math.max(0, now - t.getTime())
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
