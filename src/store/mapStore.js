import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import useAuthStore from './authStore'

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

  loadPixels: async () => {
    const { data, error } = await supabase.from('pixels').select()
    if (error) return console.error('loadPixels:', error)
    const pbc = {}
    for (const p of data) {
      if (!pbc[p.country_iso]) pbc[p.country_iso] = []
      pbc[p.country_iso].push({ id: p.id, lat: p.x, lng: p.y, userId: p.user_id, audioUrl: p.audio_url })
    }
    set({ pixelsByCountry: pbc })
  },

  subscribeToPixels: () => {
    const channel = supabase
      .channel('public:pixels')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pixels' }, ({ new: p }) => {
        set(state => {
          const existing = state.pixelsByCountry[p.country_iso] ?? []
          if (existing.some(px => px.id === p.id)) return state
          const pixel = { id: p.id, lat: p.x, lng: p.y, userId: p.user_id, audioUrl: p.audio_url }
          return {
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

  addPixels: async (countryIso, pixelsArray, audioUrl = null) => {
    const userId = useAuthStore.getState().user?.id
    console.log('[mapStore.addPixels]', { countryIso, count: pixelsArray.length, userId, audioUrl })
    const rows = pixelsArray.map(cell => ({
      user_id: userId,
      country_iso: countryIso,
      x: cell.lat,
      y: cell.lng,
      audio_url: audioUrl,
    }))
    console.log('[mapStore.addPixels] rows à insérer :', rows)
    const { data, error } = await supabase.from('pixels').insert(rows).select()
    if (error) {
      console.error('[mapStore.addPixels] Erreur Supabase :', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      throw new Error(`Insertion pixels échouée : ${error.message}`)
    }
    console.log('[mapStore.addPixels] Pixels insérés :', data)
    const newPixels = data.map(p => ({ id: p.id, lat: p.x, lng: p.y, userId: p.user_id, audioUrl: p.audio_url }))
    set(state => ({
      pixelsByCountry: {
        ...state.pixelsByCountry,
        [countryIso]: [...(state.pixelsByCountry[countryIso] ?? []), ...newPixels],
      },
    }))
  },

  commitPendingPixels: async (audioUrl = null) => {
    const { pendingPixels, cellsByCountry } = get()
    console.log('[mapStore.commitPendingPixels]', { pendingPixels: [...pendingPixels], cellsKeys: Object.keys(cellsByCountry), audioUrl })
    const byCountry = {}
    for (const key of pendingPixels) {
      const sep  = key.indexOf(':')
      const iso  = key.slice(0, sep)
      const cId  = key.slice(sep + 1)
      const cell = (cellsByCountry[iso] ?? []).find(c => c.id === cId)
      if (!cell) {
        console.warn(`[mapStore.commitPendingPixels] cellule introuvable pour clé "${key}" — cellsByCountry[${iso}] a ${(cellsByCountry[iso] ?? []).length} entrées`)
        continue
      }
      if (!byCountry[iso]) byCountry[iso] = []
      byCountry[iso].push(cell)
    }
    console.log('[mapStore.commitPendingPixels] byCountry :', byCountry)
    if (Object.keys(byCountry).length === 0) {
      throw new Error('Aucune cellule valide trouvée dans pendingPixels. Les cellules sont-elles bien chargées ?')
    }
    for (const [iso, cells] of Object.entries(byCountry)) {
      await get().addPixels(iso, cells, audioUrl)
    }
    set(state => ({
      pendingPixels: new Set(),
      confirmedPixels: new Set([...state.confirmedPixels, ...state.pendingPixels]),
    }))
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
