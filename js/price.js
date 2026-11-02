// ====================================
// price.js — "The price, plainly" (brief 5.6, slot D)
// ====================================
// Part A: group bands + dot-plot ladder are rendered from data/fleet.json through vehicles.js (minimum price per group, never typed here).
// Part B: the cockpit card. State = one active row (0..5); rows with a hotspot zoom the photo. Desktop + full mode pins the card for
// 1.2 viewport heights and scrubs the six rows; everywhere else (mobile, lite, static, reduced) the same state is driven by hover / focus / click.
// JS-built strings use tr()/trf() and are refreshed on prc:langchange (no data-i18n inside JS-built markup).
import '../css/price.css'
import { gsap, ScrollTrigger, REDUCED, MODE, mm, scrollTo } from './motion.js'
import { initReveals } from './lib/reveal.js'
import { EASE } from './lib/motion-tokens.js'
import { tr, trf } from './lib/tr.js'
import { currentLang } from './i18n.js'
import { GROUP_ORDER, getVehicles, groupCounts, priceLabel, showCar } from './lib/vehicles.js'

const GROUP_KEY = { hatchback: 'hatch', suv: 'suv', sedan: 'sedan', van: 'van' }
const GROUP_EN = { hatchback: 'Hatchback', suv: 'SUV', sedan: 'Sedan', van: 'Van' }
const OBJ_EN = { climate: 'Climate controls', screen: 'Centre screen' }
const ROWS = 6
const PRICE_MIN = 20 // ladder axis ends: the cheapest and the dearest price in the data (brief 11.1 whitelist)
const PRICE_MAX = 60

const pad = (n) => String(n).padStart(2, '0')

/* ---------- Part A: bands ---------- */
function carsText(n) {
  const sr = currentLang() === 'sr'
  const one = sr ? n % 10 === 1 && n % 100 !== 11 : n === 1
  return one ? trf('price.carsOne', { n }, '{n} car') : trf('price.carsCount', { n }, '{n} cars')
}

function cheapestOf(group) {
  let best = null
  getVehicles().forEach((v) => {
    if (v.category.key !== group || v.price_from_eur == null) return
    if (!best || v.price_from_eur < best.price_from_eur) best = v
  })
  return best
}

function renderBands(list) {
  const counts = groupCounts()
  const max = Math.max(...GROUP_ORDER.map((g) => (cheapestOf(g) ? cheapestOf(g).price_from_eur : 0)), 1)
  list.innerHTML = GROUP_ORDER.map((g) => {
    const c = cheapestOf(g)
    if (!c) return ''
    return (
      `<li data-reveal-item><button type="button" class="price__band" data-group="${g}" data-car="${c.id}">` +
      '<span class="price__band-name"></span><span class="price__band-price"></span><span class="price__band-count"></span>' +
      `<span class="price__bar" aria-hidden="true"><span class="price__bar-fill" style="--w:${(c.price_from_eur / max).toFixed(4)}"></span></span>` +
      `</button></li>`
    )
  }).join('')
  list.dataset.counts = JSON.stringify(counts)
}

function refreshBands(list) {
  const counts = groupCounts()
  list.querySelectorAll('.price__band').forEach((b) => {
    const g = b.dataset.group
    const c = cheapestOf(g)
    b.querySelector('.price__band-name').textContent = tr('price.band.' + GROUP_KEY[g], GROUP_EN[g])
    b.querySelector('.price__band-count').textContent = carsText(counts[g])
    b.querySelector('.price__band-price').textContent = c ? priceLabel(c) : ''
  })
}

