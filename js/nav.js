// ====================================
// nav.js — fixed glass nav, active link, hide-on-scroll, mobile menu dialog (brief 5.0.8)
// ====================================
// Events out: `prc:menutoggle` {detail:{open}} (sticky bar listens), html.is-menu-open while the menu is open.
// Theme flip is handled by lib/nav-theme.js (html[data-nav]); this module only owns behaviour.
// Hide on scroll: mm.add with the REDUCED guard (static mode = nav always visible). Active link / scrolled border / menu
// are not "motion" and work in every mode; the menu reveal is instant when REDUCED or MODE is static.
import '../css/nav.css'
import { gsap, ScrollTrigger, mm, REDUCED, MODE, lockScroll, scrollTo } from './motion.js'
import { EASE } from './lib/motion-tokens.js'
import { setMotionPref, storedMotionOff } from './lib/motion-mode.js'
import { tr } from './lib/tr.js'

const root = document.documentElement
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

let nav = null
let menu = null
let burger = null
let closeBtn = null
let menuOpen = false
let menuTween = null
let activeId = null

const animated = () => !REDUCED && MODE !== 'static'
const motionOn = () => !(storedMotionOff() || MODE === 'static')

/* ---------- Motion toggle ---------- */
function syncMotion() {
  const on = motionOn()
  const label = on ? tr('nav.motionOn', 'Motion: on') : tr('nav.motionOff', 'Motion: off')
  document.querySelectorAll('[data-motion-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', String(on))
    const txt = b.querySelector('.js-motion-text')
    if (txt) txt.textContent = label
    else {
      b.setAttribute('aria-label', label)
      b.setAttribute('title', label)
    }
  })
}

/* ---------- Active link ---------- */
function setActive(id) {
  if (id === activeId) return
  activeId = id
  document.querySelectorAll('[data-nav-link]').forEach((a) => {
    const on = a.dataset.navLink === id
    a.classList.toggle('is-active', on)
    if (on) a.setAttribute('aria-current', 'true')
    else a.removeAttribute('aria-current')
  })
}

function watchSections() {
  // The footer continues the contact back cover, so it keeps "Contact" lit.
  const alias = { footer: 'contact' }
  const ids = ['cover', 'fleet', 'route', 'price', 'atlas', 'terms', 'contact', 'footer']
  const els = ids.map((id) => document.getElementById(id)).filter(Boolean)
  if (!els.length || !('IntersectionObserver' in window)) return
  const idOf = (el) => alias[el.id] || el.id
  // A 1px band at 45% of the viewport: whichever section covers it is "current". IO is used instead of ScrollTrigger
  // positions because pinned sections (pin spacers) shift measured starts/ends.
  const io = new IntersectionObserver(
    (entries) => {
      entries.filter((e) => !e.isIntersecting && idOf(e.target) === activeId).forEach(() => setActive(null))
      entries.filter((e) => e.isIntersecting).forEach((e) => setActive(idOf(e.target)))
    },
    { rootMargin: '-45% 0px -55% 0px', threshold: 0 }
  )
  els.forEach((el) => io.observe(el))
}

/* ---------- Hide / show ---------- */
const showNav = () => nav && nav.classList.remove('is-hidden')
const hideNav = () => nav && nav.classList.add('is-hidden')

function initScrollState() {
  ScrollTrigger.create({
    id: 'nav-scrolled',
    start: 8,
    end: 'max',
    onToggle: (self) => nav.classList.toggle('is-scrolled', self.isActive),
  })
  nav.classList.toggle('is-scrolled', window.scrollY > 8)

  mm.add({ desktop: '(min-width: 1024px)', mobile: '(max-width: 1023px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
    const { reduce } = ctx.conditions
    if (REDUCED || reduce || MODE === 'static') {
      showNav()
      return
    }
    let lastY = window.scrollY
    let up = 0
    const st = ScrollTrigger.create({
      id: 'nav-hide',
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const y = self.scroll()
        const dy = y - lastY
        lastY = y
        if (menuOpen || y <= 120) {
          up = 0
          showNav()
          return
        }
        if (dy > 0) {
          up = 0
          hideNav()
        } else if (dy < 0) {
          up += -dy
          if (up > 8) showNav()
        }
      },
    })
    const onFocusIn = () => showNav()
    nav.addEventListener('focusin', onFocusIn)
    return () => {
      st.kill()
      nav.removeEventListener('focusin', onFocusIn)
      showNav()
    }
  })
}

