// ====================================
// atlas.js — section 07 "Locations" (slot E, brief 5.7)
// ====================================
// Data: PLACES is the only place addresses / pin positions / Maps links are defined. SR display names come from i18n (atlas.place.*).
//   {{DOBRACINA_NO}} is replaced at build time (vite.config.js); empty by default, so the name is trimmed before use.
// Branches (brief 7.6), exclusive:
//   static (REDUCED | lite | static mode | stage does not fit the viewport) -> diagram fully drawn, cards stacked, nothing animates
//   desktop && full  -> pin 1.0 vh (ScrollTrigger id atlas-pin): three steps (pin drops, route draws, card activates)
//   mobile  && full  -> no pin; diagram drawn once on entry (1.2 s, once), cards fade up
// Interactions (all modes): card hover/focus highlights its pin; tapping a pin focuses + scrolls to its card.
import '../css/atlas.css'
import { mm, gsap, ScrollTrigger, REDUCED, MODE, scrollTo, registerLangRebuild } from './motion.js'
import { initReveals } from './lib/reveal.js'
import { DUR, EASE } from './lib/motion-tokens.js'
import { contactLinks } from './lib/contact.js'
import { tr } from './lib/tr.js'

export const PLACES = [
  {
    id: 'airport',
    x: 210,
    y: 170,
    name: 'Belgrade Nikola Tesla Airport',
    maps: 'https://www.google.com/maps/search/?api=1&query=Belgrade+Nikola+Tesla+Airport',
  },
  {
    id: 'milosa',
    x: 640,
    y: 430,
    name: 'Kneza Miloša 14, Belgrade',
    maps: 'https://www.google.com/maps/search/?api=1&query=Kneza+Milosa+14+Belgrade',
  },
  {
    id: 'dobracina',
    x: 960,
    y: 520,
    name: 'Dobračina, Belgrade {{DOBRACINA_NO}}',
    maps: null, // CLIENT-CONFIRM: no Maps link until the street number is confirmed (brief 11.2)
  },
]

const SHOW_UNCONFIRMED = import.meta.env.VITE_SHOW_UNCONFIRMED === '1'
const VB_W = 1200
const VB_H = 720

/** Display name for a place in the current language, whitespace-normalised (the empty number token leaves a trailing space). */
function placeName(p) {
  return tr('atlas.place.' + p.id, p.name).replace(/\s+/g, ' ').trim()
}

function navOffset() {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h-lg'))
  return Number.isFinite(v) ? v : 76
}

function cardOf(root, id) {
  return root.querySelector(`.atlas__card[data-place="${id}"]`)
}
function pinOf(root, id) {
  return root.querySelector(`.atlas__pin[data-place="${id}"]`)
}

/** Positions from PLACES, Ask/Maps hrefs, dev badge. Safe to call again after a language swap. */
function wireData(root) {
  PLACES.forEach((p) => {
    const pin = pinOf(root, p.id)
    if (pin) {
      pin.style.setProperty('--x', ((p.x / VB_W) * 100).toFixed(3) + '%')
      pin.style.setProperty('--y', ((p.y / VB_H) * 100).toFixed(3) + '%')
    }
    const card = cardOf(root, p.id)
    if (!card) return
    const ask = card.querySelector('[data-ask]')
    if (ask) {
      // not data-contact: fillContactLinks() would overwrite this with a blank {pickup}
      ask.setAttribute('href', contactLinks('location', { pickup: placeName(p) }).wa)
      ask.setAttribute('target', '_blank')
      ask.setAttribute('rel', 'noopener')
    }
    const maps = card.querySelector('[data-maps]')
    if (maps) {
      if (p.maps) {
        maps.setAttribute('href', p.maps)
        maps.setAttribute('target', '_blank')
        maps.setAttribute('rel', 'noopener')
      } else {
        maps.remove()
      }
    }
    if (SHOW_UNCONFIRMED && !p.maps) {
      let badge = card.querySelector('.atlas__badge')
      if (!badge) {
        badge = document.createElement('span')
        badge.className = 'chip atlas__badge'
        card.querySelector('.atlas__card-head')?.after(badge)
      }
      badge.textContent = tr('atlas.confirmBadge', 'address number to confirm')
    }
  })
}

