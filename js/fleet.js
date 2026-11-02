// Compact fleet selection and detail dialog, sourced from data/fleet.json.
// All 14 cars and their controls render immediately. Card image URLs hydrate
// within 300px of the viewport; galleries load when their dialog opens.
import '../css/fleet.css'
import { gsap, ScrollTrigger, mm, MODE, REDUCED, lenis, refresh, registerLangRebuild, lockScroll, scrollTo } from './motion.js'
import { DUR, EASE, DIST } from './lib/motion-tokens.js'
import { initReveals } from './lib/reveal.js'
import { img } from './lib/media.js'
import { tr, fmt } from './lib/tr.js'
import { currentLang } from './i18n.js'
import { GROUP_ORDER, getVehicles, getVehicle, priceLabel, specLine, hasPhotos, hasCut, groupCounts } from './lib/vehicles.js'
import FLEET from '../data/fleet.json'

// Gate F1 (brief 1.9): flip to true to ship the carousel layout on desktop too. `?fleet=carousel` does the same for one visit.
const CAROUSEL_ON_DESKTOP = false
const FORCE_CAROUSEL = CAROUSEL_ON_DESKTOP || /(?:^|[?&])fleet=carousel(?:&|$)/.test(location.search)

const STAGE = { hatchback: 'var(--stage-hatch)', suv: 'var(--stage-suv)', sedan: 'var(--stage-sedan)', van: 'var(--stage-van)' }
const CHIP_KEY = { hatchback: 'fleet.chipHatch', suv: 'fleet.chipSuv', sedan: 'fleet.chipSedan', van: 'fleet.chipVan' }
const PLATE_PHOTO = {
  hatchback: ['/assets/img/fleet/toyota-yaris/03', 'toyota-yaris'],
  suv: ['/assets/img/fleet/skoda-karoq/02', 'skoda-karoq'],
  sedan: ['/assets/img/fleet/skoda-superb-2/02', 'skoda-superb-2'],
  van: ['/assets/img/fleet/mercedes-v/02', 'mercedes-v'],
}
const NO_MODEL = new Set(['skoda-octavia']) // data model string ("A8 Style 2.0 TDI") is not shown; the sub-line is the year only
const COLOUR_NOTE = new Set(['skoda-octavia']) // render is grey, the car is white: tag says so

const EN = {
  'fleet.groupsNav': 'Vehicle groups',
  'fleet.chipAll': 'All',
  'fleet.chipHatch': 'Hatchback',
  'fleet.chipSuv': 'SUV',
  'fleet.chipSedan': 'Sedan',
  'fleet.chipVan': 'Van',
  'fleet.cars.one': '{n} car',
  'fleet.cars.other': '{n} cars',
  'fleet.illustrative': 'Illustrative image',
  'fleet.illustrativeColour': 'Illustrative image · colour: {c}',
  'fleet.details': 'Details',
  'fleet.detailsAria': 'Details: {car}',
  'fleet.ask': 'Ask about this car',
  'fleet.askCompact': 'Enquire',
  'fleet.email': 'E-mail',
  'fleet.copy': 'Copy message',
  'fleet.equipment': 'Equipment (fleet-wide list)',
  'fleet.equipmentNote': 'A general list for the whole fleet; equipment is not specified per vehicle. Ask us about a specific car.',
  'fleet.spec.transmission': 'Transmission',
  'fleet.spec.fuel': 'Fuel',
  'fleet.spec.power': 'Power',
  'fleet.spec.seats': 'Seats',
  'fleet.spec.doors': 'Doors',
  'fleet.spec.trunk': 'Boot',
  'fleet.spec.year': 'Year',
  'fleet.spec.colour': 'Colour',
  'fleet.spec.engine': 'Engine size',
  'fleet.photoN': 'Photo {n} of {N}',
  'fleet.gallery': 'Photo gallery',
  'fleet.plateAlt': 'Photo of {name}',
  'fleet.close': 'Close',
  'fleet.prev': 'Previous cars',
  'fleet.next': 'Next cars',
  'fleet.endTitle': 'Not sure which one?',
  'fleet.endLead': 'Tell us your dates and we will suggest a car.',
  'fleet.endCta': 'Message us',
  'fleet.yaris': 'Automatic hybrid hatchback, 2026 model, five seats.',
  'fleet.ladderTick': '{name}, {model}, from €{price} / day*',
}
const T = (k, vars) => fmt(tr(k, EN[k]), vars)
const L = () => (currentLang() === 'sr' ? 'sr' : 'en')
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const pad2 = (n) => String(n).padStart(2, '0')
const clamp = (n, a, b) => Math.min(b, Math.max(a, n))

const ARROW = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
const CLOSE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'

// ---------- data helpers ----------
const displayName = (v) => (v.id === 'polo-comfort' ? `${v.brand} ${v.name}` : v.name)
const carLabel = (v) => (v.year ? `${displayName(v)} · ${v.year}` : displayName(v))
function variant(v) {
  if (NO_MODEL.has(v.id) || !v.model) return ''
  const skip = new Set(displayName(v).toLowerCase().split(/\s+/))
  const toks = v.model.split(/\s+/)
  while (toks.length && skip.has(toks[0].toLowerCase())) toks.shift()
  return toks.join(' ')
}
const subLine = (v) => [variant(v), v.year].filter(Boolean).join(' · ')
const carsLabel = (n) => T(n === 1 ? 'fleet.cars.one' : 'fleet.cars.other', { n })
const money = (n) => (L() === 'sr' ? `${n} €` : `€${n}`)
function cardAlt(v) {
  const city = L() === 'sr' ? 'Beograd' : 'Belgrade'
  if (v.id === 'toyota-yaris-cross' || v.id === 'skoda-octavia') return `${carLabel(v)}, Public Rent a Car ${city}`
  return ((v.card && v.card.alt && v.card.alt[L()]) || `${carLabel(v)}, Public Rent a Car ${city}`).replace(/\s*\u2014\s*/g, ', ')
}
const groupLabel = (g) => T(CHIP_KEY[g])

// ---------- state ----------
let root, track, pinEl, ladderEl, chipsEl, counterEl, progressEl, arrowsEl, dlg
let entries = []
let geo = []
let vehicles = []
let category = 'all'
let mode = 'grid' // 'pinned' | 'carousel' | 'static'
let active = null // { rebind, stop }
let lastSig = ''
let lock = null
let openId = ''
let openerId = ''
let slides = []
let slideIx = 0
let flipMod = null
let flipPromise = null
let cardImageObserver = null
let cardRevealObserver = null
let flipPreloadObserver = null
let gridTween = null
let gridRevision = 0
let gridSignature = ''
let dialogTween = null
let slideTween = null
const revealedCards = new WeakSet()
const revealTweens = new Set()
const feedback = new Map()
const MOTION = MODE === 'full' && !REDUCED
const GRID_MOTION_PROPS = 'transform,opacity,width,height,minWidth,minHeight,maxWidth,maxHeight,position,top,left,gridArea,paddingTop,paddingRight,paddingBottom,paddingLeft,display,transition,zIndex'

