// ====================================
// footer.js — colophon (brief 5.10)
// ====================================
// Fills the printed contact values from CONTACT (never typed in markup), the © year line (runtime: footer.legal carries {year}),
// the Reduce-motion switch (persisted through setMotionPref, which reloads) and Back to top (Lenis scroll, instant in static).
// The dusk column (moved from contact.js on 2026-11-01): initStage attaches the shared column stage to [data-footer-stage].
import '../css/footer.css'
import { scrollTo, REDUCED } from './motion.js'
import { setMotionPref, storedMotionOff } from './lib/motion-mode.js'
import { initReveals } from './lib/reveal.js'
import { getColumnStage } from './lib/column-stage.js'
import { CONTACT } from './lib/contact.js'
import { tr, fmt } from './lib/tr.js'

function instagramHandle() {
  try {
    const seg = new URL(CONTACT.instagram).pathname.split('/').filter(Boolean)[0]
    return seg ? '@' + seg : ''
  } catch {
    return ''
  }
}

const TEXT_OF = {
  tel: () => CONTACT.telDisplay,
  wa: () => CONTACT.telDisplay,
  viber: () => CONTACT.telDisplay,
  telegram: () => CONTACT.telDisplay,
  mail: () => CONTACT.email,
  instagram: instagramHandle,
}

function fillTexts(root) {
  root.querySelectorAll('[data-contact-text]').forEach((el) => {
    const fn = TEXT_OF[el.dataset.contactText]
    if (fn) el.textContent = fn()
  })
}

function renderLegal(root) {
  const el = root.querySelector('[data-footer-legal]')
  if (el) el.textContent = fmt(tr('footer.legal', '© {year} Public Rent a Car'), { year: new Date().getFullYear() })
}

function initMotionSwitch(root) {
  const btn = root.querySelector('#footer-motion')
  if (!btn) return
  const osReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const stored = storedMotionOff()
  const reduced = osReduced || stored || REDUCED
  const state = btn.querySelector('[data-state]')
  const paint = () => {
    btn.setAttribute('aria-checked', String(reduced))
    if (state) state.textContent = reduced ? tr('common.yes') : tr('common.no')
  }
  paint()
  document.addEventListener('prc:langchange', paint)
  if (osReduced && !stored) {
    // the operating system already asks for reduced motion; the site follows it and the switch cannot override that
    btn.setAttribute('aria-disabled', 'true')
    return
  }
  btn.addEventListener('click', () => setMotionPref(stored)) // stored off -> turn motion on; otherwise -> turn it off
}

function initTop(root) {
  const a = root.querySelector('[data-footer-top]')
  if (!a) return
  a.addEventListener('click', (e) => {
    e.preventDefault()
    if (REDUCED) window.scrollTo(0, 0)
    else scrollTo(0, { offset: 0, duration: 1.4 })
  })
}

/** Dusk column: attach the shared stage once the footer is within 20% of the viewport (one-shot; the live stage keeps
 *  its own IntersectionObserver and visibilitychange handler for pause/resume, the poster stage needs nothing). */
function initStage(root) {
  const anchor = root.querySelector('[data-footer-stage]')
  if (!anchor || !('IntersectionObserver' in window)) return
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      getColumnStage()
        .then((s) => {
          try {
            s.attach(anchor, 'dusk')
            if (!s.poster && typeof s.intro === 'function') s.intro()
          } catch (err) {
            console.warn('[footer] stage attach failed', err)
          }
        })
        .catch((err) => console.warn('[footer] stage unavailable', err))
    },
    { rootMargin: '20% 0px' },
  )
  io.observe(root)
}

export function init() {
  const root = document.getElementById('footer')
  if (!root) return
  fillTexts(root)
  renderLegal(root)
  document.addEventListener('prc:langchange', () => renderLegal(root))
  initMotionSwitch(root)
  initTop(root)
  // The car studio is the single WebGL scene; footer keeps its static brand mark.
  initReveals(root)
}
