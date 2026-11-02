// ====================================
// preloader.js — column draw-on + paper lift (brief 5.0.7)
// ====================================
// CORE: a paper overlay with the column glyph that fades out in <= 0.6 s. STRETCH (shipped here): DrawSVG stroke draw
// (0.9 s, stagger .06), hold .15, then the paper lifts with clip-path inset(0 0 100% 0) in 0.7 s.
// Release = window load + fonts ready + draw done, hard cap 2.4 s. Release sets html.is-ready and fires prc:preloaded
// (the cover intro waits for it). Skipped (removed on the first frame, still released) when: reduced motion, MODE != full,
// sessionStorage prc.seen, ?poster= or ?qa=1.
import '../css/preloader.css'
import { gsap, REDUCED, MODE, lockScroll } from './motion.js'
import { EASE } from './lib/motion-tokens.js'

const root = document.documentElement
const CAP_MS = 2400

function seen() {
  try {
    return sessionStorage.getItem('prc.seen') === '1'
  } catch {
    return false
  }
}
function markSeen() {
  try {
    sessionStorage.setItem('prc.seen', '1')
  } catch {
    /* private mode: the preloader simply runs again next load */
  }
}
function announce() {
  root.classList.add('is-ready')
  document.dispatchEvent(new CustomEvent('prc:preloaded'))
}

export function init() {
  const el = document.getElementById('preloader')
  const params = new URLSearchParams(location.search)
  const skip = REDUCED || MODE !== 'full' || seen() || params.has('poster') || params.get('qa') === '1'
  if (!el) {
    announce()
    return
  }
  if (skip) {
    el.remove()
    announce()
    return
  }

  lockScroll(true)
  let released = false
  let tl = null
  let cap = 0

  const finish = () => {
    el.remove()
    lockScroll(false)
  }

  const release = () => {
    if (released) return
    released = true
    clearTimeout(cap)
    markSeen()
    announce()
    try {
      if (tl) tl.kill()
      gsap.set(el.querySelectorAll('[data-p]'), { clearProps: 'strokeDasharray,strokeDashoffset' })
      gsap.to(el, { clipPath: 'inset(0 0 100% 0)', duration: 0.7, ease: EASE.inOut, onComplete: finish })
    } catch {
      el.classList.add('is-fading')
      setTimeout(finish, 600)
    }
  }

  const loaded = new Promise((res) => {
    if (document.readyState === 'complete') res()
    else window.addEventListener('load', res, { once: true })
  })
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve()
  const drawn = new Promise((res) => {
    try {
      const paths = el.querySelectorAll('[data-p]')
      const text = el.querySelector('.preloader__text')
      tl = gsap.timeline({ onComplete: res })
      tl.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.9, ease: 'power2.inOut', stagger: 0.06 }, 0)
      tl.fromTo(text, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: EASE.out }, 0.25)
      tl.to({}, { duration: 0.15 })
    } catch {
      res() // plugin missing: fall through to the plain lift
    }
  })

  cap = setTimeout(release, CAP_MS)
  Promise.all([loaded, fonts, drawn]).then(release)
}
