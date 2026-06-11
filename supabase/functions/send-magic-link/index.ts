const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const HOOK_SECRET    = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const FROM_EMAIL     = 'Supporters World Cup 2026 <noreply@talktotheplanet.com>'

// ── Signature verification ──────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

async function verifyHookSignature(body: string, signature: string | null): Promise<boolean> {
  if (!HOOK_SECRET) return true
  if (!signature)   return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(HOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify('HMAC', key, hexToBytes(signature), new TextEncoder().encode(body))
}

// ── URL builder ─────────────────────────────────────────────────────────────

function buildVerifyUrl(tokenHash: string, type: string, redirectTo: string): string {
  const params = new URLSearchParams({ token: tokenHash, type, redirect_to: redirectTo })
  return `${SUPABASE_URL}/auth/v1/verify?${params}`
}

// ── Email templates ──────────────────────────────────────────────────────────

function wrapLayout(content: string): string {
  return /* html */`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Supporters World Cup 2026</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400&display=swap');
    body { margin: 0; padding: 0; background-color: #0a0a1a; }
    a    { color: inherit; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a1a;font-family:'DM Mono','Courier New',monospace;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0"
         style="background-color:#0a0a1a;min-height:100vh;">
    <tr><td align="center" style="padding:0 0 40px;">

      <!-- max-width container -->
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

        <!-- card -->
        <tr>
          <td style="background-color:#0d1020;border-left:2px solid #E8C84A;
                     border-right:2px solid #E8C84A;padding:40px 36px 36px;">
            <!-- eyebrow -->
            <p style="font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
                      font-size:11px;color:#E8C84A;letter-spacing:5px;opacity:.6;
                      margin:0 0 20px;">
              SUPPORTERS WORLD CUP 2026
            </p>
            ${content}
          </td>
        </tr>

        <!-- bottom border -->
        <tr>
          <td style="height:2px;background:linear-gradient(90deg,transparent 0%,#E8C84A 30%,#E8C84A 70%,transparent 100%);"></td>
        </tr>

        <!-- footer -->
        <tr>
          <td style="background-color:#080810;border-left:2px solid #1e2a4a;
                     border-right:2px solid #1e2a4a;border-bottom:2px solid #1e2a4a;
                     padding:24px 36px;" align="center">
            <p style="font-family:'DM Mono','Courier New',monospace;font-size:10px;
                      color:rgba(255,255,255,.2);letter-spacing:.4px;
                      line-height:1.8;margin:0;">
              Si tu n'as pas demandé cet email, ignore-le simplement.<br />
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

function ctaButton(href: string, label: string): string {
  return /* html */`
    <table width="100%" border="0" cellspacing="0" cellpadding="0"
           style="margin-bottom:32px;">
      <tr>
        <td align="center">
          <a href="${href}"
             style="display:inline-block;
                    background:linear-gradient(135deg,#E8C84A 0%,#c9a830 100%);
                    color:#05080F;
                    font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
                    font-size:16px;letter-spacing:3px;text-decoration:none;
                    padding:16px 44px;border-radius:2px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`
}

function divider(): string {
  return `<table width="100%" border="0" cellspacing="0" cellpadding="0"
                 style="margin-bottom:20px;">
    <tr><td style="border-top:1px solid rgba(232,200,74,.15);font-size:0;">&nbsp;</td></tr>
  </table>`
}

function linkFallback(href: string): string {
  return /* html */`
    <p style="font-family:'DM Mono','Courier New',monospace;font-size:10px;
              color:rgba(255,255,255,.28);letter-spacing:.4px;line-height:1.8;
              margin:0;word-break:break-all;">
      Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur&nbsp;:<br />
      <a href="${href}"
         style="color:rgba(232,200,74,.55);text-decoration:underline;font-size:10px;">
        ${href}
      </a>
    </p>`
}

// ── Per-type content ─────────────────────────────────────────────────────────

function magicLinkContent(link: string): string {
  return wrapLayout(/* html */`
    <h1 style="font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
               font-size:28px;color:#ffffff;letter-spacing:2px;margin:0 0 10px;">
      CONNEXION INSTANTANÉE
    </h1>
    <p style="font-family:'DM Mono','Courier New',monospace;font-size:11px;
              color:rgba(255,255,255,.45);letter-spacing:.4px;line-height:1.8;
              margin:0 0 32px;">
      Clique sur le bouton ci-dessous pour te connecter à Supporters World Cup 2026.<br />
      Ce lien est valable <strong style="color:rgba(232,200,74,.7);">1 heure</strong>
      et ne peut être utilisé qu'une seule fois.
    </p>
    ${ctaButton(link, 'SE CONNECTER')}
    ${divider()}
    ${linkFallback(link)}
  `)
}

function signupContent(link: string): string {
  return wrapLayout(/* html */`
    <h1 style="font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
               font-size:28px;color:#ffffff;letter-spacing:2px;margin:0 0 10px;">
      CONFIRME TON ADRESSE EMAIL
    </h1>
    <p style="font-family:'DM Mono','Courier New',monospace;font-size:11px;
              color:rgba(255,255,255,.45);letter-spacing:.4px;line-height:1.8;
              margin:0 0 32px;">
      Bienvenue dans Supporters World Cup 2026&nbsp;!<br />
      Clique sur le bouton ci-dessous pour valider ton adresse et accéder à la carte.
    </p>
    ${ctaButton(link, 'CONFIRMER MON EMAIL')}
    ${divider()}
    ${linkFallback(link)}
  `)
}

function recoveryContent(link: string): string {
  return wrapLayout(/* html */`
    <h1 style="font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
               font-size:28px;color:#ffffff;letter-spacing:2px;margin:0 0 10px;">
      RÉINITIALISATION DU MOT DE PASSE
    </h1>
    <p style="font-family:'DM Mono','Courier New',monospace;font-size:11px;
              color:rgba(255,255,255,.45);letter-spacing:.4px;line-height:1.8;
              margin:0 0 32px;">
      Tu as demandé une réinitialisation de ton mot de passe.<br />
      Clique sur le bouton ci-dessous pour en définir un nouveau.
    </p>
    ${ctaButton(link, 'RÉINITIALISER MON MOT DE PASSE')}
    ${divider()}
    ${linkFallback(link)}
  `)
}

function emailChangeContent(link: string): string {
  return wrapLayout(/* html */`
    <h1 style="font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
               font-size:28px;color:#ffffff;letter-spacing:2px;margin:0 0 10px;">
      CONFIRME TON NOUVEL EMAIL
    </h1>
    <p style="font-family:'DM Mono','Courier New',monospace;font-size:11px;
              color:rgba(255,255,255,.45);letter-spacing:.4px;line-height:1.8;
              margin:0 0 32px;">
      Une demande de changement d'adresse email a été effectuée.<br />
      Clique sur le bouton pour valider ta nouvelle adresse.
    </p>
    ${ctaButton(link, 'CONFIRMER MON NOUVEL EMAIL')}
    ${divider()}
    ${linkFallback(link)}
  `)
}

// ── Email subject & body per action type ────────────────────────────────────

type EmailPayload = { subject: string; html: string }

function buildEmail(actionType: string, link: string): EmailPayload {
  switch (actionType) {
    case 'magiclink':
      return {
        subject: 'Ton lien de connexion — Supporters World Cup 2026',
        html: magicLinkContent(link),
      }
    case 'signup':
      return {
        subject: 'Confirme ton adresse email — Supporters World Cup 2026',
        html: signupContent(link),
      }
    case 'recovery':
      return {
        subject: 'Réinitialisation de mot de passe — Supporters World Cup 2026',
        html: recoveryContent(link),
      }
    case 'email_change':
    case 'email_change_new':
      return {
        subject: 'Confirme ton nouvel email — Supporters World Cup 2026',
        html: emailChangeContent(link),
      }
    default:
      return {
        subject: 'Action requise — Supporters World Cup 2026',
        html: magicLinkContent(link),
      }
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const body = await req.text()
  const signature = req.headers.get('x-supabase-signature')

  if (!(await verifyHookSignature(body, signature))) {
    console.error('[send-magic-link] invalid hook signature')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let payload: { user: { email: string }; email_data: Record<string, string> }
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { user, email_data } = payload
  const { token_hash, email_action_type, redirect_to } = email_data

  const link = buildVerifyUrl(token_hash, email_action_type, redirect_to)
  const { subject, html } = buildEmail(email_action_type, link)

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [user.email], subject, html }),
  })

  if (!resendRes.ok) {
    const error = await resendRes.text()
    console.error('[send-magic-link] Resend error:', error)
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log(`[send-magic-link] sent ${email_action_type} to ${user.email}`)
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
