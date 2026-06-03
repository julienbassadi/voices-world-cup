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

  confirmPurchase: (countryId, count, message) => {
    const state = get()
    const cells = state.cellsByCountry[countryId] ?? []
    const occupied = new Set((state.pixelsByCountry[countryId] ?? []).map(p => p.id))
    const available = cells.filter(c => !occupied.has(c.id))
    const toAdd = available.slice(0, count)
    if (toAdd.length === 0) return 0
    set((s) => ({
      pixelsByCountry: {
        ...s.pixelsByCountry,
        [countryId]: [
          ...(s.pixelsByCountry[countryId] ?? []),
          ...toAdd.map(c => ({ id: c.id, lat: c.lat, lng: c.lng, userId: null, message })),
        ],
      },
    }))
    return toAdd.length
  },

  getPixelCount: (countryId) =>
    (get().pixelsByCountry[countryId] ?? []).length,

  scaleFactor: (countryId) =>
    1 + (get().pixelsByCountry[countryId] ?? []).length * 0.0008,
}))

export default useMapStore
