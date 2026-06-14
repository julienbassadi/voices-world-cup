import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_SECRET_KEY        = Deno.env.get('STRIPE_SECRET_KEY')!
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const STRIPE_PRODUCT_ID = 'prod_UgXx68ylgfjHe1'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Stripe API helper (raw fetch — avoids Deno import issues) ─────────────────

function toFormData(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

async function stripePost(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method:  'POST',
    headers: {
      'Authorization':  `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type':   'application/x-www-form-urlencoded',
    },
    body: toFormData(params),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Stripe ${path} error: ${json.error?.message ?? res.statusText}`)
  return json
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST')    return new Response('Method Not Allowed', { status: 405 })

  try {
    // ── Auth — verify the caller's JWT ──────────────────────────────────────
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return new Response('Unauthorized', { status: 401 })

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return new Response('Unauthorized', { status: 401 })

    // ── Body ────────────────────────────────────────────────────────────────
    const { pixels, audioUrl, pseudo, description, cancelUrl } = await req.json()
    // pixels: [{ iso: string, gridX: number, gridY: number, color: string|null }]

    if (!Array.isArray(pixels) || pixels.length === 0) {
      return new Response(JSON.stringify({ error: 'No pixels' }), { status: 400, headers: CORS })
    }

    // ── Save pending checkout before hitting Stripe ──────────────────────────
    const { data: checkout, error: dbErr } = await admin
      .from('pending_checkouts')
      .insert({
        user_id:     user.id,
        pixels,
        audio_url:   audioUrl   ?? null,
        pseudo:      pseudo     ?? null,
        description: description ?? null,
        status:      'pending',
      })
      .select('id')
      .single()

    if (dbErr) throw new Error(`DB insert error: ${dbErr.message}`)

    // ── Create Stripe Checkout Session ───────────────────────────────────────
    const session = await stripePost('/checkout/sessions', {
      'payment_method_types[]':                    'card',
      'line_items[0][price_data][currency]':       'eur',
      'line_items[0][price_data][unit_amount]':    '100',
      'line_items[0][price_data][product]':        STRIPE_PRODUCT_ID,
      'line_items[0][quantity]':                   String(pixels.length),
      'mode':                                      'payment',
      'success_url':                               'https://talktotheplanet.com?payment=success',
      'cancel_url':                                cancelUrl ?? 'https://talktotheplanet.com',
      'metadata[checkout_id]':                     checkout.id,
      'metadata[user_id]':                         user.id,
      'locale':                                    'fr',
    })

    // Attach Stripe session ID for traceability
    await admin
      .from('pending_checkouts')
      .update({ session_id: session.id })
      .eq('id', checkout.id)

    console.log(`[create-checkout-session] session ${session.id} for ${pixels.length} pixels (checkout ${checkout.id})`)

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[create-checkout-session]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status:  500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
