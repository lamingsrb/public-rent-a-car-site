// ====================================
// motion.js — shared motion runtime: GSAP + ScrollTrigger + Lenis smooth scroll
// ====================================
// Every section module imports { gsap, ScrollTrigger, REDUCED, IS_TOUCH, mm } from here — never registers
// plugins or creates its own Lenis. Rules:
//   • REDUCED (prefers-reduced-motion) → no smooth scroll, no pinning; modules must show final states statically.
//   • Use `mm` (gsap.matchMedia) for desktop/mobile variants: mm.add({ desktop: '(min-width: 1024px)', mobile: '(max-width: 1023px)', reduce: '(prefers-reduced-motion: reduce)' }, ctx => {...})
//   • `window.__lenis` and `window.ScrollTrigger` are exposed for the QA script (scripts/qa_shots.py).
//   • Call `refresh()` after injecting content (fleet cards, language swap) instead of ScrollTrigger.refresh() directly.
// Extended for PRC (brief §5.0.1, §7.4): SplitText / DrawSVGPlugin / MotionPathPlugin / CustomEase are registered here and
// re-exported (Flip is NOT: fleet.js registers it lazily); REDUCED also honours the Motion toggle (localStorage prc.motion=off);
// `MODE` ('full'|'lite'|'static') mirrors the html class set by lib/motion-mode.js; `registerLangRebuild(fn)` re-runs measured
// layout after a language swap. Every existing export is kept.
import './lib/motion-mode.js' // sets html.mode-* before anything below reads it (idempotent)
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { CustomEase } from 'gsap/CustomEase'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin, CustomEase)
ScrollTrigger.normalizeScroll(false) // explicitly off: it fights Lenis

function storedMotionOff() {
  try {
    return localStorage.getItem('prc.motion') === 'off'
  } catch {
    return false
  }
}

export const MODE = document.documentElement.classList.contains('mode-static')
  ? 'static'
  : document.documentElement.classList.contains('mode-lite')
    ? 'lite'
    : 'full'
export const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches || storedMotionOff() || MODE === 'static'
export const IS_TOUCH = window.matchMedia('(hover: none), (pointer: coarse)').matches
export const IS_SMALL = window.matchMedia('(max-width: 767px)').matches
export const mm = gsap.matchMedia()
export let lenis = null

let refreshTimer = 0
export function refresh(delay = 120) {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => ScrollTrigger.refresh(), delay)
}

export function initMotion() {
  ScrollTrigger.config({ ignoreMobileResize: true })
  if (!REDUCED) {
    lenis = new Lenis({
      lerp: IS_TOUCH ? 0.14 : 0.11, // D-11: snappier smooth scroll
      smoothWheel: true,
      syncTouch: false, // native touch scrolling on phones — smoother and cheaper
      anchors: { offset: 0 }, // in-page links scroll below the fixed nav: Lenis already subtracts the target's scroll-margin-top (nav-h + 8)
    })
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((time) => lenis.raf(time * 1000))
    gsap.ticker.lagSmoothing(0)
    window.__lenis = lenis
  }
  window.ScrollTrigger = ScrollTrigger
  window.gsap = gsap
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => refresh(0))
  window.addEventListener('load', () => refresh(0))
  document.addEventListener('prc:langchange', () => refresh(200))
  return lenis
}

/** Re-run measured layout (SplitText lines, track widths, slot rects) after a language swap: waits for fonts, then refreshes. */
export function registerLangRebuild(fn) {
  document.addEventListener('prc:langchange', async () => {
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready
      fn()
    } catch (e) {
      console.error('[langRebuild]', e)
    }
    refresh(0)
  })
}

/** Smooth-scroll to an element/selector/number; respects reduced motion. */
// offset defaults to 0: Lenis subtracts the target's CSS scroll-margin-top (nav-h + 8 on every [id]), so a further -72 double-counted (sections landed at 156 px)
export function scrollTo(target, { offset = 0, duration = 1.2 } = {}) {
  if (lenis) lenis.scrollTo(target, { offset, duration })
  else {
    const el = typeof target === 'string' ? document.querySelector(target) : target
    const y = typeof target === 'number' ? target : el ? el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) + offset : 0
    window.scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' })
  }
}

/** Stop/start smooth scroll (e.g. while the mobile menu is open). */
export function lockScroll(locked) {
  if (lenis) locked ? lenis.stop() : lenis.start()
  document.documentElement.classList.toggle('is-locked', locked)
}

export { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin, CustomEase }