function setActive(root, id) {
  root.querySelectorAll('.atlas__card').forEach((c) => c.classList.toggle('is-active', c.dataset.place === id))
}

function wireInteractions(root) {
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  PLACES.forEach((p) => {
    const pin = pinOf(root, p.id)
    const card = cardOf(root, p.id)
    if (!pin || !card) return
    const on = () => pin.classList.add('is-hot')
    const off = () => pin.classList.remove('is-hot')
    card.addEventListener('focusin', on)
    card.addEventListener('focusout', off)
    if (canHover) {
      card.addEventListener('pointerenter', on)
      card.addEventListener('pointerleave', off)
    }
    pin.addEventListener('click', () => {
      setActive(root, p.id)
      card.focus({ preventScroll: true })
      const r = card.getBoundingClientRect()
      if (r.top < navOffset() + 8 || r.bottom > window.innerHeight - 12) scrollTo(card, { offset: -(navOffset() + 24) })
    })
  })
}

/** Clear every inline start state script set, make sure the diagram is fully drawn. */
function showStaticState(root) {
  root.classList.add('is-static')
  gsap.set(root.querySelectorAll('.atlas__dot, .atlas__pin-n, .atlas__mask, .atlas__traveller, .atlas__card'), { clearProps: 'all' })
}

function parts(root) {
  return {
    stage: root.querySelector('.atlas__pinbox'),
    map: root.querySelector('[data-atlas-map]'),
    dots: gsap.utils.toArray('.atlas__dot', root),
    nums: gsap.utils.toArray('.atlas__pin-n', root),
    masks: gsap.utils.toArray('.atlas__mask', root),
    travellers: gsap.utils.toArray('.atlas__traveller', root),
    cards: gsap.utils.toArray('.atlas__card', root),
  }
}

// ---- desktop: pinned three-step timeline (STRETCH) ----
// the map SVG is preserveAspectRatio=none (from 1024 px the box follows the card list: 540x841 at 1024, 763x661 at 1440), so a
// circle in user units renders as an ellipse. Each traveller gets the radii that come out as a 6 px round dot in the current box;
// re-fitted on every ScrollTrigger refresh, which is where resizes land (review 2026-11-01).
const TRAVELLER_PX = 6
function fitTravellers(map, travellers) {
  if (!map || !travellers.length) return
  const r = map.getBoundingClientRect()
  if (!(r.width > 0 && r.height > 0)) return
  const svg = map.querySelector('.atlas__svg')
  const vb = svg && svg.viewBox && svg.viewBox.baseVal
  const vw = (vb && vb.width) || 1200
  const vh = (vb && vb.height) || 720
  const rx = ((TRAVELLER_PX * vw) / r.width).toFixed(2)
  const ry = ((TRAVELLER_PX * vh) / r.height).toFixed(2)
  travellers.forEach((t) => {
    t.setAttribute('rx', rx)
    t.setAttribute('ry', ry)
  })
}