/* ---------- Mobile menu ---------- */
function trapKeys(e) {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeMenu()
    return
  }
  if (e.key !== 'Tab') return
  const items = [...menu.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && (document.activeElement === first || !menu.contains(document.activeElement))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (document.activeElement === last || !menu.contains(document.activeElement))) {
    e.preventDefault()
    first.focus()
  }
}

function emitMenu(open) {
  root.classList.toggle('is-menu-open', open)
  document.dispatchEvent(new CustomEvent('prc:menutoggle', { detail: { open } }))
}

function openMenu() {
  if (menuOpen) return
  menuOpen = true
  if (menuTween) menuTween.kill()
  menu.hidden = false
  burger.setAttribute('aria-expanded', 'true')
  showNav()
  lockScroll(true)
  emitMenu(true)

  const r = burger.getBoundingClientRect()
  const cx = Math.round(r.left + r.width / 2)
  const cy = Math.round(r.top + r.height / 2)
  const R = Math.ceil(Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy)))
  const items = menu.querySelectorAll('.menu__links a, .menu__foot > *')
  if (animated()) {
    menuTween = gsap.timeline({ onComplete: () => gsap.set(menu, { clearProps: 'clipPath' }) })
    menuTween.fromTo(menu, { clipPath: `circle(0px at ${cx}px ${cy}px)` }, { clipPath: `circle(${R}px at ${cx}px ${cy}px)`, duration: 0.5, ease: EASE.inOut }, 0)
    menuTween.fromTo(items, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: EASE.out, stagger: 0.04, clearProps: 'transform,opacity' }, 0.18)
  }
  menu.addEventListener('keydown', trapKeys)
  closeBtn.focus({ preventScroll: true })
}

function closeMenu({ restoreFocus = true, instant = false } = {}) {
  if (!menuOpen) return
  menuOpen = false
  menu.removeEventListener('keydown', trapKeys)
  burger.setAttribute('aria-expanded', 'false')
  lockScroll(false)
  emitMenu(false)
  if (menuTween) menuTween.kill()
  const done = () => {
    menu.hidden = true
    gsap.set(menu, { clearProps: 'clipPath' })
    gsap.set(menu.querySelectorAll('.menu__links a, .menu__foot > *'), { clearProps: 'transform,opacity' })
  }
  if (animated() && !instant) {
    const r = burger.getBoundingClientRect()
    const cx = Math.round(r.left + r.width / 2)
    const cy = Math.round(r.top + r.height / 2)
    const R = Math.ceil(Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy)))
    menuTween = gsap.fromTo(menu, { clipPath: `circle(${R}px at ${cx}px ${cy}px)` }, { clipPath: `circle(0px at ${cx}px ${cy}px)`, duration: 0.4, ease: EASE.inOut, onComplete: done })
  } else {
    done()
  }
  if (restoreFocus) {
    burger.focus({ preventScroll: true })
  }
}

function initMenu() {
  burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()))
  closeBtn.addEventListener('click', () => closeMenu())
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]')
    if (!a) return
    e.preventDefault()
    const hash = a.getAttribute('href')
    closeMenu({ restoreFocus: false })
    const target = document.querySelector(hash)
    if (target) {
      scrollTo(target)
      try {
        history.replaceState(null, '', hash)
      } catch {
        /* sandboxed frame: the scroll already happened */
      }
    }
  })
  // Leaving the phone layout while the menu is open (rotation, resize): close it without animation.
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
    if (e.matches) closeMenu({ restoreFocus: false, instant: true })
  })
}

/* ---------- init ---------- */
export function init() {
  nav = document.getElementById('nav')
  menu = document.getElementById('menu')
  if (!nav) return
  burger = nav.querySelector('.nav__burger')
  closeBtn = menu && menu.querySelector('.menu__close')

  syncMotion()
  document.addEventListener('prc:langchange', syncMotion)
  document.querySelectorAll('[data-motion-toggle]').forEach((b) => b.addEventListener('click', () => setMotionPref(!motionOn())))

  watchSections()
  initScrollState()
  if (menu && burger && closeBtn) initMenu()
}
