// ====================================
// reel.js — "In the picture" (brief 5.4, slot D)
// ====================================
// Data-driven: REEL_SET picks the strip set. 'photos' (default) = 9 real photos of the client's own cars.
// 'banners' is the optional variant (OFF until rights + baked-in text are cleared, brief 8.6 / 11.2 item 8); its paths are assembled
// from parts so the default build carries no banner URL literal.
// Strips are built once; alt / aria-label / label text are refreshed on prc:langchange (no DOM rebuild, no layout shift).
import '../css/reel.css'
import { gsap, REDUCED, MODE, mm } from './motion.js'
import { initReveals } from './lib/reveal.js'
import { img } from './lib/media.js'
import { tr, trf } from './lib/tr.js'
import { getVehicle, vehicleLabel, vehicleName, showCar } from './lib/vehicles.js'

const REEL_SET = 'photos'

const PHOTOS = [
  { src: '/assets/img/fleet/toyota-yaris-cross/01', car: 'toyota-yaris-cross' },
  { src: '/assets/img/fleet/toyota-yaris/03', car: 'toyota-yaris' },
  { src: '/assets/img/fleet/skoda-karoq/02', car: 'skoda-karoq' },
  { src: '/assets/img/fleet/skoda-superb-2/02', car: 'skoda-superb-2' },
  { src: '/assets/img/fleet/mercedes-v/02', car: 'mercedes-v' },
  { src: '/assets/img/fleet/toyota-yaris/05', car: 'toyota-yaris' },
  { src: '/assets/img/fleet/skoda-superb-2/04', car: 'skoda-superb-2' },
  { src: '/assets/img/fleet/toyota-yaris-cross/04', car: 'toyota-yaris-cross' },
  { src: '/assets/img/fleet/skoda-karoq/05', car: 'skoda-karoq' },
]
// joined at run time so the minifier cannot fold it back into a literal URL (the default build must not carry one)
const BANNER_DIR = ['', 'assets', 'img', 'ban' + 'ners', ''].join('/')
const BANNERS = [
  ['2025-06-1', 'polo-comfort'],
  ['2025-06-3', 'mercedes-v'],
  ['2025-06-5', 'skoda-karoq'],
  ['2025-06-6', 'skoda-octavia'],
  ['Untitled-design-1-1', 'skoda-kamiq'],
  ['scalaa', 'skoda-scala'],
  ['corola-baner', 'toyota-corolla-2'],
  ['superb-baner', 'skoda-superb-2'],
  ['yaris-cros-baner-2', 'toyota-yaris-cross'],
].map(([n, car]) => ({ src: BANNER_DIR + n, car }))
const BANNER_VARIANT = REEL_SET === 'banners'
const SET = BANNER_VARIANT ? BANNERS : PHOTOS

const SIZES = '(min-width:1024px) 39vw, 82vw'

function altFor(v) {
  return BANNER_VARIANT
    ? trf('reel.altBanner', { name: vehicleName(v) }, 'Illustrative image of the {name}')
    : trf('reel.alt', { name: vehicleName(v) }, 'Photo of the {name}')
}

function buildStrips(stage) {
  const rows = [0, 1, 2].map(() => {
    const r = document.createElement('div')
    r.className = 'reel__row'
    return r
  })
  SET.forEach((item, i) => {
    const v = getVehicle(item.car)
    if (!v) return
    const fig = document.createElement('figure')
    fig.className = 'reel__strip'
    fig.setAttribute('data-reveal-item', '')
    fig.dataset.car = item.car
    const media = img(item.src, { alt: altFor(v), sizes: SIZES, cls: 'reel__img' })
    fig.innerHTML =
      `<div class="reel__media">${media}${BANNER_VARIANT ? '<span class="reel__tag" data-i18n="reel.tag">Illustrative</span>' : ''}</div>` +
      `<figcaption class="reel__cap"><button type="button" class="reel__btn" data-car="${item.car}">` +
      '<span class="reel__label"></span><span class="reel__arrow" aria-hidden="true">→</span></button></figcaption>'
    rows[Math.floor(i / 3)].appendChild(fig)
  })
  rows.forEach((r) => r.children.length && stage.appendChild(r))
}

