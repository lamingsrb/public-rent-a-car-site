import '../css/drive-cover.css'
import { MODE, REDUCED, scrollTo } from './motion.js'
import { t } from './i18n.js'
import { getVehicles, priceLabel, showCar } from './lib/vehicles.js'
const say = (key, en) => t(key) || en
export function init() {
  const root = document.getElementById('cover')
  if (!root) return
  const minCar=getVehicles().filter(v=>v.price_from_eur!=null).sort((a,b)=>a.price_from_eur-b.price_from_eur)[0]
  const paintPrice=()=>{
    root.querySelector('[data-hero-price]').textContent=priceLabel(minCar)
    root.querySelector('[data-karoq-price]').textContent=priceLabel(getVehicles().find(v=>v.id==='skoda-karoq'))
  }
  paintPrice();document.addEventListener('prc:langchange',paintPrice)
  const form = root.querySelector('[data-trip-form]')
  const from = form.elements.from, to = form.elements.to
  const error = form.querySelector('[data-trip-error]')
  let pendingTrip = null
  document.addEventListener('prc:ready', () => {
    if (pendingTrip) document.dispatchEvent(new CustomEvent('prc:tripchange', { detail: pendingTrip }))
    pendingTrip = null
  }, { once: true })
  const today = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Belgrade',calendar:'gregory',numberingSystem:'latn',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
    return ['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('-')
  }
  function setDates() { from.min = today(); to.min = from.value || today() }
  setDates()
  from.addEventListener('input', () => { setDates(); error.textContent = ''; from.setCustomValidity(''); to.setCustomValidity('') })
  to.addEventListener('input', () => { error.textContent = ''; to.setCustomValidity('') })
  form.addEventListener('submit', e => {
    e.preventDefault(); setDates()
    if (from.value < today() || to.value <= from.value) {
      const msg = say('cover.dateError','Choose a pick-up date from today and a later return date.')
      error.textContent = msg; to.setCustomValidity(msg); to.reportValidity(); return
    }
    to.setCustomValidity(''); error.textContent = ''
    const trip = {pickup:form.elements.pickup.value,dropoff:'same',from:from.value,to:to.value,pickupTime:'10:00',dropoffTime:'10:00'}
    if (!window.__prcReady) pendingTrip = trip
    document.dispatchEvent(new CustomEvent('prc:tripchange', {detail:trip}))
    const note = document.querySelector('[data-fleet-trip]')
    if (note) { note.hidden = false; note.textContent = say('cover.datesSelected','Dates saved. Choose your car to prepare an enquiry.') }
    const heading=document.getElementById('fleet-title');heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});scrollTo('#fleet',{duration:.7}); history.replaceState(null,'','#fleet')
  })
  document.addEventListener('prc:tripupdate', e => { const d=e.detail||{}; if(d.from!=null)from.value=d.from;if(d.to!=null)to.value=d.to;if(d.pickup&&[...form.elements.pickup.options].some(o=>o.value===d.pickup))form.elements.pickup.value=d.pickup;setDates() })
  const story = root.querySelector('[data-drive-story]')
  const stage = root.querySelector('[data-drive-stage]')
  const host = root.querySelector('[data-drive-scene]')
  const caption = root.querySelector('[data-scene-caption]')
  const acts = [...root.querySelectorAll('[data-drive-act]')]
  const stops = [0, .34, .67, 1]
  const buttons = [...root.querySelectorAll('[data-story-stop]')]
  let scene, progress = 0, chapter = 0, queued = 0, hasRenderedModel = false
  let staticStory = REDUCED || MODE !== 'full' || new URLSearchParams(location.search).get('scene') === 'poster'
  const setChapter = next => {
    chapter = next
    stage.dataset.chapter = String(next)
    acts.forEach((act, i) => {
      const current = i === next
      act.classList.toggle('is-current', current)
      act.setAttribute('aria-hidden', String(!current))
      act.inert = !current
    })
    buttons.forEach((button, i) => {
      if (i === next) button.setAttribute('aria-current', 'step')
      else button.removeAttribute('aria-current')
    })
  }
  function update() {
    queued = 0
    const rect = story.getBoundingClientRect()
    const span = Math.max(1, story.offsetHeight - stage.offsetHeight)
    progress = staticStory ? 0 : Math.max(0, Math.min(1, -rect.top / span))
    const next = progress < .19 ? 0 : progress < .49 ? 1 : progress < .80 ? 2 : 3
    if (next !== chapter) setChapter(next)
    stage.style.setProperty('--story-progress', progress.toFixed(4))
    scene?.setProgress(progress)
  }
  const onScroll = () => { if (!queued) queued = requestAnimationFrame(update) }
  addEventListener('scroll', onScroll, { passive:true })
  addEventListener('resize', onScroll, { passive:true })
  addEventListener('pageshow', onScroll)
  buttons.forEach((button, i) => button.addEventListener('click', () => {
    const y = story.getBoundingClientRect().top + window.scrollY + stops[i] * Math.max(1, story.offsetHeight-stage.offsetHeight)
    scrollTo(y, {duration:.8})
  }))
  root.querySelector('[data-story-car]').addEventListener('click', event => {
    event.preventDefault()
    showCar(event.currentTarget.dataset.storyCar, {open:true,source:'story'})
  })
  setChapter(0); update()
  const liveCaption = () => {
    caption.textContent = say('cover.sceneNote','Škoda Karoq · detailed 3D model (2019 version)')
    caption.removeAttribute('data-i18n')
  }
  const fallback = () => {
    host.classList.remove('is-live')
    caption.setAttribute('data-i18n','cover.photoNote')
    caption.textContent=say('cover.photoNote','Our Škoda Karoq · actual fleet photograph')
    if (!hasRenderedModel) {staticStory = true;root.classList.add('has-photo-story')}
    update()
  }
  if (new URLSearchParams(location.search).get('qa') === '1') {
    window.__prcDrive = { snapshot: () => ({progress,chapter,staticStory,storyHeight:story.offsetHeight,stageHeight:stage.offsetHeight,...(scene?.stats() || {})}) }
  }
  document.addEventListener('prc:langchange', () => {setDates();if(scene&&host.classList.contains('is-live'))liveCaption()})
  if (staticStory) {root.classList.add('has-photo-story');return}
  const load = async () => {
    try {
      const probe=document.createElement('canvas'), gl=probe.getContext('webgl2')
      if (!gl) return fallback()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      const { mountDriveScene } = await import('./lib/drive-scene.js')
      scene = await mountDriveScene(host, {
        onReady: () => {hasRenderedModel=true;staticStory=false;root.classList.remove('has-photo-story');host.classList.add('is-live');liveCaption();update()},
        onFallback: fallback,
      })
      if (!scene) return fallback()
      update()
      addEventListener('pagehide', event => {
        if (event.persisted) return
        removeEventListener('scroll',onScroll)
        removeEventListener('resize',onScroll)
        removeEventListener('pageshow',onScroll)
        scene.dispose()
      })
    } catch (error) {fallback();console.warn('[drive] Actual fleet photo fallback:',error.message)}
  }
  const defer = async () => {
    try {await host.querySelector('img')?.decode()} catch {}
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) requestIdleCallback(load,{timeout:1200})
      else setTimeout(load,0)
    }))
  }
  if ('IntersectionObserver' in window) {
    const io=new IntersectionObserver(entries => {if(entries.some(entry=>entry.isIntersecting)){io.disconnect();defer()}},{rootMargin:'120px'})
    io.observe(stage)
  } else defer()
}
