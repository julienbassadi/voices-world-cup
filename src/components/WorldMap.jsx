import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import worldTopo from 'world-atlas/countries-110m.json'
import franceData from '../data/france.json'
import useMapStore from '../store/mapStore'

const BEBAS = "'Bebas Neue', Impact, sans-serif"

const WORLD_FEATURES = topojson.feature(worldTopo, worldTopo.objects.countries).features

export const WORLD_EXTENT = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[[-179.9, -60], [179.9, -60], [179.9, 80], [-179.9, 80], [-179.9, -60]]],
  },
}

export const QUALIFIED = [
  // Pays hôtes
  { numId: 840, iso: 'us',     name: 'États-Unis',          flag: '🇺🇸' },
  { numId: 124, iso: 'ca',     name: 'Canada',              flag: '🇨🇦' },
  { numId: 484, iso: 'mx',     name: 'Mexique',             flag: '🇲🇽' },
  // Europe (16)
  { numId: 276, iso: 'de',     name: 'Allemagne',           flag: '🇩🇪' },
  { numId: 826, iso: 'gb-eng', name: 'Angleterre',          flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { numId:  40, iso: 'at',     name: 'Autriche',            flag: '🇦🇹' },
  { numId:  56, iso: 'be',     name: 'Belgique',            flag: '🇧🇪' },
  { numId:  70, iso: 'ba',     name: 'Bosnie-Herzégovine',  flag: '🇧🇦' },
  { numId: 191, iso: 'hr',     name: 'Croatie',             flag: '🇭🇷' },
  { numId: 826, iso: 'gb-sct', name: 'Écosse',              flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { numId: 724, iso: 'es',     name: 'Espagne',             flag: '🇪🇸' },
  { numId: 250, iso: 'fr',     name: 'France',              flag: '🇫🇷' },
  { numId: 578, iso: 'no',     name: 'Norvège',             flag: '🇳🇴' },
  { numId: 528, iso: 'nl',     name: 'Pays-Bas',            flag: '🇳🇱' },
  { numId: 620, iso: 'pt',     name: 'Portugal',            flag: '🇵🇹' },
  { numId: 752, iso: 'se',     name: 'Suède',               flag: '🇸🇪' },
  { numId: 756, iso: 'ch',     name: 'Suisse',              flag: '🇨🇭' },
  { numId: 203, iso: 'cz',     name: 'République tchèque',   flag: '🇨🇿' },
  { numId: 792, iso: 'tr',     name: 'Turquie',             flag: '🇹🇷' },
  // Afrique (10)
  { numId: 710, iso: 'za',     name: 'Afrique du Sud',      flag: '🇿🇦' },
  { numId:  12, iso: 'dz',     name: 'Algérie',             flag: '🇩🇿' },
  { numId: 132, iso: 'cv',     name: 'Cap-Vert',            flag: '🇨🇻' },
  { numId: 384, iso: 'ci',     name: "Côte d'Ivoire",       flag: '🇨🇮' },
  { numId: 818, iso: 'eg',     name: 'Égypte',              flag: '🇪🇬' },
  { numId: 288, iso: 'gh',     name: 'Ghana',               flag: '🇬🇭' },
  { numId: 504, iso: 'ma',     name: 'Maroc',               flag: '🇲🇦' },
  { numId: 180, iso: 'cd',     name: 'RD Congo',            flag: '🇨🇩' },
  { numId: 686, iso: 'sn',     name: 'Sénégal',             flag: '🇸🇳' },
  { numId: 788, iso: 'tn',     name: 'Tunisie',             flag: '🇹🇳' },
  // Asie (9)
  { numId: 682, iso: 'sa',     name: 'Arabie Saoudite',     flag: '🇸🇦' },
  { numId:  36, iso: 'au',     name: 'Australie',           flag: '🇦🇺' },
  { numId: 368, iso: 'iq',     name: 'Irak',                flag: '🇮🇶' },
  { numId: 364, iso: 'ir',     name: 'Iran',                flag: '🇮🇷' },
  { numId: 392, iso: 'jp',     name: 'Japon',               flag: '🇯🇵' },
  { numId: 400, iso: 'jo',     name: 'Jordanie',            flag: '🇯🇴' },
  { numId: 860, iso: 'uz',     name: 'Ouzbékistan',         flag: '🇺🇿' },
  { numId: 634, iso: 'qa',     name: 'Qatar',               flag: '🇶🇦' },
  { numId: 410, iso: 'kr',     name: 'Corée du Sud',        flag: '🇰🇷' },
  // Amérique du Sud (6)
  { numId:  32, iso: 'ar',     name: 'Argentine',           flag: '🇦🇷' },
  { numId:  76, iso: 'br',     name: 'Brésil',              flag: '🇧🇷' },
  { numId: 170, iso: 'co',     name: 'Colombie',            flag: '🇨🇴' },
  { numId: 218, iso: 'ec',     name: 'Équateur',            flag: '🇪🇨' },
  { numId: 600, iso: 'py',     name: 'Paraguay',            flag: '🇵🇾' },
  { numId: 858, iso: 'uy',     name: 'Uruguay',             flag: '🇺🇾' },
  // Océanie (1)
  { numId: 554, iso: 'nz',     name: 'Nouvelle-Zélande',    flag: '🇳🇿' },
  // CONCACAF hors hôtes (3)
  { numId: 531, iso: 'cw',     name: 'Curaçao',             flag: '🇨🇼' },
  { numId: 332, iso: 'ht',     name: 'Haïti',               flag: '🇭🇹' },
  { numId: 591, iso: 'pa',     name: 'Panama',              flag: '🇵🇦' },
]

const toWorldId = n => String(n).padStart(3, '0')
const QUALIFIED_IDS = new Set(QUALIFIED.map(c => toWorldId(c.numId)))

export default function WorldMap({ onCountryClick, onCountryHover }) {
  const svgRef          = useRef(null)
  const containerRef    = useRef(null)
  const groupsRef       = useRef({})
  const overlayPathsRef = useRef({})
  const projCentroidRef = useRef(null)
  const callbacksRef    = useRef({ onCountryClick, onCountryHover })

  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    callbacksRef.current = { onCountryClick, onCountryHover }
  }, [onCountryClick, onCountryHover])

  const pixelsByCountry = useMapStore(s => s.pixelsByCountry)
  const frPixelCount    = (pixelsByCountry.fr ?? []).length
  const frScale         = 1 + frPixelCount * 0.0008

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

    const tileW = 2 * Math.PI * projection.scale()
    projCentroidRef.current = projection(d3.geoCentroid(franceData))

    ;[-1, 0, 1].forEach(dx => {
      const suf  = dx === -1 ? 'L' : dx === 1 ? 'R' : 'C'
      const tile = g.append('g')
      if (dx !== 0) tile.attr('transform', `translate(${dx * tileW}, 0)`)

      // Non-qualified countries
      tile.selectAll('path.country')
        .data(WORLD_FEATURES.filter(f => !QUALIFIED_IDS.has(f.id)))
        .join('path')
        .attr('class', 'country')
        .attr('d', pathGen)
        .style('fill', 'var(--country-fill)')
        .style('stroke', 'var(--country-stroke)')
        .attr('stroke-width', 0.5)
        .attr('pointer-events', 'none')

      // Qualified countries
      QUALIFIED.forEach(country => {
        const feature = country.iso === 'fr'
          ? franceData
          : WORLD_FEATURES.find(f => f.id === toWorldId(country.numId))
        if (!feature) return

        const [[bx, by], [bx1, by1]] = pathGen.bounds(feature)
        const bw = bx1 - bx
        const bh = by1 - by

        const flagId = `flag-${country.iso}-${suf}`

        const cg = tile.append('g')
        if (!groupsRef.current[country.iso]) groupsRef.current[country.iso] = []
        groupsRef.current[country.iso].push(cg)

        const defs = cg.append('defs')

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

        // Flag background — transition on filter for brightness on hover
        const flagPath = cg.append('path')
          .datum(feature).attr('d', pathGen)
          .attr('fill', `url(#${flagId})`)
          .attr('fill-opacity', 0.4)
          .attr('stroke', 'none')
          .attr('pointer-events', 'none')
          .style('transition', 'filter 0.25s ease')

        // Intensity overlay — fill-opacity updated based on pixel count
        const overlayPath = cg.append('path')
          .datum(feature).attr('d', pathGen)
          .attr('fill', '#E8C84A')
          .attr('fill-opacity', 0)
          .attr('stroke', 'none')
          .attr('pointer-events', 'none')

        if (!overlayPathsRef.current[country.iso]) overlayPathsRef.current[country.iso] = []
        overlayPathsRef.current[country.iso].push(overlayPath)

        // Country border
        cg.append('path').datum(feature).attr('d', pathGen)
          .attr('fill', 'none')
          .style('stroke', 'var(--border-country)')
          .attr('stroke-width', 0.5)
          .attr('pointer-events', 'none')

        // Hover glow — golden blurred stroke, hidden by default
        const glowPath = cg.append('path')
          .datum(feature).attr('d', pathGen)
          .attr('fill', 'none')
          .attr('stroke', '#E8C84A')
          .attr('stroke-width', 3)
          .attr('pointer-events', 'none')
          .style('opacity', 0)
          .style('filter', 'blur(3px)')
          .style('transition', 'opacity 0.25s ease')

        // Transparent hit area for click/hover
        cg.append('path').datum(feature).attr('d', pathGen)
          .attr('fill', 'transparent')
          .attr('stroke', 'none')
          .style('cursor', 'pointer')
          .on('mouseover', function(event) {
            flagPath.style('filter', 'brightness(1.3)')
            glowPath.style('opacity', 0.55)
            callbacksRef.current.onCountryHover?.(country)
            svg.style('cursor', 'pointer')
            setTooltip({ x: event.clientX + 14, y: event.clientY - 10, message: 'VOIR LES PIXELS' })
          })
          .on('mousemove', function(event) {
            setTooltip(t => t ? { ...t, x: event.clientX + 14, y: event.clientY - 10 } : null)
          })
          .on('mouseout', function() {
            flagPath.style('filter', null)
            glowPath.style('opacity', 0)
            setTooltip(null)
            svg.style('cursor', 'grab')
          })
          .on('click', function() {
            callbacksRef.current.onCountryClick?.(country)
          })
      })
    })

    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('start', () => svg.style('cursor', 'grabbing'))
      .on('end',   () => svg.style('cursor', 'grab'))
      .on('zoom', function(event) {
        const t = event.transform
        const screenTileW = tileW * t.k
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

  // ─── Sync pixel count → overlay intensity ─────────────────────────────────
  useEffect(() => {
    QUALIFIED.forEach(({ iso }) => {
      const count   = (pixelsByCountry[iso] ?? []).length
      const opacity = Math.min(0.65, count / 40000 * 0.65)
      ;(overlayPathsRef.current[iso] ?? []).forEach(path => {
        path.attr('fill-opacity', opacity)
      })
    })
  }, [pixelsByCountry])

  // ─── Scale France from its centroid ───────────────────────────────────────
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
          padding: '4px 8px', pointerEvents: 'none', maxWidth: 260, zIndex: 100,
        }}>
          {tooltip.message}
        </div>
      )}
    </div>
  )
}
