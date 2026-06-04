import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import useAuthStore from './authStore'

const mapPixel = p => ({
  id: p.id,
  lat: p.x,
  lng: p.y,
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
