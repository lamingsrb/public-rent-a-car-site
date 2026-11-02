// ====================================
// i18n — EN lives in the markup, SR comes from i18n/sr/*.json
// ====================================
// Markup contract:
//   <h2 data-i18n="fleet.title">Our fleet</h2>              → textContent swap
//   <p data-i18n="hero.lead" data-i18n-html>…<br>…</p>       → innerHTML swap (key value may contain markup)
//   <button data-i18n-attr="aria-label:nav.menu;title:nav.menu">  → attribute swap(s)
//   <button data-lang-switch="sr">SR</button>                 → toggles language (aria-pressed managed here)
// Dictionaries: every i18n/sr/<section>.json is a flat {"section.key": "Srpski tekst"} map; all files are merged.
// Events: document dispatches `prc:langchange` ({detail:{lang}}) after every swap — modules that split text
// (SplitText) must revert + re-split on that event. Language is persisted in localStorage ("prc.lang").

const dictModules = import.meta.glob('../i18n/sr/*.json', { eager: true })
const SR = Object.assign({}, ...Object.values(dictModules).map((m) => m.default || m))

const STORAGE_KEY = 'prc.lang'
const SUPPORTED = ['en', 'sr']
const original = new WeakMap() // element → { html, attrs:{name:value} } captured before any swap/split

function store(el) {
  let s = original.get(el)
  if (!s) {
    s = { html: null, attrs: {} }
    original.set(el, s)
  }
  return s
}

function snapshot() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const s = store(el)
    if (s.html == null) s.html = el.innerHTML
  })
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    const s = store(el)
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr] = pair.split(':').map((x) => x.trim())
      if (attr && !(attr in s.attrs)) s.attrs[attr] = el.getAttribute(attr)
    })
  })
}

export function detectLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (SUPPORTED.includes(q)) return q
  } catch {}
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (SUPPORTED.includes(saved)) return saved
  } catch {}
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']
  return langs.some((l) => /^(sr|hr|bs|cnr|me|sh)\b/i.test(l)) ? 'sr' : 'en'
}

export function currentLang() {
  return (document.documentElement.lang || 'en').toLowerCase().startsWith('sr') ? 'sr' : 'en'
}

/** Translate a key for JS-generated strings; returns null when no SR value exists (caller falls back to EN). */
export function t(key, lang = currentLang()) {
  return lang === 'sr' && SR[key] != null ? SR[key] : null
}

function reflectSwitches(lang) {
  document.querySelectorAll('[data-lang-switch]').forEach((b) => {
    const on = b.dataset.langSwitch === lang
    b.setAttribute('aria-pressed', String(on))
    b.classList.toggle('is-active', on)
  })
}

export function applyLang(lang) {
  if (!SUPPORTED.includes(lang)) lang = 'en'
  snapshot() // capture any elements added since init (e.g. rendered fleet cards)
  const sr = lang === 'sr'
  const missing = []

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n
    const s = store(el)
    if (sr) {
      const v = SR[key]
      if (v == null) {
        missing.push(key)
        el.innerHTML = s.html
      } else if (el.hasAttribute('data-i18n-html')) {
        el.innerHTML = v
      } else {
        el.textContent = v
      }
    } else {
      el.innerHTML = s.html
    }
  })

  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    const s = store(el)
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((x) => x.trim())
      if (!attr || !key) return
      const v = sr ? SR[key] : null
      if (sr && v == null) missing.push(key)
      const val = v != null ? v : s.attrs[attr]
      if (val == null) el.removeAttribute(attr)
      else el.setAttribute(attr, val)
    })
  })

  document.documentElement.lang = sr ? 'sr-Latn' : 'en' // BCP-47: Serbian in Latin script (brief §5.0.3)
  reflectSwitches(lang)
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {}
  if (import.meta.env.DEV && missing.length) console.warn('[i18n] missing SR keys:', [...new Set(missing)])
  document.dispatchEvent(new CustomEvent('prc:langchange', { detail: { lang } }))
  return lang
}

export function initI18n() {
  snapshot()
  const lang = detectLang()
  if (lang === 'sr') {
    applyLang('sr')
  } else {
    document.documentElement.lang = 'en'
    reflectSwitches('en')
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-lang-switch]')
    if (!b) return
    e.preventDefault()
    const next = b.dataset.langSwitch
    if (SUPPORTED.includes(next) && next !== currentLang()) applyLang(next)
  })
  return lang
}

export const SR_DICT = SR