const CARD_SIZES = '(min-width:1100px) 24vw, (min-width:701px) 31vw, 46vw'
const CARD_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
const CARD_PHOTO_INDEX = { 'toyota-yaris-cross': 2, 'skoda-karoq': 3, 'skoda-superb-2': 1, 'toyota-yaris': 1, 'mercedes-v': 1 }
const cardPhoto = (v) => v.photos?.[(CARD_PHOTO_INDEX[v.id] || 1) - 1] || v.photos?.[0]

// Native lazy loading can fetch several screens ahead. Keep real card URLs in
// inert template data until the image is within 300 px of the viewport. Gallery
// markup never passes through this helper and keeps its normal eager loading.
function deferCardImages(markup) {
  const template = document.createElement('template')
  template.innerHTML = markup
  template.content.querySelectorAll('.fleet__tile img').forEach((image) => {
    const src = image.getAttribute('src')
    const srcset = image.getAttribute('srcset')
    if (src) image.dataset.fleetSrc = src
    if (srcset) image.dataset.fleetSrcset = srcset
    image.removeAttribute('srcset')
    image.setAttribute('src', CARD_PLACEHOLDER)
  })
  return template.innerHTML
}

function observeCardImages() {
  if (!('IntersectionObserver' in window)) return
  const observer = new IntersectionObserver((changes) => {
    changes.forEach(({ target: image, isIntersecting }) => {
      if (!isIntersecting) return
      observer.unobserve(image)
      // A queued callback from a previous language render must not fetch images
      // belonging to the detached catalogue.
      if (!track.contains(image)) return
      image.loading = 'eager'
      if (image.dataset.fleetSrcset) image.setAttribute('srcset', image.dataset.fleetSrcset)
      if (image.dataset.fleetSrc) image.setAttribute('src', image.dataset.fleetSrc)
      delete image.dataset.fleetSrcset
      delete image.dataset.fleetSrc
    })
  }, { rootMargin: '300px 0px', threshold: 0 })
  cardImageObserver = observer
  track.querySelectorAll('img[data-fleet-src]').forEach((image) => observer.observe(image))
}

// ---------- markup ----------
function cardPhotoHTML(v) {
  const base = cardPhoto(v).base
  const options = { sizes: CARD_SIZES, width: 480, eager: false }
  // Both layers share the exact responsive URL set, so the browser reuses one
  // request. The decorative layer is silent and passes through the same IO
  // deferral as the foreground; gallery images remain single normal images.
  const backdrop = img(base, { ...options, decorative: true, cls: 'fleet__img fleet__photo-backdrop' }).replace('<img ', '<img aria-hidden="true" ')
  return `<span class="fleet__photo">${backdrop}${img(base, { ...options, alt: cardAlt(v), cls: 'fleet__img fleet__photo-main' })}</span>`
}

function renderHTML(v, { eager = false, sizes = '(min-width: 768px) 340px, 78vw' } = {}) {
  const cut = hasCut(v)
  const base = cut ? v.card.cut : v.card.base
  const colourNote = COLOUR_NOTE.has(v.id)
  const tag = colourNote ? T('fleet.illustrativeColour', { c: (v.color && v.color[L()]) || '' }) : T('fleet.illustrative')
  return (
    `<span class="fleet__render${cut ? '' : ' is-mat'}">${cut ? '<i class="fleet__ground"></i>' : ''}` +
    img(base, { alt: cardAlt(v), sizes, width: 410, eager, cls: 'fleet__img' }) +
    `</span><span class="fleet__tag">${esc(tag)}</span>`
  )
}

function plateHTML(g, gi, list) {
  const [photo, carId] = PLATE_PHOTO[g]
  const pv = getVehicle(carId)
  const min = list.reduce((m, v) => (m == null || v.price_from_eur < m.price_from_eur ? v : m), null)
  return (
    `<li class="fleet__plate" data-kind="plate" data-group="${g}" style="--stage:${STAGE[g]}"><div class="fleet__plate-in">` +
    `<div class="fleet__plate-top"><span>${pad2(gi + 1)} / ${pad2(GROUP_ORDER.length)}</span></div>` +
    `<div class="fleet__arch arch">${img(photo, { alt: T('fleet.plateAlt', { name: pv ? displayName(pv) : groupLabel(g) }), sizes: '300px', width: 480, eager: false })}</div>` +
    `<h3 class="fleet__plate-word">${esc(groupLabel(g))}</h3>` +
    `<p class="fleet__plate-meta"><span>${esc(carsLabel(list.length))}</span><span>${esc(min ? priceLabel(min) : '')}</span></p>` +
    `</div></li>`
  )
}

function itemHTML(v, n, total) {
  const label = carLabel(v)
  const specs = [v.transmission?.[L()], v.seats ? `${v.seats} ${L()==='sr'?'sedišta':'seats'}` : '', v.trunk_l ? `${v.trunk_l} L` : v.trunk_raw || ''].filter(Boolean)
  return (
    `<li class="fleet__item" data-kind="car" data-id="${v.id}" data-flip-id="fleet-${v.id}" data-n="${n}" data-group="${v.category.key}" style="--stage:${STAGE[v.category.key]}">` +
    `<article class="fleet__card" aria-labelledby="fc-${v.id}">` +
    `<div class="fleet__tile"><span class="fleet__catalog-no" aria-hidden="true">${pad2(n)}<small> / ${pad2(total)}</small></span>${hasPhotos(v) ? `${cardPhotoHTML(v)}<span class="fleet__tag">${L()==="sr"?"Fotografija vozila":"Actual vehicle photo"}</span>` : renderHTML(v,{eager:false,sizes:CARD_SIZES})}</div>` +
    `<div class="fleet__body">` +
    `<div class="fleet__card-head"><div class="fleet__identity"><h3 class="fleet__name" id="fc-${v.id}">${esc(v.name)}</h3>` +
    `<p class="fleet__sub">${esc(groupLabel(v.category.key))} · ${esc(v.year)}</p></div>` +
    `<button type="button" class="btn btn--icon fleet__more" data-id="${v.id}" aria-label="${esc(T('fleet.detailsAria', { car: label }))}" aria-haspopup="dialog">${ARROW}</button></div>` +
    `<ul class="fleet__specs" role="list">${specs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` +
    `<div class="fleet__bottom"><p class="fleet__price">${esc(priceLabel(v))}</p>` +
    `<a class="fleet__ask" href="#contact" data-ask="${v.id}">${esc(T('fleet.askCompact'))}<span class="visually-hidden">: ${esc(label)}</span><span aria-hidden="true">↗</span></a>` +
    `</div></div></article></li>`
  )
}