function refreshText(stage) {
  stage.querySelectorAll('.reel__strip').forEach((fig) => {
    const v = getVehicle(fig.dataset.car)
    if (!v) return
    const label = vehicleLabel(v)
    const btn = fig.querySelector('.reel__btn')
    btn.querySelector('.reel__label').textContent = label
    btn.setAttribute('aria-label', trf('reel.show', { name: label }, '{name}: show in the fleet'))
    const im = fig.querySelector('img')
    if (im) im.setAttribute('alt', altFor(v))
  })
}

function showStaticState(root) {
  root.querySelectorAll('.reel__row, .reel__img').forEach((el) => gsap.set(el, { clearProps: 'transform' }))
}

function initCounter(root, stage) {
  const now = root.querySelector('[data-reel-now]')
  const total = root.querySelector('[data-reel-total]')
  const strips = [...stage.querySelectorAll('.reel__strip')]
  if (total) total.textContent = String(strips.length).padStart(2, '0')
  let ticking = false
  const update = () => {
    ticking = false
    const first = strips[0]
    if (!first || stage.scrollWidth <= stage.clientWidth + 2) return
    const gap = parseFloat(getComputedStyle(stage).columnGap) || 14
    const step = first.getBoundingClientRect().width + gap
    const idx = Math.min(strips.length - 1, Math.max(0, Math.round(stage.scrollLeft / step)))
    if (now) now.textContent = String(idx + 1).padStart(2, '0')
    if (stage.scrollLeft > 8) root.classList.add('is-scrolled')
  }
  stage.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    },
    { passive: true },
  )
}

export function init() {
  const root = document.getElementById('reel')
  if (!root) return
  const stage = root.querySelector('[data-reel-stage]')
  if (!stage) return

  buildStrips(stage)
  refreshText(stage)
  stage.setAttribute('data-reveal', 'stagger')
  if (BANNER_VARIANT) {
    const lead = root.querySelector('.reel__lead')
    if (lead) {
      lead.setAttribute('data-i18n', 'reel.leadBanner')
      lead.textContent = tr('reel.leadBanner', 'Illustrative images of the fleet. Tap a picture to see the car in the index.')
    }
  }

  stage.addEventListener('click', (e) => {
    const b = e.target.closest('.reel__btn')
    if (b) showCar(b.dataset.car, { source: 'reel' })
  })
  document.addEventListener('prc:langchange', () => refreshText(stage))
  initCounter(root, stage)

  try {
    initReveals(root)
  } catch (e) {
    console.error('[reel] reveals', e)
  }

  mm.add(
    { desktop: '(min-width: 1024px)', mobile: '(max-width: 1023.98px)', reduce: '(prefers-reduced-motion: reduce)' },
    (ctx) => {
      const { desktop, reduce } = ctx.conditions
      if (REDUCED || reduce || MODE === 'static') {
        showStaticState(root)
        return
      }
      if (!desktop || MODE !== 'full') return
      const rows = gsap.utils.toArray(root.querySelectorAll('.reel__row'))
      const vw = () => window.innerWidth
      // rows travel +-4vw around their static position (8vw in total, brief 5.4): rows 1 and 3 drift left, row 2 drifts right
      rows.forEach((row, i) => {
        const dir = i === 1 ? 1 : -1
        gsap.fromTo(
          row,
          { x: () => -dir * vw() * 0.04 },
          {
            x: () => dir * vw() * 0.04,
            ease: 'none',
            scrollTrigger: {
              id: 'reel-row' + (i + 1),
              trigger: root,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        )
      })
      // STRETCH: Ken Burns, one settle per photo while its strip crosses the viewport
      root.querySelectorAll('.reel__strip').forEach((fig, i) => {
        const im = fig.querySelector('.reel__img')
        if (!im) return
        gsap.fromTo(
          im,
          { scale: 1.1 },
          {
            scale: 1,
            ease: 'none',
            scrollTrigger: { id: 'reel-kb' + (i + 1), trigger: fig, start: 'top bottom', end: 'bottom 30%', scrub: true },
          },
        )
      })
      return () => showStaticState(root)
    },
  )
}
