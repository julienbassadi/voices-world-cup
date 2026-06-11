import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_WEBHOOK_SECRET    = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ── Stripe webhook signature verification (HMAC-SHA256) ───────────────────────

async function verifyStripeSignature(body: string, header: string, secret: string): Promise<boolean> {
  // header format: "t=<unix_ts>,v1=<hex_sig>,v0=<hex_sig>"
  const parts: Record<string, string> = {}
  for (const chunk of header.split(',')) {
    const eq = chunk.indexOf('=')
    if (eq !== -1) parts[chunk.slice(0, eq)] = chunk.slice(eq + 1)
  }
  const t  = parts['t']
  const v1 = parts['v1']
  if (!t || !v1) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig      = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`))
  const computed = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return computed === v1
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const body      = await req.text()
  const sigHeader = req.headers.get('stripe-signature') ?? ''

  if (!(await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET))) {
    console.error('[stripe-webhook] invalid signature')
    return new Response('Unauthorized', { status: 401 })
  }

  const event = JSON.parse(body)
  console.log(`[stripe-webhook] received: ${event.type}`)

  if (event.type === 'checkout.session.completed') {
    const session    = event.data.object
    const checkoutId = session.metadata?.checkout_id as string | undefined

    if (!checkoutId) {
      console.error('[stripe-webhook] missing checkout_id in metadata')
      return new Response('Missing checkout_id', { status: 400 })
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Fetch the pending checkout record
    const { data: checkout, error: fetchErr } = await admin
      .from('pending_checkouts')
      .select('*')
      .eq('id', checkoutId)
      .single()

    if (fetchErr || !checkout) {
      console.error('[stripe-webhook] checkout not found:', checkoutId, fetchErr?.message)
      return new Response('Not found', { status: 404 })
    }

    // Idempotency guard — webhook can fire more than once
    if (checkout.status === 'completed') {
      console.log(`[stripe-webhook] checkout ${checkoutId} already processed, skipping`)
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build pixel rows matching the `pixels` table schema
    type PendingPixel = { iso: string; gridX: number; gridY: number; color: string | null }
    const rows = (checkout.pixels as PendingPixel[]).map(px => ({
      user_id:     checkout.user_id,
      country_iso: px.iso,
      grid_x:      px.gridX,
      grid_y:      px.gridY,
      x:           0,   // legacy NOT NULL columns
      y:           0,
      audio_url:   checkout.audio_url   ?? null,
      pseudo:      checkout.pseudo      ?? null,
      description: checkout.description ?? null,
      color:       px.color             ?? null,
    }))

    const { error: insertErr } = await admin.from('pixels').insert(rows)
    if (insertErr) {
      console.error('[stripe-webhook] pixel insert error:', insertErr.message)
      return new Response('DB error', { status: 500 })
    }

    await admin
      .from('pending_checkouts')
      .update({ status: 'completed' })
      .eq('id', checkoutId)

    console.log(`[stripe-webhook] ✓ ${rows.length} pixel(s) confirmed for checkout ${checkoutId}`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