function endHTML() {
  return (
    `<li class="fleet__end" data-kind="end"><div class="fleet__end-in">` +
    `<div><h3 class="fleet__end-title">${esc(T('fleet.endTitle'))}</h3>` +
    `<p class="fleet__end-lead">${esc(T('fleet.endLead'))}</p></div>` +
    `<a class="btn btn--ink" href="#contact">${esc(T('fleet.endCta'))}</a></div></li>`
  )
}

function ladderHTML() {
  const prices = vehicles.map((v) => v.price_from_eur).filter((p) => p != null)
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const pct = (p) => ((p - lo) / (hi - lo)) * 100
  const distinct = [...new Set(prices)].sort((a, b) => a - b)
  const seen = {}
  let ticks = ''
  let stems = ''
  let labs = ''
  let rail = ''
  distinct.forEach((p) => {
    const cnt = prices.filter((x) => x === p).length
    stems += `<i class="fleet__stem" style="--x:${pct(p)}%;--n:${cnt}"></i>`
    labs += `<span class="fleet__alab${p === lo || p === hi ? ' is-end' : ' is-minor'}" style="--x:${pct(p)}%">${esc(money(Math.round(p)))}</span>`
  })
  vehicles.forEach((v) => {
    if (v.price_from_eur == null) return
    const p = v.price_from_eur
    const lvl = seen[p] || 0
    seen[p] = lvl + 1
    const x = pct(p)
    const aria = T('fleet.ladderTick', { name: displayName(v), model: subLine(v), price: Math.round(p) })
    const edge = x < 12 ? ' is-edge-l' : x > 88 ? ' is-edge-r' : ''
    ticks += `<button type="button" class="fleet__tick${edge}" data-id="${v.id}" style="--x:${x}%;--lvl:${lvl}" aria-label="${esc(aria)}"><i class="fleet__dot"></i><span class="fleet__tip" aria-hidden="true">${esc(carLabel(v))} · ${esc(priceLabel(v))}</span></button>`
    rail += `<button type="button" class="fleet__rchip" data-id="${v.id}"><b>${esc(v.model_short || displayName(v))} · ${v.year}</b><span>${esc(priceLabel(v))}</span></button>`
  })
  return `<div class="fleet__axis"><div class="fleet__plot"><i class="fleet__axis-line"></i>${stems}${labs}${ticks}</div></div><div class="fleet__rail">${rail}</div>`
}

function chipsHTML() {
  const counts = groupCounts()
  const one = (key,label,n) => `<button type="button" class="fleet__chip" data-chip="${key}" aria-pressed="${category===key}"><span>${esc(label)}</span><span class="fleet__chip-n">${n}</span></button>`
  return one('all',T('fleet.chipAll'),vehicles.length)+GROUP_ORDER.map(g=>one(g,groupLabel(g),counts[g])).join('')
}
function finishGridMotion() {
  // Completing Flip restores the layout styles it temporarily owns. This also
  // settles outgoing cards before another request measures the same nodes.
  const tween = gridTween
  gridTween = null
  if (tween) tween.progress(1).kill()
  entries.forEach((el) => {
    el.hidden = el.dataset.fleetVisible === 'false'
    el.inert = false
    el.removeAttribute('aria-hidden')
  })
  if (entries.length) gsap.set(entries, { clearProps: GRID_MOTION_PROPS })
  root.removeAttribute('data-fleet-animating')
}

function stopCardReveals() {
  revealTweens.forEach((tween) => tween.kill())
  revealTweens.clear()
  const cards = entries.map((el) => el.querySelector('.fleet__card')).filter(Boolean)
  if (cards.length) gsap.set(cards, { clearProps: 'opacity,transform,willChange' })
}

function finishCardReveal(card) {
  const item = card.closest('.fleet__item')
  if (item) {
    revealedCards.add(item)
    cardRevealObserver?.unobserve(item)
  }
  // Keyboard focus or a pointer can arrive before the stagger reaches a card.
  // Make that card immediately available without interrupting its neighbours.
  gsap.killTweensOf(card)
  gsap.set(card, { clearProps: 'opacity,transform,willChange' })
}

function observeCardReveals({ reveal = true } = {}) {
  cardRevealObserver?.disconnect()
  cardRevealObserver = null
  if (!MOTION || !reveal || !('IntersectionObserver' in window)) return
  const observer = new IntersectionObserver((changes) => {
    const incoming = changes.filter(({ target, isIntersecting }) => isIntersecting && !target.hidden && track.contains(target) && !revealedCards.has(target))
      .map(({ target }) => target)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left)
    if (!incoming.length) return
    incoming.forEach((item) => {
      revealedCards.add(item)
      observer.unobserve(item)
    })
    const cards = incoming.map((item) => item.querySelector('.fleet__card'))
    // Set the start state only when a card actually enters. Offscreen content
    // stays fail-visible, including if an observer or animation is interrupted.
    const tween = gsap.fromTo(cards, { opacity: 0, y: 20, scale: 0.985 }, {
      opacity: 1, y: 0, scale: 1, duration: 0.52, stagger: 0.045,
      ease: EASE.out, clearProps: 'opacity,transform,willChange',
      onComplete: () => revealTweens.delete(tween),
    })
    revealTweens.add(tween)
  }, { rootMargin: '0px 0px -5% 0px', threshold: 0.08 })
  cardRevealObserver = observer
  entries.forEach((item) => observer.observe(item))
}

function clearCardFeedback() {
  feedback.forEach((state, card) => {
    state.reset?.kill()
    state.lift.tween.kill()
    state.rx.tween.kill()
    state.ry.tween.kill()
    gsap.set(card, { clearProps: 'transform,transformOrigin,willChange' })
    card.style.removeProperty('--fleet-pointer-x')
    card.style.removeProperty('--fleet-pointer-y')
  })
  feedback.clear()
}