/* ---------- Part A: dot-plot ladder (decorative; the figure carries the aria-label) ---------- */
const SVGNS = 'http://www.w3.org/2000/svg'
function renderLadder(fig) {
  const W = 600
  const H = 78
  const padX = 8
  const axisY = 56
  const x = (p) => padX + ((p - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * (W - 2 * padX)
  const svg = document.createElementNS(SVGNS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const mk = (tag, attrs) => {
    const el = document.createElementNS(SVGNS, tag)
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    svg.appendChild(el)
    return el
  }
  mk('line', { class: 'price__ladder-axis', x1: x(PRICE_MIN), x2: x(PRICE_MAX), y1: axisY, y2: axisY })
  for (let p = PRICE_MIN; p <= PRICE_MAX; p += 5) mk('line', { class: 'price__ladder-tick', x1: x(p), x2: x(p), y1: axisY, y2: axisY + (p % 20 === 0 ? 7 : 4) })
  const stack = {}
  getVehicles().forEach((v) => {
    if (v.price_from_eur == null) return
    const p = Math.round(v.price_from_eur)
    const k = (stack[p] = (stack[p] || 0) + 1) - 1
    const c = mk('circle', { class: 'price__dot', cx: x(p), cy: axisY - 10 - k * 12, r: 5, 'data-group': v.category.key })
    c.dataset.car = v.id
  })
  const lo = mk('text', { class: 'price__ladder-lab', x: x(PRICE_MIN), y: H - 4, 'text-anchor': 'start' })
  lo.dataset.end = 'lo'
  const hi = mk('text', { class: 'price__ladder-lab', x: x(PRICE_MAX), y: H - 4, 'text-anchor': 'end' })
  hi.dataset.end = 'hi'
  fig.appendChild(svg)
  refreshLadder(fig)
}

function refreshLadder(fig) {
  const eur = (n) => trf('price.eur', { n }, '€{n}')
  const lo = fig.querySelector('[data-end="lo"]')
  const hi = fig.querySelector('[data-end="hi"]')
  if (lo) lo.textContent = eur(PRICE_MIN)
  if (hi) hi.textContent = eur(PRICE_MAX)
}

function lightGroup(root, group, on) {
  root.querySelectorAll('.price__dot').forEach((d) => d.classList.toggle('is-lit', on && d.dataset.group === group))
  root.querySelectorAll('.price__band').forEach((b) => b.classList.toggle('is-lit', on && b.dataset.group === group))
}

/* ---------- Part B: the cockpit ---------- */
function initCockpit(root) {
  const cock = root.querySelector('.price__cockpit')
  if (!cock) return null
  const rows = [...cock.querySelectorAll('.price__eqrow')]
  const hots = [...cock.querySelectorAll('.price__hot')]
  const zoom = cock.querySelector('[data-zoom]')
  const nowEl = cock.querySelector('[data-eq-now]')
  const fill = cock.querySelector('.price__progfill')
  const instant = REDUCED || MODE === 'static'
  const state = { cur: 0, pinned: false, engaged: false }

  const markerOf = (i) => hots.find((h) => +h.dataset.row === i)

  function setActive(i, opts = {}) {
    state.cur = i
    rows.forEach((r, k) => {
      const on = k === i
      r.classList.toggle('is-active', on)
      if (on) r.setAttribute('aria-current', 'true')
      else r.removeAttribute('aria-current')
    })
    hots.forEach((h) => h.classList.toggle('is-active', +h.dataset.row === i))
    if (nowEl) nowEl.textContent = pad(i + 1)
    if (!state.pinned && fill) {
      if (instant) gsap.set(fill, { scaleX: (i + 1) / ROWS })
      else gsap.to(fill, { scaleX: (i + 1) / ROWS, duration: 0.4, ease: EASE.inOut, overwrite: 'auto' })
    }
    if (!zoom) return
    const m = opts.neutral ? null : markerOf(i)
    const to = m
      ? { scale: 1.18, transformOrigin: `${parseFloat(m.style.getPropertyValue('--x'))}% ${parseFloat(m.style.getPropertyValue('--y'))}%` }
      : { scale: 1 }
    if (instant) gsap.set(zoom, to)
    else gsap.to(zoom, { ...to, duration: 0.5, ease: EASE.inOut, overwrite: 'auto' })
  }

  function choose(i, via) {
    if (state.pinned) {
      if (via === 'hover') return
      const st = ScrollTrigger.getById('price-cockpit')
      if (st) {
        const y = st.start + ((i + 0.5) / ROWS) * (st.end - st.start)
        scrollTo(y, { offset: 0, duration: 0.9 })
        return
      }
    }
    setActive(i)
  }

  rows.forEach((r) => {
    const i = +r.dataset.row
    r.addEventListener('click', () => choose(i, 'click'))
    r.addEventListener('focus', () => choose(i, 'focus'))
    r.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') choose(i, 'hover')
    })
  })
  hots.forEach((h) => {
    const i = +h.dataset.row
    h.addEventListener('click', () => choose(i, 'click'))
    h.addEventListener('focus', () => choose(i, 'focus'))
  })

  function refreshText() {
    hots.forEach((h) => {
      const obj = tr('price.hotspotObj.' + h.dataset.obj, OBJ_EN[h.dataset.obj])
      h.setAttribute('aria-label', trf('price.hotspot', { object: obj }, 'Show: {object}'))
    })
  }
  refreshText()
  document.addEventListener('prc:langchange', refreshText)

  // initial: row 1 highlighted, photo at its neutral framing until the visitor (or the pin) engages a row
  setActive(0, { neutral: true })

  // ?hotspots=1 — QA overlay: 10% grid on the photo + click readout "x%,y%"
  try {
    if (new URLSearchParams(location.search).get('hotspots') === '1' && zoom) {
      const dbg = document.createElement('div')
      dbg.className = 'price__dbg'
      const read = document.createElement('div')
      read.className = 'price__dbg-read'
      read.textContent = 'x%,y%'
      document.body.appendChild(read)
      dbg.addEventListener('click', (e) => {
        const r = dbg.getBoundingClientRect()
        const px = (((e.clientX - r.left) / r.width) * 100).toFixed(1)
        const py = (((e.clientY - r.top) / r.height) * 100).toFixed(1)
        read.textContent = `${px}%,${py}%`
        console.log('[price hotspot]', px, py)
      })
      zoom.appendChild(dbg)
    }
  } catch {}

  return { cock, rows, zoom, fill, state, setActive }
}

function showStaticState(root, ck) {
  root.querySelectorAll('.price__bar-fill, .price__ring-arc, .price__ring-dot, .price__glyph').forEach((el) => gsap.set(el, { clearProps: 'all' }))
  const n = root.querySelector('.price__n')
  if (n) n.textContent = n.dataset.count || '20'
  if (ck) {
    ck.cock.classList.remove('is-pinned')
    ck.state.pinned = false
    ck.state.engaged = false
    if (ck.zoom) gsap.set(ck.zoom, { clearProps: 'transform' })
    ck.setActive(0, { neutral: true })
  }
}

/* ---------- init ---------- */
export function init() {
  const root = document.getElementById('price')
  if (!root) return

  const bands = root.querySelector('.price__bands')
  const ladder = root.querySelector('.price__ladder')
  try {
    if (bands) {
      renderBands(bands)
      refreshBands(bands)
      bands.addEventListener('click', (e) => {
        const b = e.target.closest('.price__band')
        if (b) showCar(b.dataset.car, { open: false, source: 'price' })
      })
      bands.querySelectorAll('.price__band').forEach((b) => {
        b.addEventListener('pointerenter', () => lightGroup(root, b.dataset.group, true))
        b.addEventListener('pointerleave', () => lightGroup(root, b.dataset.group, false))
        b.addEventListener('focus', () => lightGroup(root, b.dataset.group, true))
        b.addEventListener('blur', () => lightGroup(root, b.dataset.group, false))
      })
    }
    if (ladder) renderLadder(ladder)
  } catch (e) {
    console.error('[price] part A', e)
  }

  let ck = null
  try {
    ck = initCockpit(root)
  } catch (e) {
    console.error('[price] cockpit', e)
  }

  document.addEventListener('prc:langchange', () => {
    if (bands) refreshBands(bands)
    if (ladder) refreshLadder(ladder)
  })

  try {
    initReveals(root)
  } catch (e) {
    console.error('[price] reveals', e)
  }

  mm.add(
    { desktop: '(min-width: 1024px)', mobile: '(max-width: 1023.98px)', reduce: '(prefers-reduced-motion: reduce)' },
    (ctx) => {
      const { desktop, reduce } = ctx.conditions
      if (REDUCED || reduce || MODE === 'static') {
        showStaticState(root, ck)
        return
      }
      if (MODE !== 'full') return

      // A starting price is never interpolated into unpublished intermediate amounts.
      const n = root.querySelector('.price__n')
      if (n) n.textContent = n.dataset.count || '20'

      // group bars: 2px ink bar per band, scaleX 0 -> 1
      const fills = gsap.utils.toArray(root.querySelectorAll('.price__bar-fill'))
      if (fills.length) {
        gsap.set(fills, { scaleX: 0 })
        ScrollTrigger.create({
          id: 'price-bars',
          trigger: root.querySelector('.price__bands'),
          start: 'top 85%',
          once: true,
          onEnter: () => gsap.to(fills, { scaleX: 1, duration: 0.8, ease: EASE.out, stagger: 0.08, clearProps: 'transform' }),
        })
      }

      // included dials: ring drawn, accent dot travels with it
      const arcs = gsap.utils.toArray(root.querySelectorAll('.price__ring-arc'))
      const dots = gsap.utils.toArray(root.querySelectorAll('.price__ring-dot'))
      const glyphs = gsap.utils.toArray(root.querySelectorAll('.price__glyph'))
      if (arcs.length) {
        gsap.set(arcs, { drawSVG: '0%' })
        gsap.set(dots, { svgOrigin: '60 60', rotation: 0 })
        gsap.set(glyphs, { opacity: 0 })
        ScrollTrigger.create({
          id: 'price-dials',
          trigger: root.querySelector('.price__dials'),
          start: 'top 85%',
          once: true,
          onEnter: () => {
            gsap.to(arcs, { drawSVG: '100%', duration: 1.0, ease: EASE.inOut, stagger: 0.15 })
            gsap.to(dots, { rotation: 360, duration: 1.0, ease: EASE.inOut, stagger: 0.15, onComplete: () => gsap.set(dots, { clearProps: 'all' }) })
            gsap.to(glyphs, { opacity: 1, duration: 0.5, delay: 0.5, stagger: 0.15, clearProps: 'opacity' })
          },
        })
      }

      // the pin: desktop only (brief 1.6: 1.2 vh)
      if (desktop && ck) {
        const navH = () => (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h-lg')) || 76) + 16
        ck.state.pinned = true
        ck.cock.classList.add('is-pinned')
        const tl = gsap.timeline({
          scrollTrigger: {
            id: 'price-cockpit',
            trigger: ck.cock,
            pin: true,
            anticipatePin: 1,
            scrub: 0.35,
            start: () => 'top top+=' + navH(),
            end: () => '+=' + Math.round(window.innerHeight * 1.2),
            refreshPriority: 2,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const i = Math.min(ROWS - 1, Math.floor(self.progress * ROWS))
              if (i !== ck.state.cur || !ck.state.engaged) {
                ck.state.engaged = true
                ck.setActive(i)
              }
            },
            onLeaveBack: () => {
              ck.state.engaged = false
              ck.setActive(0, { neutral: true })
            },
          },
        })
        tl.fromTo(ck.fill, { scaleX: 0 }, { scaleX: 1, ease: 'none' })
      }

      return () => showStaticState(root, ck)
    },
  )
}
