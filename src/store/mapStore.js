import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import useAuthStore from './authStore'

const mapPixel = p => ({
  id: p.id,
  lat: p.x,
  lng: p.y,
  gridX: p.grid_x ?? null,
  gridY: p.grid_y ?? null,
  createdAt: p.created_at ?? null,
  userId: p.user_id,
  audioUrl: p.audio_url,
  pseudo: p.pseudo ?? null,
  description: p.description ?? null,
  color: p.color ?? null,
  likes: p.likes ?? 0,
})

const useMapStore = create((set, get) => ({
  pixelsByCountry: {},
  cellsByCountry: {},

  muted: false,
  setMuted: muted => set({ muted }),

  zoomTransform: { k: 1, x: 0, y: 0 },
  setZoomTransform: (k, x, y) => set({ zoomTransform: { k, x, y } }),

  zoomResetKey: 0,
  triggerZoomReset: () => set(s => ({ zoomResetKey: s.zoomResetKey + 1 })),

  zoomToCountrySignal: null,
  zoomToCountry: (iso) => set({ zoomToCountrySignal: { iso, ts: Date.now() } }),

  playingPixels: new Set(),
  setPlayingPixels: ids => set({ playingPixels: ids instanceof Set ? ids : new Set(ids) }),

  clickedPixel: null,
  setClickedPixel: (iso, pixelId) => set({ clickedPixel: { iso, pixelId, ts: Date.now() } }),

  // ── Pending pixels — selected by user, not yet confirmed ─────────────────
  pendingPixels: new Set(),

  togglePendingPixel: (iso, cellId) =>
    set(state => {
      const key  = `${iso}:${cellId}`
      const next = new Set(state.pendingPixels)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { pendingPixels: next }
    }),

  clearPendingPixels: () => set({ pendingPixels: new Set() }),

  // ── Grid pixels — modal 200×200 selection ─────────────────────────────────
  pendingGridPixels: new Set(),

  toggleGridPixel: (iso, gx, gy) =>
    set(state => {
      const key  = `${iso}:${gx}:${gy}`
      const next = new Set(state.pendingGridPixels)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { pendingGridPixels: next }
    }),

  clearGridPendingPixels: () => set({ pendingGridPixels: new Set() }),

  commitGridPendingPixels: async ({ audioUrl, pseudo, description, color } = {}) => {
    const { pendingGridPixels } = get()
    const userId = useAuthStore.getState().user?.id

    const rows = []
    for (const key of pendingGridPixels) {
      const parts    = key.split(':')
      const iso      = parts[0]
      const gx       = parseInt(parts[1])
      const gy       = parseInt(parts[2])
      rows.push({
        user_id:     userId,
        country_iso: iso,
        grid_x:      gx,
        grid_y:      gy,
        x:           0,  // legacy NOT NULL columns — no longer used for positioning
        y:           0,
        audio_url:   audioUrl  ?? null,
        pseudo:      pseudo    ?? null,
        description: description ?? null,
        color:       color     ?? null,
      })
    }

    if (rows.length === 0) throw new Error('Aucun pixel sélectionné.')

    const { data, error } = await supabase.from('pixels').insert(rows).select()
    if (error) throw new Error(`Insertion pixels échouée : ${error.message}`)

    const byCountry = {}
    for (const p of data) {
      if (!byCountry[p.country_iso]) byCountry[p.country_iso] = []
      byCountry[p.country_iso].push(mapPixel(p))
    }

    set(state => {
      const newPbc = { ...state.pixelsByCountry }
      for (const [iso, pixels] of Object.entries(byCountry)) {
        newPbc[iso] = [...(newPbc[iso] ?? []), ...pixels]
      }
      return {
        pendingGridPixels: new Set(),
        totalVoices:       state.totalVoices + data.length,
        pixelsByCountry:   newPbc,
      }
    })
  },

  // ── Confirmed pixels — committed to DB, stays visible at full opacity ─────
  confirmedPixels: new Set(),

  clearConfirmedPixels: () => set({ confirmedPixels: new Set() }),

  // ── Supabase ──────────────────────────────────────────────────────────────

  totalVoices: 0,

  loadPixels: async () => {
    const [pixelsRes, countRes] = await Promise.all([
      supabase.from('pixels').select(),
      supabase.from('pixels').select('*', { count: 'exact', head: true }),
    ])
    if (pixelsRes.error) return console.error('loadPixels:', pixelsRes.error)
    if (countRes.error) return console.error('loadTotalVoices:', countRes.error)
    const pbc = {}
    for (const p of pixelsRes.data) {
      if (!pbc[p.country_iso]) pbc[p.country_iso] = []
      pbc[p.country_iso].push(mapPixel(p))
    }
    set({ pixelsByCountry: pbc, totalVoices: countRes.count ?? 0 })
  },

  subscribeToPixels: () => {
    const channel = supabase
      .channel('public:pixels')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pixels' }, ({ new: p }) => {
        set(state => {
          const existing = state.pixelsByCountry[p.country_iso] ?? []
          if (existing.some(px => px.id === p.id)) return state
          const pixel = mapPixel(p)
          return {
            totalVoices: state.totalVoices + 1,
            pixelsByCountry: {
              ...state.pixelsByCountry,
              [p.country_iso]: [...existing, pixel],
            },
          }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pixels' }, ({ old: p }) => {
        set(state => {
          const iso      = p.country_iso
          const existing = state.pixelsByCountry[iso] ?? []
          const filtered = existing.filter(px => px.id !== p.id)
          const pbc      = { ...state.pixelsByCountry }
          if (filtered.length > 0) pbc[iso] = filtered
          else delete pbc[iso]
          return {
            totalVoices:     Math.max(0, state.totalVoices - 1),
            pixelsByCountry: pbc,
          }
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  },

  addPixels: async (countryIso, pixelsArray, { audioUrl, pseudo, description, color } = {}) => {
    const userId = useAuthStore.getState().user?.id
    const rows = pixelsArray.map(cell => ({
      user_id: userId,
      country_iso: countryIso,
      x: cell.lat,
      y: cell.lng,
      audio_url: audioUrl ?? null,
      pseudo: pseudo ?? null,
      description: description ?? null,
      color: color ?? null,
    }))
    const { data, error } = await supabase.from('pixels').insert(rows).select()
    if (error) {
      throw new Error(`Insertion pixels échouée : ${error.message}`)
    }
    const newPixels = data.map(mapPixel)
    set(state => ({
      totalVoices: state.totalVoices + newPixels.length,
      pixelsByCountry: {
        ...state.pixelsByCountry,
        [countryIso]: [...(state.pixelsByCountry[countryIso] ?? []), ...newPixels],
      },
    }))
  },

  commitPendingPixels: async ({ audioUrl, pseudo, description, color } = {}) => {
    const { pendingPixels, cellsByCountry } = get()
    const byCountry = {}
    for (const key of pendingPixels) {
      const sep  = key.indexOf(':')
      const iso  = key.slice(0, sep)
      const cId  = key.slice(sep + 1)
      const cell = (cellsByCountry[iso] ?? []).find(c => c.id === cId)
      if (!cell) continue
      if (!byCountry[iso]) byCountry[iso] = []
      byCountry[iso].push(cell)
    }
    if (Object.keys(byCountry).length === 0) {
      throw new Error('Aucune cellule valide trouvée dans pendingPixels. Les cellules sont-elles bien chargées ?')
    }
    for (const [iso, cells] of Object.entries(byCountry)) {
      await get().addPixels(iso, cells, { audioUrl, pseudo, description, color })
    }
    set(state => ({
      pendingPixels: new Set(),
      confirmedPixels: new Set([...state.confirmedPixels, ...state.pendingPixels]),
    }))
  },

  // ── Likes ─────────────────────────────────────────────────────────────────

  likePixel: async (pixelId) => {
    const { error } = await supabase.rpc('increment_pixel_likes', { p_id: pixelId })
    if (error) throw new Error(error.message)
  },

  unlikePixel: async (pixelId) => {
    const { error } = await supabase.rpc('decrement_pixel_likes', { p_id: pixelId })
    if (error) throw new Error(error.message)
  },

  // ── Comments ──────────────────────────────────────────────────────────────

  loadComments: async (pixelId) => {
    const { data, error } = await supabase
      .from('comments')
      .select('id, content, created_at')
      .eq('pixel_id', pixelId)
      .order('created_at', { ascending: true })
    if (error) { console.error('loadComments:', error); return [] }
    return data
  },

  addComment: async (pixelId, content) => {
    const { error } = await supabase
      .from('comments')
      .insert({ pixel_id: pixelId, content })
    if (error) throw new Error(error.message)
  },

  // ── Local helpers ─────────────────────────────────────────────────────────

  addPixel: (countryId, pixel) =>
    set(state => ({
      pixelsByCountry: {
        ...state.pixelsByCountry,
        [countryId]: [...(state.pixelsByCountry[countryId] ?? []), pixel],
      },
    })),

  setCells: (countryId, cells) =>
    set(state => ({
      cellsByCountry: { ...state.cellsByCountry, [countryId]: cells },
    })),

  getPixelCount: (countryId) =>
    (get().pixelsByCountry[countryId] ?? []).length,

  scaleFactor: (countryId) =>
    1 + (get().pixelsByCountry[countryId] ?? []).length * 0.0008,
}))

export default useMapStore
