// ====================================
// main.js — boot order and debug entry points (contract 5.0.1)
// ====================================
// Order matters: motion-mode.js first (sets the html.mode-* classes before anything reads MODE), then i18n (snapshots EN, applies SR),
// then motion (Lenis), then the section inits, each isolated so one failure never blanks the page.
// Events: prc:preloaded (preloader released) -> prc:ready (everything inited, window.__prcReady = true). prc:langchange comes from i18n.js.
// Debug query params (QA only; none of them changes the normal page):
//   ?qa=1                       expose window.__prc, skip the preloader hold
//   ?lang=sr|en                 force the language (i18n.js detectLang)
//   ?mode=full|lite|static      force the motion mode (motion-mode.js)
//   ?stage=test&preset=day|dusk fixed full-viewport anchor with the column stage attached; window.__columnStage
//   ?poster=day|dusk            a 420x600 transparent #poster-root for baking column-poster-<preset>.webp; window.__posterReady
import '../css/fonts.css'
import '../css/tokens.css'
import '../css/base.css'
import './lib/motion-mode.js'
import { MODE } from './lib/motion-mode.js'
import { initI18n } from './i18n.js'
import { initMotion, gsap, ScrollTrigger } from './motion.js'
import { fillContactLinks, fillContactTexts } from './lib/contact.js'
import { initNavTheme } from './lib/nav-theme.js'
import { getColumnStage, getPosterRenderer } from './lib/column-stage.js'

import { init as initPreloader } from './preloader.js'
import { init as initNav } from './nav.js'
import { init as initCover } from './cover.js'
import { init as initFleet } from './fleet.js'
import { init as initContact } from './contact.js'
import { init as initFooter } from './footer.js'
import { init as initStickyBar } from './stickybar.js'
import { init as initRentalInfo } from './rental-info.js'
import '../css/redesign.css'
import '../css/compact-content.css'
import '../css/fleet-showroom.css'

const params = new URLSearchParams(location.search)
const root = document.documentElement

const INITS = [
  ['preloader', initPreloader],
  ['nav', initNav],
  ['cover', initCover],
  ['fleet', initFleet],
  ['rental-info', initRentalInfo],
  ['contact', initContact],
  ['footer', initFooter],
  ['stickybar', initStickyBar],
]

function runInits(list = INITS) {
  for (const [name, init] of list) {
    try {
      init()
    } catch (e) {
      console.error('[init]', name, e)
    }
  }
}

/** ?poster=day|dusk — one transparent 420x600 box, nothing else on the page, no section init. */
async function bootPoster(preset) {
  const style = document.createElement('style')
  style.textContent =
    'html,body{background:transparent!important;margin:0;overflow:hidden}' +
    'body>*:not(#poster-root):not(script){display:none!important}' +
    '#poster-root{position:fixed;left:0;top:0;width:420px;height:600px;background:transparent}' +
    '#poster-root canvas,#poster-root img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}'
  document.head.appendChild(style)
  const el = document.createElement('div')
  el.id = 'poster-root'
  document.body.appendChild(el)
  root.classList.add('is-ready')
  try {
    const render = await getPosterRenderer()
    if (render) {
      await render(preset, el)
    } else {
      const stage = await getColumnStage()
      stage.attach(el, preset)
      await stage.ready
    }
  } catch (e) {
    console.error('[poster]', e)
  }
  window.__posterReady = true
}

/** ?stage=test — fixed full-viewport anchor with the column stage attached (scene development and QA). */
async function bootStageTest(preset) {
  const el = document.createElement('div')
  el.id = 'stage-test'
  el.style.cssText = 'position:fixed;inset:0;z-index:var(--z-dialog);background:var(--paper)'
  document.body.appendChild(el)
  const stage = await getColumnStage()
  window.__columnStage = stage
  stage.attach(el, preset)
  await stage.ready
  try {
    stage.intro()
  } catch (e) {
    console.error('[stage]', e)
  }
}

initI18n()

if (params.has('poster')) {
  const preset = params.get('poster') === 'dusk' ? 'dusk' : 'day'
  bootPoster(preset)
} else {
  initMotion()
  // The first frame contains working navigation, the trip form and real imagery.
  // Yield before measuring and animating the below-fold catalogue and chapters.
  runInits(INITS.slice(0, 3))
  fillContactLinks()
  fillContactTexts()
  document.addEventListener('prc:langchange', () => { fillContactLinks(); fillContactTexts() })
  initNavTheme()
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
    runInits(INITS.slice(3))
    fillContactLinks()
    fillContactTexts()
    if (params.get('qa') === '1') window.__prc = { MODE, gsap, ScrollTrigger, getColumnStage }
    window.__prcReady = true
    document.dispatchEvent(new CustomEvent('prc:ready'))
    if (params.get('stage') === 'test') bootStageTest(params.get('preset') === 'dusk' ? 'dusk' : 'day')
  }, 0)))
}
