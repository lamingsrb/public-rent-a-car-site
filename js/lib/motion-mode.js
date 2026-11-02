// ====================================
// motion-mode.js — decides html.mode-full | mode-lite | mode-static (+ is-static) BEFORE anything animates (brief §5.0.2)
// ====================================
// Exports: MODE ('full'|'lite'|'static'), storedMotionOff(), setMotionPref(on)  (writes prc.motion and reloads)
// Side effect on import: sets the html classes. The inline <head> script in index.html mirrors the static branch so the
// first paint is already static; this module is the source of truth (it also adds mode-lite / mode-full).
// static: prefers-reduced-motion OR localStorage prc.motion === "off"
// lite  : navigator.connection.saveData, deviceMemory <= 2, hardwareConcurrency <= 2, or sessionStorage['prc.lite'] === '1'
// full  : everything else
// Debug override (QA only, not persisted): ?mode=full|lite|static
const root = document.documentElement

export function storedMotionOff() {
  try {
    return localStorage.getItem('prc.motion') === 'off'
  } catch {
    return false
  }
}

function sessionLite() {
  try {
    return sessionStorage.getItem('prc.lite') === '1'
  } catch {
    return false
  }
}

function debugMode() {
  try {
    const m = new URLSearchParams(location.search).get('mode')
    return m === 'full' || m === 'lite' || m === 'static' ? m : null
  } catch {
    return null
  }
}

function detect() {
  const forced = debugMode()
  if (forced) return forced
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced || storedMotionOff()) return 'static'
  const c = navigator.connection
  const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2
  const lowMem = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2
  if ((c && c.saveData) || lowMem || lowCpu || sessionLite()) return 'lite'
  return 'full'
}

export const MODE = detect()

root.classList.remove('mode-full', 'mode-lite', 'mode-static', 'is-static')
root.classList.add('mode-' + MODE)
if (MODE === 'static') root.classList.add('is-static')

/** Motion toggle: persists the preference and reloads (documented trade-off, brief §5.0.2). */
export function setMotionPref(on) {
  try {
    if (on) localStorage.removeItem('prc.motion')
    else localStorage.setItem('prc.motion', 'off')
  } catch {}
  location.reload()
}
