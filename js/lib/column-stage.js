// ====================================
// column-stage.js — the ONLY module sections import for the 3D column (brief §4.1.1, §6.1)
// ====================================
// Exports: getColumnStage()  -> memoised Promise of the stage, NEVER null/undefined.
//          hasWebGL()        -> cached feature test (throw-away canvas)
//          getPosterRenderer() -> Promise of the scene's renderPoster(preset) or null (only main.js uses it, for ?poster=day|dusk)
// Stage shape: { attach(el, preset), detach(), intro(), setProgress(p), setTilt(x, y), pause(), resume(), refreshColors(), dispose(), ready }
//   preset: 'day' | 'dusk'.  ready: Promise, resolves after the first rendered frame ({ poster: true } for the poster-only stage).
// Load rule: js/lib/scene-column.js (slot G, default export createColumnStage()) is imported dynamically inside
//   requestIdleCallback({ timeout: 1200 }) and only when MODE === 'full' and WebGL is available. In lite/static, without WebGL,
//   when scene-column.js is missing or throws, the promise resolves a POSTER-ONLY stage: same API, no-ops, and attach() makes sure
//   the anchor shows the poster <img> (an existing img.cover__poster, otherwise a decorative <img> of /assets/img/column-poster-<preset>.webp).
// import.meta.glob keeps the build green while scene-column.js does not exist yet.
import { MODE } from './motion-mode.js'

const loaders = import.meta.glob('./scene-column.js')

// Gate H1 / G0 (docs/DECISIONS.md D-11, Lazar 2026-10-31): the live Three scene ships ON ("3D cinematic"). The governor in scene-column.js
// still degrades the level 0->3 on slow frames and the poster stays underneath as the fallback; ?scene=poster forces the posters.
const SCENE_LIVE = true
function sceneWanted() {
  let q = ''
  try { q = location.search } catch { q = '' }
  if (/[?&]scene=poster(&|$)/.test(q)) return false
  if (SCENE_LIVE) return true
  return /[?&](scene=live|stage=test)(&|$)/.test(q)
}
let promise = null
let glCache = null

export function hasWebGL() {
  if (glCache !== null) return glCache
  try {
    const c = document.createElement('canvas')
    glCache = !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch {
    glCache = false
  }
  return glCache
}

function posterSrc(preset) {
  return `/assets/img/column-poster-${preset === 'dusk' ? 'dusk' : 'day'}.webp`
}

function makePosterStage() {
  let anchor = null
  const stage = {
    poster: true,
    ready: Promise.resolve({ poster: true }),
    attach(el, preset = 'day') {
      anchor = el || null
      if (!anchor) return
      let img = anchor.querySelector('img.cover__poster, img.column-poster')
      if (!img) {
        img = document.createElement('img')
        img.className = 'column-poster'
        img.alt = ''
        img.setAttribute('aria-hidden', 'true')
        img.width = 420
        img.height = 600
        img.decoding = 'async'
        anchor.appendChild(img)
      }
      img.src = posterSrc(preset)
      anchor.classList.remove('is-live')
    },
    detach() {
      anchor = null
    },
    owns(el) {
      return !!el && anchor === el
    },
    intro() {},
    setProgress() {},
    setTilt() {},
    pause() {},
    resume() {},
    refreshColors() {},
    dispose() {},
  }
  return stage
}

/** ?poster=day|dusk only (main.js): the scene's renderPoster(preset) export, or null when scene-column.js is absent / lacks it. */
export async function getPosterRenderer() {
  const load = loaders['./scene-column.js']
  if (!load) return null
  try {
    const mod = await load()
    return typeof mod.renderPoster === 'function' ? mod.renderPoster : null
  } catch (e) {
    console.warn('[column-stage] renderPoster unavailable:', e && e.message ? e.message : e)
    return null
  }
}

function idle(fn) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 1200 })
  else setTimeout(fn, 200)
}

export function getColumnStage() {
  if (promise) return promise
  promise = new Promise((resolve) => {
    const fallback = (why) => {
      if (why) console.warn('[column-stage] poster-only:', why)
      resolve(makePosterStage())
    }
    if (MODE !== 'full' || !sceneWanted() || !hasWebGL()) return fallback(null)
    const load = loaders['./scene-column.js']
    if (!load) return fallback(null)
    idle(async () => {
      try {
        const mod = await load()
        const create = mod.default || mod.createColumnStage
        if (typeof create !== 'function') return fallback('scene-column.js has no createColumnStage')
        const real = await create()
        if (!real || typeof real.attach !== 'function') return fallback('scene-column.js returned no stage')
        const base = makePosterStage()
        const stage = Object.assign(base, real, { poster: false })
        if (!stage.ready) stage.ready = Promise.resolve({ poster: false })
        window.addEventListener('pagehide', () => {
          try {
            stage.dispose()
          } catch {}
        })
        resolve(stage)
      } catch (e) {
        fallback(e && e.message ? e.message : String(e))
      }
    })
  })
  return promise
}