function filterGrid({ animate = true } = {}) {
  const revision = ++gridRevision
  finishGridMotion()
  const transmission = root.querySelector('[data-fleet-transmission]')?.value || 'all'
  const sort = root.querySelector('[data-fleet-sort]')?.value || 'recommended'
  const requestedCategory = category
  const signature = `${requestedCategory}|${transmission}|${sort}`
  const ordered = entries.slice().sort((a, b) => sort === 'price'
    ? getVehicle(a.dataset.id).price_from_eur - getVehicle(b.dataset.id).price_from_eur || Number(a.dataset.n) - Number(b.dataset.n)
    : Number(a.dataset.n) - Number(b.dataset.n))
  const visible = new Set(ordered.filter((el) => {
    const v = getVehicle(el.dataset.id)
    const gear = (v.transmission?.en || '').toLowerCase()
    return (requestedCategory === 'all' || v.category.key === requestedCategory) && (transmission === 'all' || gear === transmission)
  }))
  chipsEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.chip === requestedCategory)))
  const commit = (F) => {
    if (revision !== gridRevision) return
    stopCardReveals()
    clearCardFeedback()
    const focusedItem = document.activeElement?.closest('.fleet__item')
    const outgoing = new Set(entries.filter((el) => !el.hidden && !visible.has(el)))
    let state = null
    try { state = F?.getState(entries) } catch { F = null }
    ordered.forEach((el) => {
      track.appendChild(el)
      el.dataset.fleetVisible = String(visible.has(el))
      el.hidden = !visible.has(el)
      if (F && outgoing.has(el)) {
        // Flip must be able to change display during absoluteOnLeave. Using
        // inline display here avoids the global [hidden] !important rule while
        // its initial invisible measurement still excludes the outgoing card.
        el.hidden = false
        el.style.display = 'none'
        el.setAttribute('aria-hidden', 'true')
        el.inert = true
      }
      if (animate && visible.has(el)) {
        revealedCards.add(el)
        cardRevealObserver?.unobserve(el)
      }
    })
    // Filtering normally starts from its control. Keep external/programmatic
    // changes from leaving focus inside a newly hidden card as well.
    if (focusedItem && !visible.has(focusedItem)) chipsEl.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true })
    counterEl.textContent = carsLabel(visible.size)
    const empty = root.querySelector('[data-fleet-empty]')
    if (empty) empty.hidden = visible.size > 0
    gridSignature = signature
    if (!F) {
      finishGridMotion()
      refresh(0)
      return
    }
    root.setAttribute('data-fleet-animating', 'true')
    try {
      gridTween = F.from(state, {
        duration: 0.58, ease: EASE.inOut, scale: true, prune: true,
        absoluteOnLeave: true, stagger: 0.025,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 18, scale: 0.96 }, {
          opacity: 1, y: 0, scale: 1, duration: 0.42, stagger: 0.035, ease: EASE.out,
        }),
        onLeave: (els) => {
          // These are the original nodes, positioned absolutely by Flip and
          // excluded from the accessibility/focus tree for their short exit.
          els.forEach((el) => {
            el.setAttribute('aria-hidden', 'true')
            el.inert = true
            el.hidden = false
          })
          return gsap.to(els, { opacity: 0, scale: 0.96, duration: 0.18, ease: EASE.out })
        },
        onComplete: () => {
          if (revision !== gridRevision) return
          gridTween = null
          finishGridMotion()
          refresh(0)
        },
      })
    } catch {
      finishGridMotion()
    }
    refresh(0)
  }
  const bounds = track.getBoundingClientRect()
  const shouldAnimate = MOTION && animate && signature !== gridSignature && bounds.top < window.innerHeight && bounds.bottom > 0
  if (!shouldAnimate) return commit(null)
  root.setAttribute('data-fleet-animating', 'true')
  if (flipMod) return commit(flipMod)
  // One import is shared by rapid requests. Only the most recent request is
  // allowed to mutate the catalogue after that asynchronous boundary.
  return Promise.race([loadFlip(), new Promise((resolve) => setTimeout(() => resolve(null), 320))]).then(commit)
}

function renderAll({ reveal = true } = {}) {
  ++gridRevision
  finishGridMotion()
  stopCardReveals()
  clearCardFeedback()
  cardRevealObserver?.disconnect()
  cardRevealObserver = null
  if (cardImageObserver) {
    cardImageObserver.disconnect()
    cardImageObserver = null
  }
  const priority=['toyota-yaris-cross','skoda-karoq','skoda-superb-2','toyota-yaris','mercedes-v']
  vehicles=getVehicles().sort((a,b)=>(priority.includes(a.id)?priority.indexOf(a.id):99)-(priority.includes(b.id)?priority.indexOf(b.id):99))
  const markup=vehicles.map((v,i)=>itemHTML(v,i+1,vehicles.length)).join('')
  track.innerHTML='IntersectionObserver' in window ? deferCardImages(markup) : markup
  entries=[...track.children];chipsEl.innerHTML=chipsHTML();gridSignature='';filterGrid({animate:false})
  observeCardImages()
  observeCardReveals({ reveal })
}

// ---------- measuring / current position ----------
const padPx = () => parseFloat(getComputedStyle(track).paddingLeft) || 0
const navPx = () => parseFloat(getComputedStyle(root).getPropertyValue('--fleet-top')) || 76
const dist = () => Math.max(0, track.scrollWidth - window.innerWidth)
const endLen = () => Math.min(dist() / 1.6, window.innerHeight * 4)
function measure() {
  geo = entries.map((e) => ({ l: e.offsetLeft, w: e.offsetWidth }))
}
function pageScroll(y, immediate) {
  if (lenis) lenis.scrollTo(y, { offset: 0, immediate: !!immediate, duration: 1.1 })
  else window.scrollTo({ top: y, behavior: immediate || REDUCED ? 'auto' : 'smooth' })
}
function lockValid() {
  if (!lock) return false
  const pos = mode === 'pinned' ? window.scrollY : track.scrollLeft
  if (performance.now() - lock.t < 1700 || Math.abs(pos - lock.pos) < 160) return true
  lock = null
  return false
}

function paintUI(idx) {
  const e = entries[idx]
  if (!e) return
  const kind = e.dataset.kind
  let key = kind === 'end' ? 'all' : e.dataset.group
  if (lockValid()) key = lock.key
  let carId = ''
  let n = vehicles.length
  if (kind === 'car') {
    carId = e.dataset.id
    n = Number(e.dataset.n)
  } else if (kind === 'plate') {
    const first = e.nextElementSibling
    carId = first ? first.dataset.id : ''
    n = first ? Number(first.dataset.n) : 1
  }
  const sig = `${key}|${carId}|${n}`
  if (sig === lastSig) return
  lastSig = sig
  chipsEl.querySelectorAll('.fleet__chip').forEach((c) => {
    if (c.dataset.chip === key) c.setAttribute('aria-current', 'true')
    else c.removeAttribute('aria-current')
  })
  counterEl.textContent = `${pad2(n)} / ${pad2(vehicles.length)}`
  ladderEl.querySelectorAll('[data-id]').forEach((t) => t.classList.toggle('is-current', t.dataset.id === carId))
}

function pickPinned(p) {
  const W = window.innerWidth
  const pd = padPx()
  const x = p * dist()
  const fp = pd + p * (W - 2 * pd)
  let best = 0
  let bd = Infinity
  geo.forEach((g, i) => {
    const d = Math.abs(g.l + g.w / 2 - x - fp)
    if (d < bd) {
      bd = d
      best = i
    }
  })
  return best
}
function pickCarousel() {
  const max = track.scrollWidth - track.clientWidth
  if (max > 0 && track.scrollLeft >= max - 4) return entries.length - 1
  const at = track.scrollLeft + padPx()
  let best = 0
  let bd = Infinity
  geo.forEach((g, i) => {
    const d = Math.abs(g.l - at)
    if (d < bd) {
      bd = d
      best = i
    }
  })
  return best
}

