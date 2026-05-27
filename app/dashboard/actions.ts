'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ItemInput = {
  item_name: string
  quantity: number
  unit_price: number
  notes: string | null
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