function buildPinned(root, ids) {
  const { stage, map, dots, nums, masks, travellers, cards } = parts(root)
  const fit = () => fitTravellers(map, travellers)
  fit()
  ScrollTrigger.addEventListener('refresh', fit)
  gsap.set(dots, { opacity: 0, scale: 0.6, y: -34 })
  gsap.set(nums, { opacity: 0 })
  gsap.set(masks, { drawSVG: '0% 0%' })
  gsap.set(cards, { clearProps: 'opacity' })
  setActive(root, ids[0])

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
  const drop = (i, at) => {
    tl.to(dots[i], { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(2)' }, at)
    tl.to(nums[i], { opacity: 1, duration: 0.2 }, at + 0.2)
  }
  const route = (i, at) => {
    tl.to(masks[i], { drawSVG: '0% 100%', duration: 0.8 }, at)
    tl.to(travellers[i], { opacity: 1, duration: 0.06 }, at)
    tl.to(
      travellers[i],
      { motionPath: { path: `#atlas-solid-${i + 1}`, align: `#atlas-solid-${i + 1}`, alignOrigin: [0.5, 0.5] }, duration: 0.8 },
      at,
    )
    tl.to(travellers[i], { opacity: 0, duration: 0.1 }, at + 0.8)
  }
  drop(0, 0)
  route(0, 1)
  drop(1, 1.6)
  route(1, 2)
  drop(2, 2.6)
  tl.set({}, {}, 3) // timeline length = 3 (three steps of one third each)

  let last = ids[0]
  ScrollTrigger.create({
    id: 'atlas-pin',
    trigger: stage,
    start: () => 'top top+=' + navOffset(),
    end: () => '+=' + window.innerHeight,
    pin: true,
    pinSpacing: true,
    anticipatePin: 1,
    scrub: 0.35,
    animation: tl,
    refreshPriority: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      const id = ids[Math.min(ids.length - 1, Math.floor(self.progress * ids.length))]
      if (id !== last) {
        last = id
        setActive(root, id)
      }
    },
  })
  return () => ScrollTrigger.removeEventListener('refresh', fit)
}

// ---- mobile / tablet: no pin; drawn once on entry (1.2 s) ----
function buildDrawOnce(root) {
  const { map, dots, nums, masks, cards } = parts(root)
  gsap.set(dots, { opacity: 0, scale: 0.6, y: -20 })
  gsap.set(nums, { opacity: 0 })
  gsap.set(masks, { drawSVG: '0% 0%' })
  gsap.set(cards, { opacity: 0, y: 24 })

  const tl = gsap.timeline({ paused: true })
  const drop = (i, at) => {
    tl.to(dots[i], { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: EASE.out }, at)
    tl.to(nums[i], { opacity: 1, duration: 0.2 }, at + 0.15)
  }
  drop(0, 0)
  tl.to(masks[0], { drawSVG: '0% 100%', duration: 0.5, ease: 'none' }, 0.2)
  drop(1, 0.6)
  tl.to(masks[1], { drawSVG: '0% 100%', duration: 0.4, ease: 'none' }, 0.7)
  drop(2, 0.95)
  tl.set({}, {}, 1.2)

  ScrollTrigger.create({ id: 'atlas-draw', trigger: map, start: 'top 82%', once: true, onEnter: () => tl.play() })
  ScrollTrigger.batch(cards, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: DUR.reveal, ease: EASE.out, stagger: 0.1, clearProps: 'opacity,transform' }),
  })
}

export function init() {
  const root = document.getElementById('atlas')
  if (!root) return
  try {
    wireData(root)
    wireInteractions(root)
    initReveals(root)
    registerLangRebuild(() => wireData(root))

    const ids = PLACES.map((p) => p.id)
    mm.add(
      { desktop: '(min-width: 1024px)', mobile: '(max-width: 1023.98px)', reduce: '(prefers-reduced-motion: reduce)' },
      (ctx) => {
        const { desktop, reduce } = ctx.conditions
        if (REDUCED || reduce || MODE !== 'full') {
          showStaticState(root)
          return
        }
        if (desktop) {
          const box = root.querySelector('.atlas__stage')
          if (box && box.offsetHeight > window.innerHeight - navOffset()) {
            showStaticState(root) // short viewport: the stage would not fit while pinned
            return
          }
          const unfit = buildPinned(root, ids)
          return () => {
            unfit()
            root.querySelectorAll('.atlas__card').forEach((c) => c.classList.remove('is-active'))
          }
        }
        buildDrawOnce(root)
      },
    )
  } catch (e) {
    console.error('[atlas]', e)
  }
}