// ---------- navigation ----------
function currentX() {
  return -(Number(gsap.getProperty(track, 'x')) || 0)
}
/** Scroll the page (pinned) or the track (carousel) so `el` is the lead entry. Returns the target position. */
function goToEntry(el, { immediate = false } = {}) {
  if(!el)return 0
  // Commit/cancel any pending filter before a hero/deep-link request measures
  // its destination. A late first Flip import must never hide that destination.
  filterGrid({animate:false})
  if(el.hidden || el.dataset.fleetVisible === 'false'){category='all';root.querySelector('[data-fleet-transmission]').value='all';filterGrid({animate:false})}
  scrollTo(el,{duration:immediate?0:.6})
  return el.getBoundingClientRect().top+window.scrollY
}
const entryFor = (id) => track.querySelector(`[data-id="${id}"][data-kind="car"]`)
function goToCar(id, opts) {
  return goToEntry(entryFor(id), opts)
}

function chipGo(key) { category=key;filterGrid() }

function prewarmFlip() {
  if (!MOTION || !('IntersectionObserver' in window)) return
  flipPreloadObserver?.disconnect()
  flipPreloadObserver = new IntersectionObserver(
    (list) => {
      if (!list.some((e) => e.isIntersecting)) return
      flipPreloadObserver.disconnect()
      flipPreloadObserver = null
      loadFlip()
    },
    { rootMargin: '500px 0px' },
  )
  flipPreloadObserver.observe(pinEl)
}

// ---------- layouts ----------
function setMode(m) {
  mode = m
  root.classList.toggle('is-pinned', m === 'pinned')
  root.classList.toggle('is-carousel', m !== 'pinned')
  root.classList.toggle('is-static', m === 'static')
}

function updateArrows() {
  const max = track.scrollWidth - track.clientWidth
  arrowsEl.querySelectorAll('.fleet__arrow').forEach((b) => {
    const dir = Number(b.dataset.dir)
    b.disabled = dir < 0 ? track.scrollLeft <= 4 : track.scrollLeft >= max - 4
  })
}

function startCarousel({ motion }) {
  const cleanups = []
  const made = []
  let raf = 0
  const onScroll = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      const max = Math.max(1, track.scrollWidth - track.clientWidth)
      progressEl.style.transform = `scaleX(${clamp(track.scrollLeft / max, 0, 1)})`
      paintUI(pickCarousel())
      updateArrows()
    })
  }
  const bind = () => {
    measure()
    onScroll()
    updateArrows()
  }
  track.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', bind)
  cleanups.push(() => {
    track.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', bind)
    cancelAnimationFrame(raf)
  })
  if (motion) {
    const first = () => {
      const els = entries.slice(0, 4).map((e) => e.firstElementChild)
      made.push(
        ScrollTrigger.create({
          trigger: pinEl,
          start: 'top 85%',
          once: true,
          onEnter: () => gsap.from(els, { opacity: 0, y: DIST.y, duration: DUR.reveal, ease: EASE.out, stagger: DIST.staggerCards, clearProps: 'opacity,transform' }),
        }),
      )
    }
    first()
  }
  bind()
  return {
    rebind() {
      made.splice(0).forEach((t) => t.kill())
      if (motion) {
        const els = entries.slice(0, 4).map((e) => e.firstElementChild)
        made.push(ScrollTrigger.create({ trigger: pinEl, start: 'top 85%', once: true, onEnter: () => gsap.from(els, { opacity: 0, y: DIST.y, duration: DUR.reveal, ease: EASE.out, stagger: DIST.staggerCards, clearProps: 'opacity,transform' }) }))
      }
      bind()
    },
    stop() {
      made.splice(0).forEach((t) => t.kill())
      cleanups.splice(0).forEach((f) => f())
    },
  }
}

