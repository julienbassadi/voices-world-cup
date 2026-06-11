import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_WEBHOOK_SECRET    = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY            = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL                = 'Supporters World Cup 2026 <noreply@talktotheplanet.com>'

// ── Country name lookup ────────────────────────────────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  us: 'États-Unis', ca: 'Canada', mx: 'Mexique',
  de: 'Allemagne', 'gb-eng': 'Angleterre', at: 'Autriche',
  be: 'Belgique', ba: 'Bosnie-Herzégovine', hr: 'Croatie',
  'gb-sct': 'Écosse', es: 'Espagne', fr: 'France',
  no: 'Norvège', nl: 'Pays-Bas', pt: 'Portugal',
  se: 'Suède', ch: 'Suisse', cz: 'République tchèque',
  tr: 'Turquie', za: 'Afrique du Sud', dz: 'Algérie',
  cv: 'Cap-Vert', ci: "Côte d'Ivoire", eg: 'Égypte',
  gh: 'Ghana', ma: 'Maroc', cd: 'RD Congo',
  sn: 'Sénégal', tn: 'Tunisie', sa: 'Arabie Saoudite',
  au: 'Australie', iq: 'Irak', ir: 'Iran',
  jp: 'Japon', jo: 'Jordanie', uz: 'Ouzbékistan',
  qa: 'Qatar', kr: 'Corée du Sud', ar: 'Argentine',
  br: 'Brésil', cl: 'Chili', co: 'Colombie',
  ec: 'Équateur', py: 'Paraguay', uy: 'Uruguay', ve: 'Venezuela',
}

// ── Stripe webhook signature verification (HMAC-SHA256) ───────────────────────

