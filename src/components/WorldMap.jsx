import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import worldTopo from 'world-atlas/countries-110m.json'
import franceData from '../data/france.json'
import useMapStore from '../store/mapStore'

const CELL = 4

const WORLD_FEATURES = topojson.feature(worldTopo, worldTopo.objects.countries).features

export const WORLD_EXTENT = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[[-179.9, -60], [179.9, -60], [179.9, 80], [-179.9, 80], [-179.9, -60]]],
  },
}

export const QUALIFIED = [
  { numId: 250, iso: 'fr', name: 'France',          flag: '🇫🇷' },
  { numId:  76, iso: 'br', name: 'Brésil',           flag: '🇧🇷' },
  { numId:  32, iso: 'ar', name: 'Argentine',        flag: '🇦🇷' },
  { numId: 276, iso: 'de', name: 'Allemagne',        flag: '🇩🇪' },
  { numId: 724, iso: 'es', name: 'Espagne',          flag: '🇪🇸' },
  { numId: 620, iso: 'pt', name: 'Portugal',         flag: '🇵🇹' },
  { numId: 528, iso: 'nl', name: 'Pays-Bas',         flag: '🇳🇱' },
  { numId:  56, iso: 'be', name: 'Belgique',         flag: '🇧🇪' },
  { numId: 756, iso: 'ch', name: 'Suisse',           flag: '🇨🇭' },
  { numId: 191, iso: 'hr', name: 'Croatie',          flag: '🇭🇷' },
  { numId: 616, iso: 'pl', name: 'Pologne',          flag: '🇵🇱' },
  { numId: 688, iso: 'rs', name: 'Serbie',           flag: '🇷🇸' },
  { numId: 840, iso: 'us', name: 'États-Unis',       flag: '🇺🇸' },
  { numId: 124, iso: 'ca', name: 'Canada',           flag: '🇨🇦' },
  { numId: 484, iso: 'mx', name: 'Mexique',          flag: '🇲🇽' },
  { numId: 170, iso: 'co', name: 'Colombie',         flag: '🇨🇴' },
  { numId: 218, iso: 'ec', name: 'Équateur',         flag: '🇪🇨' },
  { numId: 858, iso: 'uy', name: 'Uruguay',          flag: '🇺🇾' },
  { numId: 504, iso: 'ma', name: 'Maroc',            flag: '🇲🇦' },
  { numId: 566, iso: 'ng', name: 'Nigeria',          flag: '🇳🇬' },
  { numId: 686, iso: 'sn', name: 'Sénégal',          flag: '🇸🇳' },
  { numId: 120, iso: 'cm', name: 'Cameroun',         flag: '🇨🇲' },
  { numId: 288, iso: 'gh', name: 'Ghana',            flag: '🇬🇭' },
  { numId: 788, iso: 'tn', name: 'Tunisie',          flag: '🇹🇳' },
  { numId: 392, iso: 'jp', name: 'Japon',            flag: '🇯🇵' },
  { numId: 410, iso: 'kr', name: 'Corée du Sud',     flag: '🇰🇷' },
  { numId: 364, iso: 'ir', name: 'Iran',             flag: '🇮🇷' },
  { numId: 682, iso: 'sa', name: 'Arabie Saoudite',  flag: '🇸🇦' },
  { numId:  36, iso: 'au', name: 'Australie',        flag: '🇦🇺' },
  { numId: 634, iso: 'qa', name: 'Qatar',            flag: '🇶🇦' },
  { numId: 818, iso: 'eg', name: 'Égypte',           flag: '🇪🇬' },
  { numId: 792, iso: 'tr', name: 'Turquie',          flag: '🇹🇷' },
]

const toWorldId = n => String(n).padStart(3, '0')
const QUALIFIED_IDS = new Set(QUALIFIED.map(c => toWorldId(c.numId)))