function startPinned() {
  setMode('pinned')
  let made = []
  let tween = null
  let wheelOff = null

  const bindTriggers = () => {
    unbindTriggers()
    measure()
    gsap.set(track, { x: 0 })
    tween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        id: 'fleet-track',
        trigger: pinEl,
        start: () => `top top+=${navPx()}`,
        end: () => `+=${endLen()}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        refreshPriority: 3,
        onRefresh: (self) => {
          measure()
          progressEl.style.transform = `scaleX(${self.progress})`
          paintUI(pickPinned(self.progress))
        },
        onUpdate: (self) => {
          progressEl.style.transform = `scaleX(${self.progress})`
          paintUI(pickPinned(self.progress))
        },
      },
    })
    made.push(tween)
    const W = () => window.innerWidth
    entries.forEach((e) => {
      const inner = e.firstElementChild
      if (!inner) return
      if (e.offsetLeft < W() * 0.98) return // first screenful: revealed together below
      made.push(
        ScrollTrigger.create({
          trigger: e,
          containerAnimation: tween,
          start: 'left 98%',
          once: true,
          onEnter: () => gsap.from(inner, { opacity: 0, y: DIST.y, duration: DUR.reveal, ease: EASE.out, clearProps: 'opacity,transform' }),
        }),
      )
    })
    const firstScreen = entries.filter((e) => e.offsetLeft < W() * 0.98).map((e) => e.firstElementChild)
    made.push(
      ScrollTrigger.create({
        trigger: pinEl,
        start: 'top 85%',
        once: true,
        onEnter: () => gsap.from(firstScreen, { opacity: 0, y: DIST.y, duration: DUR.reveal, ease: EASE.out, stagger: DIST.staggerCards, clearProps: 'opacity,transform' }),
      }),
    )
    // depth: plate photos drift inside their arch, renders drift inside their tile
    entries.forEach((e) => {
      let target = null
      let from = 0
      let to = 0
      if (e.dataset.kind === 'plate') {
        target = e.querySelector('.fleet__arch img')
        from = -7
        to = 7
      } else if (e.dataset.kind === 'car') {
        target = e.querySelector('.fleet__render:not(.is-mat)')
        from = 5
        to = -5
      }
      if (!target) return
      made.push(
        gsap.fromTo(
          target,
          { xPercent: from },
          {
            xPercent: to,
            ease: 'none',
            scrollTrigger: {
              trigger: e,
              containerAnimation: tween,
              start: 'left right',
              end: 'right left',
              scrub: true,
              onToggle: (s) => {
                target.style.willChange = s.isActive ? 'transform' : ''
              },
            },
          },
        ),
      )
    })
  }
  const unbindTriggers = () => {
    made.splice(0).forEach((t) => {
      if (t.scrollTrigger) {
        t.scrollTrigger.kill(true)
        t.revert()
      } else t.kill(true)
    })
    tween = null
    const st = ScrollTrigger.getById('fleet-track')
    if (st) st.kill(true)
    gsap.set(track, { clearProps: 'transform' })
  }
  // horizontal wheel / trackpad swipe moves the track too
  const onWheel = (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || !e.deltaX) return
    e.preventDefault()
    const dy = e.deltaX * 1.6
    if (lenis) lenis.scrollTo(window.scrollY + dy, { offset: 0, immediate: true })
    else window.scrollBy(0, dy)
  }
  pinEl.addEventListener('wheel', onWheel, { passive: false })
  wheelOff = () => pinEl.removeEventListener('wheel', onWheel)

  bindTriggers()
  return {
    rebind() {
      bindTriggers()
    },
    stop() {
      wheelOff && wheelOff()
      unbindTriggers()
    },
  }
}

function startLayout() { root.classList.remove('is-carousel','is-pinned');root.classList.add('is-grid');mode='grid' }

// ---------- detail dialog ----------
function loadFlip() {
  if (!MOTION) return Promise.resolve(null)
  if (flipMod) return Promise.resolve(flipMod)
  if (flipPromise) return flipPromise
  flipPromise = import('gsap/Flip')
    .then((m) => {
      flipMod = m.Flip || m.default
      gsap.registerPlugin(flipMod)
      return flipMod
    })
    .catch(() => {
      flipPromise = null
      return null
    })
  return flipPromise
}

function specRows(v) {
  const l = L()
  const rows = []
  const add = (k, val) => {
    if (val != null && val !== '') rows.push([T('fleet.spec.' + k), val])
  }
  add('transmission', v.transmission && v.transmission[l])
  add('fuel', v.fuel && v.fuel[l])
  add('power', v.hp ? `${v.hp} ${tr('common.unit.hp')}${v.kw ? ` · ${v.kw} kW` : ''}` : '')
  add('engine', v.cc ? `${v.cc} cm³` : '')
  add('seats', v.seats ? String(v.seats) : '')
  add('doors', v.doors ? String(v.doors) : '')
  add('trunk', v.trunk_l ? `${v.trunk_l} L` : v.trunk_raw || '')
  add('year', v.year ? String(v.year) : '')
  add('colour', v.color && v.color[l])
  return rows
}

function slidesFor(v) {
  const list = []
  if (hasPhotos(v)) v.photos.forEach((p,i)=>list.push({kind:'photo',base:p.base,n:i+1,N:v.photos.length}))
  list.push({kind:'render'})
  return list
}

function slideHTML(v, s, eager = true) {
  if (s.kind === 'render') return renderHTML(v, { eager })
  return img(s.base, {
    alt: `${displayName(v)}, ${T('fleet.photoN', { n: s.n, N: s.N })}`,
    sizes: '(min-width: 768px) 440px, 100vw',
    width: 960,
    eager,
    cls: 'fleet__dlg-img',
  })
}

function thumbHTML(v, s, i) {
  const label = s.kind === 'render' ? T('fleet.illustrative') : T('fleet.photoN', { n: s.n, N: s.N })
  const inner =
    s.kind === 'render'
      ? img(hasCut(v) ? v.card.cut : v.card.base, { decorative: true, sizes: '56px', width: 410, eager: true })
      : img(s.base, { decorative: true, sizes: '56px', width: 480, eager: true })
  return `<button type="button" class="fleet__thumb${s.kind === 'render' ? ' is-render-thumb' : ''}" data-ix="${i}" aria-label="${esc(label)}" tabindex="${i === slideIx ? 0 : -1}"${i === slideIx ? ' aria-current="true"' : ''}>${inner}</button>`
}

function dialogHTML(v) {
  const label = carLabel(v)
  const rows = specRows(v)
  const desc = v.id === 'toyota-yaris' ? T('fleet.yaris') : v.description ? v.description[L()] : ''
  const equip = (FLEET.equipment && FLEET.equipment[L()]) || ''
  const items = equip ? equip.split(', ').filter(Boolean) : []
  const li = entryFor(v.id)
  const n = li ? Number(li.dataset.n) : 0
  const sub = subLine(v)
  return (
    `<div class="fleet__dlg">` +
    `<div class="fleet__dlg-top"><button type="button" class="btn btn--icon fleet__dlg-close" data-close aria-label="${esc(T('fleet.close'))}">${CLOSE}</button></div>` +
    `<div class="fleet__dlg-gallery" style="--stage:${STAGE[v.category.key]}">` +
    `<div class="fleet__dlg-main${slides[slideIx].kind === 'render' ? ' is-render' : ''}" data-main>${slideHTML(v, slides[slideIx])}</div>` +
    (slides.length > 1 ? `<div class="fleet__thumbs" role="group" aria-label="${esc(T('fleet.gallery'))}" data-thumbs>${slides.map((s, i) => thumbHTML(v, s, i)).join('')}</div>` : '') +
    `</div>` +
    `<div class="fleet__dlg-info">` +
    `<p class="folio"><span class="folio__tick"></span><span>${esc(groupLabel(v.category.key))}${n ? ` · ${pad2(n)} / ${pad2(vehicles.length)}` : ''}</span></p>` +
    `<h3 class="fleet__dlg-title" id="fleet-dlg-title" tabindex="-1">${esc(displayName(v))}</h3>` +
    (sub ? `<p class="fleet__dlg-sub">${esc(sub)}</p>` : '') +
    `<p class="fleet__dlg-price">${esc(priceLabel(v))}</p>` +
    `<p class="fleet__dlg-note small">${esc(tr('common.price.note'))}</p>` +
    (rows.length ? `<dl class="fleet__spec">${rows.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join('')}</dl>` : '') +
    (desc ? `<p class="fleet__dlg-desc">${esc(desc)}</p>` : '') +
    (items.length
      ? `<div class="fleet__equip"><h4>${esc(T('fleet.equipment'))}</h4><ul role="list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul><p class="small">${esc(T('fleet.equipmentNote'))}</p></div>`
      : '') +
    `<div class="fleet__dlg-actions">` +
    `<a class="btn btn--ink" href="#contact" data-ask="${v.id}">${esc(T('fleet.ask'))}</a>` +
    `</div></div></div>`
  )
}

function selectSlide(i, { focus = false } = {}) {
  const v = getVehicle(openId)
  if (!v || !slides[i]) return
  slideIx = i
  const main = dlg.querySelector('[data-main]')
  slideTween?.kill()
  gsap.killTweensOf(main)
  gsap.set(main, { clearProps: 'opacity,transform,willChange' })
  main.classList.toggle('is-render', slides[i].kind === 'render')
  main.innerHTML = slideHTML(v, slides[i])
  if (MOTION) {
    slideTween = gsap.fromTo(main, { opacity: 0.55, y: 5, scale: 0.99 }, {
      opacity: 1, y: 0, scale: 1, duration: 0.28, ease: EASE.out,
      clearProps: 'opacity,transform,willChange', onComplete: () => { slideTween = null },
    })
  }
  dlg.querySelectorAll('.fleet__thumb').forEach((b) => {
    const on = Number(b.dataset.ix) === i
    b.tabIndex = on ? 0 : -1
    if (on) b.setAttribute('aria-current', 'true')
    else b.removeAttribute('aria-current')
    if (on && focus) b.focus()
  })
}