async function verifyStripeSignature(body: string, header: string, secret: string): Promise<boolean> {
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

// ── Email template ────────────────────────────────────────────────────────────

function buildConfirmationEmail(opts: {
  pixelCount:  number
  countries:   string[]
  pseudo:      string | null
  totalEuros:  number
  firstPixelId: string
  buyerEmail:  string
}): string {
  const { pixelCount, countries, pseudo, totalEuros, firstPixelId } = opts

  const amount      = totalEuros.toFixed(2).replace('.', ',') + ' €'
  const countryList = countries.join(', ')
  const pixelUrl    = `https://talktotheplanet.com/pixel/${firstPixelId}`

  const row = (label: string, value: string) => /* html */`
    <tr>
      <td style="font-family:'DM Mono','Courier New',monospace;font-size:11px;
                 color:rgba(255,255,255,.40);letter-spacing:.5px;
                 padding:10px 0;border-bottom:1px solid rgba(232,200,74,.08);">
        ${label}
      </td>
      <td style="font-family:'DM Mono','Courier New',monospace;font-size:11px;
                 color:#e8e8e8;letter-spacing:.5px;text-align:right;
                 padding:10px 0;border-bottom:1px solid rgba(232,200,74,.08);">
        ${value}
      </td>
    </tr>`

  return /* html */`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Votre voix est sur la carte — Supporters World Cup 2026</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a1a;font-family:'DM Mono','Courier New',monospace;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0"
         style="background-color:#0a0a1a;">
    <tr><td align="center" style="padding:0 0 40px;">

      <table width="100%" border="0" cellspacing="0" cellpadding="0"
             style="max-width:600px;">

        <!-- GIF bannière drapeaux -->
        <tr>
          <td style="padding:0;line-height:0;">
            <img
              src="https://res.cloudinary.com/ddjuu5vyg/image/upload/v1780816872/flags-banner.gif"
              alt="Supporters World Cup 2026"
              width="600"
              style="display:block;width:100%;max-width:600px;height:auto;"
            />
          </td>
        </tr>

        <!-- Corps -->
        <tr>
          <td style="background-color:#0d1020;
                     border-left:2px solid #1e2a4a;border-right:2px solid #1e2a4a;
                     padding:40px 36px 36px;">

            <!-- Eyebrow -->
            <p style="font-family:'DM Mono','Courier New',monospace;font-size:11px;
                      color:#E8C84A;letter-spacing:5px;opacity:.6;margin:0 0 20px;
                      text-transform:uppercase;">
              SUPPORTERS WORLD CUP 2026
            </p>

            <!-- Badge succès -->
            <div style="display:inline-block;background:rgba(34,197,94,.12);
                        border:1px solid rgba(34,197,94,.35);border-radius:2px;
                        padding:6px 14px;margin-bottom:24px;">
              <span style="font-family:'DM Mono','Courier New',monospace;
                           font-size:11px;color:#22C55E;letter-spacing:1px;">
                ✓ Paiement confirmé
              </span>
            </div>

            <!-- Titre -->
            <h1 style="font-family:Impact,'Arial Narrow',Arial,sans-serif;
                       font-size:26px;color:#E8C84A;letter-spacing:3px;
                       text-transform:uppercase;margin:0 0 10px;line-height:1.2;">
              VOTRE VOIX EST<br/>SUR LA CARTE
            </h1>
            <p style="font-family:'DM Mono','Courier New',monospace;font-size:11px;
                      color:rgba(255,255,255,.40);letter-spacing:.5px;line-height:1.7;
                      margin:0 0 32px;">
              Votre participation à la Supporters World Cup 2026 a bien été enregistrée.
            </p>

            <!-- Tableau récapitulatif -->
            <table width="100%" border="0" cellspacing="0" cellpadding="0"
                   style="border:1px solid rgba(232,200,74,.15);border-radius:2px;
                          margin-bottom:32px;">
              <tr>
                <td colspan="2" style="background:rgba(232,200,74,.06);
                                       padding:10px 14px;
                                       border-bottom:1px solid rgba(232,200,74,.15);">
                  <span style="font-family:Impact,'Arial Narrow',Arial,sans-serif;
                               font-size:12px;color:#E8C84A;letter-spacing:2px;">
                    RÉCAPITULATIF
                  </span>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:0 14px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    ${row('Pays', countryList)}
                    ${pseudo ? row('Pseudo', pseudo) : ''}
                    ${row('Nombre de pixels', `${pixelCount} pixel${pixelCount > 1 ? 's' : ''}`)}
                    <tr>
                      <td style="font-family:'DM Mono','Courier New',monospace;font-size:11px;
                                 color:rgba(255,255,255,.40);letter-spacing:.5px;padding:12px 0 0;">
                        Montant total
                      </td>
                      <td style="font-family:Impact,'Arial Narrow',Arial,sans-serif;
                                 font-size:20px;color:#E8C84A;letter-spacing:2px;
                                 text-align:right;padding:12px 0 0;">
                        ${amount}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr><td colspan="2" style="padding:12px 0;font-size:0;">&nbsp;</td></tr>
            </table>

            <!-- Bouton CTA -->
            <table width="100%" border="0" cellspacing="0" cellpadding="0"
                   style="margin-bottom:32px;">
              <tr>
                <td align="center">
                  <a href="${pixelUrl}"
                     style="display:inline-block;
                            background:linear-gradient(135deg,#E8C84A 0%,#c9a830 100%);
                            color:#05080F;
                            font-family:Impact,'Arial Narrow',Arial,sans-serif;
                            font-size:15px;letter-spacing:3px;text-decoration:none;
                            padding:16px 44px;border-radius:2px;text-transform:uppercase;">
                    VOIR MON PIXEL
                  </a>
                </td>
              </tr>
            </table>

            <!-- Lien texte de secours -->
            <p style="font-family:'DM Mono','Courier New',monospace;font-size:10px;
                      color:rgba(255,255,255,.25);letter-spacing:.4px;line-height:1.8;margin:0;">
              Si le bouton ne fonctionne pas :<br/>
              <a href="${pixelUrl}"
                 style="color:rgba(232,200,74,.5);text-decoration:underline;word-break:break-all;">
                ${pixelUrl}
              </a>
            </p>

          </td>
        </tr>

        <!-- Séparateur doré -->
        <tr>
          <td style="height:2px;background:linear-gradient(90deg,transparent 0%,#E8C84A 30%,#E8C84A 70%,transparent 100%);"></td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#080810;
                     border-left:2px solid #1e2a4a;border-right:2px solid #1e2a4a;
                     border-bottom:2px solid #1e2a4a;padding:24px 36px;"
              align="center">
            <p style="font-family:'DM Mono','Courier New',monospace;font-size:10px;
                      color:rgba(255,255,255,.2);letter-spacing:.4px;
                      line-height:1.8;margin:0;">
              © 2026 Supporters World Cup &nbsp;·&nbsp;
              <a href="https://talktotheplanet.com"
                 style="color:rgba(232,200,74,.4);text-decoration:none;">
                talktotheplanet.com
              </a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
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

    // Service role client — bypasses RLS on all tables
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: checkout, error: fetchErr } = await admin
      .from('pending_checkouts')
      .select('*')
      .eq('id', checkoutId)
      .single()

    if (fetchErr || !checkout) {
      console.error('[stripe-webhook] checkout not found:', checkoutId, fetchErr?.code, fetchErr?.message)
      return new Response('Not found', { status: 404 })
    }

    // Idempotency guard
    if (checkout.status === 'completed') {
      console.log(`[stripe-webhook] checkout ${checkoutId} already processed, skipping`)
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ── Insert pixels ────────────────────────────────────────────────────────
    type PendingPixel = { iso: string; gridX: number; gridY: number; color: string | null }
    const rows = (checkout.pixels as PendingPixel[]).map(px => ({
      user_id:     checkout.user_id,
      country_iso: px.iso,
      grid_x:      px.gridX,
      grid_y:      px.gridY,
      x:           0,
      y:           0,
      audio_url:   checkout.audio_url   ?? null,
      pseudo:      checkout.pseudo      ?? null,
      description: checkout.description ?? null,
      color:       px.color             ?? null,
    }))

    console.log(`[stripe-webhook] inserting ${rows.length} row(s):`, JSON.stringify(rows[0]))

    const { data: insertedPixels, error: insertErr } = await admin
      .from('pixels')
      .insert(rows)
      .select('id')

    if (insertErr) {
      console.error('[stripe-webhook] pixel insert error — code:', insertErr.code,
        '| message:', insertErr.message, '| details:', insertErr.details,
        '| hint:', insertErr.hint)
      return new Response(`DB error: ${insertErr.message}`, { status: 500 })
    }

    await admin
      .from('pending_checkouts')
      .update({ status: 'completed' })
      .eq('id', checkoutId)

    console.log(`[stripe-webhook] ✓ ${rows.length} pixel(s) confirmed for checkout ${checkoutId}`)

    // ── Send confirmation email via Resend ───────────────────────────────────
    const buyerEmail = session.customer_details?.email as string | null
    if (buyerEmail) {
      const pixels      = checkout.pixels as PendingPixel[]
      const isoSet      = [...new Set(pixels.map(p => p.iso))]
      const countries   = isoSet.map(iso => COUNTRY_NAMES[iso] ?? iso.toUpperCase())
      const firstPixelId = insertedPixels?.[0]?.id ?? checkoutId

      const html = buildConfirmationEmail({
        pixelCount:   pixels.length,
        countries,
        pseudo:       checkout.pseudo ?? null,
        totalEuros:   pixels.length,   // 1 € par pixel
        firstPixelId,
        buyerEmail,
      })

      const resendRes = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from:    FROM_EMAIL,
          to:      [buyerEmail],
          subject: 'Votre voix est sur la carte — Supporters World Cup 2026',
          html,
        }),
      })

      if (!resendRes.ok) {
        const err = await resendRes.text()
        console.error('[stripe-webhook] Resend error:', err)
        // Non-fatal: pixels are already inserted, don't fail the webhook
      } else {
        console.log(`[stripe-webhook] ✉ confirmation email sent to ${buyerEmail}`)
      }
    } else {
      console.warn('[stripe-webhook] no buyer email in session, skipping confirmation email')
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
