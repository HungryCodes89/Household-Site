'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ItemInput = {
  item_name: string
  quantity: number
  unit_price: number
  notes: string | null
}

export type TransactionInput = {
  kind: 'income' | 'expense'
  occurred_at: string // YYYY-MM-DD
  amount: number
  description: string
  category: string | null
}

export type ActionResult = { ok: true } | { ok: false; error: string }

type AuthResult =
  | { ok: false; error: string }
  | { ok: true; supabase: ReturnType<typeof createClient> }

async function requireUser(): Promise<AuthResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You need to sign in to make changes.' }
  return { ok: true, supabase }
}

function validate(input: ItemInput): string | null {
  if (!input.item_name.trim()) return 'Item name is required.'
  if (!Number.isFinite(input.quantity) || input.quantity < 1) return 'Quantity must be at least 1.'
  if (!Number.isFinite(input.unit_price) || input.unit_price < 0) return 'Unit price cannot be negative.'
  return null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function validateTransaction(input: TransactionInput): string | null {
  if (input.kind !== 'income' && input.kind !== 'expense') return 'Type must be a sale or an expense.'
  if (!ISO_DATE.test(input.occurred_at)) return 'A valid date is required.'
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Amount must be greater than zero.'
  return null
}

export async function addTransaction(input: TransactionInput): Promise<ActionResult> {
  const auth = await requireUser()
  if (!auth.ok) return { ok: false, error: auth.error }
  const validation = validateTransaction(input)
  if (validation) return { ok: false, error: validation }

  const { data: { user } } = await auth.supabase.auth.getUser()

  const { error } = await auth.supabase.from('transactions').insert({
    kind: input.kind,
    occurred_at: input.occurred_at,
    amount: input.amount,
    description: input.description.trim(),
    category: input.category?.trim() || null,
    created_by: user?.id ?? null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<ActionResult> {
  const auth = await requireUser()
  if (!auth.ok) return { ok: false, error: auth.error }
  const validation = validateTransaction(input)
  if (validation) return { ok: false, error: validation }

  const { error } = await auth.supabase.from('transactions').update({
    kind: input.kind,
    occurred_at: input.occurred_at,
    amount: input.amount,
    description: input.description.trim(),
    category: input.category?.trim() || null,
  }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const auth = await requireUser()
  if (!auth.ok) return { ok: false, error: auth.error }

  // transaction_items cascade-delete via the FK (on delete cascade).
  const { error } = await auth.supabase.from('transactions').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function addTransactionItem(
  transactionId: string,
  input: ItemInput,
): Promise<ActionResult> {
  const auth = await requireUser()
  if (!auth.ok) return { ok: false, error: auth.error }
  const validation = validate(input)
  if (validation) return { ok: false, error: validation }

  const { error } = await auth.supabase.from('transaction_items').insert({
    transaction_id: transactionId,
    item_name: input.item_name.trim(),
    quantity: input.quantity,
    unit_price: input.unit_price,
    notes: input.notes?.trim() || null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function updateTransactionItem(
  id: string,
  input: ItemInput,
): Promise<ActionResult> {
  const auth = await requireUser()
  if (!auth.ok) return { ok: false, error: auth.error }
  const validation = validate(input)
  if (validation) return { ok: false, error: validation }

  const { error } = await auth.supabase.from('transaction_items').update({
    item_name: input.item_name.trim(),
    quantity: input.quantity,
    unit_price: input.unit_price,
    notes: input.notes?.trim() || null,
  }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteTransactionItem(id: string): Promise<ActionResult> {
  const auth = await requireUser()
  if (!auth.ok) return { ok: false, error: auth.error }

  const { error } = await auth.supabase.from('transaction_items').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}
