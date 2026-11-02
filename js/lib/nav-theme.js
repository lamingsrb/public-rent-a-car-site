// ====================================
// nav-theme.js — nav colour flip (brief §5.0.8)
// ====================================
// Exports: setNavTheme('light' | 'dark' | null), getNavTheme(), initNavTheme()
// The nav styles itself from html[data-nav="light|dark"]. Automatic mode: the [data-nav-theme] section that covers the nav's
// bottom edge wins (IntersectionObserver on a 1px line at the nav bottom). setNavTheme('dark'|'light') OVERRIDES the automatic
// value (cover.js uses it during the arrival plate); setNavTheme(null) hands control back to automatic.
// initNavTheme() is idempotent; main.js calls it once. Default value before any section reports: "light".
const root = document.documentElement
let auto = 'light'
let override = null
let io = null
let started = false
let lastH = -1

function apply() {
  root.setAttribute('data-nav', override || auto)
}

export function setNavTheme(theme) {
  override = theme === 'light' || theme === 'dark' ? theme : null
  apply()
}

export function getNavTheme() {
  return override || auto
}

function navHeight() {
  return window.innerWidth >= 1024 ? 76 : 64
}

function observe() {
  if (io) io.disconnect()
  const h = navHeight()
  lastH = h
  const vh = window.innerHeight
  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          auto = e.target.getAttribute('data-nav-theme') === 'dark' ? 'dark' : 'light'
          apply()
        }
      })
    },
    { rootMargin: `-${h}px 0px -${Math.max(0, vh - h - 1)}px 0px`, threshold: 0 }
  )
  document.querySelectorAll('[data-nav-theme]').forEach((s) => io.observe(s))
}

export function initNavTheme() {
  if (started) return
  started = true
  apply()
  if (!('IntersectionObserver' in window)) return
  observe()
  let t = 0
  window.addEventListener('resize', () => {
    clearTimeout(t)
    t = setTimeout(() => {
      observe()
    }, 150)
  })
}