function buildGrid(projection, feature) {
  const pathGen = d3.geoPath().projection(projection)
  const [[x0, y0], [x1, y1]] = pathGen.bounds(feature)
  const cells = []
  const cols = Math.ceil((x1 - x0) / CELL)
  const rows = Math.ceil((y1 - y0) / CELL)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = x0 + col * CELL
      const y = y0 + row * CELL
      const geo = projection.invert([x + CELL / 2, y + CELL / 2])
      if (geo && d3.geoContains(feature, geo))
        cells.push({ id: `${row}:${col}`, x, y, lat: geo[1], lng: geo[0] })
    }
  }
  return cells
}

export default function WorldMap({ onCountryClick, onCountryHover }) {
  const svgRef          = useRef(null)
  const containerRef    = useRef(null)
  // iso -> array[3] of D3 selections (one per tile), for France scale + pixel sync
  const groupsRef       = useRef({})
  const cellsGroupsRef  = useRef({})
  const projCentroidRef = useRef(null)
  const occupiedMaps    = useRef({})
  const pixelsMaps      = useRef({})
  const callbacksRef    = useRef({ onCountryClick, onCountryHover })

  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    callbacksRef.current = { onCountryClick, onCountryHover }
  }, [onCountryClick, onCountryHover])

  const pixelsByCountry = useMapStore(s => s.pixelsByCountry)
  const playingPixels   = useMapStore(s => s.playingPixels)
  const frPixelCount = (pixelsByCountry.fr ?? []).length
  const frScale = 1 + frPixelCount * 0.0008

  // ─── D3 setup — runs once ────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    const width  = container.clientWidth
    const height = container.clientHeight

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
    svg.selectAll('*').remove()

    const g = svg.append('g')

    const projection = d3.geoMercator()
      .fitExtent([[0, 0], [width, height]], WORLD_EXTENT)
    const pathGen = d3.geoPath().projection(projection)

    // True tile width: Mercator maps longitude linearly, so 360° = 2π × scale pixels.
    // This is NOT equal to `width` whenever fitExtent is height-constrained
    // (e.g. 16:9 screens), which would otherwise leave a visible gap at the Pacific seam.
    const tileW = 2 * Math.PI * projection.scale()

    projCentroidRef.current = projection(d3.geoCentroid(franceData))

    // Pre-compute cells for every qualified country ONCE — shared across all 3 tiles
    const precomputed = {}
    QUALIFIED.forEach(country => {
      const feature = country.iso === 'fr'
        ? franceData
        : WORLD_FEATURES.find(f => f.id === toWorldId(country.numId))
      if (!feature) return
      const cells = buildGrid(projection, feature)
      useMapStore.getState().setCells(country.iso, cells)
      precomputed[country.iso] = { feature, cells }
    })

    // ── 3 tiles: L(-1) C(0) R(+1)  ──────────────────────────────────────────
    // Tiles are offset in g's local space by ±width.
    // The zoom handler normalises tx to [0, tileW) and updates g's transform,
    // so the left tile always covers the gap on the left and the right tile
    // covers the gap on the right — seamless wrap at every zoom level.
    ;[-1, 0, 1].forEach(dx => {
      const suf  = dx === -1 ? 'L' : dx === 1 ? 'R' : 'C'
      const tile = g.append('g')
      if (dx !== 0) tile.attr('transform', `translate(${dx * tileW}, 0)`)

      // Background (non-qualified) countries
      tile.selectAll('path.country')
        .data(WORLD_FEATURES.filter(f => !QUALIFIED_IDS.has(f.id)))
        .join('path')
        .attr('class', 'country')
        .attr('d', pathGen)
        .style('fill', 'var(--country-fill)')
        .style('stroke', 'var(--country-stroke)')
        .attr('stroke-width', 0.5)
        .attr('pointer-events', 'none')

      // Qualified country overlays — same data, 3 visual copies
      QUALIFIED.forEach(country => {
        const pre = precomputed[country.iso]
        if (!pre) return
        const { feature, cells } = pre

        const [[bx, by], [bx1, by1]] = pathGen.bounds(feature)
        const bw = bx1 - bx
        const bh = by1 - by

        // SVG IDs must be unique in the document — suffix per tile
        const flagId = `flag-${country.iso}-${suf}`
        const clipId = `clip-${country.iso}-${suf}`

        const cg = tile.append('g')
        if (!groupsRef.current[country.iso]) groupsRef.current[country.iso] = []
        groupsRef.current[country.iso].push(cg)

        const defs = cg.append('defs')

        // Flag image pattern
        defs.append('pattern')
          .attr('id', flagId)
          .attr('patternUnits', 'userSpaceOnUse')
          .attr('x', bx).attr('y', by)
          .attr('width', bw).attr('height', bh)
          .append('image')
          .attr('href', `https://flagcdn.com/w160/${country.iso}.png`)
          .attr('x', 0).attr('y', 0)
          .attr('width', bw).attr('height', bh)
          .attr('preserveAspectRatio', 'xMidYMid slice')

        // Flag territory fill
        cg.append('path')
          .datum(feature).attr('d', pathGen)
          .attr('fill', `url(#${flagId})`)
          .attr('fill-opacity', 0.4)
          .attr('stroke', 'none')
          .attr('pointer-events', 'none')

        // Clip path — confines the pixel grid to the country shape
        defs.append('clipPath').attr('id', clipId)
          .append('path').datum(feature).attr('d', pathGen)

        // Pixel grid — present on ALL tiles so purchased pixels are visible
        // when the country appears on a side copy
        const cellsGroup = cg.append('g').attr('clip-path', `url(#${clipId})`)
        if (!cellsGroupsRef.current[country.iso]) cellsGroupsRef.current[country.iso] = []
        cellsGroupsRef.current[country.iso].push(cellsGroup)

        cellsGroup.selectAll('rect')
          .data(cells, d => d.id)
          .join('rect')
          .attr('x', d => d.x).attr('y', d => d.y)
          .attr('width', CELL).attr('height', CELL)
          .attr('fill', 'transparent').attr('fill-opacity', 0)
          .attr('stroke', '#1a2a4a').attr('stroke-width', 0.5)

        // Events on ALL tiles — hover/click work on every visible copy
        const { iso } = country
        cellsGroup
          .on('mouseover', function(event) {
            if (event.target.tagName !== 'rect') return
            const d = event.target.__data__
            if (!d) return
            callbacksRef.current.onCountryHover?.(country)
            svg.style('cursor', 'pointer')
            const occupied = (occupiedMaps.current[iso] ?? new Set()).has(d.id)
            if (occupied) {
              d3.select(event.target).attr('fill', '#FFE085').attr('fill-opacity', 1)
              setTooltip({ x: event.clientX + 14, y: event.clientY - 10, message: '▶ ÉCOUTER' })
            } else {
              d3.select(event.target).attr('fill', '#E8C84A').attr('fill-opacity', 0.3)
              setTooltip({ x: event.clientX + 14, y: event.clientY - 10, message: '+ PLACER MA VOIX' })
            }
          })
          .on('mouseout', function(event) {
            if (event.target.tagName !== 'rect') return
            const d = event.target.__data__
            if (!d) return
            setTooltip(null)
            svg.style('cursor', 'grab')
            const occupied = (occupiedMaps.current[iso] ?? new Set()).has(d.id)
            d3.select(event.target)
              .attr('fill', occupied ? '#E8C84A' : 'transparent')
              .attr('fill-opacity', occupied ? 0.9 : 0)
          })
          .on('click', function(event) {
            if (event.target.tagName !== 'rect') return
            const d = event.target.__data__
            if (!d) return
            const occupied = (occupiedMaps.current[iso] ?? new Set()).has(d.id)
            if (occupied) {
              useMapStore.getState().setClickedPixel(iso, d.id)
            } else {
              callbacksRef.current.onCountryClick?.(country)
            }
          })

        // Country border
        cg.append('path').datum(feature).attr('d', pathGen)
          .attr('fill', 'none')
          .style('stroke', 'var(--border-country)')
          .attr('stroke-width', 0.5)
          .attr('pointer-events', 'none')
      })
    })

    // ── Zoom ──────────────────────────────────────────────────────────────────
    // Horizontal: raw tx unconstrained, normalised to [0, screenTileW) each frame.
    //   screenTileW = tileW × k  (tileW = 2π × scale, computed above)
    //   The three tiles (at offsets ±tileW in local space) always cover the
    //   viewport — left tile fills the left gap, right tile fills the right gap.
    //
    // Vertical: clamped so the map always fills the screen in height.
    //   ty ∈ [height × (1 - k), 0]
    //
    // __zoom is updated with the normalised transform so subsequent drag events
    // build on the normalised position (prevents tx drift / float overflow).
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('start', () => svg.style('cursor', 'grabbing'))
      .on('end',   () => svg.style('cursor', 'grab'))
      .on('zoom', function(event) {
        const t = event.transform
        const screenTileW = tileW * t.k   // tileW captured from outer scope

        const normTx = ((t.x % screenTileW) + screenTileW) % screenTileW
        const normTy = Math.min(0, Math.max(height * (1 - t.k), t.y))

        const nt = d3.zoomIdentity.translate(normTx, normTy).scale(t.k)
        g.attr('transform', nt)
        svg.property('__zoom', nt)
        useMapStore.getState().setZoomTransform(nt.k, nt.x, nt.y)
      })
    svg.call(zoom)
    svg.style('cursor', 'grab')

    const onResize = () =>
      svg.attr('width', container.clientWidth).attr('height', container.clientHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ─── Sync purchased pixels + playing animation across ALL 3 tile copies ──
  useEffect(() => {
    QUALIFIED.forEach(({ iso }) => {
      const pixels = pixelsByCountry[iso] ?? []
      const ids = new Set(pixels.map(p => p.id))
      occupiedMaps.current[iso] = ids
      pixelsMaps.current[iso] = pixels
      const groups = cellsGroupsRef.current[iso] ?? []
      groups.forEach(group => {
        group.selectAll('rect')
          .attr('fill', d => ids.has(d.id) ? '#E8C84A' : 'transparent')
          .attr('fill-opacity', d => ids.has(d.id) ? 0.9 : 0)
          .attr('stroke', d => {
            if (ids.has(d.id) && playingPixels.has(`${iso}:${d.id}`)) return '#ffffff'
            return ids.has(d.id) ? '#E8C84A' : '#1a2a4a'
          })
          .attr('stroke-width', d =>
            ids.has(d.id) && playingPixels.has(`${iso}:${d.id}`) ? 1.5 : 0.5
          )
          .classed('pixel-playing', d => ids.has(d.id) && playingPixels.has(`${iso}:${d.id}`))
      })
    })
  }, [pixelsByCountry, playingPixels])

  // ─── Scale France from its centroid — applied to all 3 tile copies ───────
  useEffect(() => {
    const frGroups = groupsRef.current.fr ?? []
    if (frGroups.length === 0 || !projCentroidRef.current) return
    const [cx, cy] = projCentroidRef.current
    const sf = frScale
    frGroups.forEach(group => {
      group.attr('transform', `translate(${cx * (1 - sf)},${cy * (1 - sf)}) scale(${sf})`)
    })
  }, [frScale])

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', backgroundColor: 'var(--bg)', width: '100vw', height: '100vh', overflow: 'clip' }}
    >
      <svg ref={svgRef} style={{ display: 'block' }} />

      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y,
          background: 'rgba(5,8,15,0.95)', border: '1px solid #E8C84A',
          color: '#E8C84A', fontSize: 12, fontFamily: "'DM Mono', monospace",
          padding: '4px 8px', pointerEvents: 'none', maxWidth: 200, zIndex: 100,
        }}>
          {tooltip.message}
        </div>
      )}
    </div>
  )
}