function fillDialog(v) {
  dialogTween?.kill()
  slideTween?.kill()
  dialogTween = null
  slideTween = null
  dlg.innerHTML = dialogHTML(v)
}

function animateDialog(fromEl) {
  if (!MOTION || !dlg.open) return
  const panel = dlg.querySelector('.fleet__dlg')
  const main = dlg.querySelector('[data-main]')
  const info = [...dlg.querySelectorAll('.fleet__dlg-info > .folio, .fleet__dlg-title, .fleet__dlg-sub, .fleet__dlg-price, .fleet__dlg-note, .fleet__spec, .fleet__dlg-actions')]
  if (!panel || !main) return
  // A small expansion starts toward the selected card, without flying a large
  // photograph across the page or waiting for any asynchronous image/plugin.
  const bounds = panel.getBoundingClientRect()
  const source = fromEl?.getBoundingClientRect()
  const x = source && bounds.width ? clamp((source.left + source.width / 2 - bounds.left) / bounds.width * 100, 15, 85) : 50
  gsap.set(panel, { transformOrigin: `${x}% 35%` })
  dialogTween = gsap.timeline({ onComplete: () => { dialogTween = null } })
    .fromTo(panel, { opacity: 0, y: 18, scale: 0.985 }, {
      opacity: 1, y: 0, scale: 1, duration: 0.4, ease: EASE.out,
      clearProps: 'opacity,transform,transformOrigin,willChange',
    }, 0)
    .fromTo(main, { opacity: 0.5, scale: 0.975 }, {
      opacity: 1, scale: 1, duration: 0.46, ease: EASE.out,
      clearProps: 'opacity,transform,willChange',
    }, 0.03)
    .fromTo(info, { opacity: 0, y: 10 }, {
      opacity: 1, y: 0, duration: 0.35, stagger: 0.035, ease: EASE.out,
      clearProps: 'opacity,transform,willChange',
    }, 0.06)
}

function openDetail(id, { fromEl = null } = {}) {
  const v = getVehicle(id)
  if (!v || !dlg) return
  slides = slidesFor(v)
  slideIx = Math.max(0, slides.findIndex((slide) => slide.kind === 'photo' && slide.base === cardPhoto(v)?.base))
  if (dlg.open) {
    openId = id
    fillDialog(v)
    dlg.querySelector('#fleet-dlg-title').focus({ preventScroll: true })
    animateDialog(entryFor(id))
    return
  }
  openId = id
  openerId = id
  fillDialog(v)
  const card = entryFor(id)
  lockScroll(true)
  dlg.showModal()
  dlg.scrollTop = 0
  dlg.querySelector('#fleet-dlg-title').focus({ preventScroll: true })
  animateDialog(card || fromEl)
}

function closeDetail() {
  if (dlg && dlg.open) dlg.close()
}

function onDialogClosed() {
  dialogTween?.kill()
  slideTween?.kill()
  dialogTween = null
  slideTween = null
  lockScroll(false)
  dlg.innerHTML = ''
  const id = openerId
  openId = ''
  openerId = ''
  const btn = id ? track.querySelector(`.fleet__more[data-id="${id}"]`) : null
  if (btn) btn.focus({ preventScroll: true })
}

function wireDialog() {
  dlg.addEventListener('close', onDialogClosed)
  dlg.addEventListener('cancel', (e) => {
    const d = dlg.querySelector('.fleet__copy[open]')
    if (d) {
      e.preventDefault()
      d.removeAttribute('open')
    }
  })
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) {
      const r = dlg.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDetail()
      return
    }
    if (e.target.closest('[data-close]')) return closeDetail()
    const th = e.target.closest('.fleet__thumb')
    if (th) return selectSlide(Number(th.dataset.ix))

  })
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const f = [...dlg.querySelectorAll('a[href], button:not([disabled]), summary, h3[tabindex]')].filter((el) => el.tabIndex >= 0 && el.offsetParent !== null && (el.tagName === 'SUMMARY' || !el.closest('details:not([open])')))
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === first || !f.includes(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
      return
    }
    const th = e.target.closest && e.target.closest('.fleet__thumb')
    if (th && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      e.preventDefault()
      const last = slides.length - 1
      let i = slideIx
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = Math.max(0, i - 1)
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = Math.min(last, i + 1)
      else if (e.key === 'Home') i = 0
      else i = last
      selectSlide(i, { focus: true })
    }
  })
}

// ---------- events ----------
function litCar(id, on) {
  const it = id ? entryFor(id) : null
  track.querySelectorAll('.fleet__card.is-lit').forEach((c) => c.classList.remove('is-lit'))
  ladderEl.querySelectorAll('.is-lit, .is-tip').forEach((t) => t.classList.remove('is-lit', 'is-tip'))
  if (!on || !it) return
  it.querySelector('.fleet__card').classList.add('is-lit')
  ladderEl.querySelectorAll(`.fleet__tick[data-id="${id}"]`).forEach((t) => t.classList.add('is-lit', 'is-tip'))
}

function ensureVisible(it) {
  if (mode !== 'pinned') return
  const x = currentX()
  const l = it.offsetLeft - x
  if (l < 0 || l + it.offsetWidth > window.innerWidth) goToEntry(it, { immediate: false })
}

function feedbackFor(card) {
  let state = feedback.get(card)
  if (state) return state
  finishCardReveal(card)
  gsap.set(card, { transformPerspective: 850, transformOrigin: '50% 50%' })
  const vars = { duration: 0.32, ease: EASE.out }
  state = {
    hover: false, focus: false, reset: null,
    lift: gsap.quickTo(card, 'y', vars),
    rx: gsap.quickTo(card, 'rotationX', vars),
    ry: gsap.quickTo(card, 'rotationY', vars),
  }
  feedback.set(card, state)
  return state
}

function paintFeedback(card, state) {
  state.reset?.kill()
  state.reset = null
  const on = state.hover || state.focus
  card.style.willChange = on ? 'transform' : ''
  state.lift(state.hover ? -4 : state.focus ? -3 : 0)
  if (!state.hover) {
    state.rx(0)
    state.ry(0)
    card.style.setProperty('--fleet-pointer-x', '50%')
    card.style.setProperty('--fleet-pointer-y', '45%')
  }
  if (!on) {
    state.reset = gsap.delayedCall(0.36, () => {
      if (state.hover || state.focus || !card.isConnected) return
      gsap.set(card, { clearProps: 'transform,transformOrigin,willChange' })
      card.style.removeProperty('--fleet-pointer-x')
      card.style.removeProperty('--fleet-pointer-y')
    })
  }
}

