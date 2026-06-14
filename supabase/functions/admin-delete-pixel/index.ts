import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN_PASSWORD            = Deno.env.get('ADMIN_PASSWORD')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extractStoragePath(url: string): string | null {
  const marker = '/storage/v1/object/public/audio/'
  const i = url.indexOf(marker)
  return i >= 0 ? url.slice(i + marker.length) : null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST')    return new Response('Method Not Allowed', { status: 405 })

  const { pixelId, adminPassword } = await req.json()

  if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
    console.warn('[admin-delete-pixel] invalid admin password attempt')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (!pixelId) {
    return new Response(JSON.stringify({ error: 'Missing pixelId' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Fetch pixel to get audio_url before deletion
  const { data: pixel, error: fetchErr } = await admin
    .from('pixels')
    .select('id, audio_url')
    .eq('id', pixelId)
    .maybeSingle()

  if (fetchErr) {
    console.error('[admin-delete-pixel] fetch error:', fetchErr.message)
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
  if (!pixel) {
    return new Response(JSON.stringify({ error: 'Pixel not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Delete audio file from storage (non-fatal)
  if (pixel.audio_url) {
    const path = extractStoragePath(pixel.audio_url)
    if (path) {
      const { error: storageErr } = await admin.storage.from('audio').remove([path])
      if (storageErr) {
        console.warn('[admin-delete-pixel] storage delete warning:', storageErr.message)
      }
    }
  }

  // Delete associated comments (non-fatal)
  await admin.from('comments').delete().eq('pixel_id', pixelId)

  // Delete pixel
  const { error: deleteErr } = await admin.from('pixels').delete().eq('id', pixelId)
  if (deleteErr) {
    console.error('[admin-delete-pixel] delete error:', deleteErr.message)
    return new Response(JSON.stringify({ error: deleteErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  console.log(`[admin-delete-pixel] ✓ pixel ${pixelId} deleted`)
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
