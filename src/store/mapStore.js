import { create } from 'zustand'

const useMapStore = create((set, get) => ({
  pixelsByCountry: { fr: [] },
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
  pendingPixels: new Set(),  // Set<"iso:cellId">

  togglePendingPixel: (iso, cellId) =>
    set(state => {
      const key  = `${iso}:${cellId}`
      const next = new Set(state.pendingPixels)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { pendingPixels: next }
    }),

  clearPendingPixels: () => set({ pendingPixels: new Set() }),

  commitPendingPixels: (message) =>
    set(state => {
      const newPbc = { ...state.pixelsByCountry }
      for (const key of state.pendingPixels) {
        const sep  = key.indexOf(':')
        const iso  = key.slice(0, sep)
        const cId  = key.slice(sep + 1)
        const cell = (state.cellsByCountry[iso] ?? []).find(c => c.id === cId)
        if (!cell) continue
        if (!newPbc[iso]) newPbc[iso] = []
        newPbc[iso] = [
          ...newPbc[iso],
          { id: cId, lat: cell.lat, lng: cell.lng, userId: null, message },
        ]
      }
      return { pixelsByCountry: newPbc, pendingPixels: new Set() }
    }),

  addPixel: (countryId, pixel) =>
    set((state) => ({
      pixelsByCountry: {
        ...state.pixelsByCountry,
        [countryId]: [...(state.pixelsByCountry[countryId] ?? []), pixel],
      },
    })),

  setCells: (countryId, cells) =>
    set((state) => ({
      cellsByCountry: { ...state.cellsByCountry, [countryId]: cells },
    })),

  getPixelCount: (countryId) =>
    (get().pixelsByCountry[countryId] ?? []).length,

  scaleFactor: (countryId) =>
    1 + (get().pixelsByCountry[countryId] ?? []).length * 0.0008,
}))

export default useMapStore
