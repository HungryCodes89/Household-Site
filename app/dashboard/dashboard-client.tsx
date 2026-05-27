'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { categorize, type BudgetData, type LedgerRow } from '@/lib/budget'
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

function Dashboard({ data }: { data: BudgetData }) {
  const { totalInvested, currentBalance, totalIncome, totalExpenses, net, rows } = data
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.iso ?? '').localeCompare(b.iso ?? '')),
    [rows],
  )
  const recent = useMemo(() => [...sorted].reverse(), [sorted])

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
          <Kpi label="Total Invested"    value={totalInvested}  prefix="$" tone="cream"  hint="lifetime capital" />
          <Kpi label="Account Balance"   value={currentBalance} prefix="$" tone="neon"   hint="current" live />
          <Kpi label="Income · Period"   value={totalIncome}    prefix="+$" tone="green"  hint={`${rows.filter(r => r.income > 0).length} entries`} />
          <Kpi label="Expenses · Period" value={totalExpenses}  prefix="-$" tone="amber"  hint={`${rows.filter(r => r.expenses > 0).length} entries`} />
          <Kpi label="Net · Period"      value={net}            prefix={net >= 0 ? '+$' : '-$'} absValue tone={net >= 0 ? 'green' : 'red'} hint="income − expenses" />
          <Kpi label="Cash Runway"       value={isFinite(runway) ? runway : 0} suffix=" mo" tone={isFinite(runway) ? 'neon' : 'cream'} hint={isFinite(runway) ? `@ $${burn.toFixed(2)}/day burn` : 'positive cashflow'} fixed={1} infinity={!isFinite(runway)} />
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
          <Panel title="Recent Ledger" tag={`${rows.length} ENTRIES`}>
            <Ledger rows={recent} />
          </Panel>
        </div>
      </section>

      <Footer generatedAt={data.generatedAt} />
    </main>
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
  hint, fixed = 0, absValue = false, infinity = false, live = false,
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
}) {
  const displayed = useCountUp(value)
  const shown = absValue ? Math.abs(displayed) : displayed
  const formatted = infinity ? '∞' : fmt(shown, fixed)
  return (
    <div className={`dash-kpi dash-kpi-${tone}`}>
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
function Ledger({ rows }: { rows: LedgerRow[] }) {
  return (
    <div className="dash-ledger">
      <div className="dash-ledger-head">
        <span>Date</span><span>Description</span><span>Δ</span><span>Balance</span>
      </div>
      <div className="dash-ledger-body">
        {rows.slice(0, 12).map((r, i) => {
          const delta = r.income > 0 ? r.income : -r.expenses
          return (
            <div key={i} className="dash-ledger-row">
              <span className="dash-ledger-date">{r.iso ?? r.date}</span>
              <span className="dash-ledger-desc">{r.description || categorize(r.description)}</span>
              <span className={`dash-ledger-delta ${delta >= 0 ? 'pos' : 'neg'}`}>
                {delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta), 2)}
              </span>
              <span className="dash-ledger-bal">${fmt(r.balance, 2)}</span>
            </div>
          )
        })}
      </div>
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