function wireCardFeedback() {
  if (!MOTION) return
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const cardAt = (target) => {
    const card = target?.closest?.('.fleet__card')
    const item = card?.closest('.fleet__item')
    return card && track.contains(card) && !item.hidden && !item.inert ? card : null
  }
  track.addEventListener('pointerover', (e) => {
    if (!finePointer.matches || e.pointerType === 'touch') return
    const card = cardAt(e.target)
    if (!card || card.contains(e.relatedTarget)) return
    const state = feedbackFor(card)
    state.hover = true
    paintFeedback(card, state)
  }, { passive: true })
  track.addEventListener('pointermove', (e) => {
    if (!finePointer.matches || e.pointerType === 'touch') return
    const card = cardAt(e.target)
    const state = card && feedback.get(card)
    if (!state?.hover) return
    const bounds = card.getBoundingClientRect()
    const x = clamp((e.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1)
    const y = clamp((e.clientY - bounds.top) / Math.max(1, bounds.height), 0, 1)
    card.style.setProperty('--fleet-pointer-x', `${(x * 100).toFixed(1)}%`)
    card.style.setProperty('--fleet-pointer-y', `${(y * 100).toFixed(1)}%`)
    state.rx((0.5 - y) * 2)
    state.ry((x - 0.5) * 3)
  }, { passive: true })
  track.addEventListener('pointerout', (e) => {
    const card = cardAt(e.target)
    const state = card && feedback.get(card)
    if (!state || card.contains(e.relatedTarget)) return
    state.hover = false
    paintFeedback(card, state)
  }, { passive: true })
  track.addEventListener('pointercancel', (e) => {
    const card = cardAt(e.target)
    const state = card && feedback.get(card)
    if (!state) return
    state.hover = false
    paintFeedback(card, state)
  }, { passive: true })
  track.addEventListener('focusin', (e) => {
    const card = cardAt(e.target)
    if (!card || card.contains(e.relatedTarget)) return
    const state = feedbackFor(card)
    state.focus = true
    paintFeedback(card, state)
  })
  track.addEventListener('focusout', (e) => {
    const card = cardAt(e.target)
    const state = card && feedback.get(card)
    if (!state || card.contains(e.relatedTarget)) return
    state.focus = false
    paintFeedback(card, state)
  })
}

function wire() {
  root.addEventListener('click', (e) => {
    const ask=e.target.closest('[data-ask]');if(ask){e.preventDefault();if(dlg.open){openerId='';closeDetail()}document.dispatchEvent(new CustomEvent('prc:choosecar',{detail:{id:ask.dataset.ask}}));const heading=document.getElementById('contact-title');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});scrollTo('#contact',{duration:.7});history.replaceState(null,'','#contact');return}
    const more = e.target.closest('.fleet__more')
    if (more) return openDetail(more.dataset.id, { fromEl: more })
    const tick = e.target.closest('.fleet__tick, .fleet__rchip')
    if (tick) {
      const id = tick.dataset.id
      goToCar(id)
      if (e.detail === 0) {
        const b = track.querySelector(`.fleet__more[data-id="${id}"]`)
        if (b) setTimeout(() => b.focus({ preventScroll: true }), 50)
      }
      return
    }
    const chip = e.target.closest('.fleet__chip')
    if (chip) return chipGo(chip.dataset.chip)
    const arrow = e.target.closest('.fleet__arrow')
    if (arrow) {
      const dir = Number(arrow.dataset.dir)
      track.scrollBy({ left: dir * Math.round(track.clientWidth * 0.8), behavior: REDUCED ? 'auto' : 'smooth' })
      return
    }
    const card = e.target.closest('.fleet__card')
    if (card && !e.target.closest('a, button')) {
      const li = card.closest('[data-id]')
      if (li) openDetail(li.dataset.id)
    }
  })
  ladderEl.addEventListener('mouseover', (e) => {
    const t = e.target.closest('.fleet__tick, .fleet__rchip')
    if (t) litCar(t.dataset.id, true)
  })
  ladderEl.addEventListener('mouseout', (e) => {
    if (e.target.closest('.fleet__tick, .fleet__rchip')) litCar('', false)
  })
  ladderEl.addEventListener('focusin', (e) => {
    const t = e.target.closest('.fleet__tick, .fleet__rchip')
    if (t) litCar(t.dataset.id, true)
  })
  ladderEl.addEventListener('focusout', () => litCar('', false))
  track.addEventListener('focusin', (e) => {
    const it = e.target.closest('[data-kind]')
    if (it) ensureVisible(it)
  })
  track.addEventListener('pointerover', () => loadFlip(), { once: true })
  track.addEventListener('focusin', () => loadFlip(), { once: true })
  wireCardFeedback()
}

// ---------- show-car protocol ----------
function afterReady(fn) {
  if (window.__prcReady) fn()
  else document.addEventListener('prc:ready', () => setTimeout(fn, 120), { once: true })
}
function onShowCar(d) {
  const v = d && getVehicle(d.id)
  if (!v) return
  const open = d.open !== false
  afterReady(() => {
    goToCar(v.id, { immediate: open })
    if (open) {
      const b = track.querySelector(`.fleet__more[data-id="${v.id}"]`)
      openDetail(v.id, { fromEl: b })
    }
    document.dispatchEvent(new CustomEvent('prc:showcar:done', { detail: { id: v.id, open } }))
  })
}

// ---------- init ----------
export function init() {
  try {
    root = document.getElementById('fleet')
    if (!root) return
    track = root.querySelector('[data-fleet-track]')
    pinEl = root.querySelector('.fleet__pin')
    ladderEl = root.querySelector('[data-fleet-ladder]')
    chipsEl = root.querySelector('[data-fleet-chips]')
    counterEl = root.querySelector('[data-fleet-counter]')
    progressEl = root.querySelector('[data-fleet-progress]')
    arrowsEl = root.querySelector('[data-fleet-arrows]')
    dlg = root.querySelector('.fleet__dialog')
    if (!track || !pinEl || !ladderEl || !chipsEl || !counterEl || !progressEl || !arrowsEl) return

    renderAll()
    root.classList.add('is-grid')
    wire()
    if (dlg) wireDialog()
    initReveals(root)

    registerLangRebuild(() => {
      const keepOpen = dlg && dlg.open ? openId : ''
      renderAll({ reveal: false })
      if (keepOpen) {
        const v = getVehicle(keepOpen)
        if (v) {
          const ix = slideIx
          slides = slidesFor(v)
          slideIx = Math.min(ix, slides.length - 1)
          fillDialog(v)
          dlg.querySelector('#fleet-dlg-title').focus({ preventScroll: true })
        }
      }
      if (active && active.rebind) active.rebind()
    })

    startLayout()
    prewarmFlip()
    root.querySelector('[data-fleet-transmission]').addEventListener('change',filterGrid)
    root.querySelector('[data-fleet-sort]').addEventListener('change',filterGrid)

    document.addEventListener('prc:showcar', (e) => onShowCar(e.detail))
    window.__prcFleetReady = true
    const q = window.__prcShowCarQueue
    window.__prcShowCarQueue = []
    if (Array.isArray(q)) q.forEach((item) => onShowCar(item))

    refresh(0)
  } catch (err) {
    console.error('[fleet] init failed', err)
  }
}
